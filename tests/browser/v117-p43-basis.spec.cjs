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


for(const boundary of ['revision','epoch'])test('P4.3 stale preparation '+boundary+' is rejected even with the same financial hash',async({page})=>{
  await setup(page);
  const result=await page.evaluate(async boundary=>{
    const {m,scope}=migrationTest,db=await m.openHouseholdDatabase(scope),store=m.createHouseholdStore(scope),before=await store.load();
    const head=store.head;
    await new Promise((resolve,reject)=>{const tx=db.transaction('financialHead','readwrite'),r=tx.objectStore('financialHead').get('current');r.onsuccess=()=>tx.objectStore('financialHead').put({...r.result,...(boundary==='revision'?{storageRevision:head.storageRevision+1}:{migration:{epoch:'external-epoch'}})});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const candidate=structuredClone(before);candidate.meta.revision++;
    let code;try{await store.commit(candidate,{operationId:'must-not-commit'});}catch(error){code=error.code;}
    const inspection=await store.inspectOperation('must-not-commit');
    return {code,state:inspection.state,before,receipt:inspection.receipt};
  },boundary);
  expect(result.code).toBe('storage-conflict');expect(result.state).toEqual(result.before);expect(result.receipt).toBeNull();
});
