const {test}=require('node:test'),assert=require('node:assert/strict');
const {personalMonthRemaining}=require('../src/core/personal-month-summary.mjs'),{setSavingsPlanForMonth}=require('../src/core/planning-timeline.mjs'),{financialForecastForMonth}=require('../src/core/transaction-engine.mjs'),{state}=require('./helpers/package5-fixture.cjs');
test('personal remaining uses the displayed income including refunds, fixed costs and used budget exactly once',()=>{
 assert.equal(personalMonthRemaining({income:614.18,fixed:52.97,usedBudget:172.39}),388.82);
 assert.equal(personalMonthRemaining({income:620,fixed:50,usedBudget:175}),395);
});
test('cent arithmetic, zero and negative month results remain exact',()=>{
 assert.equal(personalMonthRemaining({income:.30,fixed:.10,usedBudget:.20}),0);assert.equal(personalMonthRemaining({income:0,fixed:5,usedBudget:10}),-15);assert.equal(personalMonthRemaining({income:100,fixed:10,usedBudget:125}),-35);
 for(const value of [NaN,Infinity,1.001])assert.throws(()=>personalMonthRemaining({income:value,fixed:0,usedBudget:0}));
});
test('copying to the existing monthly savings plan changes only the chosen owner/month numeric setting',()=>{
 const s=state();s.monthlySavingOverrides={'2026-09':{dion:11},'2026-10':{dion:42.5,dara:88}};const before=structuredClone(s),forecast=financialForecastForMonth(s,'2026-10');
 const amount=personalMonthRemaining({income:620,fixed:50,usedBudget:175});setSavingsPlanForMonth(s,'dion','2026-10',Math.max(0,amount));assert.equal(s.monthlySavingOverrides['2026-10'].dion,395);assert.equal(s.monthlySavingOverrides['2026-10'].dara,88);assert.equal(s.monthlySavingOverrides['2026-09'].dion,11);
 const after=financialForecastForMonth(s,'2026-10');assert.equal(after.owners.dion.allowance,forecast.owners.dion.allowance);assert.equal(after.owners.dara.allowance,forecast.owners.dara.allowance);assert.equal(after.household.income,forecast.household.income);assert.deepEqual(s.transactions,before.transactions);assert.deepEqual(s.savingsGoalLedger,before.savingsGoalLedger);assert.deepEqual(s.monthRecords,before.monthRecords);
});
test('manual zero is retained and an explicit copied deficit becomes zero without a financial posting',()=>{
 const s=state();setSavingsPlanForMonth(s,'dion','2026-10',0);assert(Object.hasOwn(s.monthlySavingOverrides['2026-10'],'dion'));const before=structuredClone(s);setSavingsPlanForMonth(s,'dion','2026-10',Math.max(0,personalMonthRemaining({income:100,fixed:150,usedBudget:20})));assert.deepEqual(s,before);
});
test('existing chunk and record cloud formats roundtrip the selected numeric saving without a new mode or schema',async()=>{
 const {encodeCloudState,decodeCloudState,cloudStateManifest}=require('../src/storage/cloud-chunks.mjs'),{buildRecordSnapshot,decodeRecordSnapshot}=require('../src/storage/cloud-record-model.mjs');
 const s=state();setSavingsPlanForMonth(s,'dara','2026-10',395);const before=structuredClone(s),encoded=await encodeCloudState(s,'synthetic-personal-summary'),descriptor={...encoded.descriptor,complete:true},manifest=cloudStateManifest(descriptor,{syncVersion:1,commitId:'synthetic-personal-summary',updatedAt:0,updatedBy:'synthetic'});
 assert.deepEqual(await decodeCloudState(manifest,descriptor,encoded.chunks),before);const records=await buildRecordSnapshot(s,[]),decoded=await decodeRecordSnapshot(records,records.records);assert.deepEqual(decoded.state,before);assert.equal(decoded.state.monthlySavingOverrides['2026-10'].dara,395);assert.deepEqual(s,before);
});
