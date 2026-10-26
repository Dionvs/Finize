const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs');
const {selectMonthEndSavings,selectDailyLiquidity,buildLiquidityInput,projectDailyLiquidity}=require('../src/core/daily-liquidity.mjs');
const {financialForecastForMonth}=require('../src/core/transaction-engine.mjs');
const project=s=>selectMonthEndSavings(s,options(s));
test('2750 end balance minus 2000 required opening = 750, including a 500 goal exactly once',()=>{
 const s=fixture(),before=structuredClone(s),p=project(s);assert.equal(p.status,'projected');assert.equal(p.transferDate,'2026-10-31');assert.equal(p.expectedEndBalanceCents,275000);assert.equal(p.minimumCumulativeCents,-180000);assert.equal(p.requiredOpeningCents,200000);assert.equal(p.safeCents,75000);assert.equal(p.plannedCents,50000);assert.equal(p.extraCents,25000);assert.equal(p.assessmentEndDate,'2026-12-05');assert.deepEqual(s,before);
});
test('full next month includes second income on24 and expenses after that receipt',()=>{
 const s=fixture({late:2400}),p=project(s);assert.equal(p.minimumCumulativeCents,-300000);s.recurringFixedExpenses[1].bedrag=4000;s.recurringFixedExpenses[1].amountHistory[0].amount=4000;const q=project(s);assert(q.requiredOpeningCents>p.requiredOpeningCents);assert.equal(q.safeCents,0);
});
test('early following-month obligations cannot be hidden beyond the next calendar month',()=>{
 const s=fixture({late:2400}),p=project(s);assert.equal(p.requiredOpeningCents,320000);assert.equal(p.safeCents,0);assert.equal(p.assessmentEndDate,'2026-12-05');
});
test('buffer uses account setting once, including exact equality and zero capacity',()=>{
 let s=fixture({balance:200000});assert.equal(project(s).safeCents,0);s=fixture({balance:210000,buffer:30000});assert.equal(project(s).requiredOpeningCents,210000);assert.equal(project(s).safeCents,0);s=fixture({balance:220000,buffer:30000});assert.equal(project(s).safeCents,10000);
});
test('selected month goal changes the comparison only, never cash capacity or allowances',()=>{
 const s=fixture(),p=project(s),f=financialForecastForMonth(s,'2026-10');s.monthlySavingOverrides={'2026-10':{gezamenlijk:700}};const q=project(s);assert.equal(p.safeCents,q.safeCents);assert.equal(q.plannedCents,70000);assert.equal(q.extraCents,5000);assert.equal(financialForecastForMonth(s,'2026-10').household.income,f.household.income);
});
test('missing checkpoint or bank coverage never produces a safe claim',()=>{
 const s=fixture();s.balanceCheckpoints=[];assert.equal(project(s).indicativeCents,null);const t=fixture();t.balanceCheckpoints[0].asOfDate='2026-10-20';assert.equal(selectMonthEndSavings(t,{...options(t),asOfDate:'2026-10-26'}).indicativeCents,null);
});
test('unknown payment date in the assessed months blocks the savings amount',()=>{
 const s=fixture();delete s.recurringFixedExpenses[0].afschrijfdag;const p=project(s);assert.equal(p.status,'incomplete');assert.equal(p.indicativeCents,null);assert(p.reasons.some(r=>r.code==='unknown-cash-date'));
});
test('missing income timing or incomplete periods never manufactures a reliable horizon',()=>{
 const s=fixture();s.accountProfiles[0].liquidity.salaryDays={};assert.equal(project(s).safeCents,null);assert(project(s).reasons.some(r=>r.code==='missing-saving-horizon'));
});
for(const [asOf,expected]of [['2024-02-15','2024-02-29'],['2025-02-15','2025-02-28'],['2026-04-15','2026-04-30'],['2026-12-15','2026-12-31']])test('calendar boundary '+expected,()=>{
 const s=fixture({asOf}),p=project(s);assert.equal(p.transferDate,expected);assert.equal(p.safeCents,75000);
});
test('past selected month is unknown, not a saving suggestion from current cash',()=>{
 const s=fixture(),p=selectMonthEndSavings(s,{...options(s),month:'2026-09'});assert.equal(p.safeCents,null);assert(p.reasons.some(r=>r.code==='past-saving-date'));
});
test('existing next-income KPI and graph contracts remain unchanged when adding savings calculation',()=>{
 const s=fixture(),o={...options(s),incomeKpis:true},a=selectDailyLiquidity(s,o),b=selectDailyLiquidity(s,{...o,monthEndSavingsMonth:'2026-10'});assert.deepEqual(b.days,a.days);assert.equal(b.minimumBalanceCents,a.minimumBalanceCents);assert.equal(b.bufferCents,a.bufferCents);assert.equal(b.monthEndSavings.safeCents,75000);assert(b.requiredMonths.includes('2026-12'));
});
test('a proposed current-month savings transfer is not subtracted before solving its maximum',()=>{
 const s=fixture();s.accountProfiles.push({id:'saving',accountOwner:'gezamenlijk',accountType:'savings'});s.internalTransfers=[{id:'proposed',sourceClosingId:'closing-Oct',type:'gezamenlijk-sparen',status:'gepland',sourceAccountProfileId:'joint',targetAccountProfileId:'saving',plannedDate:'2026-10-31',month:'2026-10',plannedAmount:500}];assert.equal(project(s).safeCents,75000);s.internalTransfers[0].plannedDate='2026-11-30';s.internalTransfers[0].month='2026-11';s.internalTransfers[0].plannedAmount=2000;assert(project(s).safeCents<75000);
});

function reference(asOf,balance,month,tax=false){
 const s=fixture({asOf,balance});s.accountProfiles[0].liquidity.salaryDays={dion:5,dara:24};
 s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:2600}],dara:[{effectiveFrom:'0000-01',salary:3400}]};
 s.recurringFixedExpenses=[['before',1,1800],['middle',10,1600],['after',25,2100]].map(([id,day,amount])=>({id,naam:'Fictief uitgavenblok inclusief bestaande zakgeldkasstroom',categorie:'Overig',bedrag:amount,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:month+'-'+String(day).padStart(2,'0'),validFrom:month,afschrijfdag:day,frequentieAantal:1,frequentieEenheid:'maanden',actief:true,amountHistory:[{effectiveFrom:month,amount}]}));
 if(tax)s.recurringIncomeSources=[{id:'tax',type:'belastingteruggave',naam:'Fictieve gezamenlijke teruggave',eigenaar:'gezamenlijk',rekening:'gezamenlijk',bedrag:800,verwachtBedrag:800,begindatum:'2026-11-18',einddatum:'2026-11-30',validFrom:'2026-11',paymentDate:'2026-11-18',frequentieAantal:1,frequentieEenheid:'maanden',actief:true,meetellenVoorVerdeling:false}];
 return s;
}
test('user reference: October700, November1500, December minimum200',()=>{
 const oct=reference('2026-09-30',220000,'2026-10'),a=selectMonthEndSavings(oct,{...options(oct),month:'2026-10'});
 assert.equal(a.expectedEndBalanceCents,270000);assert.equal(a.requiredOpeningCents,200000);assert.equal(a.safeCents,70000);assert.equal(a.extraCents,20000);assert.equal(a.expectedEndBalanceCents-50000,220000);
 const nov=reference('2026-10-31',220000,'2026-11',true),b=selectMonthEndSavings(nov,{...options(nov),month:'2026-11'});
 assert.equal(b.expectedEndBalanceCents,350000);assert.equal(b.requiredOpeningCents,200000);assert.equal(b.safeCents,150000);assert.equal(b.extraCents,100000);assert.equal(b.expectedEndBalanceCents-b.safeCents,200000);
 const dec=reference('2026-11-30',200000,'2026-12'),input=buildLiquidityInput(dec,{...options(dec),endDate:'2026-12-31'}),p=projectDailyLiquidity(input);assert.equal(p.minimumBalanceCents,20000);assert.equal(p.days.at(-1).expectedBalanceCents,250000);
});

test('executed savings stay in bank cash and reduce only the existing remaining plan comparison',()=>{
 const s=fixture({balance:225000}),h=require('./helpers/package5-fixture.cjs'),r=h.row('already-saved','sparen',-500,{savingsGoalId:'goal'});r.bankOriginal.currency='EUR';h.materialize(s,[r],'already-saved');const before=structuredClone(s),p=project(s);assert.equal(p.expectedEndBalanceCents,225000);assert.equal(p.safeCents,25000);assert.equal(p.plannedCents,50000);assert.equal(p.remainingPlannedCents,0);assert.equal(p.extraCents,25000);assert.deepEqual(s,before);
});
function extraIncomeCase(distribute){
 const s=fixture({balance:1000000}),h=require('./helpers/package5-fixture.cjs');
 s.monthlyIncomeOverrides['2026-10']={dion:2600,dara:3400};
 for(const person of ['dion','dara'])s.accountProfiles.push({id:'personal-'+person,accountOwner:person,accountType:'payment',status:'active',identifier:'synthetic-'+person,liquidity:{version:1,primaryForOwner:true,bufferCents:0,salaryDays:{},allowanceDays:{[person]:31}}});
 const rows=[h.row('salary1','salaris',2600,{salaryPersonId:'dion',budgetOwner:'dion'}),h.row('salary2','salaris',3400,{salaryPersonId:'dara',budgetOwner:'dara'})];rows.forEach(r=>r.bankOriginal.currency='EUR');h.materialize(s,rows,'past-salaries');
 const before=project(s),forecast=financialForecastForMonth(s,'2026-10'),tax=h.row('extra-income','belastingteruggave',300,{meetellenVoorVerdeling:distribute});tax.bankOriginal.currency='EUR';tax.bankOriginal.bankDate='2026-10-27';tax.processing.processingDate='2026-10-27';h.materialize(s,[tax],'extra');return {s,before,forecast,after:project(s),newForecast:financialForecastForMonth(s,'2026-10')};
}
test('joint-retained tax refund adds cash capacity without increasing allowance',()=>{
 const {s,before,forecast,after,newForecast}=extraIncomeCase(false),unchanged=structuredClone(s);assert.equal(newForecast.distributable,forecast.distributable);assert.equal(after.safeCents,before.safeCents+30000);project(s);assert.deepEqual(s,unchanged);
});
test('opted-in extra income follows existing allowance distribution and creates no extra capacity',()=>{
 const {before,forecast,after,newForecast}=extraIncomeCase(true);assert.equal(newForecast.distributable,forecast.distributable+300);assert.equal(after.safeCents,before.safeCents);
});
test('another fixed savings transfer is counted, and ambiguous monthly candidates stay unknown',()=>{
 const s=fixture();s.accountProfiles.push({id:'saving',accountOwner:'gezamenlijk',accountType:'savings'});s.internalTransfers=[{id:'other',type:'naar-spaarrekening',status:'gepland',sourceAccountProfileId:'joint',targetAccountProfileId:'saving',plannedDate:'2026-10-31',month:'2026-10',plannedAmount:500}];assert.equal(project(s).safeCents,25000);
 s.internalTransfers=[{...s.internalTransfers[0],type:'gezamenlijk-sparen',sourceClosingId:'close-a'},{...s.internalTransfers[0],id:'another',type:'gezamenlijk-sparen',sourceClosingId:'close-b'}];assert.equal(project(s).safeCents,null);assert(project(s).reasons.some(r=>r.code==='ambiguous-saving-plan'));
});
