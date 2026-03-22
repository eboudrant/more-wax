// @ts-check
const { test, expect } = require('@playwright/test');
const { mockApi, mockEmptyApi, mockStatus } = require('./fixtures');

// ── Helper: wait for the collection to load ────────────────────
async function waitForCollection(page) {
  await page.waitForFunction(
    () => typeof collection !== 'undefined' && collection.length > 0,
    { timeout: 8_000 }
  ).catch(() => {});
  await page.waitForLoadState('networkidle');
}

/** True when viewport width >= 768px (Tailwind md: breakpoint). */
function isDesktop(page) {
  return page.viewportSize().width >= 768;
}

/** Short stable pause for CSS transitions to settle. */
const TRANSITION = 400;

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

    if (!isDesktop(page)) {
      await expect(page.locator('#bottom-nav')).toBeVisible();
    }

    // Wait for status cards to fully render (avoids race with /api/status fetch)
    await expect(page.locator('#dash-status')).toContainText(/testuser/);

    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('shows empty state when collection is empty', async ({ page }) => {
    await mockEmptyApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#dash-empty')).toBeVisible();
    await expect(page.locator('#dash-empty')).toContainText(/vault is empty/i);
    await expect(page.locator('#dash-empty button')).toContainText(/Add a record/i);

    await expect(page.locator('#dash-picks-section')).not.toBeVisible();
    await expect(page.locator('#dash-recent-section')).not.toBeVisible();
    await expect(page.locator('#dash-status')).toBeVisible();
    // Wait for status cards to fully render (avoids race with /api/status fetch)
    await expect(page.locator('#dash-status')).toContainText(/testuser/);

    await expect(page).toHaveScreenshot('dashboard-empty.png');
  });

  test('shows random picks and recently added', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    await expect(page.locator('#dash-picks')).toBeVisible();
    await expect(page.locator('#dash-recent')).toBeVisible();
    await expect(page.locator('#nav-badge')).toHaveText(/\d+/);
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
    await page.waitForSelector('#view-scanner', { state: 'visible' });
    await page.waitForTimeout(TRANSITION);
  });

  test('opens in barcode mode', async ({ page }) => {
    await expect(page.locator('#view-scanner')).toBeVisible();
    await expect(page.locator('#scanner-guidance')).toContainText(/barcode/i);
    await expect(page.locator('#scanner-mode-toggle')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-barcode.png');
  });

  test('switches to photo mode', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('photo'));
    await page.waitForTimeout(TRANSITION);

    await expect(page.locator('#scanner-guidance')).toContainText(/artwork/i);
    await expect(page.locator('#scanner-shutter')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-photo.png');
  });

  test('switches to search mode', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.waitForTimeout(TRANSITION);

    await expect(page.locator('#scanner-search-panel')).toBeVisible();
    await expect(page.locator('#scanner-search-input')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-search.png');
  });

  test('search returns results in bottom sheet', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.fill('#scanner-search-input', 'Daft Punk');
    await page.evaluate(() => scannerDoSearch());

    await page.waitForSelector('#scanner-sheet.sheet-open', { timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);
    await expect(page).toHaveScreenshot('scanner-results.png');
  });

  test('confirm view shows detail layout with add button', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.fill('#scanner-search-input', 'Daft Punk');
    await page.evaluate(() => scannerDoSearch());

    await page.waitForSelector('#scanner-sheet.sheet-open', { timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

    page.evaluate(() => scannerSelectRelease(0)).catch(() => {});
    await page.waitForSelector('#scanner-sheet-body .detail-panel', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

    await expect(page.locator('#scanner-sheet-body .detail-panel')).toBeVisible();
    await expect(page.locator('#save-btn')).toBeVisible();
    await expect(page.locator('#save-btn')).toContainText(/Add to Collection/i);
    await expect(page.locator('text=Back to results')).toBeVisible();

    await expect(page).toHaveScreenshot('scanner-confirm.png');
  });

  test('back button returns to results list', async ({ page }) => {
    await page.evaluate(() => switchScannerMode('search'));
    await page.fill('#scanner-search-input', 'Daft Punk');
    await page.evaluate(() => scannerDoSearch());

    await page.waitForSelector('#scanner-sheet.sheet-open', { timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

    page.evaluate(() => scannerSelectRelease(0)).catch(() => {});
    await page.waitForSelector('#scanner-sheet-body .detail-panel', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

    await page.click('text=Back to results');
    await page.waitForTimeout(TRANSITION);

    await expect(page.locator('#scanner-sheet-header')).toContainText(/Matches Found/i);
    await expect(page.locator('#scanner-sheet.sheet-open')).toBeVisible();
  });

  test('closes cleanly', async ({ page }) => {
    await page.evaluate(() => closeScanner());
    await page.waitForTimeout(TRANSITION);

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

    page.evaluate(() => showDetail(collection[0].id)).catch(() => {});
    await page.waitForSelector('#detail-modal', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

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
    if (testInfo.project.name === 'desktop') {
      test.skip();
      return;
    }

    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    await expect(page.locator('#view-dashboard')).toBeVisible();

    await page.locator('#bottom-nav a:has-text("COLLECTION")').click();
    await expect(page.locator('#view-collection')).toBeVisible();

    await page.locator('#bottom-nav a:has-text("HOME")').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────
//  ERROR DIALOGS
// ─────────────────────────────────────────────────────────────────

test.describe('Error Dialogs', () => {
  test('shows banner when Discogs token is missing', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: false, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('#setup-error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/not configured/i);
    await expect(banner.locator('a')).toHaveAttribute('href', /discogs/);

    await expect(page).toHaveScreenshot('error-discogs-missing.png');
  });

  test('shows banner when Discogs token is invalid', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: true, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('#setup-error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/invalid/i);

    await expect(page).toHaveScreenshot('error-discogs-invalid.png');
  });

  test('dismisses Discogs error banner', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: false, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('#setup-error');
    await expect(banner).toBeVisible();

    await banner.locator('button').click();
    await expect(banner).not.toBeVisible();
  });

  test('shows API key dialog when tapping photo mode', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { anthropic_key_set: false });
    await page.goto('/');
    await waitForCollection(page);

    await page.evaluate(() => openScanner());
    await page.waitForSelector('#view-scanner', { state: 'visible' });
    await page.waitForTimeout(TRANSITION);

    await page.evaluate(() => switchScannerMode('photo'));
    await page.waitForSelector('#apikey-dialog', { state: 'visible', timeout: 5_000 });

    const dialog = page.locator('#apikey-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/API Key Required/i);
    await expect(dialog.locator('a')).toHaveAttribute('href', /anthropic/);

    await expect(page).toHaveScreenshot('error-apikey-required.png');
  });

  test('dismisses API key dialog', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { anthropic_key_set: false });
    await page.goto('/');
    await waitForCollection(page);

    await page.evaluate(() => openScanner());
    await page.waitForSelector('#view-scanner', { state: 'visible' });
    await page.waitForTimeout(TRANSITION);

    await page.evaluate(() => switchScannerMode('photo'));
    await page.waitForSelector('#apikey-dialog', { state: 'visible', timeout: 5_000 });

    const dialog = page.locator('#apikey-dialog');
    await expect(dialog).toBeVisible();

    await dialog.locator('button').click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator('#scanner-guidance')).toContainText(/barcode/i);
  });

  test('no errors when everything is configured', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#setup-error')).not.toBeVisible();
  });
});
