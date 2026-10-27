const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs');
const {row,materialize}=require('./helpers/package5-fixture.cjs');
const {buildLiquidityInput,projectDailyLiquidity,selectDailyLiquidity,selectMonthEndSavings}=require('../src/core/daily-liquidity.mjs');
const {budgetActual,financialForecastForMonth,selectTransactionProjections}=require('../src/core/transaction-engine.mjs');
const {dashboardPeriod}=require('../src/ui/dashboard.mjs');
const plans=[600,150,100,200,100],actuals=[470.05,155,110.72,90,288.77];
function budgets(s,amounts=plans){s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:amounts.map((bedrag,i)=>({id:'b'+i,post:'Post '+i,bedrag}))}];return s;}
function expense(s,amount,i=0,date='2026-10-03',extra={},account={}){
 const r=row('expense-'+s.importSummaries.length,'uitgave',-amount,{category:'Post '+i,budgetItemId:'b'+i,...extra});
 Object.assign(r.bankOriginal,{bankDate:date,currency:'EUR'});r.processing.processingDate=date;
 if(account.accountProfileId){r.accountProfileId=account.accountProfileId;r.accountOwner=account.accountOwner;r.bankOriginal.accountIdentifier='NL02SECOND';}
 materialize(s,[r],r.id,account);
}
const input=(s,endDate='2026-11-04')=>buildLiquidityInput(s,{...options(s),endDate});
const saving=s=>selectMonthEndSavings(s,options(s));
test('A: category overruns offset positive remainders: 1150 - 1114.54 = 35.46',()=>{
 const s=budgets(fixture());actuals.forEach((a,i)=>expense(s,a,i));const before=structuredClone(s),p=input(s),oct=p.reservations.find(r=>r.month==='2026-10');
 assert.equal(oct.plannedCents,115000);assert.equal(oct.usedCents,111454);assert.equal(oct.amountCents,3546);assert.equal(oct.budgetItemIds.length,5);
 const old=plans.reduce((n,a,i)=>n+Math.max(0,Math.round(a*100)-Math.round(actuals[i]*100)),0);assert.equal(old,23995);assert.equal(old-oct.amountCents,20449);
 assert.equal(budgetActual(s,'2026-10','gezamenlijk','Post 2','b2'),110.72);assert.deepEqual(s,before);
});
for(const spent of [1150,1300])test('B/C: spent '+spent+' cannot create a negative reservation or imaginary cash',()=>{
 const s=budgets(fixture());expense(s,spent);const p=input(s);assert.equal(p.reservations.find(r=>r.month==='2026-10').amountCents,0);
 const a=saving(s);s.budgetDefaultsHistory.gezamenlijk=[];const b=saving(s);assert(a.indicativeCents<=b.indicativeCents);
});
test('D: same cent allocation, five-category 153.40 becomes one-pot 153.36 for November 1-4',()=>{
 const s=budgets(fixture());actuals.forEach((a,i)=>expense(s,a,i));const p=projectDailyLiquidity(input(s));
 assert.equal(p.days.filter(d=>d.date>='2026-11-01').reduce((n,d)=>n+d.estimatedBudgetCents,0),15336);
 assert.equal(plans.reduce((n,a)=>n+4*Math.floor(a*100/30)+Math.min(4,a*100%30),0),15340);
 assert.equal(p.days.filter(d=>d.date>'2026-10-26'&&d.date<'2026-11-01').reduce((n,d)=>n+d.estimatedBudgetCents,0),3546);
 assert.deepEqual(p.days.filter(d=>d.date>='2026-11-01').map(d=>d.estimatedBudgetCents),[3834,3834,3834,3834]);
});
test('E/F: protect full monthly envelopes before late salaries, carry each once and retain 200 on every day',()=>{
 const s=budgets(fixture({balance:1000000})),p=saving(s);
 assert.equal(p.expectedEndBalanceCents,885000);assert.equal(p.requiredOpeningCents,320000);assert.equal(p.safeCents,565000);
 // Oct 8850; Nov 1: -1800 -1150 => 5900; Nov 5 +2000;
 // Nov 24 +1000; Nov 25 -100; Dec 1 -1800 -1150 => 5850; Dec 5 +2000.
 const nov=p.protectionDays.find(d=>d.date==='2026-11-01');assert.equal(nov.budgetReservedCents,230000);assert.equal(nov.protectedBalanceCents,590000);
 const dec=p.protectionDays.find(d=>d.date==='2026-12-01');assert.equal(dec.budgetReservedCents,345000);assert.equal(dec.protectedBalanceCents,585000);
 for(const d of p.protectionDays.filter(d=>d.date>=p.transferDate))assert(d.protectedBalanceCents-p.safeCents>=20000,d.date);
 const lowest=p.protectionDays.filter(d=>d.date>=p.transferDate).reduce((a,b)=>a.protectedBalanceCents<b.protectedBalanceCents?a:b);assert.equal(lowest.protectedBalanceCents-p.safeCents,20000);
 const q=projectDailyLiquidity(input(s,'2026-12-05'));assert(q.days.at(-1).estimatedBudgetCents>0);assert.equal(q.days.at(-1).cashBalanceCents,p.protectionDays.at(-1).cashBalanceCents);
});
test('E: future actual budget purchase plus remaining envelope count exactly once',()=>{
 const s=budgets(fixture({balance:1000000})),a=saving(s);expense(s,100,0,'2026-11-02');const b=saving(s);
 assert.equal(b.safeCents,a.safeCents);assert.equal(b.protectionDays.at(-1).cashBalanceCents,a.protectionDays.at(-1).cashBalanceCents-10000);
 assert.equal(b.protectionDays.at(-1).budgetReservedCents,a.protectionDays.at(-1).budgetReservedCents-10000);
});
function undated(s,bounded=true){
 for(const [id,amount] of [['tax',23],['car',43.59]])s.recurringFixedExpenses.push({id,naam:'Synthetische ongedateerde verplichting',bedrag:amount,categorie:'Overig',financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-10-01',einddatum:'2026-10-31',validFrom:'2026-10',afschrijfdag:'',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',...(bounded?{paymentDeadlines:{[id+':2026-10-01']:'2026-10-31'}}:{})});return s;
}
test('G: deadline reserves 66.59 without inventing a cash date; daily line keeps its warning',()=>{
 const s=undated(fixture()),before=structuredClone(s),a=saving(fixture()),b=saving(s),daily=projectDailyLiquidity(input(s));
 assert.equal(b.safeCents,a.safeCents-6659);assert.equal(b.expectedEndBalanceCents,a.expectedEndBalanceCents-6659);
 assert.equal(daily.status,'incomplete');for(const e of daily.events.filter(e=>['tax','car'].includes(e.planningSourceId)))assert.equal(e.date,null);
 assert.equal(daily.days.at(-1).expectedBalanceCents,projectDailyLiquidity(input(fixture())).days.at(-1).expectedBalanceCents);assert.deepEqual(s,before);
});
test('G: later explicitly linked actual replaces the deadline reserve exactly once',()=>{
 const s=undated(fixture()),a=saving(s);
 for(const [id,amount]of [['tax',23],['car',43.59]]){const r=row('paid-'+id,'vaste-last',-amount,{fixedExpenseId:id,fixedOccurrenceId:id+':2026-10-01',fixedOccurrenceMonth:'2026-10'});Object.assign(r.bankOriginal,{currency:'EUR',bankDate:'2026-10-28'});r.processing.processingDate='2026-10-28';materialize(s,[r],r.id);}
 const b=saving(s);assert.equal(b.safeCents,a.safeCents);assert.equal(b.protectionDays.find(d=>d.date==='2026-10-31').undatedReservedCents,0);
});
test('G/J: missing, invalid, or wrong-occurrence deadline stays incomplete and preserves known savings plan',()=>{
 for(const invalid of [undefined,'2026-02-30','wrong-occurrence']){
  const s=undated(fixture(),false);if(invalid)s.recurringFixedExpenses.at(-1).paymentDeadlines={[invalid==='wrong-occurrence'?'car:2026-11-01':'car:2026-10-01']:'2026-02-30'};
  const p=saving(s);assert.equal(p.safeCents,null);assert.equal(p.indicativeCents,null);assert.equal(p.extraCents,null);assert.equal(p.plannedCents,50000);assert(p.reasons.some(r=>r.code==='unknown-cash-date'));
 }
});
test('H/I: full plan is comparison only: 750/500/250, 750/600/150, 300/500/0',()=>{
 const s=fixture(),before=financialForecastForMonth(s,'2026-10'),a=saving(s);assert.equal(a.safeCents,75000);assert.equal(a.extraCents,25000);
 s.monthlySavingOverrides={'2026-10':{gezamenlijk:600}};const b=saving(s);assert.equal(b.safeCents,75000);assert.equal(b.extraCents,15000);assert.deepEqual(a.protectionDays,b.protectionDays);assert.equal(financialForecastForMonth(s,'2026-10').household.income,before.household.income);
 const c=saving(fixture({balance:230000}));assert.equal(c.safeCents,30000);assert.equal(c.plannedCents,50000);assert.equal(c.extraCents,0);
});
test('J: partial bank coverage never produces capacity or extra space',()=>{
 const s=fixture();s.balanceCheckpoints[0].asOfDate='2026-10-20';const p=selectMonthEndSavings(s,{...options(s),asOfDate:'2026-10-26'});assert.equal(p.safeCents,null);assert.equal(p.indicativeCents,null);assert.equal(p.extraCents,null);assert.equal(p.plannedCents,50000);
});
test('M: owner and physical account are separate pots, including actual spending on another account',()=>{
 const s=budgets(fixture(),[600,150]);s.accountProfiles.push({id:'second',identifier:'NL02SECOND',accountOwner:'gezamenlijk',accountType:'payment',status:'active'});
 s.budgetDefaultsHistory.gezamenlijk[0].rows[1].accountProfileId='second';s.budgetDefaultsHistory.dion=[{effectiveFrom:'0000-01',rows:[{id:'personal-budget',post:'Post 0',bedrag:500,accountProfileId:'joint'}]}];
 expense(s,700,0,'2026-10-03',{}, {accountProfileId:'second',accountOwner:'gezamenlijk'});
 const rows=input(s).reservations.filter(r=>r.month==='2026-10');assert.equal(rows.find(r=>r.owner==='gezamenlijk').amountCents,60000);assert.equal(rows.find(r=>r.owner==='dion').amountCents,50000);assert.equal(rows.length,2);
});
test('M: linked refunds preserve existing correction month and category semantics within the pot',()=>{
 const s=budgets(fixture());expense(s,100);const r=row('refund','terugbetaling',20,{refundMonth:'2026-10',refundCategory:'Post 0'});r.bankOriginal.currency='EUR';materialize(s,[r],r.id);const p=input(s).reservations.find(r=>r.month==='2026-10');assert.equal(p.usedCents,8000);assert.equal(p.amountCents,107000);
});
test('M: aggregated estimates match the KPI for every existing graph filter',()=>{
 const s=budgets(fixture());actuals.forEach((a,i)=>expense(s,a,i));const o=options(s),k=selectDailyLiquidity(s,{...o,incomeKpis:true});
 for(const filter of ['7','14','custom','salary','month']){const p=selectDailyLiquidity(s,{...o,...dashboardPeriod({month:'2026-10',today:o.asOfDate,filter,custom:'2026-10-30'})});for(const d of p.days.filter(d=>d.date>=o.asOfDate&&d.date<=k.horizon.endDate))assert.equal(d.expectedBalanceCents,k.days.find(x=>x.date===d.date).expectedBalanceCents,filter+' '+d.date);}
});
test('permanent joint savings buffer is at least 200 without changing saved account settings',()=>{
 const s=fixture({buffer:0}),before=structuredClone(s),p=saving(s);assert.equal(p.bufferCents,20000);assert.equal(p.safeCents,75000);assert.deepEqual(s,before);
});
test('K: 6100 existing-capital link remains intact and its real bank withdrawal still reduces capacity',()=>{
 const s=fixture({balance:1000000}),a=saving(s);
 s.transactions=[{id:'incoming',source:'manual',accountContext:'gezamenlijk',financialFor:'gezamenlijk',date:'2026-10-03',amount:6100,accountDelta:6100,transactionType:'interne-overboeking',processing:{contributionGoalId:'goal',contributionAmount:6100}}];
 const r=row('capital-deposit','sparen',-6100,{savingsGoalId:'goal',savingsContributionId:'incoming',savingsContributionAmount:6100});Object.assign(r.bankOriginal,{currency:'EUR',bankDate:'2026-10-27'});r.processing.processingDate='2026-10-27';materialize(s,[r],'capital-deposit');
 const before=structuredClone(s),b=saving(s),p=selectTransactionProjections(s).find(p=>p.effects.existingCapitalDeposit);
 assert.equal(p.effects.existingCapitalDeposit,6100);assert.equal(p.effects.accountCashflow,-6100);assert.equal(p.effects.goalDelta,6100);assert.equal(b.safeCents,a.safeCents-610000);assert.equal(b.remainingPlannedCents,undefined);assert.deepEqual(s,before);
});
test('reported cash chain: corrected pot and unchanged daily timing produce 252.14, not a preserved 47.61',()=>{
 const s=budgets(fixture({balance:482302}));actuals.forEach((a,i)=>expense(s,a,i));
 const fixed=(id,amount,day,month)=>({id,naam:'Synthetic block',bedrag:amount,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:month+'-01',validFrom:month,afschrijfdag:day,actief:true,frequentieAantal:1,frequentieEenheid:'maanden'});
 s.recurringFixedExpenses=[{...fixed('october-block',664.95,27,'2026-10'),einddatum:'2026-10-31'},fixed('mortgage',1924.91,1,'2026-11'),fixed('insurance',225,1,'2026-11')];
 for(const person of ['dion','dara'])s.accountProfiles.push({id:person,accountOwner:person,accountType:'payment',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:0,salaryDays:{},allowanceDays:{[person]:31}}});
 const monthlyForecast=(state,month)=>{const f=financialForecastForMonth(state,month);f.owners.dion.allowance=525.61;f.owners.dara.allowance=1041.59;return f;};
 const p=selectDailyLiquidity(s,{...options(s),incomeKpis:true,monthlyForecast});assert.equal(p.horizon.endDate,'2026-11-04');assert.equal(p.minimumDate,'2026-11-04');assert.equal(p.minimumBalanceCents,25214);
 assert.equal(482302-66495-52561-104159-3546-192491-22500-15336,25214);
 undated(s,false);const q=selectDailyLiquidity(s,{...options(s),incomeKpis:true,monthlyForecast});assert.equal(q.minimumBalanceCents,25214);assert.equal(q.status,'incomplete');assert.equal(selectMonthEndSavings(s,{...options(s),monthlyForecast}).safeCents,null);
});
test('M: 37.50 linked October insurance replaces October only; November keeps the existing 225 plan',()=>{
 const s=fixture();s.recurringFixedExpenses=[{id:'insurance',naam:'Synthetic insurance',bedrag:225,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-10-01',validFrom:'2026-10',afschrijfdag:1,actief:true,frequentieAantal:1,frequentieEenheid:'maanden'}];
 const r=row('insurance-paid','vaste-last',-37.50,{fixedExpenseId:'insurance',fixedOccurrenceId:'insurance:2026-10-01',fixedOccurrenceMonth:'2026-10'});r.bankOriginal.currency='EUR';materialize(s,[r],'insurance-paid');const before=structuredClone(s),p=input(s);
 assert.equal(p.events.find(e=>e.occurrenceId==='insurance:2026-10-01').status,'replaced');const nov=p.events.find(e=>e.occurrenceId==='insurance:2026-11-01');assert.equal(nov.amountCents,-22500);assert.equal(nov.date,'2026-11-01');assert.equal(nov.accountProfileId,'joint');assert.deepEqual(s,before);
});
