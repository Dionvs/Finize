const { expect, test } = require('@playwright/test');

test('bootstrap rendert de actieve tab exact één keer', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__finizeBootstrap?.rendered === true);
  const bootstrap = await page.evaluate(() => ({ ...window.__finizeBootstrap }));
  expect(bootstrap).toMatchObject({
    coreReady: true,
    update4Ready: true,
    update5Ready: true,
    rendered: true,
    initialRenderCount: 1
  });
});
