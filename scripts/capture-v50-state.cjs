const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

(async () => {
  const root = path.join(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(process.env.FINIZE_BASE_URL || 'http://127.0.0.1:4173');
  await page.waitForFunction(() => localStorage.getItem('finize-budget-planner-v1'));
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('finize-budget-planner-v1')));
  state.meta.revision = 0;
  state.meta.updatedAt = '2026-07-26T00:00:00.000Z';
  state.meta.updatedBy = 'v50-visual-fixture';
  fs.writeFileSync(
    path.join(root, 'tests', 'fixtures', 'v50-visual-state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  );
  await page.addInitScript(fixture => {
    localStorage.setItem('finize-budget-planner-v1', JSON.stringify(fixture));
    localStorage.setItem('finize-device-id', 'v50-visual-fixture');
  }, state);
  await page.reload();
  const selectors = [
    'body',
    '.mobile-dashboard-header',
    '.mobile-kpi-grid',
    '.dashboard-grid',
    '.joint-account-card',
    '.allowance-return-card',
    '.dashboard-goals-preview',
    '.v4-bottom-nav'
  ];
  const styles = await page.evaluate(items => Object.fromEntries(items.map(selector => {
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
  })), selectors);
  fs.writeFileSync(
    path.join(root, 'tests', 'fixtures', 'v50-computed-styles.json'),
    `${JSON.stringify(styles, null, 2)}\n`,
    'utf8'
  );
  await browser.close();
  console.log('Deterministische v50-weergavestate vastgelegd.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
