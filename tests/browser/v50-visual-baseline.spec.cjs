const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'v50-visual-state.json'), 'utf8'));
const widths = [360, 390, 430, 768, 1024, 1440];
const styleSelectors = [
  'body',
  '.mobile-dashboard-header',
  '.mobile-kpi-grid',
  '.dashboard-grid',
  '.joint-account-card',
  '.allowance-return-card',
  '.dashboard-goals-preview',
  '.v4-bottom-nav'
];

async function keepVisualFixtureLocal(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.route('https://firestore.googleapis.com/**', route => route.abort());
}

test.skip(process.platform !== 'win32', 'De pixelbaseline gebruikt de Windows-letterrendering van de v50-baseline.');
test.setTimeout(60_000);

for (const width of widths) {
  test(`v50 visuele baseline op ${width}px`, async ({ page }) => {
    await keepVisualFixtureLocal(page);
    await page.addInitScript(fixture => {
      localStorage.setItem('finize-budget-planner-v1', JSON.stringify(fixture));
      localStorage.setItem('finize-device-id', 'v50-visual-fixture');
    }, state);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const session = await page.context().newCDPSession(page);
    const capture = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const screenshot = Buffer.from(capture.data, 'base64');
    expect(screenshot).toMatchSnapshot(`v50-${width}.png`, {
      maxDiffPixelRatio: 0.002
    });
  });
}

test('v50 computed-style-contract', async ({ page }) => {
  await keepVisualFixtureLocal(page);
  await page.addInitScript(fixture => {
    localStorage.setItem('finize-budget-planner-v1', JSON.stringify(fixture));
    localStorage.setItem('finize-device-id', 'v50-visual-fixture');
  }, state);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const styles = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
    const element = document.querySelector(selector);
    if (!element) return [selector, null];
    const computed = getComputedStyle(element);
    return [selector, {
      display: computed.display,
      position: computed.position,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      borderRadius: computed.borderRadius,
      gridTemplateColumns: computed.gridTemplateColumns
    }];
  })), styleSelectors);
  expect(styles).toEqual(require('../fixtures/v50-computed-styles.json'));
});
