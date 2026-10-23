const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const visual = require('../fixtures/v50-visual-state.json');
const { state: fixture } = require('../helpers/package5-fixture.cjs');

test.use({ serviceWorkers: 'allow' });
test.setTimeout(90000);

test('V118-r4 naar r7, offline en terugrollen behouden financiën, planning, imports en lokale opslag', async ({ page, context }) => {
  const root = path.resolve(__dirname, '../..');
  const oldFiles = new Map(['index.html', 'app.js', 'app.css', 'service-worker.js'].map(name =>
    [name, execFileSync('git', ['show', `b398f0d9a369ceb50e10f00181067b0e9e48dbe1:${name}`], { cwd: root, maxBuffer: 20 * 1024 * 1024 })]));
  let old = true;
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    let bytes;
    if (old && oldFiles.has(name)) bytes = oldFiles.get(name);
    else if (fs.existsSync(file) && fs.statSync(file).isFile()) bytes = fs.readFileSync(file);
    else { response.writeHead(404).end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json' : name.endsWith('.png') ? 'image/png' : 'text/html');
    response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const snapshot = () => page.evaluate(async () => {
    const store = FinizeUpdate4Runtime.ImportStore;
    return {
      transactions: state.transactions, budgets: state.budgetDefaultsHistory,
      incomes: state.incomeDefaultsHistory, fixed: state.recurringFixedExpenses,
      goals: state.savingsGoalLedger, checkpoints: state.balanceCheckpoints,
      months: state.monthRecords, rules: state.recognitionRules,
      forecasts: ['2026-09', '2026-10', '2026-11'].map(month => FinizeTransactions.forecast(month)),
      batch: await store.getImport('r4-preservation'),
      journal: await store.getJournal('r4-preservation-journal'),
      queue: await store.listSync(), sentinel: localStorage.getItem('r4-preservation')
    };
  });
  try {
    await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.addInitScript(seed => {
      if (!localStorage.getItem('finize-budget-planner-v1')) localStorage.setItem('finize-budget-planner-v1', JSON.stringify(seed));
    }, { ...visual, ...fixture() });
    await page.goto(base);
    await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
    expect(await page.evaluate(() => caches.keys())).toContain('finize-v118-r4');
    await page.evaluate(() => FinizeManual.save({ id: 'r4-manual', date: '2026-10-03', amount: 12.34, transactionType: 'uitgave', category: 'Kleding', description: 'Synthetic release transaction' }, 'gezamenlijk'));
    await page.evaluate(() => openBankAccountDetails(state.accountProfiles[0].id));
    await page.locator('[data-balance-add]').click();
    await page.locator('[data-balance-amount]').fill('1000');
    await page.locator('[data-balance-date]').fill('2026-10-14');
    await page.locator('[data-balance-check]').click();
    await page.locator('[data-balance-confirm]').click();
    await expect(page.locator('[data-balance-value]')).toContainText('1.000,00');
    await page.evaluate(async () => {
      const store = FinizeUpdate4Runtime.ImportStore;
      await store.putImport({ id: 'r4-preservation', version: 1, operationId: 'r4-op', rows: [{ id: 'source', processingStatus: 'nakijken', bankOriginal: { amount: -10, bankDate: '2026-10-03', description: 'Synthetic preservation' } }] });
      await store.putSync({ id: 'r4-preservation', importId: 'r4-preservation', version: 1, operationId: 'r4-op' });
      await store.putJournal({ id: 'r4-preservation-journal', importId: 'r4-preservation', operation: 'release-check', status: 'completed' });
      localStorage.setItem('r4-preservation', 'synthetic-local-data');
      await caches.open('finize-obsolete-r4');
      await caches.open('other-app-r4');
    });
    const before = await snapshot();
    expect(before.transactions.length).toBeGreaterThan(0);
    expect(before.checkpoints.length).toBeGreaterThan(0);
    expect(before.months['2026-08'].snapshot).toEqual({ income: 123, expenses: 55 });
    old = false;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain('finize-v118-r11');
    // The new cache exists during install; wait for activation/cleanup as well.
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('finize-v118-r4');
    await page.reload();
    await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
    expect(await snapshot()).toEqual(before);
    expect(await page.locator('script[src*="app.js"]').getAttribute('src')).toContain('118-r11');
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).not.toContain('finize-v118-r4');
    expect(keys).not.toContain('finize-obsolete-r4');
    expect(keys).toContain('other-app-r4');
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
    expect(await snapshot()).toEqual(before);
    expect(await page.locator('script[src*="app.js"]').getAttribute('src')).toContain('118-r11');
    await context.setOffline(false);
    old = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain('finize-v118-r4');
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('finize-v118-r11');
    await page.reload();
    await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
    expect(await snapshot()).toEqual(before);
    expect(await page.locator('script[src*="app.js"]').getAttribute('src')).toContain('118-r4');
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
