const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEmulatorRecordTransport}=require('../../src/storage/firestore-record-transport.mjs');
const {createRecordCloudStore}=require('../../src/storage/cloud-records.mjs');
const {state,row,materialize,copy}=require('../helpers/package5-fixture.cjs');
const {digest}=require('../../src/storage/period-projections.mjs');
const {fixture,active,token,admin,projectId}=require('../helpers/v117-p3-emulator.cjs');
const {encodeCloudState,decodeCloudState,cloudStateManifest}=require('../../src/storage/cloud-chunks.mjs');
const {readLegacyCloudImports}=require('../../src/storage/legacy-import-readback.mjs');
const importRuntime=require('../../src/import/update4-runtime.cjs');
const {csvFileDigest}=require('../../src/import/import-identity.mjs');
const {periodFinancials,cumulativeFinancials}=require('../../src/storage/period-projections.mjs');

test('P3 actual rules: verified migration preserves legacy, ten savings sources and idempotent second client',async()=>{
  const f=await fixture();
  await f.store.migrate({state:f.s,imports:[],epoch:'epoch-one',legacyPointer:f.legacy});
  await assert.rejects(()=>f.store.loadPeriod('2026-10'),{code:'storage-version'});
  await f.store.activate({approveTestCutover:true});
  const candidate=copy(f.s),batch=materialize(candidate,Array.from({length:10},(_,i)=>row('saving-'+i,'naar-spaarrekening',-(50+i),{savingsGoalId:'goal'})));
  const result=await f.store.commit({state:candidate,imports:[batch],operationId:'savings-ten',expectedRevision:1,members:Array.from({length:10},(_,i)=>({id:'local-'+i,sha256:'a'.repeat(64),storageRevision:i+1}))});
  assert.equal(result.outcome,'committed');
  const period=await f.store.loadPeriod('2026-10');assert.equal(period.financials.totalsCents.savingsDeposit,54500);assert.equal(period.financials.approvedEffectCount,10);
  assert.equal((await f.store.operationReceipt('local-9')).outcome,'committed');
  const another=createRecordCloudStore({householdId:f.householdId,transport:createEmulatorRecordTransport({token:token(f.email,'other-client')})});
  assert.deepEqual((await another.loadPeriod('2026-10')).financials,period.financials);
  const before=await another.context();assert.equal((await another.commit({state:candidate,imports:[batch],operationId:'savings-ten',expectedRevision:1,members:Array.from({length:10},(_,i)=>({id:'local-'+i,sha256:'a'.repeat(64),storageRevision:i+1}))})).replayed,true);
  assert.equal((await another.context()).head.data.revision,before.head.data.revision);
  assert.deepEqual((await f.transport.get(`households/${f.householdId}/budgetState/current`)).data,f.legacy);
  assert.equal((await another.verifyIntegrity()).head.stateHash,await digest(candidate));
  assert.deepEqual(await another.loadImport(batch.id),batch);
});

for(const phase of ['protected','operation-prepared','changes-staged','locked','records-applied','target-verified','members-staged','committed','verified-readback'])test('P3 actual rules: resumable migration after interruption at '+phase,async()=>{
  const f=await fixture();let interrupted=false;
  await assert.rejects(()=>f.store.migrate({state:f.s,epoch:'epoch-one',legacyPointer:f.legacy,checkpoint:point=>{if(point===phase&&!interrupted){interrupted=true;throw new Error('simulated closed client at '+phase);}}}),/simulated closed/);
  const resumed=createRecordCloudStore({householdId:f.householdId,transport:createEmulatorRecordTransport({token:token(f.email,'restarted-client')})});
  await resumed.migrate({state:f.s,epoch:'epoch-one',legacyPointer:f.legacy});await resumed.activate({approveTestCutover:true});
  assert.deepEqual((await resumed.verifyIntegrity()).state,f.s);
  const operations=await f.transport.query(`households/${f.householdId}/financialEpochs/epoch-one/operations`);assert.equal(operations.length,1);assert.equal(operations[0].data.phase,'committed');
  assert.deepEqual((await f.transport.get(`households/${f.householdId}/budgetState/current`)).data,f.legacy);
});

test('P3 actual rules: v116 writes, epoch rollback and foreign household reads/writes are denied',async()=>{
  const f=await fixture(),house=`households/${f.householdId}`,root=house+'/financialEpochs/epoch-one';
  f.legacy={...f.legacy,syncVersion:2,commitId:'v116-positive-control'};
  await f.transport.commit([{path:house+'/budgetState/current',data:f.legacy}]);
  const encoded=await encodeCloudState(f.s,'v116-positive-generation'),generationPath=house+'/budgetState/current/generations/v116-positive-generation';
  await f.transport.commit([{path:generationPath,data:encoded.descriptor}]);
  for(const chunk of encoded.chunks)await f.transport.commit([{path:generationPath+'/chunks/'+chunk.sequence,data:chunk}]);
  const complete={...encoded.descriptor,complete:true};await f.transport.commit([{path:generationPath,data:complete}]);
  f.legacy=cloudStateManifest(complete,{syncVersion:3,commitId:'v116-valid-chunks',updatedAt:'test',updatedBy:'v116'});await f.transport.commit([{path:house+'/budgetState/current',data:f.legacy}]);
  await f.store.migrate({state:f.s,epoch:'epoch-one',legacyPointer:f.legacy});await f.store.activate({approveTestCutover:true});
  await assert.rejects(()=>f.transport.commit([{path:house+'/budgetState/current',data:{...f.legacy,syncVersion:4,baseVersion:3,commitId:'v116-stale'}}]),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.commit([{path:house+'/imports/old-client',data:{id:'old-client',version:1,operationId:'v116'}}]),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.commit([{path:house+'/imports/old-client/chunks/0',data:{payload:'v116'}}]),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.commit([{path:house+'/budgetState/current/generations/v116',data:{...encoded.descriptor,generation:'v116'}}]),{code:'permission-denied'});
  const control=(await f.transport.get(house+'/financialStorage/current')).data;
  await assert.rejects(()=>f.transport.commit([{path:house+'/financialStorage/current',data:{...control,epoch:'old-epoch'}}]),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.commit([{path:house+'/financialStorage/current',data:{...control,storageVersion:1}}]),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.get(root.replace(f.householdId,'foreign-house')+'/meta/head'),{code:'permission-denied'});
  await assert.rejects(()=>f.transport.commit([{path:root.replace(f.householdId,'foreign-house')+'/records/forged',data:{payload:'forged'}}]),{code:'permission-denied'});
  const head=(await f.store.context()).head.data;
  await assert.rejects(()=>f.transport.commit([{path:root+'/meta/head',data:{...head,revision:999}}]),{code:'permission-denied'});
});

for(const phase of ['changes-staged','locked','members-staged','committed'])test('P3 actual rules: interrupted financial commit has no false publication at '+phase,async()=>{
  const f=await active(),next=copy(f.s);materialize(next,[row('new-saving','naar-spaarrekening',-70,{savingsGoalId:'goal'})]);let interrupted=false;
  const args={state:next,operationId:'interrupted-saving',expectedRevision:1,members:[{id:'local-saving',sha256:'b'.repeat(64),storageRevision:3}]};
  await assert.rejects(()=>f.store.commit({...args,checkpoint:point=>{if(point===phase&&!interrupted){interrupted=true;throw new Error('interrupted');}}}),/interrupted/);
  if(['locked','members-staged'].includes(phase))await assert.rejects(()=>f.store.loadPeriod('2026-10'),{code:'cloud-pending'});
  if(phase==='members-staged')assert.equal(await f.store.operationReceipt('local-saving'),null);
  const other=createRecordCloudStore({householdId:f.householdId,transport:createEmulatorRecordTransport({token:token(f.email,'device-two')})});
  await other.commit(args);assert.equal((await other.loadPeriod('2026-10')).financials.totalsCents.savingsDeposit,7000);
  const before=(await other.context()).head.data.revision;await other.commit(args);assert.equal((await other.context()).head.data.revision,before);
  assert.equal((await other.operationReceipt('local-saving')).outcome,'committed');
});

test('P3 actual rules: stale revision and reused operation IDs cannot overwrite newer approvals',async()=>{
  const f=await active(),one=copy(f.s);materialize(one,[row('first')]);await f.store.commit({state:one,operationId:'first',expectedRevision:1});
  const two=copy(f.s);materialize(two,[row('second')]);
  await assert.rejects(()=>f.store.commit({state:two,operationId:'second',expectedRevision:1}),{code:'cloud-conflict'});
  await assert.rejects(()=>f.store.commit({state:two,operationId:'first',expectedRevision:2}),{code:'operation-reused'});
  assert.deepEqual((await f.store.verifyIntegrity()).state,one);
});

test('P3 actual rules: unverified or incomplete migration cannot activate and old source mismatch is blocked',async()=>{
  const f=await fixture(),wrong=copy(f.s);wrong.planning.spaarpotDezeMaand=999;
  await assert.rejects(()=>f.store.migrate({state:wrong,epoch:'epoch-one',legacyPointer:f.legacy}),{code:'migration-source-conflict'});
  assert.equal(await f.transport.get(`households/${f.householdId}/financialStorage/current`),null);
  await f.store.migrate({state:f.s,epoch:'epoch-one',legacyPointer:f.legacy});
  await assert.rejects(()=>f.store.activate(),{code:'cutover-approval'});
  await admin.commit([{path:`households/${f.householdId}/budgetState/current`,data:{...f.legacy,syncVersion:2,commitId:'changed-source'}}]);
  await assert.rejects(()=>f.store.activate({approveTestCutover:true}),{code:'migration-source-conflict'});
});

test('P3 actual rules: missing records and corrupt financial projections never become zero totals',async()=>{
  const f=await active(),next=copy(f.s);materialize(next,[row('corruption-check')]);await f.store.commit({state:next,operationId:'save',expectedRevision:1});
  const c=await f.store.context(),records=await admin.query(c.root+'/records',{field:'periods',op:'ARRAY_CONTAINS',value:'2026-10'}),record=records[0];
  await admin.commit([{path:record.path,data:{...record.data,payload:'corrupt'}}]);
  await assert.rejects(()=>f.store.loadPeriod('2026-10'),{code:'record-integrity'});
  await assert.rejects(()=>f.store.verifyIntegrity(),{code:'record-integrity'});
});

test('P3 actual rules: rollback export includes new post-migration postings',async()=>{
  const f=await active(),next=copy(f.s),batch=materialize(next,[row('after-migration','naar-spaarrekening',-25,{savingsGoalId:'goal'})]);
  await f.store.commit({state:next,imports:[batch],operationId:'new-booking',expectedRevision:1,members:[{id:'post-migration-local',sha256:'c'.repeat(64),storageRevision:2}]});
  const exported=await f.store.exportRollback();assert.deepEqual(exported.state,next);assert.deepEqual(exported.imports,[batch]);assert.equal(exported.operations.filter(row=>row.phase==='committed').length,2);
  assert.equal(exported.receipts[0].id,'post-migration-local');assert.equal(exported.operations.find(row=>row.id==='new-booking').members[0].id,'post-migration-local');
  const encoded=await encodeCloudState(exported.state,'verified-fallback'),descriptor={...encoded.descriptor,complete:true},pointer=cloudStateManifest(descriptor,{syncVersion:3,commitId:'verified-fallback',updatedAt:'test',updatedBy:'test'});
  const restored=await decodeCloudState(pointer,descriptor,encoded.chunks);assert.deepEqual(restored,next);assert.deepEqual(cumulativeFinancials(restored),cumulativeFinancials(next));
});

test('P3 actual rules: old generation chunks, CSV row chunks and original source bytes migrate losslessly',async()=>{
  const s=state(),batch=materialize(s,[row('raw-csv-saving','naar-spaarrekening',-75,{savingsGoalId:'goal'})]);
  batch.originalCsv='Datum;Omschrijving;Bedrag\r\n2026-10-03;Spaarrekening α;-75\r\n';batch.fileDigest=csvFileDigest(batch.originalCsv);
  const f=await fixture(s),root=`households/${f.householdId}`;
  s.spaardoelen.gezamenlijk[0].afbeelding='data:image/png;base64,'+'A'.repeat(1100000);
  const encoded=await encodeCloudState(s,'legacy-generation'),descriptor={...encoded.descriptor,complete:true};
  const pointer=cloudStateManifest(descriptor,{syncVersion:1,commitId:'legacy',updatedAt:'2026-10-01',updatedBy:'legacy'}),envelope=importRuntime.buildCloudImportEnvelope(batch),importPath=root+'/imports/'+batch.id;
  await admin.commit([{path:root+'/budgetState/current',data:pointer},{path:root+'/budgetState/current/generations/legacy-generation',data:descriptor},...encoded.chunks.map(chunk=>({path:root+'/budgetState/current/generations/legacy-generation/chunks/'+chunk.sequence,data:chunk})),{path:importPath,data:envelope.header},...envelope.chunks.map(chunk=>({path:importPath+'/chunks/'+batch.operationId+'-'+String(chunk.index).padStart(4,'0'),data:chunk})),...envelope.sourceChunks.map((text,index)=>({path:importPath+'/chunks/'+batch.operationId+'-source-'+index,data:{generation:batch.operationId,index,text}}))]);
  const readLegacyImports=(headers,transport)=>readLegacyCloudImports(headers,transport,{assembleCloudImport:importRuntime.assembleCloudImport});
  const imports=await readLegacyImports(await f.transport.query(root+'/imports'),f.transport),store=createRecordCloudStore({...f,readLegacyImports});
  await store.migrate({state:s,imports,epoch:'chunked-epoch',legacyPointer:pointer});await store.activate({approveTestCutover:true});
  const verified=await store.verifyIntegrity();assert.deepEqual(verified.state,s);assert.deepEqual(verified.imports,imports);assert.equal((await store.loadImport(batch.id)).originalCsv,batch.originalCsv);
  assert(verified.global.payload.length<10000);assert(verified.records.some(row=>row.partCount>1));
  assert.deepEqual((await f.transport.get(root+'/budgetState/current/generations/legacy-generation/chunks/0')).data,encoded.chunks[0]);
  assert.deepEqual((await store.loadPeriod('2026-10')).financials,periodFinancials(s,'2026-10'));
  const sourcePath=importPath+'/chunks/'+batch.operationId+'-source-0';
  await assert.rejects(()=>f.transport.commit([{path:sourcePath,data:{generation:batch.operationId,index:0,text:'changed'}}]),{code:'permission-denied'});
});

test('P3 actual rules: 36 period queries use bounded record reads and preserve all financial projections',async()=>{
  const s=state(),months=Array.from({length:36},(_,i)=>`${2023+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);
  s.monthRecords={};
  for(const month of months){
    const rows=[row(month+'-expense','uitgave',-100),row(month+'-saving','naar-spaarrekening',-50,{savingsGoalId:'goal'}),row(month+'-refund','terugbetaling',20,{refundCategory:'Kleding',refundMonth:month})];
    for(const r of rows){r.bankOriginal.bankDate=month+'-03';r.processing.processingDate=month+'-03';}
    materialize(s,rows,'batch-'+month);
  }
  const start=performance.now(),f=await active(s),migrationMs=performance.now()-start,all=await f.store.verifyIntegrity(),before={...f.transport.metrics},queryStart=performance.now(),period=await f.store.loadPeriod(months[17]),periodMs=performance.now()-queryStart;
  assert.deepEqual(period.financials,periodFinancials(s,months[17]));assert.deepEqual(period.cumulative,cumulativeFinancials(s));
  assert(period.recordCount<all.records.length/10);assert(f.transport.metrics.reads-before.reads<all.records.length/10);
  for(const month of months)assert.deepEqual((await f.store.loadPeriod(month)).financials,periodFinancials(s,month));
  console.log('P3_PERIOD_METRICS '+JSON.stringify({months:36,bankMovements:108,allRecordDocuments:all.records.length,queriedRecords:period.recordCount,periodDocumentReads:5+period.recordCount,migrationMs,periodMs,totalWrites:f.transport.metrics.writes}));
});

test('P3 actual rules: competing clients cannot both commit against the same cloud revision',async()=>{
  const f=await active(),a=copy(f.s),b=copy(f.s);materialize(a,[row('device-a-saving','naar-spaarrekening',-20,{savingsGoalId:'goal'})]);materialize(b,[row('device-b-saving','naar-spaarrekening',-30,{savingsGoalId:'goal'})]);
  const results=await Promise.allSettled([f.store.commit({state:a,operationId:'competing-a',expectedRevision:1}),f.store.commit({state:b,operationId:'competing-b',expectedRevision:1})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const verified=await f.store.verifyIntegrity();assert.equal(verified.head.revision,2);assert.equal(verified.global&&JSON.parse(verified.global.payload).approvedEffectCount,1);
});

test('P3 actual rules: withdrawn source tombstones cannot return with a different bank original',async()=>{
  const s=state();materialize(s,[row('immutable-return')]);const f=await active(s),empty=copy(s);empty.transactions=[];
  await f.store.commit({state:empty,operationId:'remove-source',expectedRevision:1});
  const damaged=copy(s);damaged.transactions[0].bankOriginal.amount=-999;
  await assert.rejects(()=>f.store.commit({state:damaged,operationId:'bad-return',expectedRevision:2}),{code:'source-immutable'});
  assert.equal((await f.store.context()).head.data.phase,'ready');assert.equal((await f.store.context()).head.data.revision,2);
  assert.deepEqual((await f.store.verifyIntegrity()).state,empty);
});

test('P3 actual rules: import headers changed at the migration fence block activation',async()=>{
  const f=await fixture();let changed=false;
  await assert.rejects(()=>f.store.migrate({state:f.s,epoch:'race-epoch',legacyPointer:f.legacy,checkpoint:async phase=>{if(phase==='protected'&&!changed){changed=true;await admin.commit([{path:`households/${f.householdId}/imports/changed-at-fence`,data:{id:'changed-at-fence',rows:[]}}]);}}}),{code:'migration-source-conflict'});
  await assert.rejects(()=>f.store.activate({approveTestCutover:true}),{code:'migration-incomplete'});
});
