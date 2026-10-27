const {test}=require('node:test'),assert=require('node:assert/strict');
const {timingFixture,purchase,oracle,options}=require('./helpers/budget-timing.cjs');
const {selectMonthEndSavings,buildLiquidityInput,projectDailyLiquidity}=require('../src/core/daily-liquidity.mjs');
const saving=s=>selectMonthEndSavings(s,options(s));
const daily=(s,endDate='2026-12-05')=>projectDailyLiquidity(buildLiquidityInput(s,{...options(s),endDate}));
const at=(p,date)=>p.protectionDays.find(d=>d.date===date);

test('A/F: independent daily oracle, two salaries and concrete fixed dates; no first-day monthly debit',()=>{
 const s=timingFixture(),before=structuredClone(s),p=saving(s),q=daily(s),expected=oracle();
 assert.equal(p.expectedEndBalanceCents,885000);assert.equal(p.requiredOpeningCents,200000);assert.equal(p.safeCents,685000);
 for(const d of expected.filter(d=>d.date<=p.assessmentEndDate)){
  const actual=at(p,d.date),day=q.days.find(r=>r.date===d.date);
  assert.equal(day.openingBalanceCents,d.openingBalanceCents,d.date);
  assert.equal(day.estimatedBudgetCents,d.budgetCents,d.date);
  const reserved=d.date==='2026-11-30'?230000:d.date>='2026-10-31'?115000:0;
  assert.equal(actual.budgetReservedCents,reserved,d.date);
  assert.equal(actual.protectedBalanceCents,d.balanceCents+d.cumulativeBudgetCents-reserved,d.date);
 }
 assert.equal(at(p,'2026-11-01').budgetReservedCents-at(p,'2026-10-31').budgetReservedCents,0);
 assert.equal(at(p,'2026-11-04').budgetReservedCents-at(p,'2026-10-31').budgetReservedCents,0);
 for(const [date,amount] of [['2026-11-05',200000],['2026-11-24',100000]]){
  const events=q.events.filter(e=>e.date===date&&e.type==='salary');assert.equal(events.length,1);assert.equal(events[0].amountCents,amount);
 }
 for(const d of p.protectionDays.filter(d=>d.date>=p.transferDate))assert(d.protectedBalanceCents-p.safeCents>=20000,d.date);
 assert.equal(at(p,'2026-11-04').protectedBalanceCents-p.safeCents,20000);
 assert(at(p,'2026-11-04').protectedBalanceCents-(p.safeCents+1)<20000);
 assert.deepEqual(s,before);
});

test('B: fixed debit before first salary and a low opening balance cannot be funded by later salary',()=>{
 const s=timingFixture(),a=saving(s);s.recurringFixedExpenses[0].bedrag=2000;s.recurringFixedExpenses[0].amountHistory[0].amount=2000;
 const p=saving(s);assert(p.safeCents<a.safeCents);assert.equal(at(p,'2026-11-01').cashBalanceCents,800000);
 for(const d of p.protectionDays.filter(d=>d.date>=p.transferDate))assert(d.protectedBalanceCents-p.safeCents>=20000,d.date);
 s.balanceCheckpoints[0].amountCents=200000;const low=saving(s);assert.equal(low.safeCents,0);assert(at(low,'2026-11-01').protectedBalanceCents<20000);
});

test('C: every complete month consumes exactly its entire remaining cent pot, including leap February',()=>{
 const {fixture}=require('./helpers/month-end-savings.cjs');
 for(const asOf of ['2026-10-26','2024-01-26','2025-01-26','2026-03-26']){
  const s=fixture({asOf,balance:1000000});s.budgetDefaultsHistory=timingFixture().budgetDefaultsHistory;
  const p=saving(s),q=daily(s,p.assessmentEndDate);
  for(const r of q.reservations.filter(r=>r.type==='budget'&&r.toDate<=p.assessmentEndDate)){
   const days=q.days.filter(d=>d.date>=r.fromDate&&d.date<=r.toDate);
   assert.equal(days.reduce((n,d)=>n+d.estimatedBudgetCents,0),r.amountCents,r.month);
  }
 }
});

test('D: future budget bank debit replaces estimates in exactly its month, owner and physical account',()=>{
 const s=timingFixture(),a=saving(s);purchase(s);const before=structuredClone(s),b=saving(s),q=daily(s);
 const nov=q.reservations.find(r=>r.month==='2026-11');assert.equal(nov.usedCents,10000);assert.equal(nov.amountCents,105000);
 assert.equal(q.days.filter(d=>d.date.startsWith('2026-11')).reduce((n,d)=>n+d.estimatedBudgetCents,0)+10000,115000);
 assert.equal(at(b,'2026-11-30').protectedBalanceCents,at(a,'2026-11-30').protectedBalanceCents);
 assert.equal(at(b,'2026-11-02').cashBalanceCents,at(a,'2026-11-02').cashBalanceCents-10000);
 // An earlier real debit may tighten the pre-salary minimum; equal monthly
 // totals do not imply an identical safe amount when payment timing differs.
 assert.equal(b.safeCents,675000);assert(b.safeCents<a.safeCents);assert.deepEqual(s,before);
 const separate=timingFixture();separate.accountProfiles.push({id:'second',identifier:'NL02SECOND',accountOwner:'gezamenlijk',accountType:'payment',status:'active'});
 purchase(separate,{accountProfileId:'second'});assert.deepEqual(saving(separate).protectionDays,a.protectionDays);
 const otherOwner=timingFixture();otherOwner.budgetDefaultsHistory.dion=structuredClone(otherOwner.budgetDefaultsHistory.gezamenlijk);otherOwner.budgetDefaultsHistory.dion[0].rows[0].accountProfileId='joint';purchase(otherOwner,{owner:'dion'});
 const pot=daily(otherOwner).reservations.find(r=>r.month==='2026-11'&&r.owner==='gezamenlijk');assert.equal(pot.amountCents,115000);
 const otherMonth=timingFixture();purchase(otherMonth,{date:'2026-10-28'});const pots=daily(otherMonth).reservations;assert.equal(pots.find(r=>r.month==='2026-10').amountCents,105000);assert.equal(pots.find(r=>r.month==='2026-11').amountCents,115000);
});

test('E: assessment ends on November 30; December changes never affect October savings',()=>{
 const s=timingFixture(),p=saving(s);assert.equal(p.assessmentEndDate,'2026-11-30');
 assert(!p.requiredMonths.includes('2026-12'));assert(!p.protectionDays.some(d=>d.date>'2026-11-30'));
 s.internalTransfers=[{id:'later-debit',status:'gepland',type:'naar-spaarrekening',sourceAccountProfileId:'joint',targetAccountProfileId:'saving',plannedDate:'2026-12-01',month:'2026-12',plannedAmount:20000}];
 s.accountProfiles.push({id:'saving',accountType:'savings',accountOwner:'gezamenlijk'});
 assert.equal(saving(s).safeCents,p.safeCents);assert(daily(s,'2026-12-31').days.at(-1).expectedBalanceCents<0);
 const help=require('node:fs').readFileSync('src/ui/dashboard.mjs','utf8');
 assert(help.includes('Alleen de volledige volgende kalendermaand'));assert(help.includes('alleen op de laatste kalenderdag'));
});

test('G: timing change leaves graph/minimum and informational plan independent of savings capacity',()=>{
 const s=timingFixture(),a=saving(s),line=daily(s);s.monthlySavingOverrides={'2026-10':{gezamenlijk:600}};
 const b=saving(s);assert.equal(a.safeCents,b.safeCents);assert.equal(b.extraCents,b.safeCents-60000);assert.deepEqual(a.protectionDays,b.protectionDays);assert.deepEqual(daily(s).days,line.days);
});
