const {test,expect}=require('@playwright/test');
const fixture=require('../fixtures/v50-visual-state.json');
const migrationRuntime=require('../helpers/migration-runtime.cjs');
const key='finize-budget-planner-v1',legacyKey=key+'-pre-schema-v5';
const large=()=>({...structuredClone(fixture),unknownHotfixPayload:'x'.repeat(2200000)});
async function boot(page,input=fixture){await page.addInitScript(({key,input})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(input));},{key,input});await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);}
async function failure(page,input=fixture){await page.addInitScript(({key,input})=>localStorage.setItem(key,JSON.stringify(input)),{key,input});await page.goto('/');await page.waitForFunction(()=>window.__finizeInitError);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).toEqual(input);expect(await page.evaluate(()=>window.__finizeBootstrap.rendered)).toBe(false);}

test('H1 large v9 cloud state succeeds beyond old localStorage backup capacity',async({page})=>{
 await boot(page);const raw=large();
 const result=await page.evaluate(async raw=>{
 const cloud=CloudAdapter;let writes=0;cloud.queueSave=()=>{writes++;};
 await cloud.acceptRemote({state:raw,syncVersion:799},migrateBudgetState(raw),null);
 const rows=await FinizeMigrationBackups.list(),r=rows.find(r=>r.source==='cloud');
 return {schema:state.meta.schemaVersion,writes,originalEqual:JSON.stringify(JSON.parse(r.payload).package2CloudOriginal.state)===JSON.stringify(raw),bytes:r.byteLength,unknown:state.unknownHotfixPayload.length};
 },raw);
 expect(result.schema).toBe(11);expect(result.writes).toBe(1);expect(result.originalEqual).toBe(true);expect(result.bytes).toBeGreaterThan(6000000);expect(result.unknown).toBe(2200000);console.log('H1 '+JSON.stringify(result));
});
test('H2 complete original and v10 intermediate read back with verified SHA-256',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{const [r]=await FinizeMigrationBackups.list();const again=await FinizeMigrationBackups.get(r.id);return {record:r,again};});
 expect(r.again).toEqual(r.record);expect(JSON.parse(r.record.payload).package2Original.state).toEqual(fixture);expect(JSON.parse(r.record.payload).package2Original.v10State.meta.schemaVersion).toBe(10);expect(r.record.sha256).toMatch(/^[a-f0-9]{64}$/);
});
test('H3 IndexedDB failure blocks local and cloud source replacement',async({page})=>{
 await boot(page);const result=await page.evaluate(async raw=>{const before=JSON.stringify(state);const open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{if(name==='finize-migration-backups')throw new DOMException('Test backup failure','QuotaExceededError');return open(name,...args);};
 // Abort writes on the already-open backup connection, too.
 const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(this.name==='finize-migration-backups'&&mode==='readwrite')throw new DOMException('Test backup failure','QuotaExceededError');return original.call(this,stores,mode,...rest);};let writes=0;CloudAdapter.queueSave=()=>{writes++;};let error='';try{await CloudAdapter.acceptRemote({state:raw,syncVersion:799},migrateBudgetState(raw),null);}catch(e){error=e.message;}return {error,writes,same:JSON.stringify(state)===before,source:raw.meta.schemaVersion};},{...fixture,newUnknown:'force-new-record'});
 expect(result.error).toContain('Test backup failure');expect(result.writes).toBe(0);expect(result.same).toBe(true);expect(result.source).toBe(9);
});
test('H4 corrupt readback blocks migration and retains raw storage',async({page})=>{
 await boot(page);await page.evaluate(async()=>{const [r]=await FinizeMigrationBackups.list();await new Promise((resolve,reject)=>{const request=indexedDB.open('finize-migration-backups',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('originals','readwrite');tx.objectStore('originals').put({...r,payload:r.payload+' '});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});localStorage.setItem('finize-budget-planner-v1',JSON.stringify(JSON.parse(r.payload).package2Original.state));});
 await page.reload();await page.waitForFunction(()=>window.__finizeInitError);expect(await page.evaluate(()=>window.__finizeInitError.message)).toContain('niet volledig');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).toEqual(fixture);
});
test('H5 successful backup gates local migration to schema 11',async({page})=>{await boot(page);expect(await page.evaluate(()=>state.meta.schemaVersion)).toBe(11);expect(await page.evaluate(async()=>{const [r]=await FinizeMigrationBackups.list();return r.sourceSchema;})).toBe(9);});
test('H6 migrated financial/persistent output exactly equals unchanged approved migration',async({page})=>{
 const runtime=migrationRuntime(),expected=JSON.parse(JSON.stringify(runtime.migrateBudgetState(fixture)));await boot(page);expect(await page.evaluate(async()=>DataAdapter.load())).toEqual(expected);expect(await page.evaluate(raw=>migrateBudgetState(raw),fixture)).toEqual(expected);
});
test('H7 historical localStorage envelope remains readable',async({page})=>{const old={savedAt:'old',state:{unknown:'retained'},package1Original:{state:fixture}};await page.addInitScript(({key,old})=>localStorage.setItem(key,JSON.stringify(old)),{key:legacyKey,old});await boot(page);expect(await page.evaluate(()=>FinizeMigrationBackups.legacy())).toEqual(old);});
test('H8 historical backups are never overwritten or deleted',async({page})=>{const original='{"savedAt":"before","custom":{"keep":true}}';await page.addInitScript(({key,original})=>localStorage.setItem(key,original),{key:legacyKey,original});await boot(page);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(key=>localStorage.getItem(key),legacyKey)).toBe(original);});
test('H9 reload preserves migrated state and backup',async({page})=>{await boot(page);const before=await page.evaluate(async()=>({state:state,records:await FinizeMigrationBackups.list()}));await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(async()=>({state:state,records:await FinizeMigrationBackups.list()}))).toEqual(before);});
test('H10 repeated load/capture has stable identity and no double migration write',async({page})=>{await boot(page);const r=await page.evaluate(async()=>{const before=await FinizeMigrationBackups.list();await DataAdapter.load();await DataAdapter.load();const after=await FinizeMigrationBackups.list();return {before,after};});expect(r.after).toEqual(r.before);});
test('H11 backup context isolation rejects another household/user',async({page})=>{await page.route('**/src/storage/migration-backups.mjs',route=>route.fulfill({contentType:'text/javascript',body:require('node:fs').readFileSync(require('node:path').join(__dirname,'../../src/storage/migration-backups.mjs'),'utf8')}));await boot(page);const result=await page.evaluate(async()=>{const {createMigrationBackupStore}=await import('/src/storage/migration-backups.mjs');const store=createMigrationBackupStore();const [r]=await FinizeMigrationBackups.list();let error='';try{await store.get('other-household:user',r.id);}catch(e){error=e.message;}return {error,other:await store.list('other-household:user')};});expect(result.error).toContain('niet volledig');expect(result.other).toEqual([]);});
test('H12 isolated fixture/mock execution makes no production requests',async({page})=>{const requests=[];page.on('request',r=>{if(/firestore\.googleapis\.com/.test(r.url()))requests.push(r.url());});await boot(page);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(requests).toEqual([]);});

test('async backup cannot allow an older cloud listener to replace a newer snapshot',async({page})=>{
 await boot(page);const result=await page.evaluate(async raw=>{
 const cloud=CloudAdapter;cloud.queueSave=()=>{};
 const old=cloud.acceptRemote({state:raw,syncVersion:799},migrateBudgetState(raw),null);
 const newer=migrateBudgetState(raw);newer.unknownListenerProof='newer';newer.meta.revision=5000;
 await cloud.acceptRemote({state:newer,syncVersion:800},newer,null);
 const accepted=await old;return {accepted,version:cloud.cloudVersion,proof:state.unknownListenerProof};
 },large());expect(result).toEqual({accepted:false,version:800,proof:'newer'});
});
