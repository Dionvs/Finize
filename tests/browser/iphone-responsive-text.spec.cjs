const { expect, test } = require('@playwright/test');

const iphoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const iphoneWidths = [320, 375, 390, 393, 402, 414, 428, 430];
test.setTimeout(60_000);

async function identifyAsIphone(page) {
  await page.addInitScript(userAgent => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => userAgent });
  }, iphoneUserAgent);
}

async function keepTestLocal(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.route('https://firestore.googleapis.com/**', route => route.abort());
}

for (const width of iphoneWidths) {
  test(`iPhone-tekst blijft leesbaar en binnen beeld op ${width}px`, async ({ page }) => {
    await identifyAsIphone(page);
    await keepTestLocal(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(/finize-ios-phone/);
    const columns = await page.locator('.mobile-kpi-grid').first().evaluate(element =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    );
    expect(columns).toBe(2);

    for (const tab of ['dashboard', 'gezamenlijk', 'dion', 'dara', 'spaardoelen', 'data']) {
      if (tab === 'data') await page.locator('#tab-spaardoelen [data-tab-shortcut="data"]').click();
      else await page.locator(`.v4-bottom-nav [data-tab="${tab}"]`).click();
      const horizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(horizontalOverflow, `${tab} heeft horizontale overflow op ${width}px`).toBeLessThanOrEqual(1);
    }

    await page.locator('.v4-bottom-nav [data-tab="dion"]').click();
    const labelSize = await page.locator('#tab-dion .mobile-kpi-label').first().evaluate(element =>
      parseFloat(getComputedStyle(element).fontSize)
    );
    const valueSize = await page.locator('#tab-dion .mobile-kpi-value').first().evaluate(element =>
      parseFloat(getComputedStyle(element).fontSize)
    );
    expect(labelSize).toBeGreaterThanOrEqual(12);
    expect(valueSize).toBeGreaterThanOrEqual(width < 375 ? 17 : 18);
  });
}

test('iPhone-invoervelden voorkomen Safari-inzoom, Android en desktop blijven ongewijzigd', async ({ browser }) => {
  const iphoneContext = await browser.newContext({
    userAgent: iphoneUserAgent,
    viewport: { width: 390, height: 900 }
  });
  const iphonePage = await iphoneContext.newPage();
  await keepTestLocal(iphonePage);
  await iphonePage.goto('/');
  await iphonePage.locator('.v4-bottom-nav [data-tab="dion"]').click();
  await iphonePage.locator('#tab-dion [data-open-owner-variable="dion"]').click();
  const iphoneInputSize = await iphonePage.getByRole('spinbutton', { name: 'Maandbudget' }).first().evaluate(element =>
    parseFloat(getComputedStyle(element).fontSize)
  );
  expect(iphoneInputSize).toBeGreaterThanOrEqual(16);
  await iphoneContext.close();

  const androidContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36',
    viewport: { width: 390, height: 900 }
  });
  const androidPage = await androidContext.newPage();
  await keepTestLocal(androidPage);
  await androidPage.goto('/');
  await expect(androidPage.locator('html')).not.toHaveClass(/finize-ios-phone/);
  const androidColumns = await androidPage.locator('.mobile-kpi-grid').first().evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  );
  expect(androidColumns).toBe(4);
  await androidContext.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  await keepTestLocal(desktopPage);
  await desktopPage.goto('/');
  await expect(desktopPage.locator('html')).not.toHaveClass(/finize-ios-phone/);
  await expect(desktopPage.locator('.v4-sidebar')).toBeVisible();
  await desktopContext.close();
});
