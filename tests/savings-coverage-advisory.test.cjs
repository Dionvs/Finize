const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs');
const {selectMonthEndSavings}=require('../src/core/daily-liquidity.mjs');
function setup(partial=false){const s=fixture();s.balanceCheckpoints[0].asOfDate='2026-10-20';if(partial)s.bankCoverage=[{version:1,recordType:'coverage',householdId:'legacy',accountProfileId:'joint',channel:'bank-api',authority:'test',identity:null,facts:{fromDate:'2026-10-21',toDate:'2026-10-22',completeness:'complete',basis:'provider-assertion'},provenance:{payload:{confirmed:true}}}];return s;}
const project=s=>selectMonthEndSavings(s,{...options(s),asOfDate:'2026-10-26'});
for(const partial of [false,true])test((partial?'partial':'unknown')+' coverage displays available-data capacity without changing cash, buffer, plans or stored evidence',()=>{
 const s=setup(partial),before=structuredClone(s),p=project(s),complete=project(fixture());assert.equal(p.status,'provisional');assert.equal(p.safeCents,null);assert.equal(p.indicativeCents,75000);assert.equal(p.extraCents,25000);assert.equal(p.plannedCents,50000);assert.equal(p.bufferCents,20000);assert.deepEqual(p.protectionDays,complete.protectionDays);assert.equal(p.requiredOpeningCents,complete.requiredOpeningCents);assert(p.reasons.some(r=>r.code===(partial?'partial-bank-coverage':'unknown-bank-coverage')));assert.deepEqual(s,before);
});
for(const defect of ['date','checkpoint','income','period'])test('coverage advisory does not bypass missing '+defect,()=>{
 const s=setup();if(defect==='date')delete s.recurringFixedExpenses[0].afschrijfdag;
 if(defect==='checkpoint')s.balanceCheckpoints=[];
 if(defect==='income')s.accountProfiles[0].liquidity.salaryDays={};
 if(defect==='period'){s.__finizePartialHistory=true;s.verifiedPeriods=[];s.__finizePeriodContext={periods:[]};}
 const p=project(s);assert.equal(p.safeCents,null);assert.equal(p.indicativeCents,null);assert.equal(p.extraCents,null);
});
test('insufficient available cash displays zero without lifting it to the savings plan',()=>{
 const s=setup();s.balanceCheckpoints[0].amountCents=100000;const p=project(s);assert.equal(p.indicativeCents,0);assert.equal(p.extraCents,0);assert.equal(p.plannedCents,50000);
});
