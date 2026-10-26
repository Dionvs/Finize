const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup,receivedAllowance}=require('./helpers/income-outlook-fixture.cjs');
const {selectDailyLiquidity,buildLiquidityInput}=require('../src/core/daily-liquidity.mjs');
const {dashboardPeriod,liquidityView,paymentEvents}=require('../src/ui/dashboard.mjs');
const {financialForecastForMonth,sumTransactionEffects}=require('../src/core/transaction-engine.mjs');
const copy=structuredClone;
const project=(s,options={})=>selectDailyLiquidity(s,{accountProfileId:'joint',asOfDate:s.balanceCheckpoints[0]?.asOfDate||'2026-10-10',scope:{householdId:'legacy',accountProfiles:s.accountProfiles},incomeKpis:true,...options});
test('income KPI period is independent of all five graph filters and includes the opening balance',()=>{
 const s=setup(),before=copy(s);for(const filter of ['7','14','month','custom','salary']){
  const p=project(s,{...dashboardPeriod({month:'2026-10',today:'2026-10-10',filter,custom:'2026-10-12'})});
  assert.equal(p.horizon.endDate,'2026-10-24');assert.equal(p.horizon.receiptDate,'2026-10-25');assert.equal(p.minimumBalanceCents,80000);assert.equal(liquidityView(p).free,70000);
 }assert.deepEqual(s,before);
});
test('personal allowance is an income boundary without direct salary; graph includes its final day',()=>{
 const s=setup(),kpi=project(s,{accountProfileId:'personal'}),graph=selectDailyLiquidity(s,{accountProfileId:'personal',asOfDate:'2026-10-10',scope:{householdId:'legacy',accountProfiles:s.accountProfiles},...dashboardPeriod({month:'2026-10',today:'2026-10-10',filter:'salary'})});
 assert.equal(kpi.horizon.receiptDate,'2026-10-31');assert.equal(kpi.horizon.endDate,'2026-10-30');assert.equal(kpi.minimumBalanceCents,100000);assert.equal(liquidityView(kpi).free,90000);
 assert.equal(graph.horizon.endDate,'2026-10-31');assert(paymentEvents(graph).some(e=>e.type==='allowance'&&e.date==='2026-10-31'&&e.amountCents>0));assert(graph.days.at(-1).expectedBalanceCents>100000);
});
test('allowance received October 31 selects November income and never reapplies October income',()=>{
 const s=setup('2026-10-31');receivedAllowance(s);const before=copy(s),p=project(s,{accountProfileId:'personal'});
 assert.equal(p.horizon.receiptDate,'2026-11-30');assert.equal(p.horizon.endDate,'2026-11-29');assert.equal(p.opening.balanceCents,100000);assert(!p.events.some(e=>e.type==='allowance'&&e.month==='2026-10'&&e.status==='planned'));assert.deepEqual(s,before);
 const graph=selectDailyLiquidity(s,{accountProfileId:'personal',asOfDate:'2026-10-31',scope:{householdId:'legacy',accountProfiles:s.accountProfiles},...dashboardPeriod({month:'2026-10',today:'2026-10-31',filter:'salary'})});assert.equal(graph.horizon.endDate,'2026-11-30');assert(graph.days.at(-1).expectedBalanceCents>100000);
});
test('proven early allowance receipt replaces the later planned occurrence',()=>{
 const s=setup('2026-10-25');receivedAllowance(s,'2026-10-20');const p=project(s,{accountProfileId:'personal'});assert.equal(p.horizon.receiptDate,'2026-11-30');assert(p.events.some(e=>e.type==='allowance'&&e.month==='2026-10'&&e.status==='replaced'));
});
test('the earliest relevant salary or allowance wins; other account income and ordinary transfers do not',()=>{
 const s=setup();s.accountProfiles[0].liquidity.salaryDays={dara:15};s.accountProfiles[1].liquidity.salaryDays={dion:20};
 s.internalTransfers=[{id:'ordinary',status:'planned',plannedDate:'2026-10-12',plannedAmount:10,sourceAccountProfileId:'joint',targetAccountProfileId:'personal'}];
 const p=project(s,{accountProfileId:'personal'});assert.equal(p.horizon.receiptDate,'2026-10-20');assert.equal(project(s).horizon.receiptDate,'2026-10-15');
});
test('multiple receipts on the same day are all excluded from KPI and shown on the graph',()=>{
 const s=setup();delete s.accountProfiles[0].liquidity.salaryDays.dion;s.accountProfiles[1].liquidity.salaryDays={dion:31};
 const p=project(s,{accountProfileId:'personal'});assert.equal(p.horizon.endDate,'2026-10-30');assert.equal(p.minimumBalanceCents,100000);
 const input=buildLiquidityInput(s,{accountProfileId:'personal',asOfDate:'2026-10-10',scope:{householdId:'legacy',accountProfiles:s.accountProfiles},incomeOnly:true,includeReceipt:true});assert.equal(input.horizon.endDate,'2026-10-31');assert.equal(input.events.filter(e=>e.amountCents>0&&e.date==='2026-10-31'&&e.status==='planned').length,2);
});
test('buffer is subtracted once in exact cents and clamps negative availability at zero',()=>{
 const s=setup();assert.equal(liquidityView(project(s)).free,70000);s.accountProfiles[0].liquidity.bufferCents=90000;assert.equal(liquidityView(project(s)).free,0);assert.equal(project(s).minimumBalanceCents,80000);
 s.recurringFixedExpenses[0].bedrag=.01;s.recurringFixedExpenses[0].amountHistory[0].amount=.01;s.accountProfiles[0].liquidity.bufferCents=10000;assert.equal(project(s).minimumBalanceCents,99999);assert.equal(liquidityView(project(s)).free,89999);
});
test('no future income stays unknown instead of fabricating a safe horizon',()=>{
 const s=setup();s.accountProfiles[0].liquidity.salaryDays={};s.accountProfiles[1].liquidity.allowanceDays={};const p=project(s);assert.equal(p.horizon.endDate,null);assert.equal(p.minimumBalanceCents,null);assert.equal(liquidityView(p).free,null);assert.equal(p.status,'unknown');
});
test('internal allowance sides remain one transfer and never create household income',()=>{
 const s=setup(),before=copy(s),monthly=financialForecastForMonth(s,'2026-10'),opts={asOfDate:'2026-10-10',endDate:'2026-10-31',scope:{householdId:'legacy',accountProfiles:s.accountProfiles}};
 const outgoing=buildLiquidityInput(s,{...opts,accountProfileId:'joint'}).events.find(e=>e.id==='allowance:dion:2026-10:out'),incoming=buildLiquidityInput(s,{...opts,accountProfileId:'personal'}).events.find(e=>e.id==='allowance:dion:2026-10:in');assert(outgoing&&incoming);assert.equal(outgoing.amountCents+incoming.amountCents,0);assert.equal(outgoing.transferId,incoming.transferId);
 project(s);project(s,{accountProfileId:'personal'});assert.deepEqual(s,before);assert.deepEqual(financialForecastForMonth(s,'2026-10'),monthly);
 receivedAllowance(s);assert.equal(sumTransactionEffects(s,'incomeImpact',{month:'2026-10'}),0);
});
test('missing starting balance and incomplete coverage keep their existing quality boundaries',()=>{
 const s=setup();s.balanceCheckpoints=[];let p=project(s);assert.equal(p.minimumBalanceCents,null);assert.equal(p.freeAfterObligationsCents,null);
 const existing=setup();existing.bankSyncStatus={joint:{complete:false}};p=project(existing);assert.notEqual(p.status,'projected');assert.equal(p.freeAfterObligationsCents,null);assert.equal(p.indicativeFreeAfterObligationsCents,70000);
});
test('soft savings plans do not change hard income KPI minimum or subtract the goal again',()=>{
 const s=setup();const before=project(s);s.internalTransfers=[{id:'save',type:'gezamenlijk-sparen',status:'planned',month:'2026-10',plannedDate:'2026-10-15',plannedAmount:300,sourceAccountProfileId:'joint',targetAccountProfileId:'saving'}];s.accountProfiles.push({id:'saving',accountOwner:'gezamenlijk',accountType:'savings'});const after=project(s);assert.equal(after.minimumBalanceCents,before.minimumBalanceCents);assert.equal(liquidityView(after).free,liquidityView(before).free);
});
test('historical months, original bank evidence and monthly distribution stay unchanged',()=>{
 const s=setup('2026-10-26');s.monthRecords={'2026-09':{status:'afgesloten',snapshot:{income:123,expenses:55},closureHistory:[{source:'synthetic-original'}]}};receivedAllowance(s,'2026-10-20');const before=copy(s),monthly=financialForecastForMonth(s,'2026-10');project(s);project(s,{accountProfileId:'personal'});assert.deepEqual(s,before);assert.deepEqual(financialForecastForMonth(s,'2026-10'),monthly);
});
