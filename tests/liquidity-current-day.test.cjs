const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs'),{row,materialize}=require('./helpers/package5-fixture.cjs');
const {selectDailyLiquidity,selectMonthEndSavings,buildLiquidityInput,projectDailyLiquidity}=require('../src/core/daily-liquidity.mjs');
function setup(){const s=fixture();s.recurringFixedExpenses=[{id:'due-today',naam:'Synthetic due today',bedrag:100,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-10-01',einddatum:'2026-10-31',validFrom:'2026-10',afschrijfdag:27,frequentieAantal:1,frequentieEenheid:'maanden',actief:true}];return s;}
const opts=s=>({...options(s),asOfDate:'2026-10-27',endDate:'2026-10-31'});
test('old end-of-day anchor plus bank rows does not close today: an unmatched current-day plan counts once',()=>{
 const s=setup(),before=structuredClone(s),p=selectDailyLiquidity(s,opts(s));
 const e=p.events.find(e=>e.type==='fixed');assert.equal(e.date,'2026-10-27');assert.equal(e.status,'planned');assert.equal(p.includeAsOfPlans,true);
 assert.equal(p.days[0].expectedBalanceCents,265000);assert.equal(p.days[0].mutationCents,-10000);assert(!p.reasons.some(r=>r.code==='unknown-cash-date'));assert.deepEqual(s,before);
});
test('a proved payment today replaces the plan, already included in opening cash, without another debit',()=>{
 const s=setup(),r=row('paid-today','vaste-last',-105,{fixedExpenseId:'due-today',fixedOccurrenceId:'due-today:2026-10-01',fixedOccurrenceMonth:'2026-10'});Object.assign(r.bankOriginal,{currency:'EUR',bankDate:'2026-10-27'});r.processing.processingDate='2026-10-27';materialize(s,[r],'paid-today');
 const p=selectDailyLiquidity(s,opts(s));assert.equal(p.opening.balanceCents,264500);assert.equal(p.events.find(e=>e.type==='fixed').status,'replaced');assert.equal(p.days.at(-1).expectedBalanceCents,264500);assert.equal(p.days[0].mutationCents,0);
});
test('an explicit end-of-day checkpoint for today does not replay the unproved plan',()=>{
 const s=setup();s.balanceCheckpoints[0].asOfDate='2026-10-27';const p=selectDailyLiquidity(s,opts(s));assert.equal(p.includeAsOfPlans,false);assert.equal(p.days[0].expectedBalanceCents,275000);assert.equal(p.events.find(e=>e.type==='fixed').date,null);assert(p.reasons.some(r=>r.code==='unknown-cash-date'));assert.equal(selectMonthEndSavings(s,{...opts(s),month:'2026-10'}).safeCents,null);
});
test('a still-unmatched plan from yesterday remains undated/incomplete; no fictitious payment day is assigned',()=>{
 const s=setup();s.recurringFixedExpenses[0].afschrijfdag=26;const p=selectDailyLiquidity(s,opts(s));const e=p.events.find(e=>e.type==='fixed');assert.equal(e.date,null);assert.equal(e.plannedDate,'2026-10-26');assert.equal(p.minimumBalanceCents,275000);assert.equal(p.status,'incomplete');
});
test('the savings assessment includes current-day obligations and treats unknown coverage as advisory',()=>{
 const s=setup(),a=selectMonthEndSavings(s,{...opts(s),month:'2026-10'});assert.equal(a.safeCents,null);assert.equal(a.status,'provisional');assert.equal(a.indicativeCents,245000);assert(a.reasons.some(r=>r.code==='unknown-bank-coverage'));assert(!a.reasons.some(r=>r.code==='unknown-cash-date'));assert.equal(a.protectionDays.find(d=>d.date==='2026-10-31').protectedBalanceCents,265000);
});
test('complete evidenced bank coverage allows the same current-day obligation to be assessed without a fictitious date gap',()=>{
 const s=setup(),coverage=[{version:1,recordType:'coverage',householdId:'legacy',accountProfileId:'joint',channel:'bank-api',authority:'test',identity:null,facts:{fromDate:'2026-10-27',toDate:'2026-10-27',completeness:'complete',basis:'provider-assertion'},provenance:{payload:{confirmed:true}}}];
 const p=selectMonthEndSavings(s,{...opts(s),month:'2026-10',coverage});assert.equal(p.status,'projected');assert.equal(p.expectedEndBalanceCents,265000);assert.equal(p.safeCents,245000);assert.deepEqual(p.reasons,[]);
});
test('a concrete current-day expense linked to a budget reservation is not reserved twice',()=>{
 const s=setup(),input=buildLiquidityInput(s,opts(s));input.events[0].reservationId='budget-proof';input.reservations.push({id:'budget-proof',type:'budget',month:'2026-10',amountCents:10000,fromDate:'2026-10-28',toDate:'2026-10-31'});const p=projectDailyLiquidity(input);assert.equal(p.reservations[0].amountCents,0);assert.equal(p.days.at(-1).expectedBalanceCents,265000);
});
