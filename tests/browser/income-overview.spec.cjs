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
    await screenshot(page,`income-${owner}-iphone-390`);await card.click();await expect(page.locator('#incomeEditInput')).toBeVisible();await page.locator('#btnCancelIncomeEdit').click();
  }
  expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
async function capture(page){return page.evaluate(()=>({state:JSON.parse(JSON.stringify(state)),forecast:FinizeTransactions.forecast('2026-10'),income:FinizeTransactions.income('2026-10'),effects:FinizeTransactions.effects({month:'2026-10'}),scenario:FinizeUpdate3.scenarioResult()}));}
function cents(text){return Math.round(Number(text.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))*100);}
async function breakdown(card){return card.locator('.personal-income-sources > div').evaluateAll(rows=>rows.map(row=>({label:row.querySelector('span').textContent,amount:row.querySelector('strong').textContent})));}
const dashboardCard=page=>page.locator('.u5-primary-kpi').filter({has:page.locator('.metric-label').filter({hasText:/^Totaal gezamenlijke rekening$/})});
const jointCard=page=>page.locator('#tab-gezamenlijk .overview-kpi-row .card').filter({has:page.locator('.metric-label').filter({hasText:/^Totaal gezamenlijk inkomen$/})});
async function screenshot(page,name){if(process.env.FINIZE_INCOME_EVIDENCE){fs.mkdirSync(process.env.FINIZE_INCOME_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.FINIZE_INCOME_EVIDENCE,name+'.png'),fullPage:page.viewportSize().width>=768});}}
test('income overview financial baseline',async({page})=>{
  const errors=await boot(page,1440);const before=await capture(page);
  const totals={};for(const tab of ['dashboard','gezamenlijk','dion','dara']){await nav(page,tab);const card=tab==='dashboard'?dashboardCard(page):tab==='gezamenlijk'?jointCard(page):page.locator(`#tab-${tab} .overview-kpi-row [data-personal-kpi="income"]`);totals[tab]=await card.locator('.metric-value').innerText();}
  expect(await capture(page)).toEqual(before);expect(errors).toEqual([]);
  if(process.env.FINIZE_INCOME_BASELINE)fs.writeFileSync(process.env.FINIZE_INCOME_BASELINE,JSON.stringify({capture:before,totals},null,2));
});
for(const width of [390,1440]){
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
