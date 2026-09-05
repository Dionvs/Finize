const { expect, test } = require('@playwright/test');

function parseEuro(text) {
  return Number(String(text).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
}

test('desktop spaardoelen en data back-up renderen volledig', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('firestore.googleapis.com')) errors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const dashboardDistributionCards = page.locator('#tab-dashboard .u5-planning-realisation > .card');
  await expect(dashboardDistributionCards).toHaveCount(2);
  await expect(dashboardDistributionCards.nth(0)).toContainText('Geplande verdeling');
  await expect(dashboardDistributionCards.nth(1)).toContainText('Verdeling Dion / Dara');
  await expect(page.locator('#tab-dashboard')).not.toContainText('Werkelijk maandresultaat');
  const dashboardIncomeValues = await page.locator('#tab-dashboard .u5-primary-kpi .metric-value').allTextContents();
  expect(dashboardIncomeValues).toHaveLength(4);
  expect(parseEuro(dashboardIncomeValues[2])).toBeCloseTo(
    parseEuro(dashboardIncomeValues[0]) + parseEuro(dashboardIncomeValues[1]),
    2
  );
  const flowIcon = await page.locator('.u5-flow-list > div').nth(1).locator('span').evaluate(element =>
    getComputedStyle(element, '::before').content
  );
  expect(flowIcon).toBe('"−"');
  await expect(page.locator('.u5-flow-list')).not.toContainText('âˆ');

  await page.locator('.v4-sidebar [data-tab="dion"]').click();
  const dionBudget = page.locator('#tab-dion .card').filter({ hasText: 'Budgetgebruik deze maand' }).first();
  await expect(dionBudget).toBeVisible();
  await expect(dionBudget.locator('.progress-item').first()).toBeVisible();
  await dionBudget.getByRole('button', { name: 'Maandbudgetten van Dion wijzigen' }).click();
  const dionBudgetDialog = page.getByRole('dialog', { name: 'Variabele lasten aanpassen' });
  await expect(dionBudgetDialog.getByRole('heading', { name: 'Dion variabele lasten' })).toBeVisible();
  await expect(dionBudgetDialog.getByRole('spinbutton', { name: 'Maandbudget' }).first()).toBeVisible();
  const budgetScope = dionBudgetDialog.getByRole('combobox', { name: 'Geldigheid' });
  await expect(budgetScope).toHaveValue('from');
  await expect(budgetScope.locator('option')).toHaveCount(2);
  await expect(dionBudgetDialog.getByRole('button', { name: 'Opslaan' })).toBeVisible();
  await dionBudgetDialog.getByRole('button', { name: 'Sluiten' }).click();
  await page.getByRole('button', { name: 'Spaargeld van Dion voor deze maand aanpassen' }).click();
  const personalSavingDialog = page.getByRole('dialog', { name: 'Spaargeld van Dion aanpassen' });
  await expect(personalSavingDialog.getByText('Automatisch berekend')).toBeVisible();
  await expect(personalSavingDialog.getByRole('spinbutton', { name: 'Eigen spaarbedrag voor deze maand' })).toBeVisible();
  await expect(personalSavingDialog.getByRole('button', { name: 'Automatisch gebruiken' })).toBeVisible();
  await personalSavingDialog.getByRole('button', { name: 'Annuleren' }).click();
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="dion"]')).toBeVisible();
  await expect(page.locator('#tab-dion .u5-joint-activity-row')).toHaveCount(1);
  await expect(page.locator('#tab-dion .u5-fixed-costs-overview')).toBeVisible();
  await expect(page.locator('#tab-dion .u5-joint-goals-preview')).toBeVisible();
  await expect(page.locator('#tab-dion .manage-stack')).not.toContainText('Eigen vaste lasten');
  await page.locator('.overview-kpi-row [data-u3-planning-owner="dion"]').click();
  const dionFixedDialog = page.getByRole('dialog');
  await expect(dionFixedDialog.getByRole('heading', { name: 'Dion vaste lasten' })).toBeVisible();
  await expect(dionFixedDialog).not.toContainText('Inkomstenbronnen');
  const dionFixedRows = dionFixedDialog.locator('.u3-admin-row');
  for (let index = 0; index < await dionFixedRows.count(); index += 1) {
    await expect(dionFixedRows.nth(index)).toContainText('→ Dion');
  }
  await dionFixedDialog.getByRole('button', { name: 'Sluiten' }).click();

  await page.locator('.v4-sidebar [data-tab="dara"]').click();
  const daraBudget = page.locator('#tab-dara .card').filter({ hasText: 'Budgetgebruik deze maand' }).first();
  await expect(daraBudget).toBeVisible();
  await expect(daraBudget.locator('.progress-item').first()).toBeVisible();
  await daraBudget.getByRole('button', { name: 'Maandbudgetten van Dara wijzigen' }).click();
  await expect(page.getByRole('dialog', { name: 'Variabele lasten aanpassen' }).getByRole('heading', { name: 'Dara variabele lasten' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Variabele lasten aanpassen' }).getByRole('button', { name: 'Sluiten' }).click();
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="dara"]')).toBeVisible();
  await expect(page.locator('#tab-dara .u5-fixed-costs-overview')).toBeVisible();
  await expect(page.locator('#tab-dara .u5-joint-goals-preview')).toBeVisible();

  await page.locator('.v4-sidebar [data-tab="gezamenlijk"]').click();
  await expect(page.locator('#tab-gezamenlijk .u5-joint-budget-card')).toBeVisible();
  await page.locator('#tab-gezamenlijk .u5-joint-budget-card').getByRole('button', { name: 'Gezamenlijke maandbudgetten wijzigen' }).click();
  await expect(page.getByRole('dialog', { name: 'Variabele lasten aanpassen' }).getByRole('heading', { name: 'Variabele lasten', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Variabele lasten aanpassen' }).getByRole('button', { name: 'Sluiten' }).click();
  await expect(page.locator('#tab-gezamenlijk')).not.toContainText('Recente gezamenlijke uitgaven');
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="gezamenlijk"]')).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk .u5-fixed-costs-overview')).toBeVisible();
  const jointGoals=page.locator('#tab-gezamenlijk .u5-joint-goals-preview');
  await expect(jointGoals).toBeVisible();
  await expect(jointGoals.locator('.goal-table')).toBeVisible();
  await expect(jointGoals.getByRole('button',{name:'Spaargeld van deze maand aanpassen'})).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk .overview-kpi-row')).toContainText('Over deze maand');
  await expect(page.locator('#tab-gezamenlijk .manage-stack')).not.toContainText('Sparen');
  await expect(page.locator('#tab-gezamenlijk .manage-stack')).not.toContainText('Beheer vaste lasten');

  await page.locator('.v4-sidebar [data-tab="spaardoelen"]').click();
  await expect(page.locator('#tab-spaardoelen .u5-goal-master')).toBeVisible();
  await expect(page.locator('#tab-spaardoelen .u5-goal-list-card').first()).toBeVisible();
  await expect(page.locator('#tab-spaardoelen .u5-goal-detail')).toBeVisible();

  await page.locator('.v4-sidebar [data-tab="data"]').click();
  await expect(page.locator('#tab-data .u5-data-sections')).toBeVisible();
  await expect(page.locator('#btnExport')).toBeVisible();
  await expect(page.locator('#btnRestoreBackup')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('persoonlijke spaardoelen met subdoelen klappen op desktop open',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/');
  await page.evaluate(()=>{
    state.spaardoelen.dion=[{
      id:'desktop-subgoals',naam:'Koffie-uitrusting',doelbedrag:400,algespaard:150,doeldatum:'2027-12-31',
      vasteInleg:0,rendement:0,rendementPeriode:'jaarlijks',favoriet:true,eigenaar:'dion',ratoVerdeling:true,
      subdoelen:[
        {id:'machine',naam:'Espressomachine',doelbedrag:300,gespaard:150,link:'',voltooid:false},
        {id:'molen',naam:'Koffiemolen',doelbedrag:100,gespaard:0,link:'',voltooid:false}
      ]
    }];
    document.querySelector('.v4-sidebar [data-tab="dion"]').click();
  });
  const card=page.locator('#tab-dion .u5-joint-goals-preview');
  const toggle=card.getByRole('button',{name:'Koffie-uitrusting'});
  const panel=card.locator('.goal-table-subgoal-detail');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Espressomachine');
  await expect(panel).toContainText('Koffiemolen');
  await toggle.press('Enter');
  await expect(panel).toBeHidden();
  await toggle.press('Space');
  await expect(panel).toBeVisible();
  await page.locator('.v4-sidebar [data-tab="spaardoelen"]').click();
  await page.locator('[data-open-goal-editor="dion:desktop-subgoals"]:visible').first().click();
  await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();
  const editor=page.locator('#incomeEditModal .goal-detail-editor');
  await expect(editor).toBeVisible();
  expect(await editor.evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThan(800);
  const rowOverflow=await editor.locator('.u2-subgoal-row').evaluateAll(rows=>rows.map(row=>row.scrollWidth-row.clientWidth));
  expect(Math.max(...rowOverflow)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('subdoelen zijn rechtstreeks in de spaardoelentabel uitklapbaar en bewerkbaar',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await page.evaluate(()=>{
    state.spaardoelen.dion=[{
      id:'table-subgoals',naam:'Koffie-uitrusting',doelbedrag:400,algespaard:150,doeldatum:'2027-12-31',
      vasteInleg:0,rendement:0,rendementPeriode:'jaarlijks',favoriet:true,eigenaar:'dion',ratoVerdeling:true,
      subdoelen:[
        {id:'table-machine',naam:'Espressomachine',doelbedrag:300,gespaard:150,link:'',voltooid:false},
        {id:'table-molen',naam:'Koffiemolen',doelbedrag:100,gespaard:0,link:'',voltooid:false}
      ]
    }];
    document.querySelector('.v4-sidebar [data-tab="spaardoelen"]').click();
  });
  await page.getByRole('button',{name:'Tabelweergave'}).click();
  await expect(page.locator('#tab-spaardoelen .u5-goal-table-stack').getByRole('heading',{name:'Dion'})).toBeVisible();
  const toggle=page.locator('[data-table-subgoal-toggle][data-goal-id="table-subgoals"]');
  const panel=page.locator('#manage-subgoals-spaardoelen-dion-table-subgoals');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-goal-subgoal-edit]')).toHaveCount(2);
  await panel.locator('[data-subgoal-id="table-machine"][data-goal-subgoal-field="naam"]').fill('Nieuwe espressomachine');
  await panel.locator('[data-subgoal-id="table-machine"][data-goal-subgoal-field="naam"]').press('Tab');
  await expect(panel).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion[0].subdoelen[0].naam)).toBe('Nieuwe espressomachine');
  await panel.locator('[data-subgoal-id="table-machine"][data-goal-subgoal-field="doelbedrag"]').fill('350');
  await panel.locator('[data-subgoal-id="table-machine"][data-goal-subgoal-field="doelbedrag"]').press('Tab');
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion[0].doelbedrag)).toBe(450);
  await panel.getByRole('button',{name:'+ Subdoel'}).click();
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion[0].subdoelen.length)).toBe(3);
  await expect(panel).toBeVisible();
  const overflow=await panel.locator('.goal-table-subgoal-editor').evaluate(element=>element.scrollWidth-element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('mobiel en desktop beheren vaste lasten via dezelfde canonieke editor',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const legacyBefore=await page.evaluate(()=>{
    state.meta.scenario='voor';
    state.recurringFixedExpenses.voor.push({
      id:'parity-joint',naam:'Pariteit gezamenlijke last',categorie:'Wonen',bedrag:80,rekening:'gezamenlijk',financialFor:'gezamenlijk',
      frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-01-01',einddatum:'',afschrijfdatum:'',actief:true,
      distributionMode:'income-ratio',amountHistory:[{id:'amount-parity-joint',effectiveFrom:'2026-01-01',amount:80}],monthOverrides:{},recognition:{}
    });
    state.recurringFixedExpenses.voor.push({
      id:'parity-personal',naam:'Pariteit persoonlijk',categorie:'Overig',bedrag:25,rekening:'dion',financialFor:'dion',
      frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-01-01',einddatum:'',afschrijfdatum:'',actief:true,
      distributionMode:'equal',amountHistory:[{id:'amount-parity-personal',effectiveFrom:'2026-01-01',amount:25}],monthOverrides:{},recognition:{}
    });
    renderActiveTab();
    return JSON.stringify(state.voor.gezamenlijk.vasteLasten);
  });

  await page.locator('.v4-bottom-nav [data-tab="gezamenlijk"]').click();
  await expect(page.locator('#tab-gezamenlijk [data-open-owner-fixed]')).toHaveCount(0);
  const mobileFixed=page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]');
  await expect(mobileFixed).toBeVisible();
  await mobileFixed.click();
  const planning=page.getByRole('dialog');
  await expect(planning.getByRole('heading',{name:'Gezamenlijk vaste lasten'})).toBeVisible();
  await planning.locator('.u3-admin-row').filter({hasText:'Pariteit gezamenlijke last'}).getByRole('button',{name:'Bewerken'}).click();
  const editor=page.getByRole('dialog');
  await expect(editor.locator('#u3RecDistributionField')).toBeVisible();
  await editor.locator('#u3RecDistribution').selectOption('equal');
  await editor.locator('#u3RecDebitDate').fill('2026-09-05');
  await editor.getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='parity-joint')?.distributionMode)).toBe('equal');
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='parity-joint')?.afschrijfdatum)).toBe('2026-09-05');
  expect(await page.evaluate(()=>JSON.stringify(state.voor.gezamenlijk.vasteLasten))).toBe(legacyBefore);
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Pariteit gezamenlijke last'})).toContainText('50/50');
  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();

  for(const width of [768,1024,1280]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>renderActiveTab());
    await expect(page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first()).toBeVisible();
  }
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();
  const desktopRow=page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Pariteit gezamenlijke last'});
  await expect(desktopRow).toContainText('50/50');
  await desktopRow.getByRole('button',{name:'Bewerken'}).click();
  await page.getByRole('dialog').locator('#u3RecDistribution').selectOption('income-ratio');
  await page.getByRole('dialog').getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='parity-joint')?.distributionMode)).toBe('income-ratio');
  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>renderActiveTab());
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').click();
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Pariteit gezamenlijke last'})).toContainText('Naar rato · Dion minimaal 40%');
  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();

  await page.locator('.v4-bottom-nav [data-tab="dion"]').click();
  await page.locator('#tab-dion [data-u3-planning-owner="dion"]').click();
  await page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Pariteit persoonlijk'}).getByRole('button',{name:'Bewerken'}).click();
  await expect(page.getByRole('dialog').locator('#u3RecDistributionField')).toBeHidden();
  await expect(page.getByRole('dialog').locator('#u3RecDistribution')).toBeDisabled();
  await page.setViewportSize({width:360,height:800});
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('de gedeelde mobiele editor bewaart 50/50 ook na verkoop',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>{
    state.meta.scenario='na';
    state.recurringFixedExpenses.na.push({
      id:'parity-after-sale',naam:'Last na verkoop',categorie:'Wonen',bedrag:120,rekening:'gezamenlijk',financialFor:'gezamenlijk',
      frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-01-01',einddatum:'',afschrijfdatum:'',actief:true,
      distributionMode:'income-ratio',amountHistory:[{id:'amount-parity-after-sale',effectiveFrom:'2026-01-01',amount:120}],monthOverrides:{},recognition:{}
    });
    renderActiveTab();
  });
  await page.locator('.v4-bottom-nav [data-tab="gezamenlijk"]').click();
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').click();
  await page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Last na verkoop'}).getByRole('button',{name:'Bewerken'}).click();
  const editor=page.getByRole('dialog');
  await expect(editor.locator('#u3RecDistribution')).toHaveValue('income-ratio');
  await expect(editor.locator('#u3RecDistribution').locator('option').first()).toHaveText('Naar rato van inkomen');
  await editor.locator('#u3RecDistribution').selectOption('equal');
  await editor.getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.na.find(item=>item.id==='parity-after-sale')?.distributionMode)).toBe('equal');
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Last na verkoop'})).toContainText('50/50');
});

test('mobiel voegt een canonieke vaste last met maanduitzondering toe en kan die stoppen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>{state.meta.scenario='voor';renderActiveTab();});
  const month=await page.evaluate(()=>getSelectedMonth());
  const legacyBefore=await page.evaluate(()=>JSON.stringify(state.voor.gezamenlijk.vasteLasten));
  await page.locator('.v4-bottom-nav [data-tab="gezamenlijk"]').click();
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').click();
  await page.getByRole('dialog').getByRole('button',{name:'+ Vaste last'}).click();
  const editor=page.getByRole('dialog');
  await editor.locator('#u3RecName').fill('Mobiele canonieke last');
  await editor.locator('#u3RecAmount').fill('42.50');
  await editor.locator('#u3RecCategory').fill('Test');
  await editor.locator('#u3RecDebitDate').fill(`${month}-12`);
  await editor.locator('#u3RecDistribution').selectOption('equal');
  await editor.locator('#u3RecScope').selectOption('once');
  await editor.getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.naam==='Mobiele canonieke last')?.distributionMode)).toBe('equal');
  await expect.poll(()=>page.evaluate(selectedMonth=>state.recurringFixedExpenses.voor.find(item=>item.naam==='Mobiele canonieke last')?.monthOverrides[selectedMonth],month)).toBe(42.5);
  expect(await page.evaluate(()=>JSON.stringify(state.voor.gezamenlijk.vasteLasten))).toBe(legacyBefore);
  const row=page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Mobiele canonieke last'});
  await row.getByRole('button',{name:'Bewerken'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Stoppen'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.naam==='Mobiele canonieke last')?.actief)).toBe(false);
});

test('vaste lasten laten hun verdeling aanpassen en bewaren een administratieve afschrijfdatum',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/');
  await page.evaluate(()=>{
    state.meta.scenario='voor';
    state.recurringFixedExpenses.voor.push({
      id:'admin-fixed-date',naam:'Administratieve last',categorie:'Wonen',bedrag:73.45,rekening:'gezamenlijk',financialFor:'gezamenlijk',
      frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-01-01',einddatum:'',afschrijfdatum:'',actief:true,
      amountHistory:[{id:'amount-admin-fixed',effectiveFrom:'2026-01-01',amount:73.45}],monthOverrides:{},recognition:{text:'',counterparty:'',amountTolerance:5}
    });
    document.querySelector('.v4-sidebar [data-tab="gezamenlijk"]').click();
  });
  await page.locator('.overview-kpi-row [data-u3-planning-owner="gezamenlijk"]').click();
  const planning=page.getByRole('dialog');
  const row=planning.locator('.u3-admin-row').filter({hasText:'Administratieve last'});
  await expect(row).toContainText('Naar rato · Dion minimaal 40%');
  const ratioResult=await page.evaluate(()=>({zakgeld:FinizeUpdate3.scenarioResult().dion.zakgeld,ratio:FinizeUpdate3.scenarioResult().effDion}));
  await row.getByRole('button',{name:'Bewerken'}).click();
  const editor=page.getByRole('dialog');
  await expect(editor.locator('#u3RecDistribution')).toHaveValue('income-ratio');
  await editor.locator('#u3RecDistribution').selectOption('equal');
  await editor.locator('#u3RecDebitDate').fill('2026-08-24');
  await editor.getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='admin-fixed-date')?.afschrijfdatum)).toBe('2026-08-24');
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='admin-fixed-date')?.distributionMode)).toBe('equal');
  const equalZakgeld=await page.evaluate(()=>FinizeUpdate3.scenarioResult().dion.zakgeld);
  const expectedEqual=Math.round((ratioResult.zakgeld+73.45*(ratioResult.ratio-.5))*100)/100;
  expect(Math.abs(equalZakgeld-expectedEqual)).toBeLessThanOrEqual(.011);
  expect(await page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='admin-fixed-date')?.bedrag)).toBe(73.45);
  const savedRow=page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Administratieve last'});
  await expect(savedRow).toContainText('afschrijving 24-08-2026');
  await expect(savedRow).toContainText('50/50');

  await page.setViewportSize({width:390,height:844});
  await savedRow.getByRole('button',{name:'Bewerken'}).click();
  await expect(page.getByRole('dialog').locator('#u3RecDistribution')).toBeVisible();
  await expect(page.getByRole('dialog').locator('#u3RecDistribution')).toHaveValue('equal');
  await page.getByRole('dialog').getByRole('button',{name:'Terug'}).click();

  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>{
    state.meta.scenario='na';
    state.recurringFixedExpenses.na.push({id:'admin-mortgage',naam:'Hypotheek test',categorie:'Huis',bedrag:1000,rekening:'gezamenlijk',financialFor:'gezamenlijk',frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-01-01',einddatum:'',actief:true,amountHistory:[{id:'amount-admin-mortgage',effectiveFrom:'2026-01-01',amount:1000}],monthOverrides:{},recognition:{},legacyKind:'hypotheek'});
    renderActiveTab();
  });
  await page.locator('.overview-kpi-row [data-u3-planning-owner="gezamenlijk"]').click();
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Hypotheek test'})).toContainText('50/50');
});

test('spaardoelkaarten wijzigen direct van volgorde zonder beheerpop-up',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>{
    state.spaardoelen.dion=[
      {id:'direct-a',naam:'Eerste doel',doelbedrag:100,algespaard:0,doeldatum:'2027-12-31',vasteInleg:0,rendement:0,rendementPeriode:'jaarlijks',favoriet:false,eigenaar:'dion',ratoVerdeling:true,subdoelen:[]},
      {id:'direct-b',naam:'Tweede doel',doelbedrag:200,algespaard:0,doeldatum:'2027-12-31',vasteInleg:0,rendement:0,rendementPeriode:'jaarlijks',favoriet:false,eigenaar:'dion',ratoVerdeling:true,subdoelen:[]}
    ];
    document.querySelector('.v4-bottom-nav [data-tab="spaardoelen"]').click();
  });
  const ownerSection=page.locator('.mobile-goal-section').filter({has:page.getByRole('heading',{name:'Dion',exact:true})});
  await expect(ownerSection.locator('[data-reorder-goal]')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ownerSection.getByRole('button',{name:'Eerste doel omhoog'})).toBeDisabled();
  await expect(ownerSection.getByRole('button',{name:'Tweede doel omlaag'})).toBeDisabled();
  const arrowBoxes=await ownerSection.locator('.goal-direct-order-arrow').evaluateAll(buttons=>buttons.map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})));
  arrowBoxes.forEach(box=>{expect(box.width).toBeLessThanOrEqual(24);expect(box.height).toBeLessThanOrEqual(22);});
  await ownerSection.getByRole('button',{name:'Tweede doel omhoog'}).click();
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.map(goal=>goal.id).join(','))).toBe('direct-b,direct-a');
  await ownerSection.getByRole('button',{name:'Tweede doel omlaag'}).click();
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.map(goal=>goal.id).join(','))).toBe('direct-a,direct-b');
  await ownerSection.getByRole('button',{name:'+ Spaardoel'}).click();
  await expect(page.getByRole('heading',{name:'Spaardoel bewerken'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Spaardoelen beheren'})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.length)).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Sluiten'}).click();

  await page.setViewportSize({width:768,height:900});
  await page.evaluate(()=>{state.spaardoelen.dion[0].naam='olympische spelen 2032 met een extra lange naam';renderActiveTab();});
  const desktopCard=page.locator('.u5-goal-list-card').filter({hasText:'olympische spelen 2032'});
  await expect(desktopCard).toBeVisible();
  const fit=await desktopCard.evaluate(card=>{
    const title=card.querySelector('.u5-goal-list-title strong').getBoundingClientRect();
    const percent=card.querySelector(':scope > b').getBoundingClientRect();
    const bounds=card.getBoundingClientRect();
    return {overflow:card.scrollWidth-card.clientWidth,titleRight:title.right,percentLeft:percent.left,percentRight:percent.right,boundsRight:bounds.right};
  });
  expect(fit.overflow).toBeLessThanOrEqual(1);
  expect(fit.titleRight).toBeLessThanOrEqual(fit.percentLeft);
  expect(fit.percentRight).toBeLessThanOrEqual(fit.boundsRight);
});

test('budgetten openen op desktop transacties en zijn op mobiel bewerkbaar', async ({ page }) => {
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/');
  await page.locator('.v4-sidebar [data-tab="dion"]').click();
  const desktopBudget=page.locator('#tab-dion .budget-usage-button').first();
  const category=await desktopBudget.locator('strong').innerText();
  await desktopBudget.click();
  const transactionsModal=page.locator('#transactionModal.open .budget-transactions-modal');
  await expect(transactionsModal.getByRole('heading',{name:category})).toBeVisible();
  await expect(transactionsModal).toContainText(/transactie/);
  await transactionsModal.getByRole('button',{name:'Sluiten'}).click();

  await page.setViewportSize({ width:390, height:844 });
  await page.reload();
  await page.locator('.v4-bottom-nav [data-tab="gezamenlijk"]').click();
  const jointEdit=page.locator('#tab-gezamenlijk').getByRole('button',{name:'Gezamenlijke maandbudgetten wijzigen'});
  await expect(jointEdit).toContainText('Wijzig');
  expect((await jointEdit.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await jointEdit.click();
  const jointDialog=page.getByRole('dialog',{name:'Variabele lasten aanpassen'});
  await expect(jointDialog.getByRole('heading',{name:'Variabele lasten',exact:true})).toBeVisible();
  await jointDialog.getByRole('button',{name:'Sluiten'}).click();

  await page.locator('.v4-bottom-nav [data-tab="dion"]').click();
  const personalEdit=page.locator('#tab-dion').getByRole('button',{name:'Maandbudgetten van Dion wijzigen'});
  await expect(personalEdit).toContainText('Wijzig');
  await personalEdit.click();
  const personalDialog=page.getByRole('dialog',{name:'Variabele lasten aanpassen'});
  await expect(personalDialog.getByRole('heading',{name:'Dion variabele lasten'})).toBeVisible();
  await personalDialog.getByRole('button',{name:'Sluiten'}).click();
});

test('mobiele spaardoelbalken houden hun vaste breedte', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/');
  const mobileIncomeValues = await page.locator('#tab-dashboard .mobile-kpi-card .mobile-kpi-value').allTextContents();
  expect(mobileIncomeValues).toHaveLength(4);
  expect(parseEuro(mobileIncomeValues[2])).toBeCloseTo(
    parseEuro(mobileIncomeValues[0]) + parseEuro(mobileIncomeValues[1]),
    2
  );
  await page.locator('.v4-bottom-nav [data-tab="spaardoelen"]').click();

  const measurements = await page.locator('#tab-spaardoelen .mobile-goal-main').evaluateAll(items =>
    items.map(item => {
      const amount = item.querySelector(':scope > span');
      const bar = item.querySelector(':scope > .progress-track');
      const inleg = item.querySelector(':scope > .goal-inleg-breakdown');
      return {
        amount: amount?.getBoundingClientRect().width,
        bar: bar?.getBoundingClientRect().width,
        inleg: inleg?.getBoundingClientRect().width,
        amountAlign: amount ? getComputedStyle(amount).textAlign : '',
        inlegAlign: inleg ? getComputedStyle(inleg).textAlign : ''
      };
    })
  );

  expect(measurements.length).toBeGreaterThan(0);
  measurements.forEach(item => {
    expect(item.amount).toBe(104);
    expect(item.bar).toBe(104);
    expect(item.inleg).toBe(104);
    expect(item.amountAlign).toBe('center');
    expect(item.inlegAlign).toBe('center');
  });
});
