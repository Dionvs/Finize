const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
async function boot(page,width){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
 await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
 await page.addInitScript(s=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>commitChange(()=>{
  state.meta.selectedMonth='2026-10';state.transactions=[];state.monthRecords={};state.recurringIncomeSources=[];state.recurringFixedExpenses=[];state.monthlyIncomeOverrides={};state.monthlyRefundOverrides={};state.monthlyBudgets={};state.monthlySavingOverrides={};state.manualTransactionReplacements=[];state.internalTransferPairs=[];state.advanceLedger=[];state.advanceRepayments=[];state.savingsCoverageAllocations=[];
  state.planning.spaarpotDezeMaand=250;state.budgetDefaultsHistory=Object.fromEntries(['dion','dara','gezamenlijk'].map(owner=>[owner,[{id:owner+'-history',effectiveFrom:'0000-01',rows:[{id:owner+'-clothing',post:'Kleding',categorie:'Variabel',bedrag:owner==='gezamenlijk'?500:100}]}]]));
  state.incomeDefaultsHistory={dion:[{id:'salary-dion',effectiveFrom:'0000-01',salary:3000,refund:0}],dara:[{id:'salary-dara',effectiveFrom:'0000-01',salary:2000,refund:0}]};
  state.spaardoelen={gezamenlijk:[{id:'goal-p6',naam:'Buffer P6',algespaard:1000,doelbedrag:2000}],dion:[],dara:[]};state.savingsGoalLedger=[{id:'opening-p6',goalId:'goal-p6',source:'legacy-opening',effectiveAmount:1000,active:true}];
 },{render:false}));await nav(page,'dashboard');return errors;
}
async function nav(page,tab){await page.evaluate(tab=>document.querySelector(`#tabs [data-tab="${tab}"]`).click(),tab);}
const listRows=(page,owner,width)=>page.locator('#tab-'+owner+(width<768?' .joint-transaction-row':owner==='gezamenlijk'?' [data-edit-joint-transaction]':' [data-edit-personal-transaction]'));
async function month(page,value){await page.locator('#monthPickerButton').click();await page.locator(`[data-month-year="${value.slice(0,4)}"]`).click();await page.locator(`[data-month-value="${value}"]`).click();}
async function open(page,owner,id=''){await nav(page,owner);if(id){const row=page.locator(`#tab-${owner} [data-edit-joint-transaction="${id}"],#tab-${owner} [data-edit-personal-transaction="${id}"]`);if(await row.count())await row.first().click();else await page.evaluate(({owner,id})=>FinizeManual.open(owner,id),{owner,id});}else{await page.locator(`#tab-${owner} [data-open-${owner==='gezamenlijk'?'joint':'personal'}-transaction]`).first().click();await page.locator('#transactionModal').getByRole('button',{name:/Handmatig invoeren/}).click();}return owner==='gezamenlijk'?'jointTx':'personalTx';}
async function save(page,owner,{amount=100,type='uitgave',description='Manual P6',date='2026-10-03',category='Kleding',goal='',refundMonth='',refundCategory=''}={}){
 const prefix=await open(page,owner);await page.locator('#'+prefix+'Amount').fill(String(amount));await page.locator('#'+prefix+'Date').fill(date);await page.locator('#'+prefix+'Description').fill(description);await page.locator('#'+prefix+'Type').selectOption(type);
 if(type==='uitgave')await page.locator('#'+prefix+'Category').selectOption(category);if(goal)await page.locator('#'+prefix+'Goal').selectOption(goal);if(refundMonth){await page.locator('#'+prefix+'RefundMonth').fill(refundMonth);await page.locator('#'+prefix+'RefundCategory').fill(refundCategory);}
 await page.locator('#btnSave'+(owner==='gezamenlijk'?'Joint':'Personal')+'Transaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
 return page.evaluate(description=>state.transactions.find(t=>t.description===description),description);
}
for(const width of [390,1440]){
 test(`P6 salaries received jointly retain personal salary precedence ${width}px`,async({page})=>{
  const errors=await boot(page,width);expect(await page.evaluate(()=>commitChange(()=>{
   state.recurringIncomeSources=['dion','dara'].map(owner=>({id:'joint-salary-'+owner,legacyKind:'salary',naam:'Loon '+owner,type:'loon',eigenaar:owner,rekening:'gezamenlijk',financialFor:'gezamenlijk',verwachtBedrag:owner==='dion'?3000:2000,begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{id:'joint-salary-history-'+owner,effectiveFrom:'2026-01-01',amount:owner==='dion'?3000:2000}],monthOverrides:{}}));
  },{render:false}))).toBe(true);
  for(const [owner,amount] of [['dion',3100],['dara',2100]]){
   await open(page,'gezamenlijk');await page.locator('#jointTxType').selectOption('salaris');await expect(page.locator('#jointTxIncome option[value="joint-salary-'+owner+'"]').first()).toHaveCount(1);
   await page.locator('#jointTxIncome').selectOption('joint-salary-'+owner);await page.locator('#jointTxAmount').fill(String(amount));await page.locator('#jointTxDate').fill('2026-10-03');await page.locator('#jointTxDescription').fill('Joint salary '+owner);await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
   expect(await page.evaluate(owner=>state.transactions.find(t=>t.description==='Joint salary '+owner),owner)).toMatchObject({accountContext:'gezamenlijk',financialFor:owner,budgetOwner:owner,incomeSourceId:'joint-salary-'+owner});
   expect(await page.evaluate(owner=>FinizeTransactions.income('2026-10',owner).amount,owner)).toBe(amount);
  }
  expect(await page.evaluate(()=>FinizeTransactions.total('accountCashflow',{month:'2026-10',account:'gezamenlijk'}))).toBe(5200);
  for(const owner of ['dion','dara']){expect(await page.evaluate(owner=>FinizeTransactions.total('accountCashflow',{month:'2026-10',account:owner}),owner)).toBe(0);await nav(page,owner);await expect(listRows(page,owner,width).filter({hasText:'Joint salary'})).toHaveCount(0);const card=page.locator('#tab-'+owner+(width<768?' [data-personal-kpi-mobile="income"]':' .overview-kpi-row [data-personal-kpi="income"]'));await expect(card).toContainText('Zakgeld');await expect(card).not.toContainText('Salaris');}
  const before=await page.evaluate(()=>FinizeTransactions.forecast('2026-10'));await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10'))).toEqual(before);expect(errors).toEqual([]);
 });
 test(`P6 personal refund adds to displayed income without reducing allowance ${width}px`,async({page})=>{
  const errors=await boot(page,width);await month(page,'2026-09');await save(page,'dion',{amount:100,date:'2026-09-03',description:'Refund purchase'});await month(page,'2026-10');
  await nav(page,'dion');const card=page.locator('#tab-dion'+(width<768?' [data-personal-kpi-mobile="income"]':' .overview-kpi-row [data-personal-kpi="income"]')),metric=card.locator(width<768?'.mobile-kpi-value':'.metric-value');
  const parse=text=>Number(text.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'));
  const before=parse(await metric.innerText()),forecast=await page.evaluate(()=>FinizeTransactions.forecast('2026-10').allowanceBasis);
  await save(page,'dion',{amount:30,type:'terugbetaling',refundCategory:'Kleding',refundMonth:'2026-09',description:'Personal return'});
  expect(parse(await metric.innerText())).toBeCloseTo(before+30,2);const allowanceRow=card.locator('.personal-income-sources div').filter({has:page.locator('span').filter({hasText:/^Zakgeld$/})});expect(parse(await allowanceRow.locator('strong').innerText())).toBe(before);
  expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10').allowanceBasis)).toEqual(forecast);expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dion').amount)).toBe(0);expect(errors).toEqual([]);
 });
 test(`P6 U1/U2/U3/U5 shared manual create/edit contract ${width}px`,async({page})=>{
  const errors=await boot(page,width);
  for(const owner of ['dion','dara','gezamenlijk']){
   const t=await save(page,owner,{description:'From '+owner});expect(t.accountContext).toBe(owner);expect(t.processingStatus).toBe('goedgekeurd');expect(t.splits?.length||0).toBe(0);
   const prefix=await open(page,owner,t.id);await expect(page.locator('#'+prefix+'Date')).toHaveAttribute('max','2026-10-06');await expect(page.locator('#'+prefix+'Owner,#'+prefix+'Account,[data-manual-split]')).toHaveCount(0);
   await page.locator('#'+prefix+'Date').fill('2026-10-07');await page.locator('#btnSave'+(owner==='gezamenlijk'?'Joint':'Personal')+'Transaction').click();await expect(page.locator('[data-p4-error]')).toContainText('verleden');
   expect(await page.evaluate(id=>state.transactions.find(t=>t.id===id).date,t.id)).toBe('2026-10-03');await page.locator('#'+prefix+'Date').fill('2026-10-03');await page.locator('#'+prefix+'Amount').fill('125');await page.locator('#btnSave'+(owner==='gezamenlijk'?'Joint':'Personal')+'Transaction').click();
   expect(await page.evaluate(id=>state.transactions.filter(t=>t.id===id).map(t=>t.amount),t.id)).toEqual([125]);
  }
  await save(page,'dion',{type:'salaris',amount:3100,description:'Actual salary'});expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dion').amount)).toBe(3100);expect(errors).toEqual([]);
 });
 test(`P6 U4 historical category source and H15 month selector ${width}px`,async({page})=>{
  const errors=await boot(page,width);await page.evaluate(()=>commitChange(()=>{state.budgetDefaultsHistory.dion.push({id:'removed',effectiveFrom:'2026-10',rows:[]});},{render:false}));
  let prefix=await open(page,'dion');expect(await page.locator('#'+prefix+'Category option').allTextContents()).toEqual(['Overig']);await page.locator('#btnCancelPersonalTransaction').click();
  await month(page,'2026-09');prefix=await open(page,'dion');expect(await page.locator('#'+prefix+'Category option').allTextContents()).toEqual(['Kleding','Overig']);await expect(page.locator('#'+prefix+'Date')).toHaveValue('2026-09-06');await page.locator('#btnCancelPersonalTransaction').click();
  const old=await save(page,'dion',{date:'2026-09-03',description:'Historical clothing'});await month(page,'2026-10');await open(page,'dion',old.id);await expect(page.locator('#personalTxCategory')).toHaveValue('Kleding');await page.locator('#btnCancelPersonalTransaction').click();
  await month(page,'2027-01');await page.locator('#tab-dion [data-open-personal-transaction]').first().click();await expect(page.locator('#transactionModal').getByRole('button',{name:/Handmatig invoeren/})).toBeDisabled();expect(errors).toEqual([]);
 });
 test(`P6 U6/U7 shared forecast and planning allowance on viewport/reload ${width}px`,async({page})=>{
  const errors=await boot(page,width),before=await page.evaluate(()=>FinizeTransactions.forecast('2026-10'));
  expect(before.allowanceBasis.owners.gezamenlijk).toMatchObject({budgetReserve:500,savingsReserve:250,fixedReserve:0});
  await save(page,'gezamenlijk',{amount:300,description:'Partial spend'});await nav(page,'dashboard');const after=await page.evaluate(()=>FinizeTransactions.forecast('2026-10'));
  expect(after.allowanceBasis).toEqual(before.allowanceBasis);expect(after.owners.dion.allowance).toBe(before.owners.dion.allowance);expect(after.owners.dara.allowance).toBe(before.owners.dara.allowance);expect(after.owners.gezamenlijk.available).toBe(before.owners.gezamenlijk.available-300);
  const persistent=await page.evaluate(()=>JSON.stringify(state));await page.setViewportSize({width:width===390?1440:390,height:900});await page.evaluate(()=>renderActiveTab());expect(await page.evaluate(()=>JSON.stringify(state))).toBe(persistent);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10'))).toEqual(after);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10'))).toEqual(after);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(persistent);expect(errors).toEqual([]);
 });
 test(`P6 U8/U9/U10 physical account lists independent of financial destination ${width}px`,async({page})=>{
  const errors=await boot(page,width);
  await page.evaluate(()=>{for(const [account,owner]of [['dion','gezamenlijk'],['dara','gezamenlijk'],['gezamenlijk','dion']])FinizeManual.save({id:'cross-'+account,source:'manual',date:'2026-10-03',amount:100,transactionType:'uitgave',financialFor:owner,budgetOwner:owner,category:'Kleding',description:'Paid by '+account},account);});
  for(const owner of ['dion','dara','gezamenlijk']){await nav(page,owner);await expect(listRows(page,owner,width).filter({hasText:'Paid by '+owner})).toHaveCount(1);for(const other of ['dion','dara','gezamenlijk'].filter(x=>x!==owner))await expect(listRows(page,owner,width).filter({hasText:'Paid by '+other})).toHaveCount(0);expect(await page.evaluate(owner=>FinizeTransactions.total('accountCashflow',{month:'2026-10',account:owner}),owner)).toBe(-100);}
  expect(errors).toEqual([]);
 });
 test(`P6 U11/U12/U13 source activity drives normal lists ${width}px`,async({page})=>{
  const errors=await boot(page,width);await page.evaluate(()=>commitChange(()=>{for(const [id,status,lifecycle]of [['active','goedgekeurd','active'],['review','nakijken','active'],['unknown','onbekend','active'],['excluded','niet-meetellen','active'],['withdrawn','goedgekeurd','withdrawn']])state.transactions.push({id,source:'csv',accountContext:'gezamenlijk',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',budgetOwner:'gezamenlijk',date:'2026-10-03',amount:10,description:'Source '+id,category:'Kleding',transactionType:'uitgave',processingStatus:status,approvalSource:status==='goedgekeurd'?'manual':'',importBatchId:'batch-'+id,importTransactionId:'source-'+id,batchLifecycle:lifecycle,bankOriginal:{bankDate:'2026-10-03',amount:-10,description:id}});},{render:false}));
  await nav(page,'gezamenlijk');await expect(listRows(page,'gezamenlijk',width).filter({hasText:'Source active'})).toHaveCount(1);for(const name of ['review','unknown','excluded'])await expect(listRows(page,'gezamenlijk',width).filter({hasText:'Source '+name})).toHaveCount(1);await expect(listRows(page,'gezamenlijk',width).filter({hasText:'Source withdrawn'})).toHaveCount(0);expect(await page.evaluate(()=>FinizeTransactions.bankTotal({month:'2026-10'}))).toBe(-40);
  expect(await page.evaluate(()=>FinizeTransactions.total('realExpense',{month:'2026-10'}))).toBe(10);expect(await page.evaluate(()=>state.transactions.filter(t=>t.recordRole!=='bank-source').length)).toBe(5);expect(errors).toEqual([]);
 });
 test(`P6 U14 refund bankmonth and historical category correction ${width}px`,async({page})=>{
  const errors=await boot(page,width);await month(page,'2026-09');const expense=await save(page,'dion',{amount:100,date:'2026-09-03',description:'September expense'});await month(page,'2026-10');await save(page,'dion',{amount:30,type:'terugbetaling',refundCategory:'Kleding',refundMonth:'2026-09',description:'October refund'});
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-09',owner:'dion'}))).toBe(70);expect(await page.evaluate(()=>FinizeTransactions.total('accountCashflow',{month:'2026-10',account:'dion'}))).toBe(30);expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dion').amount)).toBe(0);expect(await page.evaluate(id=>state.transactions.find(t=>t.id===id).amount,expense.id)).toBe(100);await expect(listRows(page,'dion',width).filter({hasText:'October refund'})).toHaveCount(1);expect(errors).toEqual([]);
 });
 test(`P6 U15 savings shared goal ledger, no ordinary income/expense ${width}px`,async({page})=>{
  const errors=await boot(page,width),before=await page.evaluate(()=>FinizeTransactions.forecast('2026-10').allowanceBasis);
  const deposit=await save(page,'gezamenlijk',{type:'naar-spaarrekening',amount:250,goal:'goal-p6',description:'Goal deposit'});await save(page,'gezamenlijk',{type:'van-spaarrekening',amount:100,goal:'goal-p6',description:'Goal withdrawal'});
  expect(await page.evaluate(()=>FinizeTransactions.total('realExpense'))).toBe(0);expect(await page.evaluate(()=>FinizeTransactions.total('incomeImpact'))).toBe(0);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10').allowanceBasis)).toEqual(before);expect(await page.evaluate(id=>state.savingsGoalLedger.filter(x=>x.transactionId===id).length,deposit.id)).toBe(1);
  await nav(page,'spaardoelen');await expect(page.locator('#tab-spaardoelen')).toContainText('Buffer P6');await nav(page,'gezamenlijk');for(const label of ['Goal deposit','Goal withdrawal'])await expect(listRows(page,'gezamenlijk',width).filter({hasText:label})).toHaveCount(1);expect(errors).toEqual([]);
 });
 test(`P6 future budget/fixed/income editors preserve previous month ${width}px`,async({page})=>{
  const errors=await boot(page,width);await page.evaluate(()=>commitChange(()=>{state.recurringFixedExpenses=[{id:'fixed-p6',naam:'Fixed P6',categorie:'Wonen',bedrag:100,rekening:'gezamenlijk',financialFor:'gezamenlijk',begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{id:'initial-fixed',effectiveFrom:'2026-01-01',amount:100}],monthOverrides:{}}];state.recurringIncomeSources=[{id:'salary-p6',legacyKind:'salary',naam:'Salary P6',type:'loon',eigenaar:'dion',rekening:'dion',financialFor:'dion',verwachtBedrag:3000,begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{id:'initial-income',effectiveFrom:'2026-01-01',amount:3000}],monthOverrides:{}}];},{render:false}));
  await month(page,'2027-01');await nav(page,'gezamenlijk');await page.locator('#tab-gezamenlijk [data-open-owner-variable="gezamenlijk"]').first().click();await page.locator('[data-variable-field="bedrag"]').first().fill('600');await page.locator('[data-variable-save]').click();
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();await page.locator('[data-u3-edit-recurring="fixed:fixed-p6"]').click();await page.locator('#u3RecAmount').fill('150');await page.locator('#u3RecSave').click();await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await nav(page,'dion');await page.locator('#tab-dion [data-u3-planning-owner="dion"]').first().click();await page.locator('[data-u3-edit-recurring="income:salary-p6"]').click();await page.locator('#u3RecAmount').fill('3300');await page.locator('#u3RecSave').click();await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  const read=()=>page.evaluate(()=>({sepBudget:FinizePlanning.budgets('2026-09','gezamenlijk')[0].bedrag,janBudget:FinizePlanning.budgets('2027-01','gezamenlijk')[0].bedrag,sepFixed:FinizePlanning.fixed('2026-09')[0].bedrag,janFixed:FinizePlanning.fixed('2027-01')[0].bedrag,sepSalary:FinizePlanning.income('2026-09','dion').salary,janSalary:FinizePlanning.income('2027-01','dion').salary,actuals:state.transactions.filter(t=>t.recordRole!=='bank-source').length}));
  expect(await read()).toEqual({sepBudget:500,janBudget:600,sepFixed:100,janFixed:150,sepSalary:3000,janSalary:3300,actuals:0});await month(page,'2026-09');await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await read()).toEqual({sepBudget:500,janBudget:600,sepFixed:100,janFixed:150,sepSalary:3000,janSalary:3300,actuals:0});
  await month(page,'2026-10');await open(page,'gezamenlijk');await page.locator('#jointTxAmount').fill('105');await page.locator('#jointTxDate').fill('2026-10-03');await page.locator('#jointTxType').selectOption('vaste-last');await page.locator('#jointTxFixedMonth').fill('2026-09');await page.locator('#jointTxFixed').selectOption('fixed-p6:2026-09-01');await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>FinizeTransactions.fixedActual({id:'fixed-p6:2026-09-01',month:'2026-09',amount:100}))).toMatchObject({planned:100,actual:105,deviation:5,status:'Betaald'});expect(await page.evaluate(()=>FinizeTransactions.total('accountCashflow',{month:'2026-10',account:'gezamenlijk'}))).toBe(-105);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10').allowanceBasis.owners.gezamenlijk.fixedReserve)).toBe(100);expect(errors).toEqual([]);
 });
}
