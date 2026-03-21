const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(() => typeof collection !== 'undefined' && collection.length > 0, { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Dashboard
  await page.screenshot({ path: 'docs/screenshot-dashboard.png' });

  // Collection — filter by "source"
  await page.evaluate(() => navigateTo('collection'));
  await page.waitForTimeout(800);
  await page.fill('#filter-input', 'source');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshot-collection.png' });

  // Detail — open the first record that matches the "source" filter
  await page.evaluate(() => {
    const cards = document.querySelectorAll('#collection-grid [data-record-id]');
    if (cards.length > 0) {
      const id = cards[0].getAttribute('data-record-id');
      showDetail(Number(id));
    }
  });
  // Wait for detail modal to fully render (API fetch + animation)
  await page.waitForSelector('#detail-modal', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshot-detail.png' });

  // Scanner — fake camera feed
  // Close detail modal first
  await page.evaluate(() => {
    const modal = document.getElementById('detail-modal');
    if (modal) {
      modal.classList.remove('app-modal-visible', 'active');
      modal.style.display = 'none';
    }
    const backdrop = document.querySelector('.app-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.style.display = 'none';
    }
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => openScanner());
  await page.waitForTimeout(800);

  // Inject a faux camera background (blurry record shelf) since Playwright has no camera
  await page.evaluate(() => {
    const video = document.getElementById('scanner-video');
    if (video) video.style.display = 'none';
    const errEl = document.getElementById('scanner-cam-error');
    if (errEl) errEl.classList.add('hidden');
    const wrap = document.getElementById('scanner-frame-wrap');
    if (wrap) wrap.classList.remove('hidden');
    // Dark vinyl-shelf gradient as camera background
    const scanner = document.getElementById('view-scanner');
    scanner.style.background = 'linear-gradient(160deg, #1a1a1a 0%, #2d1f1a 30%, #1a1a2d 60%, #0d0d0d 100%)';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshot-scanner.png' });

  await browser.close();
  console.log('Screenshots saved to docs/');
})();
