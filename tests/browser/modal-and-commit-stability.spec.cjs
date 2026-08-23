const { expect, test } = require('@playwright/test');

function parseEuro(text){
  return Number(String(text).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
}

test('transacties worden alleen vanuit persoonlijk en gezamenlijk toegevoegd', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-open-transaction], [data-open-general-transaction]')).toHaveCount(0);

  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  await page.getByRole('button',{name:'+ Gezamenlijke uitgave'}).click();
  const modal = page.locator('#transactionModal');
  await expect(modal).toHaveClass(/open/);
  await expect(modal.getByRole('heading',{name:'Uitgave toevoegen'})).toBeVisible();
  await expect(modal.getByRole('button',{name:/Bankbestand importeren/})).toBeVisible();
  await modal.getByRole('button',{name:/Handmatig invoeren/}).click();
  await expect(modal.getByRole('heading',{name:'Gezamenlijke uitgave'})).toBeVisible();
  await expect(modal.getByLabel('Eigenaar')).toHaveCount(0);
  await modal.locator('#btnCloseJointTransaction').click();
  await expect(modal).not.toHaveClass(/open/);

  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  await page.getByRole('button',{name:'+ Uitgave van Dion'}).click();
  await expect(modal.getByRole('heading',{name:'Uitgave toevoegen'})).toBeVisible();
  await modal.getByRole('button',{name:/Handmatig invoeren/}).click();
  await expect(modal.getByRole('heading',{name:'Dion uitgave'})).toBeVisible();
  await expect(modal.getByLabel('Eigenaar')).toHaveCount(0);
  await modal.locator('#personalTxAmount').fill('12.34');
  await modal.locator('#personalTxDescription').fill('Persoonlijke test');
  await modal.locator('#btnSavePersonalTransaction').click();
  await expect.poll(()=>page.evaluate(()=>window.state.transactions.at(-1)?.owner)).toBe('dion');
});

test('bankimport opent vanuit de gekozen uitgavenknop en staat niet op dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Bank import & uitgaven',{exact:true})).toHaveCount(0);
  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  await page.getByRole('button',{name:'+ Uitgave van Dion'}).click();
  await page.locator('#transactionModal').getByRole('button',{name:/Bankbestand importeren/}).click();
  const importModal=page.locator('#u4ImportModalRoot');
  await expect(importModal).toHaveClass(/open/);
  await expect(importModal.getByRole('heading',{name:'Bankimport'})).toBeVisible();
  await expect(importModal).toContainText('Dion');
  await expect(importModal.locator('[data-u4-file]')).toHaveCount(1);
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

test('gezamenlijk over deze maand gebruikt alle inkomsten en trekt zakgeld alleen visueel af', async ({ page }) => {
  await page.goto('/');
  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  const cards=page.locator('#tab-gezamenlijk .overview-kpi-row .icon-kpi');
  const incomeCard=cards.filter({hasText:'Totaal gezamenlijk inkomen'});
  const remainingCard=cards.filter({hasText:'Over deze maand'});
  const incomeBefore=parseEuro(await incomeCard.locator('.metric-value').innerText());
  await page.evaluate(() => {
    const month=window.state.meta.selectedMonth;
    window.state.transactions.push({id:'joint-extra-income-test',date:month+'-14',owner:'gezamenlijk',kind:'inkomen',transactionType:'overige-inkomsten',amount:125,description:'Gezamenlijk extra inkomen'});
    window.renderActiveTab();
  });
  const incomeAfter=parseEuro(await incomeCard.locator('.metric-value').innerText());
  expect(incomeAfter-incomeBefore).toBe(125);
  const fixed=parseEuro(await cards.filter({hasText:'Vaste lasten totaal'}).locator('.metric-value').innerText());
  const used=parseEuro((await cards.filter({hasText:'Variabel gebruikt'}).locator('.metric-value').innerText()).split('/')[0]);
  const saving=parseEuro(await page.locator('#tab-gezamenlijk .savings-month-button strong').innerText());
  const remaining=parseEuro(await remainingCard.locator('.metric-value').innerText());
  await expect(remainingCard.locator('.metric-sub')).toHaveCount(0);
  await page.locator('.v4-sidebar .tab-btn[data-tab="dashboard"]').click();
  const allowance=parseEuro(await page.locator('#tab-dashboard .allowance-return-card .metric-value').innerText());
  expect(remaining).toBeCloseTo(incomeAfter-fixed-used-saving-allowance,2);
});

test('gezamenlijk inkomen vervangt standaardsalaris en negeert oude dubbele teruggaven', async ({ page }) => {
  await page.goto('/');
  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  await page.evaluate(() => {
    const month='2026-07';
    window.__incomeTestSavedState={
      transactions:structuredClone(state.transactions),
      monthlyTeruggaven:structuredClone(state.monthlyTeruggaven),
      incomeDefaultsHistory:structuredClone(state.incomeDefaultsHistory),
      monthlyIncomeOverrides:structuredClone(state.monthlyIncomeOverrides),
      monthlyRefundOverrides:structuredClone(state.monthlyRefundOverrides),
      recurringIncomeSources:structuredClone(state.recurringIncomeSources),
      selectedMonth:state.meta.selectedMonth
    };
    state.meta.selectedMonth=month;
    state.transactions=[
      {id:'salary-a',date:`${month}-05`,owner:'gezamenlijk',kind:'inkomen',processing:{transactionType:'salaris',include:true},amount:800,description:'Werkgever Dion — Deel 1'},
      {id:'salary-b',date:`${month}-24`,owner:'gezamenlijk',kind:'inkomen',transactionType:'salaris',amount:1200,description:'Werkgever Dion — Deel 2'},
      {id:'extra',date:`${month}-08`,owner:'gezamenlijk',kind:'inkomen',transactionType:'overige-inkomsten',amount:50,description:'Naam: Cadeau'},
      {id:'refund',date:`${month}-09`,owner:'dion',kind:'uitgave',transactionType:'terugbetaling',amount:20,description:'Naam: Terugbetaling'},
      {id:'duo',date:`${month}-20`,owner:'dion',kind:'inkomen',transactionType:'overige-inkomsten',amount:300.5,description:'DUO Hoofdrekening'},
      {id:'transfer',date:`${month}-21`,owner:'gezamenlijk',kind:'interne-overboeking',transactionType:'van-spaarrekening',amount:500,description:'Oranje Spaarrekening'}
    ];
    state.incomeDefaultsHistory={
      dion:[{id:'dion-default',effectiveFrom:'0000-01',salary:2000,refund:300}],
      dara:[{id:'dara-default',effectiveFrom:'0000-01',salary:3000,refund:0}]
    };
    state.monthlyIncomeOverrides={};
    state.monthlyRefundOverrides={};
    state.recurringIncomeSources=[{
      id:'duo-source',naam:'DUO',legacyKind:'fixed-refund',eigenaar:'dion',actief:true,
      verwachtBedrag:300,amountHistory:[{effectiveFrom:'0000-01',amount:300}],recognition:{text:'duo',amountTolerance:10}
    }];
    state.monthlyTeruggaven={[month]:{
      dion:[{id:'duplicate-refund',omschrijving:'Terugbetaling',bedrag:20}],
      dara:[],
      gezamenlijk:[
        {id:'duplicate-extra',omschrijving:'Cadeau',bedrag:50},
        {id:'stale-transfer',omschrijving:'Oranje Spaarrekening',bedrag:500},
        {id:'manual-only',omschrijving:'Los handmatig bedrag',bedrag:30}
      ]
    }};
    renderActiveTab();
  });
  const incomeCard=page.locator('#tab-gezamenlijk .overview-kpi-row .icon-kpi').filter({hasText:'Totaal gezamenlijk inkomen'});
  expect(parseEuro(await incomeCard.locator('.metric-value').innerText())).toBe(5400.5);
  await page.evaluate(() => {
    const saved=window.__incomeTestSavedState;
    Object.assign(state,saved);
    state.meta.selectedMonth=saved.selectedMonth;
    delete state.selectedMonth;
    delete window.__incomeTestSavedState;
    renderActiveTab();
  });
});

test('twee herkende werkgevers vervangen in juli beide persoonlijke standaardsalarissen', async ({ page }) => {
  await page.goto('/');
  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  await page.evaluate(() => {
    window.__julyIncomeSavedState={
      transactions:structuredClone(state.transactions),
      monthlyTeruggaven:structuredClone(state.monthlyTeruggaven),
      incomeDefaultsHistory:structuredClone(state.incomeDefaultsHistory),
      monthlyIncomeOverrides:structuredClone(state.monthlyIncomeOverrides),
      monthlyRefundOverrides:structuredClone(state.monthlyRefundOverrides),
      recurringIncomeSources:structuredClone(state.recurringIncomeSources),
      selectedMonth:state.meta.selectedMonth
    };
    state.meta.selectedMonth='2026-07';
    state.transactions=[
      {id:'salary-dion',date:'2026-07-06',owner:'gezamenlijk',kind:'inkomen',transactionType:'salaris',amount:1294.74,description:'St-iek Fysiotherapie B.V. — Salaris juni'},
      {id:'salary-dara',date:'2026-07-24',owner:'gezamenlijk',kind:'inkomen',transactionType:'salaris',amount:3610.09,description:'Stichting SBOH — Maand 7 2026'}
    ];
    state.incomeDefaultsHistory={
      dion:[{id:'dion-default',effectiveFrom:'0000-01',salary:2650,refund:0}],
      dara:[{id:'dara-default',effectiveFrom:'0000-01',salary:3250,refund:0}]
    };
    state.monthlyIncomeOverrides={'2026-07':{dion:922.42}};
    state.monthlyRefundOverrides={};
    state.monthlyTeruggaven={'2026-07':{dion:[],dara:[],gezamenlijk:[]}};
    state.recurringIncomeSources=[];
    renderActiveTab();
  });
  const incomeCard=page.locator('#tab-gezamenlijk .overview-kpi-row .icon-kpi').filter({hasText:'Totaal gezamenlijk inkomen'});
  expect(parseEuro(await incomeCard.locator('.metric-value').innerText())).toBe(4904.83);
  await page.evaluate(() => {
    const saved=window.__julyIncomeSavedState;
    Object.assign(state,saved);
    state.meta.selectedMonth=saved.selectedMonth;
    delete state.selectedMonth;
    delete window.__julyIncomeSavedState;
    renderActiveTab();
  });
});

test('dashboard toont alleen het directe jaaroverzicht onderaan', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tab-dashboard')).not.toContainText('Maandadministratie');
  await expect(page.locator('#tab-dashboard')).not.toContainText('Onderling te verrekenen');
  const year=page.locator('#tab-dashboard .dashboard-year-overview');
  await expect(year).toBeVisible();
  await expect(year.locator('tbody tr')).toHaveCount(12);
  await expect(year.locator('details')).toHaveCount(0);
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
