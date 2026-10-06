const {test}=require('node:test');
const assert=require('node:assert/strict');
const {encodeCloudState,decodeCloudState,cloudStateManifest,createChunkedCloudStore,CLOUD_CHUNK_BYTES}=require('../src/storage/cloud-chunks.mjs');
const {assertCloudBase,cloudStateSignature}=require('../src/storage/sync-protocol.mjs');
const {financialForecastForMonth,categoryFinancialActuals,sumTransactionEffects}=require('../src/core/transaction-engine.mjs');
const migrationRuntime=require('./helpers/migration-runtime.cjs');
const input=require('./fixtures/v50-visual-state.json');
const fs=require('node:fs');
const fixture=()=>({...JSON.parse(JSON.stringify(migrationRuntime().migrateBudgetState(input))),unknownStoragePayload:'€🙂漢字'.repeat(200000)});
const metadata={syncVersion:800,commitId:'test-generation',updatedAt:'isolated',updatedBy:'device-a'};
const seal=e=>({...e.descriptor,complete:true});
async function roundtrip(state){const encoded=await encodeCloudState(state,'test-generation');const descriptor=seal(encoded),manifest=cloudStateManifest(descriptor,metadata);return {encoded,descriptor,manifest,state:await decodeCloudState(manifest,descriptor,encoded.chunks)};}
function mock(){
 const docs=new Map();let failSequence=-1;
 const snapshot=path=>({exists:()=>docs.has(path),data:()=>structuredClone(docs.get(path))});
 const sdk={doc:(_,path)=>({path}),getDoc:async ref=>snapshot(ref.path),setDoc:async(ref,data)=>{if(data.sequence===failSequence)throw new Error('isolated write failure');docs.set(ref.path,structuredClone(data));},updateDoc:async(ref,data)=>docs.set(ref.path,{...docs.get(ref.path),...data})};
 const currentRef={path:'households/test/budgetState/current'};
 return {docs,sdk,currentRef,store:createChunkedCloudStore(sdk,{},currentRef),setFailure:n=>{failSequence=n;}};
}
test('T5 large v11 has safe deterministic UTF-8 chunks',async()=>{const state=fixture(),a=await encodeCloudState(state,'test-generation'),b=await encodeCloudState(state,'test-generation');assert.deepEqual(a,b);assert.ok(a.chunks.length>1);for(const c of a.chunks){assert.ok(c.byteLength<=CLOUD_CHUNK_BYTES);assert.equal(Buffer.byteLength(c.payload),c.byteLength);} });
test('T6 recursive exact v11 roundtrip, Unicode and unknown fields',async()=>{const state=fixture();assert.deepEqual((await roundtrip(state)).state,state);});
test('T7 missing/wrong-sequence/wrong-generation chunk refused',async()=>{const r=await roundtrip(fixture());for(const mode of ['missing','sequence','generation']){const chunks=structuredClone(r.encoded.chunks);if(mode==='missing')chunks[1]=null;else chunks[1][mode]=mode==='sequence'?0:'other';await assert.rejects(decodeCloudState(r.manifest,r.descriptor,chunks),/integriteit/);}});
test('T8 corrupt per-chunk and total checksum refused',async()=>{const r=await roundtrip(fixture()),chunks=structuredClone(r.encoded.chunks);chunks[0].payload=chunks[0].payload.replace('a','b');await assert.rejects(decodeCloudState(r.manifest,r.descriptor,chunks),/integriteit/);await assert.rejects(decodeCloudState({...r.manifest,totalSha256:'0'.repeat(64)},r.descriptor,r.encoded.chunks),/integriteit/);});
test('T9 interrupted generation never changes current or seals',async()=>{const m=mock(),before={state:{meta:{schemaVersion:9}},syncVersion:799};m.docs.set(m.currentRef.path,before);m.setFailure(1);await assert.rejects(m.store.prepare(fixture(),'failed-generation'),/isolated/);assert.deepEqual(m.docs.get(m.currentRef.path),before);assert.equal(m.docs.get(m.store.generationRef('failed-generation').path).complete,false);assert.throws(()=>cloudStateManifest(m.docs.get(m.store.generationRef('failed-generation').path),metadata),/incomplete/);});
test('T10 server-verified complete generation can be activated',async()=>{const m=mock(),state=fixture(),descriptor=await m.store.prepare(state,'test-generation');assert.equal(descriptor.complete,true);const manifest=cloudStateManifest(descriptor,metadata);m.docs.set(m.currentRef.path,manifest);assert.deepEqual((await m.store.hydrate(manifest)).state,state);});
test('T11 A wins CAS; B cannot switch complete second generation with stale base',async()=>{const m=mock(),state=fixture(),base={state,syncVersion:799};const a=await m.store.prepare(state,'device-a'),b=await m.store.prepare({...state,unknown:'b'},'device-b');assert.equal(assertCloudBase(base,799,cloudStateSignature(state)),799);const current=cloudStateManifest(a,{...metadata,commitId:'device-a'});m.docs.set(m.currentRef.path,current);assert.throws(()=>assertCloudBase(current,799,cloudStateSignature(state)),{code:'finize/cloud-conflict'});assert.equal(m.docs.get(m.currentRef.path).activeGeneration,'device-a');assert.equal(b.complete,true);});
test('T12 equal version with stale signature refused',async()=>{const r=await roundtrip(fixture());assert.throws(()=>assertCloudBase(r.manifest,800,'stale'),{code:'finize/cloud-conflict'});assert.equal(assertCloudBase(r.manifest,800,cloudStateSignature(r.state)),800);});
test('T13 inline schema9/v11 stay readable without chunk requests',async()=>{const m=mock();for(const schema of [9,11]){const data={state:{meta:{schemaVersion:schema},unknown:{preserved:true}},syncVersion:799};assert.strictEqual(await m.store.hydrate(data),data);}});
test('T14 fresh reader reconstructs same v11 after reload',async()=>{const m=mock(),state=fixture(),descriptor=await m.store.prepare(state,'test-generation'),manifest=cloudStateManifest(descriptor,metadata);const reloaded=createChunkedCloudStore(m.sdk,{},m.currentRef);assert.deepEqual((await reloaded.hydrate(manifest)).state,state);});
test('T16 financial selectors exactly equal on already-migrated state',async()=>{
 const before=fixture();
 before.transactions=[{id:'salary',source:'manual',accountContext:'gezamenlijk',financialFor:'dion',date:'2026-08-12',amount:2645,transactionType:'salaris',kind:'inkomen',processingStatus:'goedgekeurd'},
 {id:'expense',source:'manual',accountContext:'dion',financialFor:'dion',date:'2026-08-12',amount:300,transactionType:'uitgave',category:'Kleding',processingStatus:'goedgekeurd'},
 {id:'refund',source:'manual',accountContext:'dion',financialFor:'dion',date:'2026-09-12',amount:50,transactionType:'terugbetaling',refundCategory:'Kleding',refundMonth:'2026-08',processingStatus:'goedgekeurd'}];
 const after=(await roundtrip(before)).state;
 const capture=state=>['2026-08','2026-09','2026-10'].map(month=>({month,forecast:financialForecastForMonth(state,month),categories:categoryFinancialActuals(state,month),effects:Object.fromEntries(['accountCashflow','externalHouseholdCashflow','incomeImpact','realExpense','budgetImpact','savingsDeposit','unusedSavings'].map(field=>[field,sumTransactionEffects(state,field,{month})]))}));
 const baseline=capture(before);assert.equal(baseline[0].effects.realExpense,300);assert.equal(baseline[0].effects.incomeImpact,2645);assert.deepEqual(capture(after),baseline);
});
test('manifest/map key ordering does not change JSON reconstruction',async()=>{const r=await roundtrip(fixture());const sorted=Object.fromEntries(Object.entries(r.manifest.stateMeta).sort());assert.deepEqual(await decodeCloudState({...r.manifest,stateMeta:sorted},{...r.descriptor,stateMeta:sorted},r.encoded.chunks),r.state);});
test('measurement of already-migrated representative v11 (no data pruning)',()=>{const state=fixture(),components=Object.entries(state).map(([field,value])=>({field,bytes:Buffer.byteLength(JSON.stringify(value))})).sort((a,b)=>b.bytes-a.bytes);console.log('STORAGE_PAYLOAD '+JSON.stringify({total:Buffer.byteLength(JSON.stringify(state)),components}));assert.equal(state.meta.schemaVersion,11);});
