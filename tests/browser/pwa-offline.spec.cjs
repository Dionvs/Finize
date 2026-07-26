const { expect, test } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });

test('PWA start offline en geeft geen HTML terug voor ontbrekende assets', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload();

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('Finize');
  await expect(page.locator('#tab-dashboard h1')).toHaveText('Dashboard');

  const missingAsset = await page.evaluate(() =>
    fetch('./niet-bestaand-script.js')
      .then(async response => ({
        fulfilled: true,
        contentType: response.headers.get('content-type') || '',
        textStart: (await response.text()).slice(0, 20)
      }))
      .catch(() => ({ fulfilled: false }))
  );
  if (missingAsset.fulfilled) {
    expect(missingAsset.contentType).not.toContain('text/html');
    expect(missingAsset.textStart.toLowerCase()).not.toContain('<!doctype html');
  }
});
