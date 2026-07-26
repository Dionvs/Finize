const { expect, test } = require('@playwright/test');

for (const width of [360, 390, 430, 768, 1024, 1440]) {
  test(`v50 start zonder horizontale overflow op ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('firestore.googleapis.com')) errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page).toHaveTitle('Finize');
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
