const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
test.setTimeout(240000);
function fixture(){const s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'budget-ov',post:'OV',bedrag:100},{id:'budget-other',post:'Overig',bedrag:200}]}];return s;}
async function check(page,label,amount,description){
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="dashboard"]').click());
  const budget=page.locator(`#tab-dashboard [data-open-budget-transactions="${label}"]`);
  await expect(budget.locator('.neutral-amount').first()).toHaveText(new RegExp(amount+',00'));
  await budget.click();await expect(page.locator('[data-open-budget-transaction-id]')).toHaveCount(1);
  await expect(page.locator('.budget-transactions-list')).toContainText(new RegExp(description,'i'));
  await page.locator('[data-close-budget-transactions]').click();
}
for(const width of [1440,390])test(`P4 OV and Overig legacy amounts and details are independent at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});const f=await newHousehold(),s=fixture();
  materialize(s,[row('OV rit','uitgave',-50,{category:'OV'}),row('Overig aankoop','uitgave',-20,{category:'Overig'})]);
  for(const tx of s.transactions){delete tx.budgetItemId;if(tx.processing)delete tx.processing.budgetItemId;}
  await boot(page,f,s);
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(70);
  await check(page,'OV',50,'OV rit');await check(page,'Overig',20,'Overig aankoop');
});

for(const width of [1440,390])test(`P4 CSV budget identities survive rename restart and second client at ${width}`,async({page,browser})=>{
  await page.setViewportSize({width,height:900});const f=await newHousehold();await boot(page,f,fixture());
  const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n2026-10-03;OV rit;NL01JOINT;NL03TRAIN;-50\n2026-10-04;Overig aankoop;NL01JOINT;NL04SHOP;-20';
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  await page.locator('[data-u4-file]').setInputFiles({name:'budgetten.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('[data-u4-row]')).toHaveCount(2);
  const rowIds=await page.locator('[data-u4-row]').evaluateAll(nodes=>nodes.map(n=>n.dataset.u4Row));
  for(const [index,category]of ['OV','Overig'].entries()){
    await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
    const item=page.locator(`[data-u4-row="${rowIds[index]}"]`);await item.locator('[data-u4-family]').selectOption('uitgave');await item.locator('[data-u4-field="category"]').selectOption(category);await item.locator('[data-u4-approve]').click();
    if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
    await expect.poll(()=>page.evaluate(()=>FinizeTransactions.effects({month:'2026-10'}).length)).toBe(index+1);
  }
  await page.locator('.u4-modal-head [data-u4-close]').click();
  const proof=await page.evaluate(()=>({sources:state.transactions.filter(t=>t.recordRole==='bank-source').map(t=>({id:t.id,original:t.bankOriginal})),effects:FinizeTransactions.effects({month:'2026-10'}).map(p=>({id:p.id,budget:p.budgetItemId,amount:p.amount})),total:FinizeTransactions.total('budgetImpact',{month:'2026-10'})}));
  expect(proof.total).toBe(70);expect(proof.sources).toHaveLength(2);expect(proof.effects.map(p=>p.budget).sort()).toEqual(['budget-other','budget-ov']);
  await check(page,'OV',50,'OV rit');await check(page,'Overig',20,'Overig aankoop');
  // Edit a later month's planning through the existing UI. October stays unchanged.
  await page.locator('#monthPickerButton').click();await page.locator('[data-month-year="2026"]').click();await page.locator('[data-month-value="2026-11"]').click();
  await expect.poll(()=>page.evaluate(()=>getSelectedMonth())).toBe('2026-11');
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());await page.locator('#tab-gezamenlijk [data-open-owner-variable="gezamenlijk"]').first().click();
  await page.locator('[data-variable-field="post"][data-variable-id="budget-ov"]').fill('Openbaar vervoer');await page.locator('[data-variable-field="bedrag"][data-variable-id="budget-ov"]').fill('125');await page.locator('[data-variable-save]').click();await expect(page.locator('[data-variable-save]')).toHaveCount(0);
  expect(await page.evaluate(()=>({old:FinizePlanning.budgets('2026-10','gezamenlijk')[0],next:FinizePlanning.budgets('2026-11','gezamenlijk')[0]}))).toMatchObject({old:{id:'budget-ov',post:'OV',bedrag:100},next:{id:'budget-ov',post:'Openbaar vervoer',bedrag:125}});
  await page.locator('#monthPickerButton').click();await page.locator('[data-month-year="2026"]').click();await page.locator('[data-month-value="2026-10"]').click();
  await expect.poll(()=>page.evaluate(()=>getSelectedMonth())).toBe('2026-10');
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await check(page,'OV',50,'OV rit');await check(page,'Overig',20,'Overig aankoop');
  await attach(page,f,{initialize:true});await page.evaluate(()=>p4.sync());
  const context=await browser.newContext(),second=await context.newPage();await second.setViewportSize({width,height:900});await boot(second,f);await attach(second,f);await second.evaluate(()=>p4.openMonth('2026-10'));
  await check(second,'OV',50,'OV rit');await check(second,'Overig',20,'Overig aankoop');
  expect(await second.evaluate(()=>({sources:state.transactions.filter(t=>t.recordRole==='bank-source').map(t=>({id:t.id,original:t.bankOriginal})),effects:FinizeTransactions.effects({month:'2026-10'}).map(p=>({id:p.id,budget:p.budgetItemId,amount:p.amount})),total:FinizeTransactions.total('budgetImpact',{month:'2026-10'})}))).toEqual(proof);
  await context.close();
});
