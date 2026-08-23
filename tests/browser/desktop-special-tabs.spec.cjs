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

test('vaste lasten tonen hun verdeling en bewaren een administratieve afschrijfdatum',async({page})=>{
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
  await row.getByRole('button',{name:'Bewerken'}).click();
  const editor=page.getByRole('dialog');
  await expect(editor.locator('#u3RecDistributionLabel')).toHaveText('Naar rato · Dion minimaal 40%');
  await editor.locator('#u3RecDebitDate').fill('2026-08-24');
  await editor.getByRole('button',{name:'Opslaan'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='admin-fixed-date')?.afschrijfdatum)).toBe('2026-08-24');
  expect(await page.evaluate(()=>state.recurringFixedExpenses.voor.find(item=>item.id==='admin-fixed-date')?.bedrag)).toBe(73.45);
  const savedRow=page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Administratieve last'});
  await expect(savedRow).toContainText('afschrijving 24-08-2026');

  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
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
  await ownerSection.getByRole('button',{name:'Tweede doel verplaatsen'}).focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.map(goal=>goal.id).join(','))).toBe('direct-b,direct-a');
  const firstHandle=ownerSection.getByRole('button',{name:'Eerste doel verplaatsen'});
  const secondHandle=ownerSection.getByRole('button',{name:'Tweede doel verplaatsen'});
  await firstHandle.dragTo(secondHandle,{targetPosition:{x:4,y:2}});
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.map(goal=>goal.id).join(','))).toBe('direct-a,direct-b');
  const touchFrom=ownerSection.getByRole('button',{name:'Tweede doel verplaatsen'});
  const touchTo=ownerSection.getByRole('button',{name:'Eerste doel verplaatsen'});
  const [touchFromBox,touchToBox]=await Promise.all([touchFrom.boundingBox(),touchTo.boundingBox()]);
  await touchFrom.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:7,button:0,clientX:touchFromBox.x+4,clientY:touchFromBox.y+4});
  await page.evaluate(({x,y})=>document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y})),{x:touchToBox.x+4,y:touchToBox.y+2});
  await page.evaluate(({x,y})=>document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y})),{x:touchToBox.x+4,y:touchToBox.y+2});
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.map(goal=>goal.id).join(','))).toBe('direct-b,direct-a');
  await ownerSection.getByRole('button',{name:'+ Spaardoel'}).click();
  await expect(page.getByRole('heading',{name:'Spaardoel bewerken'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Spaardoelen beheren'})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.dion.length)).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
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
