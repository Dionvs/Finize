const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const fixture=require('../fixtures/v50-visual-state.json');
const migrate=require('../helpers/migration-runtime.cjs')().migrateBudgetState;
const legacyKey='finize-budget-planner-v1';
test.setTimeout(90000);
async function offline(page){await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());}
async function rawStores(page,name='finize-imports-v1'){
  const bundle=require('esbuild').buildSync({entryPoints:[require.resolve('../../src/storage/payload-parts.mjs')],bundle:true,format:'esm',platform:'browser',write:false}).outputFiles[0].text;
  await page.route('**/p2-payload-readback.mjs',route=>route.fulfill({contentType:'text/javascript',body:bundle}));
  return page.evaluate(async name=>{
    // Read native stores without opening the application's migration gate.
    // Losslessly decode the physical representation before the original P2
    // assertions compare all retained data, including pending recovery rows.
    const out=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,names=[...db.objectStoreNames],tx=db.transaction(names,'readonly'),out={};for(const name of names){const q=tx.objectStore(name).getAll();q.onsuccess=()=>out[name]=q.result;}tx.oncomplete=()=>{db.close();resolve(out);};tx.onabort=()=>reject(tx.error);};});
    const {decodePayloadRow}=await import('/p2-payload-readback.mjs'),parts=new Map((out.payloadParts||[]).map(row=>[row.id,row]));
    for(const name of ['imports','journal','syncQueue','financialRecords','financialHead','operationReceipts','financialOutbox','periodCache'])if(out[name])out[name]=await Promise.all(out[name].map(row=>decodePayloadRow(row,hash=>parts.get(hash))));
    return out;
  },name);
}
const retained={
  imports:[{id:'retained-draft',version:4,operationId:'old-op',originalCsv:'Datum;Bedrag\n2026-01-01;-42',sourceFile:{digest:'retained-sha',name:'old.csv'},rows:[{id:'old-row',bankOriginal:{bankDate:'2026-01-01',amount:-42,description:'kept'},processing:{splits:[{id:'split-a',amount:12},{id:'split-b',amount:30}]}}]}],
  journal:[{id:'retained-proof',status:'prepared',operation:'legacy-extension',localChoice:{rawCsvReference:'old.csv',state:{retained:true}}}],
  syncQueue:[{id:'retained-draft',operationId:'old-op',version:4,baseVersion:3,status:'pending',needsSourceUpload:true}]
};
for(const phase of ['after-backup','during-financial-commit','after-prepared','after-activation'])test(`V117 P2 real browser close/reopen resumes migration ${phase}`,async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'finize-v117-p2-'));
  let context;
  try{
    context=await chromium.launchPersistentContext(directory,{headless:true,baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
    let page=await context.newPage();await offline(page);await page.route('**/app.js*',r=>r.abort());await page.goto('/');
    await page.evaluate(async({fixture,retained,key})=>{
      localStorage.setItem(key,JSON.stringify(fixture));
      await new Promise((resolve,reject)=>{const r=indexedDB.open('finize-imports-v1',1);r.onupgradeneeded=()=>{for(const name of Object.keys(retained))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>{const db=r.result,tx=db.transaction(Object.keys(retained),'readwrite');for(const[name,records]of Object.entries(retained))for(const record of records)tx.objectStore(name).put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
    },{fixture,retained,key:legacyKey});
    await page.unroute('**/app.js*');
    await page.addInitScript(phase=>{
      const put=IDBObjectStore.prototype.put,transaction=IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction=function(names,mode,...rest){if(phase==='after-backup'&&mode==='readwrite'&&Array.isArray(names)&&names.includes('financialHead')){window.__p2Checkpoint=phase;throw new DOMException('browser interruption before commit','AbortError');}return transaction.call(this,names,mode,...rest);};
      IDBObjectStore.prototype.put=function(record,...rest){
        if(this.name==='financialHead'&&!record.verified&&phase==='during-financial-commit'||this.name==='financialHead'&&record.verified&&phase==='after-prepared'){
          window.__p2Checkpoint=phase;this.transaction.abort();throw new DOMException('browser interruption','AbortError');
        }
        if(this.name==='financialHead'&&record.verified&&phase==='after-activation')this.transaction.addEventListener('complete',()=>window.__p2Checkpoint=phase);
        return put.call(this,record,...rest);
      };
    },phase);
    await page.reload();await page.waitForFunction(()=>window.__p2Checkpoint);
    const interrupted=await rawStores(page),head=interrupted.financialHead[0];
    expect(await page.evaluate(key=>localStorage.getItem(key),legacyKey)).toBe(JSON.stringify(fixture));
    if(phase==='after-prepared')expect(head.verified).toBe(false);
    if(phase==='after-activation')expect(head.verified).toBe(true);
    if(['after-backup','during-financial-commit'].includes(phase))expect(head).toBeUndefined();
    for(const name of Object.keys(retained))expect(interrupted[name]).toEqual(retained[name]);
    await context.close();context=await chromium.launchPersistentContext(directory,{headless:true,baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
    page=await context.newPage();await offline(page);await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    const resumed=await rawStores(page);
    expect(resumed.financialHead[0].verified).toBe(true);expect(resumed.financialHead[0].migration.retainedStores.imports.count).toBe(1);
    for(const name of Object.keys(retained))expect(resumed[name]).toEqual(retained[name]);
    expect(await page.evaluate(()=>DataAdapter.readDurableState())).toEqual(JSON.parse(JSON.stringify(migrate(fixture))));
    expect(await page.evaluate(key=>localStorage.getItem(key),legacyKey)).toBe(JSON.stringify(fixture));
    expect(resumed.operationReceipts.filter(row=>row.id.startsWith('migration-'))).toHaveLength(1);
    expect(resumed.financialOutbox.filter(row=>row.status==='pending'&&row.id!=='current')).toHaveLength(1);
  }finally{
    await context?.close();
    const resolved=fs.realpathSync(directory),root=fs.realpathSync(os.tmpdir());
    if(path.dirname(resolved)===root&&path.basename(resolved).startsWith('finize-v117-p2-'))fs.rmSync(resolved,{recursive:true,force:true});
  }
});

test('V117 P2 unchanged legacy source is protected; divergent old-client writes block new commits and restart',async({page})=>{
  await offline(page);await page.addInitScript(input=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const result=await page.evaluate(async()=>{
    const before=await DataAdapter.readDurableState(),old=JSON.parse(localStorage.getItem('finize-budget-planner-v1'));old.oldClientChoice='preserved';localStorage.setItem('finize-budget-planner-v1',JSON.stringify(old));
    const accepted=await commitChange(()=>state.newClientChoice='must not commit');return {accepted,before,after:await DataAdapter.readDurableState(),old};
  });
  expect(result.accepted).toBe(false);expect(result.after).toEqual(result.before);
  await page.reload();await page.waitForFunction(()=>window.__finizeInitError);
  expect(await page.evaluate(()=>window.__finizeInitError.message)).toContain('oudere client');
  expect(await page.evaluate(()=>window.__finizeBootstrap.rendered)).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('finize-budget-planner-v1')))).toEqual(result.old);
});

test('V117 P2 stale client cannot overwrite a newer IndexedDB revision',async({page,context})=>{
  await offline(page);await page.addInitScript(input=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const second=await context.newPage();await offline(second);await second.goto('/');await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>commitChange(()=>state.firstClientChoice='durable'))).toBe(true);
  // A durable read must not implicitly rebase an older UI snapshot.
  await second.evaluate(()=>DataAdapter.readDurableState());
  expect(await second.evaluate(()=>commitChange(()=>state.secondClientChoice='stale'))).toBe(false);
  expect(await second.evaluate(()=>DataAdapter.readDurableState())).toMatchObject({firstClientChoice:'durable'});
  expect(await second.evaluate(async()=>Object.hasOwn(await DataAdapter.readDurableState(),'secondClientChoice'))).toBe(false);
  await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await second.evaluate(()=>state.firstClientChoice)).toBe('durable');
});

test('V117 P2 committed operation with lost acknowledgment is read back, never rejected or duplicated',async({page})=>{
  await offline(page);await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const result=await page.evaluate(async()=>{
    const store=DataAdapter.store(),commit=store.commit;
    store.commit=async function(...args){await commit.apply(this,args);throw new Error('lost completion acknowledgment');};
    const ok=await commitChange(()=>state.acknowledgedExactlyOnce='kept',{operationId:'lost-ack-p2'});store.commit=commit;
    const proof=await store.inspectOperation('lost-ack-p2');return {ok,equal:JSON.stringify(state)===JSON.stringify(proof.state),pending:CloudAdapter.pendingState?.acknowledgedExactlyOnce,receipt:proof.receipt};
  });
  expect(result.ok).toBe(true);expect(result.equal).toBe(true);expect(result.pending).toBe('kept');expect(result.receipt.outcome).toBe('committed');
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>state.acknowledgedExactlyOnce)).toBe('kept');
  expect((await rawStores(page)).operationReceipts.filter(row=>row.id==='lost-ack-p2')).toHaveLength(1);
});

test('V117 P2 household switch reloads editors and keeps state, imports, receipts and outboxes separate',async({page})=>{
  await offline(page);
  await page.addInitScript(fixture=>{
    const first={uid:'user-a',email:'a@example.test',emailVerified:true,household:'house-a'};
    if(!localStorage.getItem('v117-test-session'))localStorage.setItem('v117-test-session',JSON.stringify(first));
    const user=JSON.parse(localStorage.getItem('v117-test-session'));
    const key=`finize-budget-planner-v1:account:${user.household}:${user.uid}`;
    if(user.uid!=='user-a2'&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({...fixture,householdMarker:user.household,spaardoelen:{gezamenlijk:[],dara:[],dion:[{id:'same-goal-image',naam:'Scoped foto',doelbedrag:1000,algespaard:0,afbeelding:user.household==='house-a'?'data:image/png;base64,QQ==':'data:image/png;base64,Qg=='}]}}));
    window.__FINIZE_AUTH_ENABLED__=true;
    window.__FINIZE_AUTH_TEST_DRIVER__={initialize(callback){window.__p2Auth=callback;setTimeout(()=>callback(user),0);},loadAssignment:async user=>({householdId:user.household,role:'dion'}),setPersistence:async()=>{}};
  },fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const marker=await page.evaluate(async()=>{
    await commitChange(()=>state.originalHouseholdChoice='only A');
    await FinizeUpdate4.importStore.putImport({id:'same-import-id',householdMarker:'A',version:1,rows:[]});
    return {scope:DataAdapter.store().scope,pending:await DataAdapter.store().pendingCloud(),state:await DataAdapter.readDurableState()};
  });
  expect(marker.scope).toBe('house-a');expect(marker.pending).toBeTruthy();
  const switchUser=async user=>{
    await page.evaluate(user=>{localStorage.setItem('v117-test-session',JSON.stringify(user));window.__p2Auth(user);},user);
    await page.waitForFunction(scope=>window.__finizeBootstrap?.rendered&&DataAdapter.store().scope===scope,user.household);
  };
  await switchUser({uid:'user-b',email:'b@example.test',emailVerified:true,household:'house-b'});
  expect(await page.evaluate(()=>state.householdMarker)).toBe('house-b');
  expect(await page.evaluate(()=>state.originalHouseholdChoice)).toBeUndefined();
  expect(await page.evaluate(()=>FinizeUpdate4.importStore.getImport('same-import-id'))).toBeUndefined();
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="spaardoelen"]').click());
  expect(await page.evaluate(()=>[...document.querySelectorAll('#tab-spaardoelen [style]')].some(node=>node.style.backgroundImage.includes('data:image/png;base64,Qg==')))).toBe(true);
  expect(await page.evaluate(()=>[...document.querySelectorAll('#tab-spaardoelen [style]')].some(node=>node.style.backgroundImage.includes('data:image/png;base64,QQ==')))).toBe(false);
  await page.evaluate(async()=>{await commitChange(()=>state.otherHouseholdChoice='only B');await FinizeUpdate4.importStore.putImport({id:'same-import-id',householdMarker:'B',version:1,rows:[]});});
  const other=await rawStores(page,'finize-imports-v1-house-b');
  const original=await rawStores(page,'finize-imports-v1-house-a');
  expect(original.imports[0].householdMarker).toBe('A');expect(other.imports[0].householdMarker).toBe('B');
  expect(original.operationReceipts.some(a=>other.operationReceipts.some(b=>a.id===b.id))).toBe(false);
  await switchUser({uid:'user-a2',email:'a2@example.test',emailVerified:true,household:'house-a'});
  expect(await page.evaluate(()=>DataAdapter.readDurableState())).toEqual(marker.state);
  expect(await page.evaluate(()=>DataAdapter.store().pendingCloud())).toEqual(marker.pending);
  expect(await page.evaluate(()=>FinizeUpdate4.importStore.getImport('same-import-id'))).toMatchObject({householdMarker:'A'});
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="spaardoelen"]').click());
  expect(await page.evaluate(()=>[...document.querySelectorAll('#tab-spaardoelen [style]')].some(node=>node.style.backgroundImage.includes('data:image/png;base64,QQ==')))).toBe(true);
});

test('V117 P2 referenced legacy goal image is copied to household scope without deleting the original',async({page})=>{
  await offline(page);await page.route('**/app.js*',r=>r.abort());await page.goto('/');
  await page.evaluate(async fixture=>{
    const original=structuredClone(fixture);original.spaardoelen.gezamenlijk=[{id:'legacy-image-goal',naam:'Foto behouden',doelbedrag:1000,algespaard:0,afbeelding:'idb:goal-image:legacy-image-goal'}];
    localStorage.setItem('finize-budget-planner-v1:account:image-house:image-user',JSON.stringify(original));
    await new Promise((resolve,reject)=>{const r=indexedDB.open('finize-goal-images-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>{const db=r.result,tx=db.transaction('images','readwrite');tx.objectStore('images').put('data:image/png;base64,T0xE','legacy-image-goal');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  },fixture);
  await page.addInitScript(()=>{const user={uid:'image-user',email:'image@example.test',emailVerified:true};window.__FINIZE_AUTH_ENABLED__=true;window.__FINIZE_AUTH_TEST_DRIVER__={initialize(callback){setTimeout(()=>callback(user),0);},loadAssignment:async()=>({householdId:'image-house',role:'dion'}),setPersistence:async()=>{}};});
  await page.unroute('**/app.js*');await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const result=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('finize-goal-images-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const read=key=>new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly'),q=tx.objectStore('images').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    const [image,original]=await Promise.all([read(JSON.stringify(['image-house','legacy-image-goal'])),read('legacy-image-goal')]);db.close();
    return {image,original,reference:state.spaardoelen.gezamenlijk[0].afbeelding};
  });
  expect(result).toEqual({image:'data:image/png;base64,T0xE',original:'data:image/png;base64,T0xE',reference:'idb:goal-image:legacy-image-goal'});
});

test('V117 P2 source changed during migration cannot activate an outdated IndexedDB copy',async({page})=>{
  await offline(page);await page.addInitScript(input=>{
    localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(record,...args){
      if(this.name==='financialHead'&&!record.verified){const changed=JSON.parse(localStorage.getItem('finize-budget-planner-v1'));changed.oldClientDuringMigration='preserved';localStorage.setItem('finize-budget-planner-v1',JSON.stringify(changed));}
      return put.call(this,record,...args);
    };
  },fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeInitError);
  await expect(page.locator('#finizeStorageError')).toContainText('oudere client');
  const data=await rawStores(page);expect(data.financialHead[0].verified).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('finize-budget-planner-v1')).oldClientDuringMigration)).toBe('preserved');
  expect(await page.evaluate(()=>window.state)).toBeUndefined();
});

test('V117 P2 operation receipts are immutable and replay does not advance the storage revision',async({page})=>{
  await offline(page);await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const result=await page.evaluate(async()=>{
    const store=DataAdapter.store(),snapshot=structuredClone(state);
    const first=await store.commit(snapshot,{operationId:'stable-p2-operation'}),second=await store.commit(snapshot,{operationId:'stable-p2-operation'});
    const reused={...snapshot,unexpectedDuplicate:'blocked'};let rejected='';
    try{await store.commit(reused,{operationId:'stable-p2-operation'});}catch(error){rejected=error.code;}
    return {first,second,rejected,same:JSON.stringify(await store.load())===JSON.stringify(snapshot)};
  });
  expect(result.second).toEqual(result.first);expect(result.rejected).toBe('storage-operation-reused');expect(result.same).toBe(true);
  expect((await rawStores(page)).operationReceipts.filter(row=>row.id==='stable-p2-operation')).toHaveLength(1);
});
