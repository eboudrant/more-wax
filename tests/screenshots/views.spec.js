// @ts-check
const { test, expect } = require('@playwright/test');
const { mockApi } = require('./fixtures');

// ── Helper: wait for the collection to load ────────────────────
async function waitForCollection(page) {
  // The app fetches /api/collection on load; wait for the grid to render
  await page.waitForFunction(
    () => typeof collection !== 'undefined' && collection.length > 0,
    { timeout: 8_000 }
  ).catch(() => {
    // Collection may be empty — that's fine for some tests
  });
  // Let any CSS transitions / Tailwind JIT settle
  await page.waitForTimeout(500);
}

/** True when viewport width >= 768px (Tailwind md: breakpoint). */
function isDesktop(page) {
  return page.viewportSize().width >= 768;
}

// ─────────────────────────────────────────────────────────────────
//  DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test('renders correctly', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#view-dashboard')).toBeVisible();

    // Bottom nav is md:hidden — only visible on mobile
    if (!isDesktop(page)) {
      await expect(page.locator('#bottom-nav')).toBeVisible();
    }

    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('shows total pressings count', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    const count = page.locator('#dash-count');
    await expect(count).toBeVisible();
    await expect(count).toHaveText(/\d+/);
  });
});

// ─────────────────────────────────────────────────────────────────
//  COLLECTION VIEW
// ─────────────────────────────────────────────────────────────────

test.describe('Collection', () => {
  test('renders grid', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    await expect(page.locator('#view-collection')).toBeVisible();
    await expect(page).toHaveScreenshot('collection.png');
  });

  test('filter input is visible', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    await expect(page.locator('#filter-input')).toBeVisible();
  });

  test('sort dropdown defaults to Recently Added', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    const sort = page.locator('#sort-select');
    await expect(sort).toBeVisible();
    await expect(sort).toHaveValue('added');
  });
});

// ─────────────────────────────────────────────────────────────────
//  SCANNER VIEW
// ─────────────────────────────────────────────────────────────────

test.describe('Scanner', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.evaluate(() => openScanner());
    await page.waitForTimeout(600);
  });

  test('opens in barcode mode', async ({ page }) => {
    await expect(page.locator('#view-scanner')).toBeVisible();
    await expect(page.locator('#scanner-guidance')).toContainText(/barcode/i);
    await expect(page.locator('#scanner-mode-toggle')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-barcode.png');
  });

  test('switches to photo mode', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('photo'));
    await page.waitForTimeout(300);

    await expect(page.locator('#scanner-guidance')).toContainText(/artwork/i);
    await expect(page.locator('#scanner-shutter')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-photo.png');
  });

  test('switches to search mode', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.waitForTimeout(300);

    await expect(page.locator('#scanner-search-panel')).toBeVisible();
    await expect(page.locator('#scanner-search-input')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-search.png');
  });

  test('search returns results in bottom sheet', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.fill('#scanner-search-input', 'Daft Punk');
    await page.evaluate(() => scannerDoSearch());

    await page.waitForSelector('#scanner-sheet.sheet-open', { timeout: 10_000 });
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('scanner-results.png');
  });

  test('closes cleanly', async ({ page }) => {
    await page.evaluate(() => closeScanner());
    // Give transitions time to complete
    await page.waitForTimeout(600);

    // Verify scanner is hidden via JS state (more reliable than DOM class checks)
    const isClosed = await page.evaluate(() => !scannerOpen);
    expect(isClosed).toBe(true);

    await expect(page.locator('header')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL
// ─────────────────────────────────────────────────────────────────

test.describe('Detail Modal', () => {
  test('opens when a record is selected', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    // Open via JS function (avoids z-index click issues on desktop)
    await page.evaluate(() => showDetail(collection[0].id));
    await page.waitForTimeout(800);

    const modal = page.locator('#detail-modal');
    await expect(modal).toBeVisible();

    await expect(page).toHaveScreenshot('detail-modal.png');
  });
});

// ─────────────────────────────────────────────────────────────────
//  NAVIGATION (mobile only — bottom nav is md:hidden)
// ─────────────────────────────────────────────────────────────────

test.describe('Navigation (mobile)', () => {
  test('bottom nav switches between views', async ({ page }, testInfo) => {
    // Skip on desktop where bottom nav is hidden
    if (testInfo.project.name === 'desktop') {
      test.skip();
      return;
    }

    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    await expect(page.locator('#view-dashboard')).toBeVisible();

    await page.locator('#bottom-nav a:has-text("COLLECTION")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#view-collection')).toBeVisible();

    await page.locator('#bottom-nav a:has-text("HOME")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });
});
