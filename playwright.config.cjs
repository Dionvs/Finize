const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: 'line',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block'
  },
  webServer: {
    command: `"${process.execPath}" scripts/serve.mjs`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  }
});
