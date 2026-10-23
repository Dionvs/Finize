const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const visual = require('../fixtures/v50-visual-state.json');
const { state: fixture } = require('../helpers/package5-fixture.cjs');
const root = path.resolve(__dirname, '../..');
test.setTimeout(60000);
test.use({ actionTimeout: 8000 });

async function boot(page, width = 390, enabled = true, balance = false) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-23T12:00:00Z'));
  await page.route('https://www.gstatic.com/**', route => route.abort());
  await page.route('https://firestore.googleapis.com/**', route => route.abort());
  await page.route('https://api.enablebanking.com/**', route => { throw new Error('Production bank request forbidden in this test'); });
  // The production app loads bundled JS; only this isolated test imports pure source modules.
  await page.route('http://127.0.0.1:4173/src/**', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(root + new URL(route.request().url()).pathname, 'utf8')
  }));
  const seed = { ...visual, ...fixture() };
  seed.meta.selectedMonth = '2026-10'; seed.monthRecords = {};
  seed.accountProfiles = [{ id: 'joint', accountOwner: 'gezamenlijk', name: 'ING synthetisch', identifier: 'NL20INGB0001234567', accountType: 'payment', status: 'active' }];
  seed.recognitionRules = [{ id: 'p5b-test', level: 'keyword', value: 'boodschappen', category: 'Kleding', budgetItemId: 'food', transactionType: 'uitgave' }];
  seed.balanceCheckpoints = [{ version: 1, id: 'opening', operationId: 'opening', householdId: 'legacy', accountProfileId: 'joint',
    amountCents: 100000, currency: 'EUR', asOfDate: '2026-10-20', boundary: 'end-of-bank-day', source: 'manual-observation',
    createdAt: '2026-10-20T20:00:00Z', actor: 'synthetic', note: '', revision: 1, supersedesId: null }];
  await page.addInitScript(value => { if (!localStorage.getItem('finize-budget-planner-v1')) localStorage.setItem('finize-budget-planner-v1', JSON.stringify(value)); }, seed);
  await page.goto('/'); await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
  await page.evaluate(async enabled => {
    window.FinizeAuth = { user: { uid: 'synthetic', getIdToken: async () => 'synthetic-only' } };
    if (enabled === null) return; // Exercise the real bundled release configuration.
    const { installBankConnection } = await import('/src/ui/bank-connection.mjs');
    window.FinizeBank = installBankConnection(window, { enabled, baseUrl: 'http://127.0.0.1:4999/bank' });
  }, enabled);
  const householdId = await page.evaluate(() => CloudAdapter.importScope());
  const snapshot = { version: 1, runId: 'browser-run', householdId, accountProfileId: 'joint', fetchedAt: '2026-10-23T12:00:00Z',
    account: { iban: seed.accountProfiles[0].identifier, identificationHash: 'synthetic-hash' }, fromDate: '2026-10-21', toDate: '2026-10-23',
    complete: true, balances: balance ? [{ balance_type: 'ITBD', balance_amount: { amount: '990.00', currency: 'EUR' }, last_change_date_time: '2026-10-23T11:59:00Z' }] : [],
    transactions: [{ entry_reference: 'entry-browser', status: 'BOOK', booking_date: '2026-10-23', value_date: '2026-10-23',
      transaction_amount: { amount: '10.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Boodschappen'] }] };
  await page.route('http://127.0.0.1:4999/bank/**', async route => {
    expect(route.request().headers().authorization).toBe('Bearer synthetic-only');
    const path = new URL(route.request().url()).pathname;
    const response = path.endsWith('/status') ? { connected: true, backendReady: true, accountProfileId: 'joint' } : path.endsWith('/disconnect') ? { connected: false } : snapshot;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.evaluate(() => openBankAccountDetails('joint'));
  await expect(page.locator('[data-bank-sync]')).toBeVisible();
  return snapshot;
}

test('P5b explicit disabled override blocks bank requests', async ({ page }) => {
  await boot(page, 390, false);
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  await expect(page.locator('[data-bank-status]')).toContainText('Nog niet geactiveerd');
});

for (const host of ['auth.enablebanking.com', 'tilisy.enablebanking.com']) test('P5b activated release only checks status and starts authorization after an explicit click: ' + host, async ({ page }) => {
  const calls = [];
  await page.route('https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/enableBanking', '');
    calls.push(endpoint);
    expect(route.request().headers().authorization).toBe('Bearer synthetic-only');
    expect(JSON.parse(route.request().postData()).accountProfileId).toBe('joint');
    expect(['/status', '/auth/start']).toContain(endpoint);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(endpoint === '/status' ? { connected: false } : { url: 'https://' + host + '/ais/start?synthetic=1' }) });
  });
  await page.route('https://' + host + '/ais/start?synthetic=1', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetische banktoestemming</h1>' }));
  await boot(page, 390, null);
  await expect(page.locator('[data-bank-status]')).toContainText('Geen geldige bankverbinding');
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  expect(calls).toEqual(['/status']);
  await page.locator('[data-bank-authorize]').click();
  await expect(page.getByRole('heading', { name: 'Synthetische banktoestemming' })).toBeVisible();
  expect(calls).toEqual(['/status', '/auth/start']);
});

test('P5b disconnected account cannot fetch; existing review remains accessible', async ({ page }) => {
  await boot(page);
  await page.route('http://127.0.0.1:4999/bank/status', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false, reauthorize: true }) }));
  await page.evaluate(() => openBankAccountDetails('joint'));
  await expect(page.locator('[data-bank-status]')).toContainText('Geen geldige bankverbinding');
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  await expect(page.locator('[data-bank-authorize]')).toBeEnabled();
  await page.locator('[data-bank-review]').click();
  await expect(page.locator('[data-bank-status]')).toContainText('Nog geen banktransacties opgehaald');
});

test('P5b opening details only reads status; offline status keeps review available', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().startsWith('http://127.0.0.1:4999/bank/')) requests.push(new URL(request.url()).pathname); });
  await boot(page);
  await expect(page.locator('[data-bank-status]')).toContainText('Verbonden.');
  expect(requests).toEqual(['/bank/status']);
  await page.route('http://127.0.0.1:4999/bank/status', route => route.abort());
  await page.evaluate(() => openBankAccountDetails('joint'));
  await expect(page.locator('[data-bank-status]')).toContainText('Controleer je verbinding');
  await expect(page.locator('[data-bank-review]')).toBeEnabled();
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  expect(await page.evaluate(() => state.transactions.length)).toBe(0);
});

test('P5b expired authorization during fetch requests renewed permission without writing transactions', async ({ page }) => {
  await boot(page);
  await page.route('http://127.0.0.1:4999/bank/sync', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'reauthorization-required' }) }));
  await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-bank-status]')).toContainText('Banktoegang is verlopen');
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  await expect(page.locator('[data-bank-authorize]')).toBeEnabled();
  expect(await page.evaluate(() => state.transactions.length)).toBe(0);
});

test('P5b failed revocation stays explicitly unconfirmed and can be retried', async ({ page }) => {
  await boot(page);
  await page.route('http://127.0.0.1:4999/bank/disconnect', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'provider-unavailable' }) }));
  await page.locator('[data-bank-disconnect]').click();
  await expect(page.locator('[data-bank-status]')).toContainText('nog niet bevestigd');
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  await expect(page.locator('[data-bank-disconnect]')).toBeEnabled();
  await page.route('http://127.0.0.1:4999/bank/disconnect', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false }) }));
  await page.locator('[data-bank-disconnect]').click();
  await expect(page.locator('[data-bank-status]')).toContainText('Banktoegang ingetrokken');
});

test('P5b outstanding revocation stays visible after reopening the account', async ({ page }) => {
  await boot(page);
  await page.route('http://127.0.0.1:4999/bank/status', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false, reauthorize: true, revocationPending: true }) }));
  await page.evaluate(() => openBankAccountDetails('joint'));
  await expect(page.locator('[data-bank-status]')).toContainText('Eerdere banktoegang is nog niet volledig ingetrokken');
  await expect(page.locator('[data-bank-disconnect]')).toBeEnabled();
  await expect(page.locator('[data-bank-sync]')).toBeDisabled();
});
for (const width of [390, 1440]) test('P5b ' + width + ' direct cash, existing review, explicit approval, repeat and durable reload', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page, width);
  await expect(page.locator('[data-bank-status]')).toContainText('Verbonden.');
  await page.locator('[data-bank-connection]').screenshot({ path: info.outputPath('bankverbinding.png') });
  await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  expect(await page.evaluate(() => FinizeTransactions.total('realExpense', { month: '2026-10' }))).toBe(0);
  expect(await page.evaluate(() => state.transactions.filter(row => row.recordRole === 'bank-source').length)).toBe(1);
  await page.locator('[data-bank-review]').click();
  const row = page.locator('[data-u4-row]').first(); await expect(row).toBeVisible();
  await expect(row.locator('.u4-status')).toHaveText('Nakijken');
  await expect(row.locator('[data-u4-field=category]')).toHaveValue('Kleding');
  await page.screenshot({ path: info.outputPath('nakijken.png') });
  await row.locator('[data-u4-approve]').click();
  await expect.poll(() => page.evaluate(() => FinizeTransactions.total('realExpense', { month: '2026-10' }))).toBe(10);
  await page.locator('[data-u4-close]').click();
  await page.evaluate(() => openBankAccountDetails('joint'));
  await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  expect(await page.evaluate(() => state.transactions.filter(row => row.recordRole !== 'bank-source').length)).toBe(1);
  await page.reload(); await page.waitForFunction(() => window.__finizeBootstrap?.rendered);
  await page.evaluate(() => openBankAccountDetails('joint'));
  await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  expect(await page.evaluate(() => FinizeTransactions.total('realExpense', { month: '2026-10' }))).toBe(10);
  await page.screenshot({ path: info.outputPath('saldo.png') });
  expect(await page.locator('[data-bank-connection]').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
test('P5b timestamp balance does not double count and missing pages remain visible', async ({ page }) => {
  const snapshot = await boot(page, 390, true, true);
  snapshot.complete = false; snapshot.issue = 'transactions-incomplete';
  await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  await expect(page.locator('[data-bank-status]')).toContainText('onvolledig');
  expect(await page.evaluate(() => state.balanceCheckpoints.length)).toBe(1);
  expect(await page.evaluate(() => state.bankBalanceObservations[0].facts.boundary)).toBe('timestamp');
  const graph=await page.evaluate(()=>FinizeLiquidity.project({accountProfileId:'joint',startDate:'2026-10-01',asOfDate:'2026-10-23',endDate:'2026-10-25'}));
  expect(graph.currentBalance.balanceCents).toBe(99000);
  expect(graph.days.find(row=>row.date==='2026-10-23').cashBalanceCents).toBe(99000);
});
test('P5b existing approved CSV remains intact when API overlap is explicitly linked', async ({ page }) => {
  await boot(page);
  const original = await page.evaluate(async () => {
    const u = FinizeUpdate4Runtime;
    const csv = u.createImportDraft({ id: 'p5b-original-csv',
      text: 'Datum;Omschrijving;Rekening;Bedrag\n2026-10-23;Boodschappen;NL20INGB0001234567;-10.00',
      profiles: state.accountProfiles, rules: state.recognitionRules, entryOwner: 'gezamenlijk', today: '2026-10-23' });
    await u.persistImportDraft(window, csv, { syncCloud: false });
    const editor = await u.beginImportEditor(window, csv);
    await u.commitImportEditor(window, editor, { approveIds: [editor.rows[0].id] });
    openBankAccountDetails('joint');
    return state.transactions.filter(row => row.recordRole !== 'bank-source');
  });
  await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  expect(await page.evaluate(() => state.transactions.filter(row => row.recordRole !== 'bank-source'))).toEqual(original);
  await page.locator('[data-bank-review]').click();
  await expect(page.locator('[data-u4-identity="same"]')).toBeVisible();
  await page.locator('[data-u4-identity="same"]').click();
  await expect.poll(() => page.evaluate(async () => {
    const batch = (await FinizeUpdate4.importStore.listImports()).find(row => row.channel === 'bank-api');
    return batch.rows[0].identityDecision;
  })).toBe('same');
  expect(await page.evaluate(() => state.transactions.filter(row => row.recordRole === 'bank-source').length)).toBe(1);
  expect(await page.evaluate(() => state.transactions.find(row => row.recordRole === 'bank-source').importReferences.length)).toBe(2);
  expect(await page.evaluate(() => FinizeTransactions.total('realExpense', { month: '2026-10' }))).toBe(10);
  expect(await page.evaluate(() => state.transactions.filter(row => row.recordRole !== 'bank-source'))).toEqual(original);
});
