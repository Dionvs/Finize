const {test}=require('node:test'),assert=require('node:assert/strict');
const {defaultPeriodWindow,requestedPeriodWindow,planCacheEviction,storageBytes}=require('../src/storage/period-cache.mjs');
const {createProductionRecordTransport,createEmulatorRecordTransport}=require('../src/storage/firestore-record-transport.mjs');

test('P4 cache window is bounded and crosses year boundaries',()=>{
  assert.deepEqual(defaultPeriodWindow('2026-02'),['2026-02','2026-01','2025-12','2025-11']);
  assert.throws(()=>defaultPeriodWindow('2026-13'),{code:'invalid-period'});
});

test('P4 calendar window and a historical request have separate scopes',()=>{
  for(const month of ['2026-10','2026-09','2026-08','2026-07'])assert.deepEqual(requestedPeriodWindow(month,'2026-10'),defaultPeriodWindow('2026-10'));
  assert.deepEqual(requestedPeriodWindow('2024-02','2026-10'),['2024-02']);
  assert.throws(()=>requestedPeriodWindow('2024-13','2026-10'),{code:'invalid-period'});
  const entries=['2024-01','2024-02','2026-07','2026-08','2026-09','2026-10'].map(id=>({id,sha256:id,lastUsed:0}));
  assert.deepEqual(planCacheEviction(entries,{selectedMonth:'2024-02',currentMonth:'2026-10',targetBytes:0}).remove.map(r=>r.id),['2024-01']);
});
test('P4 eviction keeps recent months and offline pins, choosing oldest replaceable first',()=>{
  const entries=['2024-01','2024-02','2025-01','2026-07','2026-08','2026-09','2026-10'].map((id,i)=>({id,sha256:id,lastUsed:i,pinned:id==='2025-01',payload:'x'.repeat(100)}));
  const result=planCacheEviction(entries,{selectedMonth:'2026-10',currentMonth:'2026-10',targetBytes:0});
  assert.deepEqual(result.remove.map(row=>row.id),['2024-01','2024-02']);assert.equal(result.overTarget,true);
});
test('P4 offline pins do not consume the replaceable cache allowance',()=>{
  const pinned={id:'2024-01',pinned:true,lastUsed:0,payload:'x'.repeat(10000)},replaceable={id:'2024-02',lastUsed:1,sha256:'proof'};
  assert.equal(planCacheEviction([pinned,replaceable],{selectedMonth:'2026-10',targetBytes:storageBytes(replaceable)}).remove.length,0);
});
test('P4 invalid cache limits cannot trigger deletion',()=>{
  for(const targetBytes of [-1,NaN,Infinity])assert.throws(()=>planCacheEviction([],{selectedMonth:'2026-10',targetBytes}),{code:'cache-target'});
});
test('P4 production adapter defaults to disabled before any network request',()=>{
  let requests=0;const fetch=()=>{requests++;throw Error('must not connect');};
  for(const activation of [null,{}, {enabled:true}, {enabled:true,storageVersion:2,minClientVersion:116,householdId:'h',epoch:'e',phase:'active'}])assert.throws(()=>createProductionRecordTransport({projectId:'finize-project',householdId:'h',token:async()=>'',activation,fetch}),{code:'production-disabled'});
  assert.equal(requests,0);
});
test('P4 prepared production adapter fences household paths without network access',async()=>{
  let requests=0;const transport=createProductionRecordTransport({projectId:'finize-project',householdId:'h',token:async()=>'',activation:{enabled:true,storageVersion:2,minClientVersion:117,householdId:'h',epoch:'e',phase:'active'},fetch:()=>{requests++;throw Error('must not connect');}});
  await assert.rejects(()=>transport.get('households/other/financialStorage/current'),{code:'household-scope'});
  await assert.rejects(()=>transport.query('accountLinks'),{code:'household-scope'});
  await assert.rejects(()=>transport.commit([{path:'households/other/x',data:{}}]),{code:'household-scope'});assert.equal(requests,0);
});
test('P4 emulator factory remains unable to address production',()=>{
  assert.throws(()=>createEmulatorRecordTransport({host:'firestore.googleapis.com',projectId:'finize',token:'owner'}),{code:'emulator-only'});
});
test('P4 record transport retains native legacy timestamp fields during migration readback',async()=>{
  const timestamp='2026-10-10T19:49:57.808Z';
  const transport=createEmulatorRecordTransport({token:'owner',fetch:async()=>new Response(JSON.stringify({name:'projects/demo-finize-v117/databases/(default)/documents/households/h/budgetState/current',fields:{updatedAt:{timestampValue:timestamp},nested:{mapValue:{fields:{time:{timestampValue:timestamp}}}}},updateTime:timestamp}))});
  const result=await transport.get('households/h/budgetState/current');assert.equal(result.data.updatedAt,timestamp);assert.deepEqual(result.data.nested,{time:timestamp});assert.equal(result.version,timestamp);
});
test('P4 refund chains keep bounded dependencies and identical canonical month projections',async()=>{
  const {state,row,materialize}=require('./helpers/package5-fixture.cjs'),{buildRecordSnapshot,decodeRecordValues}=require('../src/storage/cloud-record-model.mjs'),{periodFinancials}=require('../src/storage/period-projections.mjs');
  const full=state();full.monthRecords={};
  for(let i=1;i<=10;i++){const month='2026-'+String(i).padStart(2,'0'),r=row('refund-chain-'+i,'terugbetaling',10,{refundCategory:'Kleding',refundMonth:defaultPeriodWindow(month)[1]});r.bankOriginal.bankDate=month+'-03';r.processing.processingDate=month+'-03';materialize(full,[r],'chain-'+i);}
  const snapshot=await buildRecordSnapshot(full),month='2026-10',records=snapshot.records.filter(row=>row.periods.includes(month));
  assert(records.length<full.transactions.length/2);
  const selected=await decodeRecordValues(records),partial={...full,transactions:selected.filter(row=>row.collection==='transactions').map(row=>row.value)};
  assert.deepEqual(periodFinancials(partial,month),periodFinancials(full,month));
});

test('P4 protected backup inventory isolates household and legacy scopes exactly',()=>{
  const {storageScopeMatches,imageScopeMatches}=require('../src/storage/storage-inventory.mjs');
  assert(storageScopeMatches('base:account:house:a','base','house'));
  for(const key of ['base','base:account:house2:a','base:account:other:a',null])assert.equal(storageScopeMatches(key,'base','house'),false);
  assert(storageScopeMatches('base','base','legacy'));assert.equal(storageScopeMatches('base:account:house:a','base','legacy'),false);
  assert(imageScopeMatches('["house","goal"]','house'));assert.equal(imageScopeMatches('["house2","goal"]','house'),false);
  assert(imageScopeMatches('legacy-goal','legacy'));assert.equal(imageScopeMatches('["house","goal"]','legacy'),false);
});

test('P4 budget IDs separate OV and Overig without rewriting legacy transactions',()=>{
  const {state,row,materialize}=require('./helpers/package5-fixture.cjs');
  const {budgetActual,sumTransactionEffects}=require('../src/core/transaction-engine.mjs');
  const {resolveBudgetAssignment,bindBudgetAssignment}=require('../src/core/budget-assignment.mjs');
  const s=state();s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'ov',post:'OV',bedrag:100},{id:'other',post:'Overig',bedrag:200}]}];
  materialize(s,[row('a','uitgave',-50,{category:'OV'}),row('b','uitgave',-20,{category:'Overig'})]);
  const before=structuredClone(s);
  assert.equal(budgetActual(s,'2026-10','gezamenlijk','OV','ov'),50);assert.equal(budgetActual(s,'2026-10','gezamenlijk','Overig','other'),20);
  assert.equal(sumTransactionEffects(s,'budgetImpact',{month:'2026-10'}),70);assert.deepEqual(s,before);
  assert.equal(resolveBudgetAssignment(s,'2026-10','gezamenlijk',{category:'O'}),null);
  assert.equal(resolveBudgetAssignment(s,'2026-10','dion',{category:'OV',budgetItemId:'ov'}),null);
  assert.throws(()=>bindBudgetAssignment(s,'2026-10','gezamenlijk',{category:'OV',budgetItemId:'missing'}));
  s.budgetDefaultsHistory.gezamenlijk.push({effectiveFrom:'2026-11',rows:[{id:'ov',post:'Openbaar vervoer',bedrag:125},{id:'other',post:'Overig',bedrag:200}]});
  assert.equal(budgetActual(s,'2026-10','gezamenlijk','OV','ov'),50);
  materialize(s,[{...row('c','uitgave',-30,{category:'OV',budgetItemId:'ov'}),bankOriginal:{...row('c').bankOriginal,bankDate:'2026-11-03'}}],'november');
  assert.equal(budgetActual(s,'2026-11','gezamenlijk','Openbaar vervoer','ov'),30);
  assert.equal(budgetActual(s,'2026-11','gezamenlijk','Overig','other'),0);
  s.budgetDefaultsHistory.gezamenlijk[0].rows.push({id:'ambiguous',post:'OV',bedrag:5});
  assert.equal(resolveBudgetAssignment(s,'2026-10','gezamenlijk',{category:'OV'}),null);
  assert.equal(budgetActual(s,'2026-10','gezamenlijk','OV','ov'),50);
});
