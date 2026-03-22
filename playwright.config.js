// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/screenshots',
  timeout: 30_000,
  fullyParallel: true,
  expect: {
    toHaveScreenshot: {
      // Allow small pixel differences from font rendering across platforms
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:8765',
    // Consistent viewport for reproducible screenshots
    viewport: { width: 390, height: 844 },  // iPhone 14 size
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  // The Python server must be running before tests start
  webServer: {
    command: 'python3 server.py',
    port: 8765,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
