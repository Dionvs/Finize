const { test, expect } = require('@playwright/test');
const { boot, navigate } = require('./helpers/v118-ux-fixture.cjs');
test.setTimeout(60000);
test.use({ actionTimeout:5000 });

test('tablet behoudt namen voor iedere navigatieknop', async ({page}) => {
  await boot(page,768);
  for(const button of await page.locator('#tabs .tab-btn:visible').all()) {
    expect(await button.getAttribute('aria-label')).toBeTruthy();
    await expect(button).toHaveAccessibleName(/\S/);
  }
});

for(const width of [390,1440]) test(`dialogen ${width}px begrenzen focus, sluiten en herstellen focus`, async ({page}) => {
  await boot(page,width);
  const cases=[
    ['gezamenlijk',()=>page.evaluate(()=>openTransactionModal()),'#btnCloseJointTransaction'],
    ['dion',()=>page.getByRole('button',{name:'Maandbudgetten van Dion wijzigen'}).click(),'[data-close-joint-variable-costs]'],
    ['spaardoelen',()=>page.locator('[data-open-goal-editor]:visible').first().click(),'[data-close-goal-editor]']
  ];
  for(const [tab,open,close] of cases){
    await navigate(page,tab);
    if(tab==='gezamenlijk')await page.locator('[data-open-joint-transaction],.tab-btn.active:visible').first().focus();
    await open();
    const dialog=page.locator('.modal-backdrop.open > .modal');
    await expect(dialog).toHaveAttribute('role','dialog');
    await expect(dialog).toHaveAccessibleName(/\S/);
    for(const key of ['Tab','Shift+Tab'])for(let i=0;i<35;i++){
      await page.keyboard.press(key);
      expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    }
    expect(await page.locator('.v4-sidebar').evaluate(el=>el.inert||!!el.closest('[inert]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(()=>!!document.activeElement.closest('[inert]'))).toBe(false);
    expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
  }
});

test('Escape en sluiten bewaren gewijzigde invoer na weigeren',async({page})=>{
  await boot(page);await navigate(page,'gezamenlijk');await page.evaluate(()=>openTransactionModal());
  await page.locator('#jointTxAmount').fill('12.34');
  const decline=dialog=>dialog.dismiss();page.on('dialog',decline);
  await page.keyboard.press('Escape');await expect(page.locator('#jointTxAmount')).toHaveValue('12.34');
  await page.locator('#btnCloseJointTransaction').click();await expect(page.locator('#jointTxAmount')).toHaveValue('12.34');
  page.off('dialog',decline);page.once('dialog',dialog=>dialog.accept());
  await page.keyboard.press('Escape');await expect(page.locator('.modal-backdrop.open')).toHaveCount(0);
});

test('inkomensbron en primaire kaartactie zijn afzonderlijk bedienbaar',async({page})=>{
  await boot(page);await navigate(page,'dion');
  const card=page.locator('[data-personal-kpi-mobile="income"]');
  await expect(card).not.toHaveAttribute('role','button');
  await card.locator('.income-source-link').first().click();
  await expect(page.locator('.modal-backdrop.open .modal')).toContainText('Zakgeld');
  await page.keyboard.press('Escape');await card.locator('.ux-card-primary').click();
  await expect(page.locator('.modal-backdrop.open .modal')).toContainText('Totaal inkomen Dion');
});

test('focusherstel vindt de oorspronkelijke kaart na hertekenen met veranderde tekst',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boot(page);await navigate(page,'dion');
  await page.locator('[data-personal-kpi-mobile="income"] .ux-card-primary').click();
  await page.evaluate(()=>{state.personen.dion.naam='Dion test';document.querySelector('#tabs [data-tab="dion"]').click();});
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-personal-kpi-mobile="income"] .ux-card-primary')).toBeFocused();
  expect(errors).toEqual([]);
});

test('vervolgactie uit informatie opent het bestaande venster en herstelt focus',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boot(page);await page.evaluate(()=>{state.recurringFixedExpenses[0].afschrijfdatum='';state.recurringFixedExpenses[0].afschrijfdag=null;});
  await navigate(page,'dashboard');const opener=page.locator('[data-p3-info="minimum"]');await opener.click();
  await page.locator('#p3-info-minimum [data-p3-action="payments"]').first().click();
  await expect(page.locator('#p3-info-minimum')).toBeHidden();
  await expect(page.locator('.modal-backdrop.open .modal')).toContainText('Betalingen binnen je prognoseperiode');
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();expect(errors).toEqual([]);
});

test('spaardoel selecteren blijft werken zonder geneste knopsemantiek',async({page})=>{
  await boot(page,1440);await navigate(page,'spaardoelen');
  const cards=page.locator('[data-u5-select-goal]');await expect(cards.first()).not.toHaveAttribute('role','button');
  const card=cards.nth(1),title=await card.locator('strong').innerText();
  await card.locator('.ux-card-primary').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.u5-goal-detail h2')).toHaveText(title);
});

for(const width of [320,390,768,1440])test(`informatie ${width}px werkt via klik, toetsenbord, Escape en buitenklik`,async({page})=>{
  await boot(page,width);
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const key of ['free','balance','minimum','buffer','chart']){
    const button=page.locator(`[data-p3-info="${key}"]`),panel=page.locator(`#p3-info-${key}`);
    await expect(panel).toBeHidden();await button.focus();await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded','true');await expect(panel).toBeVisible();
    expect(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;})).toBe(true);
    await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(button).toBeFocused();
    await button.click();await panel.locator('[data-p3-close-info]').click();await expect(panel).toBeHidden();
    await button.click();await page.locator('.p3-toolbar h2').click();await expect(panel).toBeHidden();
  }
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});

test('onvolledigheidsuitleg volgt de actuele motor en verdwenen oorzaken verdwijnen',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{state.balanceCheckpoints=[];});await navigate(page,'dashboard');
  await page.locator('[data-p3-info="minimum"]').click();
  const info=page.locator('#p3-info-minimum');await expect(info.locator('[data-p3-reason="missing-checkpoint"]')).toContainText('Vul een banksaldo');
  const actual=await page.evaluate(async()=>{const p=await FinizeLiquidity.project({accountProfileId:'ux-gezamenlijk',asOfDate:'2026-10-14',startDate:'2026-10-01',endDate:'2026-10-31'});return [...new Set(p.reasons.map(r=>r.code))].sort();});
  expect(await info.locator('[data-p3-reason]').evaluateAll(nodes=>nodes.map(n=>n.dataset.p3Reason).sort())).toEqual(actual);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>openBankAccountDetails('ux-gezamenlijk'));await page.locator('[data-balance-add]').click();
  await page.locator('[data-balance-amount]').fill('3100');await page.locator('[data-balance-date]').fill('2026-10-01');
  await page.locator('[data-balance-check]').click();await page.locator('[data-balance-confirm]').click();
  await navigate(page,'dashboard');await page.locator('[data-p3-info="minimum"]').click();
  await expect(info.locator('[data-p3-reason="missing-checkpoint"]')).toHaveCount(0);
});

test('geen bestedingsruimte en essentiële tekortwaarschuwing blijven zichtbaar',async({page})=>{
  await boot(page);await page.evaluate(()=>{state.balanceCheckpoints.find(c=>c.accountProfileId==='ux-gezamenlijk').amountCents=10000;});await navigate(page,'dashboard');
  await expect(page.locator('.p3-kpi').first()).toContainText('Geen bestedingsruimte');
  await expect(page.locator('.p3-warning')).toContainText('onder € 0');
  await expect(page.locator('.p3-no-room')).toBeVisible();
  await expect(page.locator('.p3-account-name')).toHaveText('Rekening: Gezamenlijk betalen');
});

test('jaarlegenda gebruikt de reeks-kleuren en bedragen zijn zonder hover uitleesbaar',async({page})=>{
  await boot(page,1440);
  const colors=await page.evaluate(()=>{const color=s=>getComputedStyle(document.querySelector(s)).backgroundColor;return {income:color('.p3-bar-pair i'),incomeKey:color('.p3-year-income-key i'),expense:color('.p3-bar-pair i+i'),expenseKey:color('.p3-year-expense-key i')};});
  expect(colors.income).toBe(colors.incomeKey);expect(colors.expense).toBe(colors.expenseKey);
  await expect(page.locator('.p3-year-bars [role="img"]').first()).toHaveAccessibleName(/inkomen.*uitgaven/);
});

test('volledig bruikbare prognose krijgt geen verzonnen onvolledigheidsreden',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    state.recurringFixedExpenses=[];state.recurringIncomeSources=[];state.internalTransfers=[];state.transactions=[];
    state.budgetDefaultsHistory=Object.fromEntries(['gezamenlijk','dion','dara'].map(owner=>[owner,[{effectiveFrom:'0000-01',rows:[]}]]));
    state.monthlyBudgets={};state.monthlyIncomeOverrides={};
    state.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:0,refund:0}],dara:[{effectiveFrom:'0000-01',salary:0,refund:0}]};
    state.accountProfiles.forEach(p=>{p.liquidity.allowanceDays={};p.liquidity.salaryDays={};});
    state.balanceCheckpoints.forEach(c=>{c.asOfDate='2026-10-13';});
    const original=FinizeLiquidity,coverage=[{version:1,recordType:'coverage',householdId:state.balanceCheckpoints[0].householdId,
      accountProfileId:'ux-gezamenlijk',channel:'bank-api',authority:'synthetic-ux-test',identity:null,
      facts:{fromDate:'2026-10-14',toDate:'2026-10-31',completeness:'complete',basis:'provider-assertion'},provenance:{payload:{confirmed:true}}}];
    window.FinizeLiquidity={...original,project:options=>original.project({...options,coverage})};
  });
  await navigate(page,'dashboard');await page.locator('[data-p3-filter="7"]').click();
  const p=await page.evaluate(()=>FinizeLiquidity.project({accountProfileId:'ux-gezamenlijk',asOfDate:'2026-10-14',startDate:'2026-10-14',endDate:'2026-10-20'}));
  expect(p.status).toBe('projected');expect(p.reasons).toEqual([]);
  await page.locator('[data-p3-info="minimum"]').click();await expect(page.locator('#p3-info-minimum')).toContainText('Een prognose blijft een verwachting');
  await expect(page.locator('#p3-info-minimum [data-p3-reason]')).toHaveCount(0);
});

test('uitgebreide klikgebieden raken geen naburige bediening',async({browser})=>{
  for(const width of [320,390,430]){
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    await boot(page,width,false);await navigate(page,'gezamenlijk');
    const overlaps=await page.evaluate(()=>{
      const visible=e=>!!e.getBoundingClientRect().width&&!!e.getBoundingClientRect().height;
      return [...document.querySelectorAll('.joint-fixed-edit-btn,.joint-transaction-add-btn,.mobile-status-pill')].filter(visible).flatMap(e=>{
        const s=getComputedStyle(e,'::after');if(s.content==='none')return [];
        const r=e.getBoundingClientRect(),hit={x:r.x+parseFloat(s.left),y:r.y+parseFloat(s.top),right:r.right-parseFloat(s.right),bottom:r.bottom-parseFloat(s.bottom)};
        return [...document.querySelectorAll('button')].filter(o=>o!==e&&visible(o)&&!e.contains(o)&&!o.contains(e)).filter(o=>{const a=o.getBoundingClientRect();return a.x<hit.right&&a.right>hit.x&&a.y<hit.bottom&&a.bottom>hit.y;}).map(o=>({source:e.className,other:o.className}));
      });
    });
    expect(overlaps).toEqual([]);await context.close();
  }
});
