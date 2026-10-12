const {test,expect}=require('@playwright/test');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
test.setTimeout(120000);
async function setup(page){
  const bundle=require('esbuild').buildSync({stdin:{contents:'export {openHouseholdDatabase,createHouseholdStore,encodeHouseholdState} from "./src/storage/household-store.mjs";export {csvFileDigest} from "./src/import/import-identity.mjs";export {encodePayloadRow,decodePayloadRow} from "./src/storage/payload-parts.mjs";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false}).outputFiles[0].text;
  await page.route('https://www.gstatic.com/**',route=>route.abort());await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.route('**/payload-migration-test.mjs',route=>route.fulfill({contentType:'text/javascript',body:bundle}));
  await page.goto('/');
  const s=state(),batch=materialize(s,Array.from({length:20},(_,i)=>row('protected-'+i)), 'protected-batch');
  return page.evaluate(async({state,batch})=>{
    const m=await import('/payload-migration-test.mjs'),scope='physical-migration-'+crypto.randomUUID(),name='finize-imports-v1-'+scope;
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,3);r.onupgradeneeded=()=>{for(const name of ['imports','journal','syncQueue','financialRecords','financialHead','operationReceipts','financialOutbox','periodCache'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const encoded=m.encodeHouseholdState(state),head={id:'current',storageVersion:1,schemaVersion:11,storageRevision:1,revision:state.meta.revision,layout:encoded.layout,sha256:m.csvFileDigest(JSON.stringify(state)),verified:true};
    await new Promise((resolve,reject)=>{const tx=db.transaction(Array.from(db.objectStoreNames),'readwrite');for(const record of encoded.records)tx.objectStore('financialRecords').put(record);tx.objectStore('financialHead').put(head);tx.objectStore('imports').put(batch);tx.objectStore('journal').put({id:'pending-proof',status:'pending',intent:{operationId:'never-execute'},candidate:state,baseSignature:JSON.stringify(state),batch});tx.objectStore('syncQueue').put({id:batch.id,importId:batch.id,operationId:'offline-op',version:batch.version});tx.objectStore('operationReceipts').put({id:'durable-receipt',outcome:'committed',sha256:head.sha256});tx.objectStore('financialOutbox').put({id:'offline-op',operationId:'offline-op',status:'pending',sha256:head.sha256,previousHash:head.sha256,changes:[]});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    db.close();window.migrationTest={m,scope,name,state,batch,head};return {scope,name,state,batch,head};
  },{state:s,batch});
}

test('P4 physical migration resumes after browser close and preserves pending imports receipts and original state',async({page,context})=>{
  const seed=await setup(page);
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put,getAll=IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.put=function(value,...args){if(this.name==='representationMeta'&&value.phase==='copying'&&value.lastKey!==null)this.transaction.addEventListener('complete',()=>window.copyCheckpoint=true);return put.call(this,value,...args);};
    IDBObjectStore.prototype.getAll=function(...args){if(window.copyCheckpoint&&['imports','journal','syncQueue','financialRecords'].includes(this.name)){const native=getAll.apply(this,args);return {set onsuccess(value){},set onerror(value){native.onerror=value;}};}return getAll.apply(this,args);};
    window.pendingMigration=migrationTest.m.openHouseholdDatabase(migrationTest.scope).catch(error=>window.migrationError=error.code||error.name);
  });
  await page.waitForFunction(()=>window.copyCheckpoint);await page.close();
  const restarted=await context.newPage();await setup(restarted);
  const result=await restarted.evaluate(async seed=>{
    const {openHouseholdDatabase,createHouseholdStore}=await import('/payload-migration-test.mjs'),db=await openHouseholdDatabase(seed.scope),store=createHouseholdStore(seed.scope);
    const read=async name=>new Promise((resolve,reject)=>{const tx=db.transaction(name),r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return {state:await store.load(),imports:await read('imports'),journal:await read('journal'),queue:await read('syncQueue'),receipts:await read('operationReceipts'),meta:await read('representationMeta'),backups:await read('representationBackup')};
  },seed);
  expect(result.state).toEqual(seed.state);expect(result.imports).toEqual([seed.batch]);expect(result.journal[0].candidate).toEqual(seed.state);expect(result.queue[0].operationId).toBe('offline-op');expect(result.receipts[0].id).toBe('durable-receipt');expect(result.meta[0]).toMatchObject({format:2,phase:'active',scope:seed.scope});expect(result.backups.length).toBeGreaterThan(40);
  expect(result.backups.find(row=>row.store==='financialHead').value).toEqual(seed.head);
});

for(const invalid of ['scope','format'])test(`P4 physical storage rejects an unsupported ${invalid} without changing original finance`,async({page})=>{
  const seed=await setup(page);
  const result=await page.evaluate(async invalid=>{
    const {name,scope,m}=migrationTest;
    const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,4);r.onupgradeneeded=()=>{for(const name of ['payloadParts','payloadProtection','representationMeta','representationBackup','representationStage'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=raw.transaction('representationMeta','readwrite');tx.objectStore('representationMeta').put({id:'current',format:invalid==='format'?99:2,phase:'active',scope:invalid==='scope'?'different-household':scope});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});raw.close();
    let code;try{await m.openHouseholdDatabase(scope);}catch(error){code=error.code;}
    const check=await new Promise(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);});
    const head=await new Promise(resolve=>{const r=check.transaction('financialHead').objectStore('financialHead').get('current');r.onsuccess=()=>resolve(r.result);});check.close();return {code,head};
  },invalid);
  expect(result.code).toBe(invalid==='scope'?'household-scope':'storage-version');expect(result.head).toEqual(seed.head);
});

test('P4 cache cleanup preserves transitive financial proofs and can recreate deleted cache-only parts',async({page})=>{
  await setup(page);
  const result=await page.evaluate(async()=>{
    const {m,state}=migrationTest,scope='cache-proof-'+crypto.randomUUID(),db=await m.openHouseholdDatabase(scope),store=m.createHouseholdStore(scope);
    const graph={items:Array.from({length:20},(_,i)=>({id:'shared-'+i,text:'immutable '+i}))};
    const cache={id:'2024-01',scope,epoch:'test',cloudRevision:1,lastUsed:1,pinned:false,offline:0,state:{archive:graph,cacheOnly:'disposable'.repeat(800)}};
    const putCache=()=>new Promise((resolve,reject)=>{const tx=db.transaction('periodCache','readwrite');tx.objectStore('periodCache').put(cache);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    await putCache();await store.commit({...state,archive:graph},{queueCloud:false});await store.commit(state,{queueCloud:false});
    const before=await store.load(),trimmed=await store.cache.evict({selectedMonth:'2026-10',targetBytes:0});
    const raw=db.rawDatabase,parts=await new Promise(resolve=>{const r=raw.transaction('payloadParts').objectStore('payloadParts').getAll();r.onsuccess=()=>resolve(new Map(r.result.map(row=>[row.id,row])));});
    const proof=m.encodePayloadRow({id:'old-financial-proof',value:graph}),retained=await m.decodePayloadRow(proof.stored,hash=>parts.get(hash));
    await putCache();const restored=await new Promise((resolve,reject)=>{const tx=db.transaction('periodCache'),r=tx.objectStore('periodCache').get(cache.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return {trimmed,retained:JSON.stringify(retained.value)===JSON.stringify(graph),recreated:JSON.stringify(restored)===JSON.stringify(cache),finance:JSON.stringify(await store.load())===JSON.stringify(before)};
  });
  expect(result.trimmed.removed).toEqual(['2024-01']);expect(result.trimmed.removedPayloadBytes).toBeGreaterThan(0);
  expect(result.retained).toBe(true);expect(result.recreated).toBe(true);expect(result.finance).toBe(true);
});

test('P4 aborted physical activation leaves original finance intact and resumes safely',async({page})=>{
  const seed=await setup(page);
  const result=await page.evaluate(async()=>{
    const {m,scope,name}=migrationTest,put=IDBObjectStore.prototype.put;let failed;
    IDBObjectStore.prototype.put=function(value,...args){if(this.name==='financialHead'){this.transaction.abort();throw new DOMException('physical activation interrupted','QuotaExceededError');}return put.call(this,value,...args);};
    try{await m.openHouseholdDatabase(scope);}catch(error){failed=error.code||error.name;}finally{IDBObjectStore.prototype.put=put;}
    const raw=await new Promise(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);}),original=await new Promise(resolve=>{const r=raw.transaction('financialHead').objectStore('financialHead').get('current');r.onsuccess=()=>resolve(r.result);});raw.close();
    await m.openHouseholdDatabase(scope);return {failed,original,state:await m.createHouseholdStore(scope).load()};
  });
  expect(result.failed).toBeTruthy();expect(result.original).toEqual(seed.head);expect(result.state).toEqual(seed.state);
});

test('P4 missing immutable payload blocks reads instead of displaying empty finance',async({page})=>{
  await setup(page);
  expect(await page.evaluate(async()=>{
    const {m,scope}=migrationTest,db=await m.openHouseholdDatabase(scope),raw=db.rawDatabase;
    await new Promise((resolve,reject)=>{const tx=raw.transaction('payloadParts','readwrite'),store=tx.objectStore('payloadParts'),keys=store.getAllKeys();keys.onsuccess=()=>{for(const key of keys.result)store.delete(key);};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    try{await m.createHouseholdStore(scope).load();return 'unsafe empty fallback';}catch(error){return error.code;}
  })).toBe('storage-payload-integrity');
});

test('P4.2 metadata query hydrates only required journals and revalidates each new transaction',async({page})=>{
  await setup(page);
  const result=await page.evaluate(async()=>{
    const {m,scope}=migrationTest,db=await m.openHouseholdDatabase(scope);
    const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    let tx=db.transaction('journal','readwrite'),completed=done(tx);
    tx.objectStore('journal').put({id:'query-completed',status:'completed',operation:'import-command',importId:'query',proof:{private:'unused'}});
    tx.objectStore('journal').put({id:'query-pending',status:'pending',operation:'import-command',importId:'query',proof:{amount:100}});await completed;
    async function query(){const tx=db.transaction('journal'),completed=done(tx),r=tx.objectStore('journal').getAllMatching({status:['pending','uncertain'],importId:'query',operation:'import-command'});const values=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await completed;return values;}
    const first=await query();first[0].proof.amount=999;
    const second=await query();
    tx=db.transaction('journal','readwrite');completed=done(tx);tx.objectStore('journal').put({...second[0],proof:{amount:200}});await completed;
    const third=await query();
    const raw=db.rawDatabase,rt=raw.transaction('journal'),r=rt.objectStore('journal').get('query-pending');
    const root=await new Promise(resolve=>{r.onsuccess=()=>resolve(r.result);});
    tx=raw.transaction('payloadParts','readwrite');completed=done(tx);tx.objectStore('payloadParts').put({id:root.proof.hash,format:2,payload:'corrupt'});await completed;
    let failure;try{await query();}catch(error){failure=error.code;}
    return {first:first.length,second:second[0].proof.amount,third:third[0].proof.amount,failure};
  });
  expect(result).toEqual({first:1,second:100,third:200,failure:'storage-payload-integrity'});
});
