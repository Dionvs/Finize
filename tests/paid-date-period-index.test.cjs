const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize}=require('./helpers/package5-fixture.cjs');
const {encodeHouseholdState}=require('../src/storage/household-store.mjs');
const {categoryFinancialActuals}=require('../src/core/transaction-engine.mjs');
const {transactionPeriodDependencies,periodFinancials}=require('../src/storage/period-projections.mjs');
test('legacy bank-month indexes can omit existing paid-date corrections from a partial October window',()=>{
 const s=state();s.monthRecords={};const rows=[row('40','uitgave',-40,{processingDate:'2026-10-31'}),row('1550','uitgave',-15.5,{processingDate:'2026-10-31'})];rows.forEach(r=>r.bankOriginal.bankDate='2026-11-01');materialize(s,rows);
 // Legacy effects retained the bank date in date/transactionDate, while processingDate already held the correction.
 s.transactions.forEach(t=>{t.date='2026-11-01';t.transactionDate='2026-11-01';});
 const records=encodeHouseholdState(s).records.filter(r=>r.collection==='transactions');
 const effects=records.filter(r=>r.value.recordRole!=='bank-source');for(const r of effects)assert.deepEqual(r.periods,['2026-11','2026-10']);
 // Reproduce the prior getTransactionDate contract's persisted period index, without changing any real records.
 const legacyIndex=records.map(r=>({...r,periods:['2026-11']}));const missing=legacyIndex.filter(r=>!r.periods.includes('2026-10')&&effects.some(e=>e.id===r.id));assert.equal(missing.length,2);
 const partial={...s,transactions:legacyIndex.filter(r=>r.periods.includes('2026-10')).map(r=>r.value),__finizePartialHistory:true,verifiedPeriods:['2026-10'],__finizePeriodContext:{periods:[{month:'2026-10'}]}};
 assert.equal(periodFinancials(s,'2026-10').totalsCents.budgetImpact,5550);assert.equal(periodFinancials(partial,'2026-10').totalsCents.budgetImpact,0);assert.equal(periodFinancials(s,'2026-11').totalsCents.budgetImpact,0);
 const dependencies=transactionPeriodDependencies(s,['2026-10']).get('2026-10');assert.equal(dependencies.size,4);assert.deepEqual(s.monthRecords,{});
});
