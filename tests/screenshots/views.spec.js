// @ts-check
const { test, expect } = require('@playwright/test');
const { mockApi, mockEmptyApi, mockStatus, mockAuth, mockSettingsWithAuth, mockSyncApi, mockSyncWithFailed } = require('./fixtures');

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
    await expect(page.locator('#dash-status')).toContainText(/More'Wax/);

    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('shows empty state when collection is empty', async ({ page }) => {
    await mockEmptyApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#dash-empty')).toBeVisible();
    await expect(page.locator('#dash-empty')).toContainText(/vault is empty/i);
    await expect(page.locator('#dash-empty button').first()).toContainText(/Add a record/i);

    await expect(page.locator('#dash-picks-section')).not.toBeVisible();
    await expect(page.locator('#dash-recent-section')).not.toBeVisible();
    await expect(page.locator('#dash-status')).toBeVisible();
    // Status cards re-render after _checkStatus resolves
    await expect(page.locator('#dash-status')).toContainText(/testuser/);
    await expect(page.locator('#dash-status')).toContainText(/More'Wax/);

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

  test('status card shows version and connections', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);
    await expect(page.locator('#dash-status')).toContainText(/More'Wax/);
    await expect(page.locator('#dash-status')).toContainText(/testuser/);

    await expect(page.locator('#dash-status')).toHaveScreenshot('status-card.png');
  });

  test('now playing section shows button and recent listens', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    // Wait for recent-listens strip to populate (mocks return 3 listens for record 1)
    await page.waitForFunction(
      () => document.querySelectorAll('#dash-recent-listens button').length > 0,
      null,
      { timeout: 10_000 },
    );

    const section = page.locator('#dash-now-playing-section');
    await expect(section).toBeVisible();
    await expect(section).toContainText(/What are you listening to\?/i);
    await expect(section).toContainText(/Recent Listens/i);

    await expect(section).toHaveScreenshot('dashboard-now-playing.png');
  });

  test('picker modal opens with collection grid', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);

    await page.click('#dash-now-playing-btn');
    await page.waitForSelector('#picker-modal.active', { timeout: 5_000 });
    await page.waitForTimeout(TRANSITION);

    const modal = page.locator('#picker-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/What are you spinning\?/i);
    await expect(page.locator('#picker-grid button').first()).toBeVisible();

    await expect(modal.locator('.app-modal-dialog')).toHaveScreenshot('picker-modal.png');
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

  test('filter with text shows clear button', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    await page.fill('#filter-input', 'Daft Punk');
    await page.waitForTimeout(TRANSITION);
    await expect(page.locator('#filter-clear')).toBeVisible();
    await expect(page).toHaveScreenshot('collection-filtered.png');
  });

  test('smart filter dropdown shows when typing is:', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    await page.click('#filter-input');
    await page.type('#filter-input', 'is:');
    await page.waitForTimeout(TRANSITION);
    await expect(page.locator('#smart-filter-dropdown')).toBeVisible();
    await expect(page).toHaveScreenshot('collection-smart-filter.png');
  });

  test('wall view renders on desktop', async ({ page }) => {
    test.skip(!isDesktop(page), 'wall view only on desktop');
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    // Click wall toggle
    await page.locator('#view-toggle').click();
    await page.waitForTimeout(TRANSITION);

    // Verify wall cards rendered
    await expect(page.locator('.wall-card').first()).toBeVisible();
    await expect(page).toHaveScreenshot('collection-wall.png');
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

  test('shows liked tracks with filled hearts', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    // collection[0] has liked_tracks: ['A1', 'B1'] from fixtures
    page.evaluate(() => showDetail(collection[0].id)).catch(() => {});
    await page.waitForSelector('#detail-modal', { state: 'visible', timeout: 10_000 });
    // Wait for tracklist to load
    await page.waitForSelector('.bi-heart-fill', { timeout: 10_000 });
    await page.waitForTimeout(TRANSITION);

    // Verify liked hearts exist
    const filledHearts = await page.locator('.bi-heart-fill').count();
    expect(filledHearts).toBeGreaterThanOrEqual(2); // A1 and B1

    // Verify unliked hearts exist too
    const outlineHearts = await page.locator('.bi-heart').count();
    expect(outlineHearts).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('detail-liked-tracks.png');
  });

  test('listens section shows history and log button', async ({ page }) => {
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    page.evaluate(() => showDetail(collection[0].id)).catch(() => {});
    await page.waitForSelector('#detail-modal', { state: 'visible', timeout: 10_000 });
    // Wait for the listens section to be populated (record 1 has 3 mocked listens)
    await page.waitForFunction(
      () => document.querySelector('#detail-listens-1 ul li') !== null,
      null,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(TRANSITION);

    const section = page.locator('#detail-listens-1');
    await expect(section).toBeVisible();
    await expect(section.locator('li')).toHaveCount(3);
    await expect(section).toContainText(/Log a listen/i);

    await expect(section).toHaveScreenshot('detail-listens.png');
  });
});

// ─────────────────────────────────────────────────────────────────
//  SHARE CARD
// ─────────────────────────────────────────────────────────────────

test.describe('Share Card', () => {
  test('generates share card image', async ({ page }) => {
    test.skip(!isDesktop(page), 'canvas output is identical on mobile and desktop');
    await mockApi(page);
    await page.goto('/#collection');
    await waitForCollection(page);

    // Generate a share card via the canvas API directly
    const dataUrl = await page.evaluate(async () => {
      const r = collection[0];
      // Mock discogs_extra with tracklist
      r.discogs_extra = {
        tracklist: [
          { position: 'A1', title: 'Track One', duration: '3:42', type_: 'track' },
          { position: 'A2', title: 'Track Two', duration: '4:15', type_: 'track' },
          { position: 'B1', title: 'Track Three', duration: '5:01', type_: 'track' },
        ]
      };
      // Create a mock QR code image (simple dark square with pattern)
      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = 150; qrCanvas.height = 150;
      const qCtx = qrCanvas.getContext('2d');
      qCtx.fillStyle = '#131313';
      qCtx.fillRect(0, 0, 150, 150);
      qCtx.fillStyle = '#9a8f83';
      for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) {
        if ((i + j) % 3 === 0) qCtx.fillRect(i * 10, j * 10, 8, 8);
      }
      // Wait for the image to load
      const qrImg = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = qrCanvas.toDataURL();
      });

      const canvas = document.createElement('canvas');
      _drawShareCard(canvas, r, null, qrImg);
      return canvas.toDataURL('image/png');
    });

    // Render the card in the page for screenshot
    await page.evaluate((src) => {
      document.body.innerHTML = `<img src="${src}" style="display:block">`;
    }, dataUrl);
    await page.waitForTimeout(200);

    await expect(page.locator('img')).toHaveScreenshot('share-card.png');
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
//  SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test('opens from dashboard cog icon', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    // Click the settings cog in the Connections card
    await page.locator('#dash-status button[onclick="openSettings()"]').click();
    await page.waitForSelector('#settings-modal.app-modal-visible', { timeout: 5_000 });
    await page.waitForTimeout(TRANSITION);

    // Verify settings content loaded
    await expect(page.locator('#settings-discogs-mask')).toContainText('••••');
    await expect(page.locator('#settings-anthropic-mask')).toContainText('••••');

    // Verify auth setup fields exist
    await expect(page.locator('#settings-auth-setup')).toBeVisible();
    await expect(page.locator('#settings-google-client-id')).toBeVisible();
    await expect(page.locator('#settings-auth-enable-btn')).toBeVisible();

    // Remove scroll/overflow constraints on modal and all parents so element screenshot captures everything
    await page.evaluate(() => {
      for (const sel of ['#settings-body', '#settings-modal .app-modal-content', '#settings-modal .app-modal-dialog', '#settings-modal']) {
        const el = document.querySelector(sel);
        if (el) { el.style.maxHeight = 'none'; el.style.overflow = 'visible'; el.style.height = 'auto'; }
      }
    });

    await expect(page.locator('#settings-body')).toHaveScreenshot('settings-modal.png');
  });

  test('shows auth active state when Google OAuth is configured', async ({ page }) => {
    await mockApi(page);
    await mockSettingsWithAuth(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    await page.locator('#dash-status button[onclick="openSettings()"]').click();
    await page.waitForSelector('#settings-modal.app-modal-visible', { timeout: 5_000 });
    await page.waitForTimeout(TRANSITION);

    // Verify auth active state is shown
    await expect(page.locator('#settings-auth-active')).toBeVisible();
    await expect(page.locator('#settings-auth-setup')).not.toBeVisible();
    await expect(page.locator('#settings-auth-active')).toContainText(/Google Sign-In is active/);
    await expect(page.locator('#settings-allowed-emails')).toHaveValue('user@example.com');

    await expect(page).toHaveScreenshot('settings-auth-active.png');
  });
});

// ─────────────────────────────────────────────────────────────────
//  AUTHENTICATION
// ─────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('shows login overlay when auth is required and not authenticated', async ({ page }) => {
    await mockAuth(page, { authRequired: true });
    await mockApi(page);
    await page.goto('/');
    await page.waitForTimeout(TRANSITION);

    // Login overlay should be visible
    await expect(page.locator('#auth-overlay')).toBeVisible();
    await expect(page.locator('#auth-overlay')).toContainText(/Sign in/);

    await expect(page).toHaveScreenshot('auth-login.png');
  });

  test('does not show login overlay when auth is not required', async ({ page }) => {
    await mockAuth(page, { authRequired: false });
    await mockApi(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    // No login overlay
    const overlay = page.locator('#auth-overlay');
    await expect(overlay).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────
//  DISCOGS SYNC
// ─────────────────────────────────────────────────────────────────

test.describe('Discogs Sync', () => {
  test('shows diff review with selectable records', async ({ page }) => {
    await mockApi(page);
    await mockSyncApi(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    // Trigger sync via JS (fire-and-forget async)
    page.evaluate(() => startDiscogsSync()).catch(() => {});
    await page.waitForFunction(() => {
      const el = document.getElementById('sync-overlay');
      return el && el.style.display === 'flex';
    }, { timeout: 8_000 });

    // Wait for diff to render (4 new + 2 duplicates)
    await expect(page.locator('#sync-content')).toContainText('DJ Shadow');
    await expect(page.locator('#sync-content')).toContainText('4 new record');
    await expect(page.locator('#sync-content')).toContainText('2 possible duplicate');

    // Expand first duplicate to show comparison
    await page.locator('#sync-content >> text=Discovery').first().click();
    await page.waitForTimeout(200);

    // Increase viewport to fit all content without scrolling
    await page.setViewportSize({ width: page.viewportSize().width, height: 1400 });
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('sync-diff.png');
  });

  test('shows completion message after import', async ({ page }) => {
    await mockApi(page);
    await mockSyncApi(page, { importResult: { imported: 4, skipped: 0 } });
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    // Trigger sync and wait for diff
    page.evaluate(() => startDiscogsSync()).catch(() => {});
    await page.waitForFunction(() => {
      const el = document.getElementById('sync-overlay');
      return el && el.style.display === 'flex';
    }, { timeout: 8_000 });
    await expect(page.locator('#sync-content')).toContainText('DJ Shadow');

    // Click import button
    await page.locator('#sync-footer button:has-text("Import")').click();

    // Wait for completion
    await expect(page.locator('#sync-content')).toContainText(/Imported 4 record/);

    await expect(page).toHaveScreenshot('sync-complete.png');
  });

  test('shows already in sync message', async ({ page }) => {
    await mockApi(page);
    await mockSyncApi(page, { diff: [] });
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    page.evaluate(() => startDiscogsSync()).catch(() => {});
    await page.waitForFunction(() => {
      const el = document.getElementById('sync-overlay');
      return el && el.style.display === 'flex';
    }, { timeout: 8_000 });

    await expect(page.locator('#sync-content')).toContainText(/Already in sync/);

    await expect(page).toHaveScreenshot('sync-in-sync.png');
  });

  test('shows failed records after import', async ({ page }) => {
    await mockApi(page);
    await mockSyncWithFailed(page);
    await page.goto('/');
    await waitForCollection(page);
    await page.waitForTimeout(TRANSITION);

    page.evaluate(() => startDiscogsSync()).catch(() => {});
    await page.waitForFunction(() => {
      const el = document.getElementById('sync-overlay');
      return el && el.style.display === 'flex';
    }, { timeout: 8_000 });

    // Wait for diff to load, then import all
    await expect(page.locator('#sync-content')).toContainText(/new/i, { timeout: 5_000 });
    await page.locator('#sync-footer button:has-text("Import")').click();

    // Wait for completion with failed records
    await expect(page.locator('#sync-content')).toContainText(/could not be imported/i, { timeout: 8_000 });
    await expect(page.locator('#sync-content')).toContainText(/Broken Record/);
    await expect(page.locator('#sync-content')).toContainText(/Download as JSON/);

    await expect(page).toHaveScreenshot('sync-failed.png');
  });
});

// ─────────────────────────────────────────────────────────────────
//  ERROR DIALOGS
// ─────────────────────────────────────────────────────────────────

test.describe('Error Dialogs', () => {
  test('shows setup wizard when Discogs token is missing', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: false, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const wizard = page.locator('#setup-wizard');
    await expect(wizard).toBeVisible();
    await expect(wizard).toContainText(/Connect to Discogs/i);
    await expect(wizard.locator('a')).toHaveAttribute('href', /discogs/);

    await expect(page).toHaveScreenshot('setup-wizard.png');
  });

  test('setup wizard step 2 shows Claude AI config', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: false, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const wizard = page.locator('#setup-wizard');
    await expect(wizard).toBeVisible();

    // Type a token and submit to advance to step 2
    await page.fill('#setup-discogs-token', 'test-token-123');
    await page.click('#setup-btn-1');
    await page.waitForTimeout(300);

    await expect(wizard).toContainText(/Claude AI/i);
    await expect(wizard.locator('a[href*="anthropic"]')).toBeVisible();

    await expect(page).toHaveScreenshot('setup-wizard-step2.png');
  });

  test('shows wizard with error when Discogs token is invalid', async ({ page }) => {
    await mockApi(page);
    await mockStatus(page, { discogs_token_set: true, discogs_connected: false });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const wizard = page.locator('#setup-wizard');
    await expect(wizard).toBeVisible();
    await expect(wizard).toContainText(/no longer valid/i);

    await expect(page).toHaveScreenshot('setup-wizard-invalid.png');
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
