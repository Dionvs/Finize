const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
async function nav(page,tab){await page.evaluate(tab=>document.querySelector(`#tabs [data-tab="${tab}"]`).click(),tab);}
async function boot(page,width,iphone=false){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width,height:1000});await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  if(iphone)await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}));
  await page.addInitScript(s=>{localStorage.setItem('finize-device-id','income-overview-test-device');localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>commitChange(()=>{
    state.meta.selectedMonth='2026-10';state.transactions=[];state.monthRecords={};state.recurringIncomeSources=[];state.recurringFixedExpenses=[];
    state.monthlyIncomeOverrides={};state.monthlyRefundOverrides={};state.monthlyTeruggaven={};state.monthlyBudgets={};state.monthlySavingOverrides={};state.manualTransactionReplacements=[];state.internalTransferPairs=[];state.advanceLedger=[];state.advanceRepayments=[];state.savingsCoverageAllocations=[];
    state.planning.spaarpotDezeMaand=250;
    state.incomeDefaultsHistory={dion:[{id:'d-old',effectiveFrom:'0000-01',salary:2500,refund:20},{id:'d-new',effectiveFrom:'2026-10',salary:2600,refund:20}],dara:[{id:'a-old',effectiveFrom:'0000-01',salary:2300,refund:30},{id:'a-new',effectiveFrom:'2026-10',salary:2400,refund:30}]};
    state.budgetDefaultsHistory=Object.fromEntries(['dion','dara','gezamenlijk'].map(owner=>[owner,[{id:owner+'-history',effectiveFrom:'0000-01',rows:[{id:owner+'-clothing',post:'Kleding',categorie:'Variabel',bedrag:owner==='gezamenlijk'?500:100}]}]]));
    state.spaardoelen={gezamenlijk:[{id:'overview-goal',naam:'Buffer',algespaard:1000,doelbedrag:2000}],dion:[],dara:[]};
    state.savingsGoalLedger=[{id:'overview-opening',goalId:'overview-goal',source:'legacy-opening',effectiveAmount:1000,active:true}];
    const tx=(id,type,amount,owner='gezamenlijk',extra={})=>({id,source:'manual',processingStatus:'goedgekeurd',approvalSource:'manual',date:'2026-10-03',transactionDate:'2026-10-03',accountContext:'gezamenlijk',owner:'gezamenlijk',financialFor:owner,budgetOwner:owner,transactionType:type,kind:'inkomen',amount,description:id,category:'Overig',...extra});
    state.transactions=[tx('salary','salaris',2645,'dion'),tx('holiday','vakantiegeld',100),tx('arrears','nabetaling',.09),tx('compensation','vergoeding',20),tx('tax','belastingteruggave',30),tx('other','overige-inkomsten',40),tx('general','inkomen',50),tx('personal','belastingteruggave',15,'dara',{accountContext:'dara',owner:'dara'}),tx('expense','uitgave',100,'gezamenlijk',{kind:'uitgave',category:'Kleding'}),tx('refund','terugbetaling',10,'gezamenlijk',{refundCategory:'Kleding',refundMonth:'2026-10'}),tx('deposit','naar-spaarrekening',25,'gezamenlijk',{kind:'uitgave',savingsGoalId:'overview-goal'}),tx('pending','vakantiegeld',999,'gezamenlijk',{source:'csv',processingStatus:'nakijken',approvalSource:undefined,importBatchId:'review-batch',importTransactionId:'review-row',bankOriginal:{amount:999,date:'2026-10-03'}})];
    state.monthlyTeruggaven={'2026-10':{gezamenlijk:[{id:'legacy-return',bedrag:10,omschrijving:'Een andere teruggave'}]}};
  },{render:false}));await nav(page,'dashboard');return errors;
}
test('iPhone 390px retains visible personal breakdown and joint tap overview',async({page})=>{
  const errors=await boot(page,390,true),before=await capture(page);let shared;
  for(const tab of ['dashboard','gezamenlijk']){
    await nav(page,tab);await page.locator(`[data-open-income-overview="${tab}"]`).click();const modal=page.locator('#incomeEditModal');const rows=await breakdown(modal);if(shared)expect(rows).toEqual(shared);shared=rows;
    await screenshot(page,`income-${tab}-iphone-390`);await modal.getByRole('button',{name:'Sluiten',exact:true}).click();
  }
  for(const owner of ['dion','dara']){
    await nav(page,owner);const card=page.locator(`#tab-${owner} [data-personal-kpi-mobile="income"]`);await expect(card.locator('.personal-income-sources')).toBeVisible();
    expect(await card.evaluate(card=>{const bounds=card.getBoundingClientRect();return [...card.querySelectorAll('.personal-income-sources > div')].every(row=>{const r=row.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom&&r.left>=bounds.left&&r.right<=bounds.right;});})).toBe(true);
    await screenshot(page,`income-${owner}-iphone-390`);await card.click();await expect(page.locator('#incomeOverviewTitle')).toHaveText(`Totaal inkomen ${owner==='dion'?'Dion':'Dara'}`);await page.locator('[data-edit-overview-income]').click();await expect(page.locator('#incomeEditInput')).toBeVisible();await page.locator('#btnCancelIncomeEdit').click();
  }
  expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
async function capture(page){return page.evaluate(()=>({state:JSON.parse(JSON.stringify(state)),forecast:FinizeTransactions.forecast('2026-10'),income:FinizeTransactions.income('2026-10'),effects:FinizeTransactions.effects({month:'2026-10'}),scenario:FinizeUpdate3.scenarioResult()}));}
function cents(text){return Math.round(Number(text.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))*100);}
async function breakdown(card){return card.locator('.personal-income-sources > div').evaluateAll(rows=>rows.map(row=>({label:row.querySelector('span').textContent,amount:row.querySelector('strong').textContent})));}
const dashboardCard=page=>page.locator('.u5-primary-kpi').filter({has:page.locator('.metric-label').filter({hasText:/^Totaal gezamenlijke rekening$/})});
const jointCard=page=>page.locator('#tab-gezamenlijk .overview-kpi-row .card').filter({has:page.locator('.metric-label').filter({hasText:/^Totaal gezamenlijk inkomen$/})});
async function screenshot(page,name){if(process.env.FINIZE_INCOME_EVIDENCE){fs.mkdirSync(process.env.FINIZE_INCOME_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.FINIZE_INCOME_EVIDENCE,name+'.png'),fullPage:page.viewportSize().width>=768});}}

for(const iphone of [false,true]){
  test(`personal mobile card opens readable income sources ${iphone?'iPhone':'Android'} 390px`,async({page})=>{
    const errors=await boot(page,390,iphone),before=await capture(page),storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
    for(const owner of ['dion','dara']){
      await nav(page,owner);
      const card=page.locator(`#tab-${owner} [data-personal-kpi-mobile="income"]`),expectedRows=await breakdown(card),total=await card.locator('.mobile-kpi-value').innerText();
      await card.press('Enter');
      const overview=page.locator('#incomeEditModal');
      await expect(overview.locator('#incomeOverviewTitle')).toHaveText(`Totaal inkomen ${owner==='dion'?'Dion':'Dara'}`);
      await expect(overview).toContainText('oktober 2026');
      await expect(overview.locator('input,select,textarea')).toHaveCount(0);
      expect(await breakdown(overview)).toEqual(expectedRows);
      expect(await overview.locator('.metric-value').innerText()).toBe(total);
      expect(expectedRows.reduce((sum,row)=>sum+cents(row.amount),0)).toBe(cents(total));
      expect(await overview.locator('.personal-income-sources').evaluate(container=>[...container.querySelectorAll('button,strong')].every(item=>item.scrollWidth<=item.clientWidth))).toBe(true);
      await screenshot(page,`personal-income-${owner}-${iphone?'iphone':'android'}-390`);
      await overview.getByRole('button',{name:'Transacties bij Zakgeld bekijken',exact:true}).click();
      await expect(page.locator('#transactionModal')).toContainText('geen afzonderlijke inkomenstransactie');
      await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
      await expect(overview).toHaveClass(/open/);
      if(owner==='dara'){
        await overview.getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();
        await expect(page.locator('[data-income-transaction-id="personal"]')).toBeVisible();
        await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
      }
      await overview.getByRole('button',{name:`Inkomen van ${owner==='dion'?'Dion':'Dara'} aanpassen`,exact:true}).click();
      await expect(page.locator('#incomeEditInput')).toBeVisible();
      await page.locator('#btnCancelIncomeEdit').click();
      await card.click();await page.keyboard.press('Escape');
      await expect(overview).not.toHaveClass(/open/);await expect(card).toBeFocused();
    }
    expect(await capture(page)).toEqual(before);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage);expect(errors).toEqual([]);
  });
}
test('income overview financial baseline',async({page})=>{
  const errors=await boot(page,1440);const before=await capture(page);
  const totals={};for(const tab of ['dashboard','gezamenlijk','dion','dara']){await nav(page,tab);const card=tab==='dashboard'?dashboardCard(page):tab==='gezamenlijk'?jointCard(page):page.locator(`#tab-${tab} .overview-kpi-row [data-personal-kpi="income"]`);totals[tab]=await card.locator('.metric-value').innerText();}
  expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);
  if(process.env.FINIZE_INCOME_BASELINE)fs.writeFileSync(process.env.FINIZE_INCOME_BASELINE,JSON.stringify({capture:before,totals},null,2));
});
for(const width of [390,1440]){
  test(`income source opens relevant transactions without editing ${width}px`,async({page})=>{
    const errors=await boot(page,width,width<768),before=await capture(page),storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
    for(const tab of ['dashboard','gezamenlijk']){
      await nav(page,tab);if(width<768)await page.locator(`[data-open-income-overview="${tab}"]`).click();const card=width<768?page.locator('#incomeEditModal'):tab==='dashboard'?dashboardCard(page):jointCard(page);
      await card.getByRole('button',{name:'Transacties bij Salarissen bekijken',exact:true}).click();const details=page.locator('#transactionModal');await expect(details).toHaveClass(/open/);await expect(details.locator('[data-income-transaction-id]')).toHaveCount(1);await expect(details.locator('[data-income-transaction-id="salary"]')).toContainText('Gezamenlijk');await expect(details).toContainText('geplande of eerder ingevoerde');await expect(details.locator('input,select,textarea')).toHaveCount(0);
      await details.getByRole('button',{name:'Sluiten',exact:true}).click();if(width<768)await expect(card).toHaveClass(/open/);
      await card.getByRole('button',{name:'Transacties bij Overige inkomsten bekijken',exact:true}).click();await expect(details.locator('[data-income-transaction-id]')).toHaveCount(2);await expect(details.locator('[data-income-transaction-id="other"]')).toBeVisible();await expect(details.locator('[data-income-transaction-id="general"]')).toBeVisible();await expect(details.locator('[data-income-transaction-id="pending"],[data-income-transaction-id="refund"],[data-income-transaction-id="deposit"]')).toHaveCount(0);await screenshot(page,`income-source-${tab}-${width}`);
      await page.keyboard.press('Escape');await expect(details).not.toHaveClass(/open/);if(width<768)await card.getByRole('button',{name:'Sluiten',exact:true}).click();
    }
    await nav(page,'dara');const personal=page.locator('#tab-dara '+(width<768?'[data-personal-kpi-mobile="income"]':'.overview-kpi-row [data-personal-kpi="income"]'));
    await personal.getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);await expect(page.locator('[data-income-transaction-id="personal"]')).toContainText('Dara');await screenshot(page,`income-source-dara-${width}`);await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
    await personal.getByRole('button',{name:'Transacties bij Zakgeld bekijken',exact:true}).click();await expect(page.locator('#transactionModal')).toContainText('geen afzonderlijke inkomenstransactie');await expect(page.locator('[data-income-transaction-id]')).toHaveCount(0);await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
    expect(await capture(page)).toEqual(before);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage);expect(errors).toEqual([]);
  });
  test(`income breakdown sums, parity and read-only ${width}px`,async({page})=>{
    const errors=await boot(page,width),before=await capture(page);const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));let shared;
    for(const tab of ['dashboard','gezamenlijk']){
      await nav(page,tab);let card;
      if(width<768){await page.locator(`[data-open-income-overview="${tab}"]`).click();card=page.locator('#incomeEditModal');await expect(card).toHaveClass(/open/);await expect(card).toContainText('oktober 2026');await expect(card.locator('input,select,textarea')).toHaveCount(0);}
      else card=tab==='dashboard'?dashboardCard(page):jointCard(page);
      const rows=await breakdown(card);expect(rows.map(r=>r.label)).toEqual(['Salarissen','Vaste teruggaven','Terugbetalingen','Vakantiegeld','Nabetaling','Vergoedingen','Belastingteruggave','Overige inkomsten']);
      expect(rows.reduce((sum,r)=>sum+cents(r.amount),0)).toBe(cents(await card.locator('.metric-value').innerText()));
      expect(cents(rows[0].amount)).toBe(504500);expect(cents(rows.find(r=>r.label==='Terugbetalingen').amount)).toBe(1000); // Actual refund/savings/review proposal stay outside joint income.
      if(shared)expect(rows).toEqual(shared);shared=rows;await screenshot(page,`income-${tab}-${width}`);
      if(width<768){await card.getByRole('button',{name:'Sluiten',exact:true}).click();await expect(card).not.toHaveClass(/open/);await expect(page.locator(`[data-open-income-overview="${tab}"]`)).toBeFocused();await page.locator(`[data-open-income-overview="${tab}"]`).click();await page.keyboard.press('Escape');await expect(card).not.toHaveClass(/open/);}
    }
    for(const owner of ['dion','dara']){await nav(page,owner);const card=page.locator(`#tab-${owner} `+(width<768?'[data-personal-kpi-mobile="income"]':'.overview-kpi-row [data-personal-kpi="income"]'));await expect(card).toContainText('Zakgeld');await expect(card).not.toContainText('Salarissen');const rows=await breakdown(card);expect(rows.reduce((sum,r)=>sum+cents(r.amount),0)).toBe(cents(await card.locator(width<768?'.mobile-kpi-value':'.metric-value').innerText()));await screenshot(page,`income-${owner}-${width}`);}
    expect(await capture(page)).toEqual(before);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage);expect(errors).toEqual([]);
  });
  test(`income fallback, explicit zero, actual salary and historical month ${width}px`,async({page})=>{
    const errors=await boot(page,width);
    for(const [month,override,actual,expected] of [['2026-09',null,false,480000],['2026-10',null,false,500000],['2026-10',0,false,240000],['2026-10',0,true,504500]]){
      await page.evaluate(({month,override,actual})=>commitChange(()=>{state.meta.selectedMonth=month;state.monthlyIncomeOverrides={'2026-10':override===null?{}:{dion:override}};state.transactions=state.transactions.filter(t=>t.id!=='salary');if(actual)state.transactions.push({id:'salary',source:'manual',processingStatus:'goedgekeurd',approvalSource:'manual',accountContext:'gezamenlijk',owner:'gezamenlijk',financialFor:'dion',budgetOwner:'dion',transactionType:'salaris',date:'2026-10-03',amount:2645,kind:'inkomen',description:'Salaris Dion'});}),{month,override,actual});
      await nav(page,'dashboard');if(width<768)await page.locator('[data-open-income-overview="dashboard"]').click();const card=width<768?page.locator('#incomeEditModal'):dashboardCard(page);const rows=await breakdown(card);expect(cents(rows[0].amount)).toBe(expected);expect(rows.reduce((sum,r)=>sum+cents(r.amount),0)).toBe(cents(await card.locator('.metric-value').innerText()));if(width<768)await card.getByRole('button',{name:'Sluiten',exact:true}).click();
    }
    // Both explicit zero values retain the salary row rather than hiding it.
    await page.evaluate(()=>commitChange(()=>{state.transactions=[];state.monthlyIncomeOverrides={'2026-10':{dion:0,dara:0}};}));await nav(page,'dashboard');if(width<768)await page.locator('[data-open-income-overview="dashboard"]').click();const zero=await breakdown(width<768?page.locator('#incomeEditModal'):dashboardCard(page));expect(zero[0].label).toBe('Salarissen');expect(cents(zero[0].amount)).toBe(0);expect(errors).toEqual([]);
  });
}
test('source transactions preserve physical account isolation, privacy and split projection identity',async({page})=>{
  const errors=await boot(page,1440);await nav(page,'dashboard');
  await page.evaluate(()=>{window.FinizeAuth={...window.FinizeAuth,enabled:true,assignment:{role:'dion'},profile:{hiddenKpis:[]},householdMembers:[{role:'dara',sharePersonalTab:false,hiddenKpis:[]}]};});
  await dashboardCard(page).getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id="personal"]')).toHaveCount(0);await expect(page.locator('[data-income-transaction-id="tax"]')).toBeVisible();await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
  await page.evaluate(()=>window.FinizeAuth.householdMembers[0].sharePersonalTab=true);await dashboardCard(page).getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id="personal"]')).toHaveCount(0);await expect(page.locator('[data-income-transaction-id="tax"]')).toBeVisible();await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
  await page.evaluate(()=>{window.FinizeAuth.householdMembers[0].hiddenKpis=['income'];});await dashboardCard(page).getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id="personal"]')).toHaveCount(0);await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
  await page.evaluate(()=>{window.FinizeAuth.enabled=false;commitChange(()=>state.transactions.push({id:'split-income',source:'csv',importBatchId:'split-batch',importTransactionId:'split-row',processingStatus:'goedgekeurd',approvalSource:'manual',accountContext:'gezamenlijk',owner:'gezamenlijk',financialFor:'gezamenlijk',date:'2026-10-03',amount:50,bankOriginal:{amount:50,bankDate:'2026-10-03',description:'Split income'},transactionType:'inkomen',description:'Split income',splits:[{id:'first',amount:20,transactionType:'inkomen',category:'Overig',financialFor:'gezamenlijk'},{id:'second',amount:30,transactionType:'inkomen',category:'Overig',financialFor:'gezamenlijk'}]}));});await nav(page,'dashboard');const before=await capture(page);
  await dashboardCard(page).getByRole('button',{name:'Transacties bij Overige inkomsten bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id^="split-income:split:"]')).toHaveCount(2);await expect(page.locator('#transactionModal')).toContainText('deeltransactie');await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);
});

for(const width of [390,1440])test(`private receipts stay on physical account and refund corrects joint category ${width}px`,async({page})=>{
  const errors=await boot(page,width);
  await page.evaluate(()=>commitChange(()=>{
    const tx=(id,type,amount,account,financialFor='gezamenlijk',extra={})=>({id,source:'manual',processingStatus:'goedgekeurd',approvalSource:'manual',date:'2026-10-04',transactionDate:'2026-10-04',accountContext:account,financialFor,budgetOwner:financialFor,transactionType:type,kind:'inkomen',amount,description:id,category:'Overig',bankOriginal:{amount,bankDate:'2026-10-04',description:id},...extra});
    for(const account of ['dion','dara'])for(const type of ['inkomen','belastingteruggave','vergoeding','overige-inkomsten'])state.transactions.push(tx(`private-${account}-${type}`,type,10,account));
    state.transactions.push(tx('joint-receipt-personal-destination','belastingteruggave',20,'gezamenlijk','dion'));
    state.transactions.push(tx('past-joint-expense','uitgave',120,'gezamenlijk','gezamenlijk',{kind:'uitgave',category:'Kleding',date:'2026-09-17',transactionDate:'2026-09-17',bankOriginal:{amount:-120,bankDate:'2026-09-17',description:'Original expense'}}));
    state.transactions.push(tx('private-refund-joint-category','terugbetaling',40,'dion','gezamenlijk',{refundCategory:'Kleding',refundMonth:'2026-09'}));
  }));
  const before=await capture(page),storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
  const effects=await page.evaluate(()=>({privateCash:FinizeTransactions.effects({month:'2026-10',account:'dion'}).find(p=>p.id==='private-refund-joint-category'),jointBudget:FinizeTransactions.effects({month:'2026-09',owner:'gezamenlijk',dimension:'budget'}).reduce((sum,p)=>sum+p.effects.budgetImpact,0),jointRows:FinizeTransactions.effects({month:'2026-10',account:'gezamenlijk'}).map(p=>p.id)}));
  expect(effects.privateCash.accountContext).toBe('dion');expect(effects.privateCash.effects.accountCashflow).toBe(40);expect(effects.privateCash.effects.incomeImpact).toBe(0);expect(effects.jointBudget).toBe(80);
  expect(effects.jointRows).not.toContain('private-refund-joint-category');expect(effects.jointRows).toContain('joint-receipt-personal-destination');
  for(const tab of ['dashboard','gezamenlijk']){
    await nav(page,tab);if(width<768)await page.locator(`[data-open-income-overview="${tab}"]`).click();
    const card=width<768?page.locator('#incomeEditModal'):tab==='dashboard'?dashboardCard(page):jointCard(page);
    const rows=await breakdown(card);expect(cents(rows.find(row=>row.label==='Belastingteruggave').amount)).toBe(5000);expect(cents(rows.find(row=>row.label==='Vergoedingen').amount)).toBe(2000);expect(cents(rows.find(row=>row.label==='Overige inkomsten').amount)).toBe(9000);
    await card.getByRole('button',{name:'Transacties bij Belastingteruggave bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id="tax"]')).toBeVisible();await expect(page.locator('[data-income-transaction-id="joint-receipt-personal-destination"]')).toBeVisible();await expect(page.locator('[data-income-transaction-id^="private-"],[data-income-transaction-id="personal"]')).toHaveCount(0);
    await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();if(width<768)await card.getByRole('button',{name:'Sluiten',exact:true}).click();
  }
  for(const owner of ['dion','dara']){
    await nav(page,owner);if(width<768)await page.locator(`[data-open-income-overview="${owner}"]`).click();
    const card=width<768?page.locator('#incomeEditModal'):page.locator(`#tab-${owner} .overview-kpi-row [data-personal-kpi="income"]`);
    for(const label of ['Overige inkomsten','Belastingteruggave','Vergoedingen']){
      await card.getByRole('button',{name:`Transacties bij ${label} bekijken`,exact:true}).click();await expect(page.locator(`[data-income-transaction-id^="private-${owner}-"]`)).not.toHaveCount(0);await expect(page.locator('[data-income-transaction-id="joint-receipt-personal-destination"]')).toHaveCount(0);await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
    }
    if(owner==='dion'){
      await card.getByRole('button',{name:'Transacties bij Terugbetalingen bekijken',exact:true}).click();await expect(page.locator('[data-income-transaction-id="private-refund-joint-category"]')).toBeVisible();await page.locator('#transactionModal').getByRole('button',{name:'Sluiten',exact:true}).click();
    }
    if(width<768)await card.getByRole('button',{name:'Sluiten',exact:true}).click();
  }
  expect(await capture(page)).toEqual(before);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage);expect(errors).toEqual([]);
});

test('personal overview respects shared-tab privacy and read-only income',async({page})=>{
  const errors=await boot(page,390),before=await capture(page),storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
  await nav(page,'dara');const card=page.locator('#tab-dara [data-personal-kpi-mobile="income"]');
  // A card already rendered before a privacy change must still recheck permissions on click.
  await page.evaluate(()=>{window.FinizeAuth={...window.FinizeAuth,enabled:true,assignment:{role:'dion'},profile:{hiddenKpis:[]},householdMembers:[{role:'dara',sharePersonalTab:false,hiddenKpis:[]}]};});
  await card.click();
  await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  await page.evaluate(()=>{window.FinizeAuth.householdMembers[0].sharePersonalTab=true;window.FinizeAuth.householdMembers[0].hiddenKpis=['income'];});
  await card.click();
  await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  await page.evaluate(()=>{window.FinizeAuth.householdMembers[0].hiddenKpis=[];});
  await card.click();
  await expect(page.locator('#incomeOverviewTitle')).toHaveText('Totaal inkomen Dara');
  await expect(page.locator('[data-edit-overview-income]')).toHaveCount(0);
  await page.locator('#incomeEditModal').getByRole('button',{name:'Sluiten',exact:true}).click();
  expect(await capture(page)).toEqual(before);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage);expect(errors).toEqual([]);
});
test('source drilldown uses historical month and escapes transaction descriptions',async({page})=>{
  const errors=await boot(page,1440);await page.evaluate(()=>commitChange(()=>{state.meta.selectedMonth='2026-09';state.transactions.push({id:'past-"-income',source:'manual',processingStatus:'goedgekeurd',approvalSource:'manual',accountContext:'gezamenlijk',owner:'gezamenlijk',financialFor:'gezamenlijk',transactionType:'vakantiegeld',date:'2026-09-03',amount:7,description:'<img src=x onerror="window.incomeDescriptionXss=1">'});}));await nav(page,'dashboard');const before=await capture(page);
  await dashboardCard(page).getByRole('button',{name:'Transacties bij Vakantiegeld bekijken',exact:true}).click();const modal=page.locator('#transactionModal');await expect(modal).toContainText('september 2026');await expect(modal.locator('[data-income-transaction-id]')).toHaveCount(1);expect(await modal.locator('[data-income-transaction-id]').getAttribute('data-income-transaction-id')).toBe('past-"-income');await expect(modal).toContainText('<img src=x onerror=');await expect(modal.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>window.incomeDescriptionXss||0)).toBe(0);await modal.getByRole('button',{name:'Sluiten',exact:true}).click();expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);
});
