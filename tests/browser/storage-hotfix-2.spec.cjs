const {test,expect}=require('@playwright/test');
const fixture=require('../fixtures/v50-visual-state.json');
const key='finize-budget-planner-v1';
async function boot(page){await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key,fixture});await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);}
test('T1/T2 large ordinary backup stored and SHA verified in real IndexedDB',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const snapshot={...state,unknownStoragePayload:'x'.repeat(6000000)},before=await FinizeMigrationBackups.list();const ok=await DataAdapter.backup(snapshot,'isolated-large');const read=await DataAdapter.loadBackup(),after=await FinizeMigrationBackups.list();return {ok,equal:JSON.stringify(read.state)===JSON.stringify(snapshot),bytes:new TextEncoder().encode(JSON.stringify(read)).length,migrationUntouched:JSON.stringify(before)===JSON.stringify(after),localBackup:localStorage.getItem('finize-budget-planner-v1-last-good-backup')};});
 expect(result.ok).toBe(true);expect(result.equal).toBe(true);expect(result.bytes).toBeGreaterThan(6000000);expect(result.migrationUntouched).toBe(true);expect(result.localBackup).toBeNull();
});
test('T3 backup write failure blocks cloud adoption and restore before mutation',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const before=JSON.stringify(state),original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(this.name==='finize-state-backups'&&mode==='readwrite')throw new DOMException('isolated quota','QuotaExceededError');return original.call(this,stores,mode,...rest);};let error='';try{await CloudAdapter.acceptRemote({state,syncVersion:1},structuredClone(state));}catch(e){error=e.message;}return {error,same:JSON.stringify(state)===before,backup:await DataAdapter.backup(state,'isolated failure'),version:CloudAdapter.cloudVersion};});
 expect(result.error).toContain('Noodback-up');expect(result.same).toBe(true);expect(result.backup).toBe(false);expect(result.version).toBeNull();
});
test('T4 old localStorage ordinary backup readable and never deleted',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const old={savedAt:'2020-01-01T00:00:00Z',label:'legacy',state:{unknown:'kept'}},backupKey='finize-budget-planner-v1-last-good-backup';localStorage.setItem(backupKey,JSON.stringify(old));const read=await DataAdapter.loadBackup();await DataAdapter.backup(state,'new');return {read,retained:localStorage.getItem(backupKey),old};});expect(result.read).toEqual(result.old);expect(JSON.parse(result.retained)).toEqual(result.old);
});
test('T2 corrupt ordinary backup readback refused',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{await DataAdapter.backup(state,'corruption-test');await new Promise((resolve,reject)=>{const r=indexedDB.open('finize-state-backups',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),q=store.getAll();q.onsuccess=()=>store.put({...q.result[0],payload:q.result[0].payload+' '});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});try{await DataAdapter.loadBackup();return 'incorrectly accepted';}catch(e){return e.message;}});expect(result).toContain('integriteit');
});
test('cloud adapter commits chunk manifest atomically with existing import hook and reload',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
 const cloud=CloudAdapter,docs=new Map(),current={path:'households/isolated/budgetState/current'},input={...structuredClone(state),unknownStoragePayload:'â‚¬ðŸ™‚'.repeat(350000)};
 const before={state:structuredClone(input),syncVersion:799,commitId:'old'};docs.set(current.path,before);
 const snap=ref=>({exists:()=>docs.has(ref.path),data:()=>structuredClone(docs.get(ref.path))});let importsValidated=0,importsPublished=0;
 const f={doc:(_,path)=>({path}),getDoc:async ref=>snap(ref),setDoc:async(ref,data)=>docs.set(ref.path,structuredClone(data)),updateDoc:async(ref,data)=>docs.set(ref.path,{...docs.get(ref.path),...data}),serverTimestamp:()=> 'isolated-server-time',runTransaction:async(_,work)=>{const writes=[];const value=await work({get:async ref=>snap(ref),set:(ref,data)=>writes.push([ref.path,structuredClone(data)])});for(const [path,data]of writes)docs.set(path,data);return value;}};
 cloud.modules={firestore:f};cloud.db={};cloud.docRef=current;cloud.initialSyncComplete=true;cloud.cloudVersion=799;cloud.lastCloudSignature=[input.meta.revision||0,input.meta.updatedAt||'',input.meta.updatedBy||''].join('|');window.FinizeImportSync.prepareCloudSnapshot=async()=>({readAndValidate:async()=>{importsValidated++;},publish:()=>{importsPublished++;},acknowledge:async()=>{}});
 const ok=await cloud.saveNow(input),manifest=docs.get(current.path),read=await cloud.cloudStore().hydrate(manifest);return {ok,format:manifest.stateFormat,chunks:manifest.chunkCount,version:manifest.syncVersion,hasInline:'state'in manifest,equal:JSON.stringify(read.state)===JSON.stringify(input),importsValidated,importsPublished};
 });expect(result.ok).toBe(true);expect(result.format).toBe('finize-json-chunks-v1');expect(result.chunks).toBeGreaterThan(1);expect(result.version).toBe(800);expect(result.hasInline).toBe(false);expect(result.equal).toBe(true);expect(result.importsValidated).toBe(1);expect(result.importsPublished).toBe(1);
});
test('async ordinary backup does not allow late older cloud adoption',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const old=structuredClone(state),newer=structuredClone(state);old.meta.revision=10;newer.meta.revision=11;const original=DataAdapter.backup;let release;DataAdapter.backup=async(_,reason)=>reason==='old'?await new Promise(r=>{release=r;}):true;const pending=CloudAdapter.acceptRemote({state:old,syncVersion:10},old,'old');await new Promise(r=>setTimeout(r,10));await CloudAdapter.acceptRemote({state:newer,syncVersion:11},newer,'new');release(true);const accepted=await pending;DataAdapter.backup=original;return {accepted,version:CloudAdapter.cloudVersion,revision:state.meta.revision};});expect(result).toEqual({accepted:false,version:11,revision:11});
});
test('ordinary backup presentation and restore entry remain reachable at 390/1440px',async({page})=>{
 await boot(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.evaluate(()=>DataAdapter.backup(state,'presentation-test'));
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.locator(width===390?'.mobile-status-pill':'#saveStatus').click();await expect(page.locator('#btnRestoreBackup')).toBeVisible();await expect(page.locator(width===390?'#tab-data.mobile-data-page':'#tab-data .u5-data-local')).toHaveCount(1);await expect(page.locator('#tab-data')).toContainText('Vandaag');}
 expect(errors).toEqual([]);
});

test('in-flight backup cannot adopt old household after sign-out',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const before=JSON.stringify(state),remote=structuredClone(state);remote.unknownDetached='must-not-adopt';CloudAdapter.docRef={path:'households/isolated/budgetState/current'};let release;DataAdapter.backup=async()=>await new Promise(r=>{release=r;});const pending=CloudAdapter.acceptRemote({state:remote,syncVersion:1},remote);await new Promise(r=>setTimeout(r,10));await CloudAdapter.signOut();release(true);return {accepted:await pending,same:JSON.stringify(state)===before};});expect(result).toEqual({accepted:false,same:true});
});
test('restore rejects a newer local choice made during async backup',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const restored=structuredClone(state),cloud=CloudAdapter;cloud.db={};cloud.docRef={path:'isolated'};cloud.initialSyncComplete=true;cloud.cloudVersion=1;cloud.pendingState=null;let release,writes=0;DataAdapter.backup=async()=>await new Promise(r=>{release=r;});cloud.saveNow=async()=>{writes++;return true;};const pending=cloud.restoreBackup(restored,'isolated restore');await new Promise(r=>setTimeout(r,10));state.unknownNewerLocalChoice='preserved';release(true);let error='';try{await pending;}catch(e){error=e.message;}return {error,writes,preserved:state.unknownNewerLocalChoice};});expect(result.error).toContain('stand veranderde');expect(result.writes).toBe(0);expect(result.preserved).toBe('preserved');
});
