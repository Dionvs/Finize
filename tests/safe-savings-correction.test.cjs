const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs');
const {selectMonthEndSavings,selectDailyLiquidity,liquidityRequiredMonths}=require('../src/core/daily-liquidity.mjs');
const {purchase}=require('./helpers/budget-timing.cjs');
const saving=s=>selectMonthEndSavings(s,options(s));
const earlyBudget=(s,amount)=>{s.accountProfiles[0].liquidity.budgetBeforeIncomeHistory=[{effectiveFrom:s.meta.selectedMonth,amountCents:amount}];return s;};
function variable(s,amount){s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'timing-budget',post:'Variabel',bedrag:amount}]}];return s;}

test('budget before income increases the opening needed, keeps the buffer, and leaves month-end budget unchanged',()=>{
 const s=variable(fixture({balance:400000,first:1850}),600),before=saving(s),daily=selectDailyLiquidity(s,options(s));
 earlyBudget(s,30001);const p=saving(s);
 assert.equal(p.requiredOpeningCents,before.requiredOpeningCents+30001);
 assert.equal(p.indicativeCents,before.indicativeCents-30001);
 assert.equal(p.firstIncomeDate,'2026-11-05');assert.equal(p.earlyBudgetCents,30001);
 assert.equal(p.protectionDays.at(-1).protectedBalanceCents,before.protectionDays.at(-1).protectedBalanceCents);
 for(const day of p.protectionDays.filter(d=>d.date>p.transferDate))assert(day.protectedBalanceCents-p.indicativeCents>=20000,day.date);
 assert.deepEqual(selectDailyLiquidity(s,options(s)),daily);
 earlyBudget(s,0);assert.deepEqual(saving(s),before);
});

test('concrete budget payments before and after income never double the early or month-end budget',()=>{
 const make=()=>earlyBudget(variable(fixture({balance:1000000}),600),30000),original=saving(make());
 for(const date of ['2026-11-02','2026-11-15']){
  const s=make();purchase(s,{amount:100,date});const p=saving(s);
  assert.equal(p.earlyBudgetCents,date<'2026-11-05'?20000:30000);
  assert.equal(p.protectionDays.at(-1).protectedBalanceCents,original.protectionDays.at(-1).protectedBalanceCents);
  if(date<'2026-11-05')assert.equal(p.protectionDays.find(d=>d.date===date).protectedBalanceCents,original.protectionDays.find(d=>d.date===date).protectedBalanceCents);
 }
});

test('late obligations can dominate: budget room is not blindly added twice to the required opening',()=>{
 const s=variable(fixture({balance:1000000,first:0,late:4000}),600),before=saving(s);earlyBudget(s,30000);const p=saving(s);
 assert.equal(p.requiredOpeningCents,before.requiredOpeningCents);
 assert.equal(p.protectionDays.at(-1).protectedBalanceCents-p.indicativeCents,20000);
});

test('income on the first, no income day, lower later budget and personal allowance use the configured timing',()=>{
 const s=earlyBudget(variable(fixture({balance:1000000}),600),70000);
 let p=saving(s);assert.equal(p.appliedBudgetBeforeIncomeCents,60000);
 s.accountProfiles[0].liquidity.salaryDays={dion:1};p=saving(s);assert.equal(p.firstIncomeDate,'2026-11-01');assert.equal(p.earlyBudgetCents,0);
 s.accountProfiles[0].liquidity.salaryDays={};p=saving(s);assert.equal(p.firstIncomeDate,null);assert.equal(p.earlyBudgetCents,60000);
 s.accountProfiles[0].accountOwner='dion';s.accountProfiles[0].liquidity.allowanceDays={dion:12};
 s.budgetDefaultsHistory.dion=s.budgetDefaultsHistory.gezamenlijk;s.budgetDefaultsHistory.gezamenlijk=[];
 p=saving(s);assert.equal(p.firstIncomeDate,'2026-11-12');assert.equal(p.appliedBudgetBeforeIncomeCents,60000);
});

test('explicit 3000 - 2050 = 950: zero-based daily November simulation always retains 200',()=>{
 const s=fixture({balance:300000,first:1850,late:100}),before=structuredClone(s),p=saving(s);
 assert.equal(p.expectedEndBalanceCents,300000);assert.equal(p.minimumCumulativeCents,-185000);
 assert.equal(p.requiredOpeningCents,205000);assert.equal(p.safeCents,95000);
 // Independent zero-start simulation, with actual configured dates 1/5/24/25.
 let cumulative=0,minimum=0;
 for(let day=1;day<=30;day++){
  cumulative+=day===1?-185000:day===5?200000:day===24?100000:day===25?-10000:0;
  minimum=Math.min(minimum,cumulative);
  const date='2026-11-'+String(day).padStart(2,'0'),actual=p.protectionDays.find(d=>d.date===date);
  assert.equal(actual.protectedBalanceCents-p.expectedEndBalanceCents,cumulative,date);
  assert(p.expectedEndBalanceCents-p.safeCents+cumulative>=20000,date);
 }
 assert.equal(minimum,-185000);assert.equal(300000-95000+minimum,20000);
 assert(300000-(95000+1)+minimum<20000);assert.deepEqual(s,before);
});

test('nonnegative cashflow includes zero start and needs only the single 200 buffer',()=>{
 const s=fixture({balance:300000,first:0,late:100}),p=saving(s);
 assert.equal(p.minimumCumulativeCents,0);assert.equal(p.requiredOpeningCents,20000);assert.equal(p.safeCents,280000);
});

test('remaining variable budget is deducted only at month-end, including the late fixed payment',()=>{
 const s=variable(fixture({balance:300000,first:1850,late:3500}),600);
 // October remainder is 600; November: -1850 + 2000 + 1000 - 3500 - 600 = -2950.
 s.recurringFixedExpenses[1].afschrijfdag=30;
 const before=structuredClone(s),p=saving(s);
 assert.equal(p.expectedEndBalanceCents,240000);assert.equal(p.minimumCumulativeCents,-295000);
 assert.equal(p.requiredOpeningCents,315000);assert.equal(p.safeCents,0);
 for(const d of p.protectionDays.filter(d=>d.date>p.transferDate&&d.date<'2026-11-30'))assert.equal(d.budgetReservedCents,60000);
 const last=p.protectionDays.at(-1);assert.equal(last.date,'2026-11-30');assert.equal(last.budgetReservedCents,120000);
 assert.equal(last.protectedBalanceCents-p.expectedEndBalanceCents,-295000);assert.deepEqual(s,before);
});

test('future budget bank payment and remaining month-end budget consume each cent once',()=>{
 const s=variable(fixture({balance:1000000}),1150),a=saving(s);purchase(s,{amount:100.01});const b=saving(s);
 const at=(p,date)=>p.protectionDays.find(d=>d.date===date);
 assert.equal(at(b,'2026-11-02').cashBalanceCents,at(a,'2026-11-02').cashBalanceCents-10001);
 assert.equal(at(b,'2026-11-29').budgetReservedCents,115000);
 assert.equal(at(b,'2026-11-30').budgetReservedCents,219999);
 assert.equal(at(b,'2026-11-30').protectedBalanceCents,at(a,'2026-11-30').protectedBalanceCents);
});

test('exact cents: 3000.01 minus (1850.03 plus 200) = 949.98',()=>{
 const s=fixture({balance:300001,first:1850.03}),p=saving(s);
 assert.equal(p.minimumCumulativeCents,-185003);assert.equal(p.requiredOpeningCents,205003);assert.equal(p.safeCents,94998);
 for(const d of p.protectionDays.filter(d=>d.date>=p.transferDate))assert(d.protectedBalanceCents-p.safeCents>=20000);
});

for(const [asOf,end] of [['2026-10-26','2026-11-30'],['2026-11-26','2026-12-31'],['2026-12-26','2027-01-31'],['2024-01-26','2024-02-29'],['2025-01-26','2025-02-28']])test('complete next calendar month only: '+asOf+' to '+end,()=>{
 const s=fixture({asOf,balance:300000,first:1850}),p=saving(s);
 assert.equal(p.assessmentEndDate,end);assert.equal(p.protectionDays.at(-1).date,end);
 assert.equal(p.protectionDays.filter(d=>d.date>p.transferDate).length,Number(end.slice(-2)));
 assert(!p.requiredMonths.some(m=>m>end.slice(0,7)));assert.equal(p.safeCents,95000);
 const preload=liquidityRequiredMonths(s,{...options(s),monthEndSavingsMonth:s.meta.selectedMonth});
 assert.equal(preload.at(-1),end.slice(0,7));assert(!preload.some(m=>m>end.slice(0,7)));
});

test('configured salary day changes required opening; graph day spread and settings stay intact',()=>{
 const s=variable(fixture({balance:1000000}),1150),o={...options(s),incomeKpis:true},before=structuredClone(s),daily=selectDailyLiquidity(s,o);
 const p=selectDailyLiquidity(s,{...o,monthEndSavingsMonth:'2026-10'});
 assert.deepEqual(p.days,daily.days);assert.equal(p.minimumBalanceCents,daily.minimumBalanceCents);assert.deepEqual(s,before);
 assert(p.days.find(d=>d.date==='2026-11-01').estimatedBudgetCents>0);
 s.accountProfiles[0].liquidity.salaryDays.dion=1;
 const earlier=saving(s);assert.equal(earlier.minimumCumulativeCents,-5000);assert.equal(earlier.requiredOpeningCents,25000);
 assert(earlier.safeCents>p.monthEndSavings.safeCents);
});

test('confirmed month-end cash releases unspent current budget: 100 less spent means 100 more savings, without changing next month',()=>{
 const project=spent=>{const s=variable(fixture({asOf:'2026-10-31',balance:1000000-spent*100}),1150);if(spent)purchase(s,{amount:spent,date:'2026-10-03'});const before=structuredClone(s),p=saving(s);assert.deepEqual(s,before);return p;};
 const a=project(0),b=project(100);assert.equal(a.expectedEndBalanceCents,1000000);assert.equal(b.expectedEndBalanceCents,990000);assert.equal(a.requiredOpeningCents,200000);assert.equal(b.requiredOpeningCents,200000);assert.equal(a.safeCents,800000);assert.equal(b.safeCents,790000);
 assert.equal(a.safeCents-b.safeCents,10000);assert.equal(a.expectedEndBalanceCents-a.safeCents,b.expectedEndBalanceCents-b.safeCents);
 for(const p of [a,b]){assert.equal(p.protectionDays[0].budgetReservedCents,0);assert.equal(p.protectionDays.at(-1).budgetReservedCents,115000);for(const d of p.protectionDays.filter(d=>d.date>p.transferDate))assert(d.protectedBalanceCents-p.safeCents>=20000,d.date);}
});

test('a balance carried forward from yesterday is not silently treated as a confirmed month-end close',()=>{
 const s=variable(fixture({asOf:'2026-10-31',balance:1000000}),1150);s.balanceCheckpoints[0].asOfDate='2026-10-30';const p=selectMonthEndSavings(s,{...options(s),asOfDate:'2026-10-31'});assert.equal(p.expectedEndBalanceCents,885000);assert.equal(p.indicativeCents,685000);assert.equal(p.protectionDays[0].budgetReservedCents,115000);
});
