const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/forecast-current-basis.cjs');
const {selectDailyLiquidity}=require('../src/core/daily-liquidity.mjs'),{dashboardPeriod}=require('../src/ui/dashboard.mjs');
const options=s=>({accountProfileId:'joint',asOfDate:'2026-10-26',scope:{householdId:'legacy',accountProfiles:s.accountProfiles}});
const graph=(s,filter='salary')=>selectDailyLiquidity(s,{...options(s),...dashboardPeriod({month:'2026-10',today:'2026-10-26',filter,custom:'2026-10-30'})});
test('past unreviewed bank salary already in current cash is not replayed as planned income in the future graph',()=>{
 const s=fixture(),before=structuredClone(s),k=selectDailyLiquidity(s,{...options(s),incomeKpis:true}),g=graph(s);
 assert.equal(k.opening.balanceCents,200000);assert.equal(g.days[0].openingBalanceCents,200000);assert.equal(g.days[0].expectedBalanceCents,200000);assert.equal(k.minimumBalanceCents,190000);assert.equal(g.days.find(d=>d.date==='2026-11-04').expectedBalanceCents,190000);
 assert.equal(k.horizon.endDate,'2026-11-04');assert.equal(g.horizon.endDate,'2026-11-05');assert.equal(g.minimumBalanceCents,k.minimumBalanceCents);assert.equal(g.minimumDate,k.minimumDate);assert.deepEqual(s,before);
});
test('budget daily estimate is calendar-based: income endpoint does not move expenses on the previous day',()=>{
 const s=fixture({pastSalary:false,budget:true}),before=structuredClone(s),k=selectDailyLiquidity(s,{...options(s),incomeKpis:true}),g=graph(s);
 assert.equal(k.days.find(d=>d.date==='2026-11-04').estimatedBudgetCents,334);assert.equal(g.days.find(d=>d.date==='2026-11-04').estimatedBudgetCents,334);
 assert.equal(k.days.find(d=>d.date==='2026-11-04').expectedBalanceCents,98664);assert.equal(g.days.find(d=>d.date==='2026-11-04').expectedBalanceCents,98664);assert.equal(k.reservations[0].toDate,'2026-11-30');assert.deepEqual(s,before);
});
test('five chart filters share the same future day basis while preserving historical points separately',()=>{
 const s=fixture(),before=structuredClone(s),k=selectDailyLiquidity(s,{...options(s),incomeKpis:true});
 for(const filter of ['month','7','14','custom','salary']){const p=graph(s,filter);assert.equal(p.currentBalance.balanceCents,200000);for(const day of p.days.filter(d=>d.date>='2026-10-26'&&d.date<=k.horizon.endDate))assert.equal(day.expectedBalanceCents,k.days.find(d=>d.date===day.date).expectedBalanceCents,filter+' '+day.date);}
 assert(graph(s,'month').days.some(d=>d.date<'2026-10-26'));assert.deepEqual(s,before);
});
test('fully historical chart keeps its original horizon and never receives current future days',()=>{
 const s=fixture(),p=selectDailyLiquidity(s,{...options(s),...dashboardPeriod({month:'2026-09',today:'2026-10-26',filter:'month'})});assert.equal(p.horizon.endDate,'2026-09-30');assert(p.days.every(d=>d.date<'2026-10-01'));
});
test('unavailable current cash remains unknown rather than borrowing a reconstructed future balance',()=>{
 const s=fixture();s.balanceCheckpoints=[];s.bankBalanceObservations=[];const p=graph(s);assert.equal(p.currentBalance.balanceCents,null);assert.equal(p.status,'unknown');assert.equal(p.days.filter(d=>d.date>='2026-10-26').length,0);
});
test('historical reconciliation is presentation-only, once at today, and preserves the legacy selector',()=>{
 for(const sign of [-1,0,1]){
  const s=fixture(),before=JSON.stringify(s),o=options(s),legacyOptions={...o,...dashboardPeriod({month:'2026-10',today:o.asOfDate})};delete legacyOptions.currentCashBasis;
  // Change only the synthetic historical salary plan, keeping actual bank cash fixed.
  s.incomeDefaultsHistory.dion[0].salary=sign<0?1000:0;
  if(sign>0)s.recurringFixedExpenses.push({...s.recurringFixedExpenses[0],id:'past-fixed',begindatum:'2026-10-20',afschrijfdag:20});
  const source=JSON.stringify(s),legacy=selectDailyLiquidity(s,legacyOptions),p=graph(s,'month'),basis=p.events.filter(e=>e.type==='balance-basis'),today=p.days.find(d=>d.date===o.asOfDate),previous=p.days.filter(d=>d.date<o.asOfDate).at(-1);
  assert.equal(JSON.stringify(s),source);assert.deepEqual(p.days.filter(d=>d.date<o.asOfDate),legacy.days.filter(d=>d.date<o.asOfDate));
  assert.equal(basis.length,sign===0?0:1);if(sign)assert.equal(Math.sign(basis[0].amountCents),sign);
  assert.equal(today.openingBalanceCents+today.mutationCents,today.expectedBalanceCents);assert.equal(today.expectedBalanceCents,200000);
  if(sign)assert.equal(today.openingBalanceCents,previous.expectedBalanceCents);
  for(const d of p.days.filter(d=>d.date>o.asOfDate))assert(!d.eventIds.some(id=>id.startsWith('view-balance-basis:')));
  assert(!legacy.events.some(e=>e.type==='balance-basis'));assert.deepEqual(graph(s,'month'),p);
  for(const f of ['7','14','custom','salary'])assert(!graph(s,f).events.some(e=>e.type==='balance-basis'));
 }
});
test('future month uses current cash without a synthetic historical start or reconciliation',()=>{
 const s=fixture(),p=selectDailyLiquidity(s,{...options(s),...dashboardPeriod({month:'2026-11',today:'2026-10-26'})});assert(p.days.every(d=>d.date>='2026-11-01'));assert(!p.events.some(e=>e.type==='balance-basis'));
});
