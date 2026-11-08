const { defineConfig } = require('@playwright/test');
const testOrigin = require('./tests/browser/helpers/test-origin.cjs');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  outputDir: process.env.FINIZE_TEST_OUTPUT_DIR || 'test-results',
  reporter: 'line',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    actionTimeout: 10_000,
    baseURL: testOrigin,
    serviceWorkers: 'block'
  },
  webServer: {
    command: `"${process.execPath}" scripts/serve.mjs`,
    url: testOrigin,
    reuseExistingServer: false
  }
});
