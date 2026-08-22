const { expect, test } = require('@playwright/test');

test('transacties worden alleen vanuit persoonlijk en gezamenlijk toegevoegd', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-open-transaction], [data-open-general-transaction]')).toHaveCount(0);

  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  await page.getByRole('button',{name:'+ Gezamenlijke uitgave'}).click();
  const modal = page.locator('#transactionModal');
  await expect(modal).toHaveClass(/open/);
  await expect(modal.getByRole('heading',{name:'Gezamenlijke uitgave'})).toBeVisible();
  await expect(modal.getByLabel('Eigenaar')).toHaveCount(0);
  await modal.locator('#btnCloseJointTransaction').click();
  await expect(modal).not.toHaveClass(/open/);

  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  await page.getByRole('button',{name:'+ Uitgave van Dion'}).click();
  await expect(modal.getByRole('heading',{name:'Dion uitgave'})).toBeVisible();
  await expect(modal.getByLabel('Eigenaar')).toHaveCount(0);
  await modal.locator('#personalTxAmount').fill('12.34');
  await modal.locator('#personalTxDescription').fill('Persoonlijke test');
  await modal.locator('#btnSavePersonalTransaction').click();
  await expect.poll(()=>page.evaluate(()=>window.state.transactions.at(-1)?.owner)).toBe('dion');
});

test('zonder huishouden toont persoonlijk totaal alle inkomstenbronnen', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const month=window.state.meta.selectedMonth;
    window.state.transactions.push({id:'standalone-income-test',date:month+'-12',owner:'dion',kind:'inkomen',transactionType:'overige-inkomsten',amount:40,description:'Los inkomen'});
    window.renderActiveTab();
  });
  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  const card=page.locator('#tab-dion .overview-kpi-row [data-personal-kpi="income"]');
  await expect(card).toContainText('Totaal inkomen');
  await expect(card).toContainText('Salaris');
  await expect(card).toContainText('Overige inkomsten');
  await expect(card).not.toContainText('Zakgeld');
});

test('opgeslagen inkomen valt niet terug door een nieuwere cloudsnapshot', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    CloudAdapter.unsubscribe?.();
    CloudAdapter.unsubscribe = null;
    CloudAdapter.db = null;
    CloudAdapter.docRef = null;
    const copy = value => JSON.parse(JSON.stringify(value));
    const base = copy(window.state);
    window.__incomeCloudTestBase = base;
    CloudAdapter.confirmedState = copy(base);
    CloudAdapter.initialSyncComplete = true;
    CloudAdapter.cloudVersion = 100;
    CloudAdapter.lastCloudSignature = `${Number(base.meta.revision)||0}|${base.meta.updatedAt||''}|${base.meta.updatedBy||''}`;
  });
  await page.locator('[data-income-edit="dion"]').first().click();
  await page.locator('#incomeEditInput').fill('2344');
  await page.locator('#btnSaveIncomeEdit').click();
  const result = await page.evaluate(async () => {
    const copy = value => JSON.parse(JSON.stringify(value));
    const salary = value => [...value.incomeDefaultsHistory.dion]
      .filter(item => item.effectiveFrom <= value.meta.selectedMonth)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .at(-1).salary;
    const base = window.__incomeCloudTestBase;
    const afterSave = salary(window.state);

    const remote = copy(base);
    remote.meta.revision = (Number(base.meta.revision) || 0) + 1;
    remote.meta.updatedAt = new Date(Date.now() + 1000).toISOString();
    remote.meta.updatedBy = 'ander-apparaat';
    remote.meta.scenario = base.meta.scenario === 'voor' ? 'na' : 'voor';
    await CloudAdapter.rebasePendingOntoRemote({syncVersion:101,commitId:'remote',state:remote}, remote, CloudAdapter.pendingState, null);
    return {
      afterSave,
      afterRemote: salary(window.state),
      remoteScenarioKept: window.state.meta.scenario === remote.meta.scenario,
      pendingSalary: salary(CloudAdapter.pendingState)
    };
  });
  expect(result).toEqual({afterSave:2344,afterRemote:2344,remoteScenarioKept:true,pendingSalary:2344});
});

test('een no-op veroorzaakt geen revision of lokale write', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    commitChange(() => {}, { render: false });
    const beforeRevision = Number(window.state.meta.revision) || 0;
    let saves = 0;
    const originalSave = DataAdapter.save;
    DataAdapter.save = (...args) => {
      saves += 1;
      return originalSave.apply(DataAdapter, args);
    };
    const ok = commitChange(() => {}, { render: false });
    DataAdapter.save = originalSave;
    return {
      ok,
      saves,
      beforeRevision,
      afterRevision: Number(window.state.meta.revision) || 0
    };
  });
  expect(result).toEqual({
    ok: true,
    saves: 0,
    beforeRevision: result.beforeRevision,
    afterRevision: result.beforeRevision
  });
});

test('backdrop sluit ook na interne klikken en na opnieuw openen', async ({ page }) => {
  await page.goto('/');
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.evaluate(() => openTransactionModal());
    const modal = page.locator('#transactionModal');
    await expect(modal).toHaveClass(/open/);
    await modal.locator('#txAmount').click();
    await expect(modal).toHaveClass(/open/);
    await modal.click({ position: { x: 2, y: 2 } });
    await expect(modal).not.toHaveClass(/open/);
  }
});
