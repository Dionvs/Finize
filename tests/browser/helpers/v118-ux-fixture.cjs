const fs = require('node:fs');
const path = require('node:path');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/v50-visual-state.json'), 'utf8'));
const profiles = ['gezamenlijk', 'dion', 'dara'].map((owner, index) => ({
  id: `ux-${owner}`, name: `${owner === 'gezamenlijk' ? 'Gezamenlijk' : owner === 'dion' ? 'Dion' : 'Dara'} betalen`,
  accountOwner: owner, accountType: 'payment', status: 'active',
  identifier: ['NL91ABNA0417164300', 'NL02ABNA0123456789', 'NL20INGB0001234567'][index],
  liquidity: { version: 1, primaryForOwner: true, bufferCents: owner === 'gezamenlijk' ? 20000 : 0,
    salaryDays: owner === 'gezamenlijk' ? { dion: 25, dara: 27 } : {},
    allowanceDays: owner === 'gezamenlijk' ? {} : { [owner]: 25 } }
}));
async function boot(page, width = 390, balance = true, url = 'http://127.0.0.1:4173/') {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(seed => {
    if (!localStorage.getItem('finize-budget-planner-v1')) localStorage.setItem('finize-budget-planner-v1', JSON.stringify(seed));
  }, { ...fixture, meta: { ...fixture.meta, selectedMonth: '2026-10' }, accountProfiles: profiles });
  await page.goto(url);
  await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
  await page.evaluate(() => {
    state.recurringFixedExpenses.forEach((row, i) => { row.afschrijfdatum = `2026-01-${String(16 + i % 8).padStart(2, '0')}`; });
  });
  if (balance) {
    for (const owner of ['gezamenlijk', 'dion', 'dara']) {
      await page.evaluate(owner => openBankAccountDetails(`ux-${owner}`), owner);
      await page.locator('[data-balance-add]').click();
      await page.locator('[data-balance-amount]').fill(owner === 'gezamenlijk' ? '3100' : '500');
      await page.locator('[data-balance-date]').fill('2026-10-14');
      await page.locator('[data-balance-check]').click();
      await page.locator('[data-balance-confirm]').click();
      await page.waitForFunction(owner => state.balanceCheckpoints?.some(c => c.accountProfileId === `ux-${owner}`), owner);
    }
    await page.evaluate(() => state.balanceCheckpoints.forEach(c => { c.id = `checkpoint-${c.accountProfileId}`; c.operationId = `operation-${c.accountProfileId}`; }));
  }
  await navigate(page, 'dashboard');
}
async function navigate(page, tab) {
  await page.evaluate(tab => document.querySelector(`#tabs [data-tab="${tab}"]`).click(), tab);
  if (tab === 'dashboard') await page.waitForFunction(() => !document.querySelector('[data-p3-outlook]')?.innerText.includes('laden'));
}
module.exports = { boot, navigate };
