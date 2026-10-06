const {test,expect}=require('@playwright/test');
const fixture=require('../fixtures/v50-visual-state.json');
test.setTimeout(60000);
async function boot(page){
 await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());
 await page.route('https://firestore.googleapis.com/**',r=>r.abort());
 await page.addInitScript(input=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
}
async function cloudFixture(page,{delay=true,orphan=true,initialDocs=null}={}){
 await page.evaluate(async({delay,orphan,initialDocs})=>{
  const cloud=CloudAdapter,u=FinizeUpdate4Runtime,copy=structuredClone,docs=new Map(initialDocs||[]),ref={path:'households/isolated/budgetState/current'};
  const metrics={coreWrites:0,adoptions:0,acceptedCallbacks:0,backups:0,events:[]},echoes=[];
  const snap=(reference,value=docs.get(reference.path))=>({exists:()=>value!==undefined,data:()=>copy(value),metadata:{hasPendingWrites:false}});
  let listener;
  const f={doc:(_,path)=>({path}),getDoc:async r=>snap(r),setDoc:async(r,data)=>docs.set(r.path,copy(data)),updateDoc:async(r,data)=>docs.set(r.path,{...docs.get(r.path),...copy(data)}),serverTimestamp:()=> 'isolated-time',
   onSnapshot:(_,callback)=>{listener=callback;return()=>listener=null;},
   runTransaction:async(_,work)=>{const writes=[];const result=await work({get:async r=>snap(r),set:(r,data)=>writes.push([r.path,copy(data)])});for(const[path,data]of writes){docs.set(path,data);if(path===ref.path){metrics.coreWrites++;metrics.events.push('current:'+data.syncVersion);if(listener){const echo={data:copy(data)};echoes.push(echo);echo.promise=listener(snap(ref,data));}}}return result;}
  };
  Object.assign(cloud,{modules:{firestore:f},db:{},docRef:ref,initialSyncComplete:true,cloudVersion:1,lastCloudSignature:[state.meta.revision||0,state.meta.updatedAt||'',state.meta.updatedBy||''].join('|'),pendingState:null,confirmedState:null,conflict:false});
  if(!initialDocs){docs.set(ref.path,{state:copy(state),syncVersion:1,commitId:'isolated-inline'});await cloud.saveNow(copy(state));} // Complete chunked current before testing.
  else{cloud.initialSyncComplete=false;cloud.cloudVersion=null;cloud.lastCloudSignature='';}
  const initial=await cloud.cloudStore().hydrate(docs.get(ref.path));await cloud.acceptRemote(initial,migrateBudgetState(initial.state),null);
  metrics.coreWrites=0;
  const store=cloud.cloudStore(),originalHydrate=store.hydrate.bind(store);
  const controlledStore={...store,hydrate:async data=>{const echo=echoes.find(e=>e.data.commitId===data.commitId);if(echo&&delay){metrics.events.push('hydrate-start:'+data.syncVersion);await new Promise(resolve=>echo.release=resolve);metrics.events.push('hydrate-release:'+data.syncVersion);}return originalHydrate(data);}};cloud.cloudStore=()=>controlledStore;
  const accept=cloud.acceptRemote.bind(cloud);cloud.acceptRemote=async(...args)=>{metrics.adoptions++;metrics.events.push('remote-adopt');return accept(...args);};
  const accepted=window.FinizeImportSync.onCloudAccepted;window.FinizeImportSync.onCloudAccepted=async()=>{metrics.acceptedCallbacks++;metrics.events.push('onCloudAccepted');return accepted();};
  const backup=DataAdapter.backup.bind(DataAdapter);DataAdapter.backup=async(...args)=>{metrics.backups++;return backup(...args);};
  if(orphan)await u.ImportStore.putSync({id:'orphan',importId:'orphan',version:1,baseVersion:0,operationId:'orphan-op'});
  cloud.attachSnapshot();
  window.__sync3={cloud,u,docs,ref,metrics,echoes,originalHydrate,initial:copy(state),emit:async data=>{const echo={data:copy(data)};echoes.push(echo);echo.promise=listener(snap(ref,data));return echo;},current:()=>docs.get(ref.path)};
 },{delay,orphan,initialDocs});
}
test('S6/S8 integrated delayed own echo plus unpublishable queue never repeats identical commits',async({page})=>{
 await boot(page);await cloudFixture(page);
 page.on('console',message=>{if(message.type()==='error')console.log('FIXTURE_ERROR '+message.text());});
 const saved=await page.evaluate(async()=>{state.unknownSyncChoice='explicit-isolated-choice';state.meta.revision++;const x=__sync3;const ok=await x.cloud.saveNow(structuredClone(state));x.metrics.events.push('save-finished-active:'+x.cloud.activeCommitId);return {ok,status:x.cloud.status,events:x.metrics.events,echoes:x.echoes.length};});console.log('SYNC3_SAVE '+JSON.stringify(saved));expect(saved.ok).toBe(true);
 await page.waitForFunction(()=>__sync3.echoes[0]?.release);
 // Release after saveNow finally cleared activeCommitId. Repeat only if the old bug generated another echo.
 for(let cycle=0;cycle<3;cycle++){
  const released=await page.evaluate(async index=>{const x=__sync3,e=x.echoes[index];if(!e?.release)return false;e.release();await e.promise;return true;},cycle);
  if(!released)break;
  await page.waitForTimeout(150);
 }
 const result=await page.evaluate(async()=>{const x=__sync3;clearTimeout(x.cloud.saveTimer);return {...x.metrics,queue:await x.u.ImportStore.listSync(),activeCommitId:x.cloud.activeCommitId,current:x.current(),hashes:[...new Set(x.echoes.map(e=>e.data.totalSha256))]};});
 console.log('SYNC3_INTEGRATED '+JSON.stringify(result));
 expect(result.coreWrites).toBe(1);expect(result.adoptions).toBe(0);expect(result.acceptedCallbacks).toBe(0);expect(result.backups).toBe(0);expect(result.queue).toHaveLength(1);expect(result.hashes).toHaveLength(1);
});
module.exports={boot,cloudFixture};

for(const format of ['inline','chunked'])test('S5 own '+format+' echo without delay is side-effect free',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false});
 const result=await page.evaluate(async format=>{const x=__sync3;let current=structuredClone(x.current());if(format==='inline'){const hydrated=await x.originalHydrate(current);current={state:hydrated.state,syncVersion:current.syncVersion,commitId:current.commitId};}const echo=await x.emit(current);await echo.promise;await x.u.flushImportSync(window);return {metrics:x.metrics,queue:(await x.u.ImportStore.listSync()).length};},format);
 expect(result.metrics.coreWrites).toBe(0);expect(result.metrics.adoptions).toBe(0);expect(result.metrics.acceptedCallbacks).toBe(0);expect(result.queue).toBe(1);
});
test('S7 a later other-device chunked commit is adopted normally',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false});
 const result=await page.evaluate(async()=>{const x=__sync3,next=structuredClone(state);next.unknownOtherDevice='retained';next.meta.revision++;next.meta.updatedBy='other-device';const id='other-device-generation',descriptor=await x.cloud.cloudStore().prepare(next,id),current={...descriptor,activeGeneration:id,commitId:id,syncVersion:x.current().syncVersion+1,revision:next.meta.revision};delete current.complete;delete current.generation;x.docs.set(x.ref.path,current);const echo=await x.emit(current);await echo.promise;await x.u.flushImportSync(window);return {metrics:x.metrics,value:state.unknownOtherDevice,version:x.cloud.cloudVersion,expected:current.syncVersion,diagnostics:FinizeImportSync.pendingDiagnostics};});
 expect(result.value).toBe('retained');expect(result.version).toBe(result.expected);expect(result.metrics.adoptions).toBe(1);expect(result.metrics.acceptedCallbacks).toBe(1);expect(result.metrics.coreWrites).toBe(0);expect(result.diagnostics).toEqual([{importId:'orphan',code:'import-details-missing'}]);
});
test('S9/S14 repeated echo/flush/no-op preserves versions, generations, originals and financial output',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false});
 const result=await page.evaluate(async()=>{const x=__sync3,before=structuredClone(x.current()),docsBefore=JSON.stringify([...x.docs]),financial=JSON.stringify(FinizeTransactions.forecast('2026-07')),queue=JSON.stringify(await x.u.ImportStore.listSync());
  for(let i=0;i<4;i++){const echo=await x.emit(x.current());await echo.promise;await x.u.flushImportSync(window);await x.cloud.saveNow(structuredClone(state));}
  return {before,after:x.current(),sameDocuments:docsBefore===JSON.stringify([...x.docs]),sameQueue:queue===JSON.stringify(await x.u.ImportStore.listSync()),sameFinancial:financial===JSON.stringify(FinizeTransactions.forecast('2026-07')),metrics:x.metrics};});
 expect(result.after).toEqual(result.before);expect(result.sameDocuments).toBe(true);expect(result.sameQueue).toBe(true);expect(result.sameFinancial).toBe(true);expect(result.metrics.coreWrites).toBe(0);expect(result.metrics.backups).toBe(0);
});
test('S10 real local core change creates exactly one new generation',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false,orphan:false});
 const result=await page.evaluate(async()=>{const x=__sync3,before=structuredClone(x.current()),input=structuredClone(state);input.unknownUserChoice='new value';input.meta.revision++;const financial=JSON.stringify(FinizeTransactions.forecast('2026-07'));const ok=await x.cloud.saveNow(input);await Promise.all(x.echoes.map(e=>e.promise));const hydrated=await x.originalHydrate(x.current());return {ok,before,after:x.current(),metrics:x.metrics,value:hydrated.state.unknownUserChoice,sameFinancial:financial===JSON.stringify(FinizeTransactions.forecast('2026-07'))};});
 expect(result.ok).toBe(true);expect(result.metrics.coreWrites).toBe(1);expect(result.after.activeGeneration).not.toBe(result.before.activeGeneration);expect(result.after.syncVersion).toBe(result.before.syncVersion+1);expect(result.value).toBe('new value');expect(result.sameFinancial).toBe(true);
});
test('S11 actual competing device still rejects stale CAS and preserves local rebase',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false,orphan:false});
 const result=await page.evaluate(async()=>{const x=__sync3,next=structuredClone(state);next.unknownOtherDevice='remote value';next.meta.revision++;const id='competing-generation',descriptor=await x.cloud.cloudStore().prepare(next,id),remote={...descriptor,activeGeneration:id,commitId:id,syncVersion:x.current().syncVersion+1,revision:next.meta.revision};delete remote.complete;delete remote.generation;x.docs.set(x.ref.path,remote);const local=structuredClone(state);local.unknownLocalChoice='local value';local.meta.revision++;const ok=await x.cloud.saveNow(local);return {ok,unchanged:JSON.stringify(x.current())===JSON.stringify(remote),coreWrites:x.metrics.coreWrites,local:x.cloud.pendingState?.unknownLocalChoice,other:x.cloud.pendingState?.unknownOtherDevice};});
 expect(result.ok).toBe(false);expect(result.unchanged).toBe(true);expect(result.coreWrites).toBe(0);expect(result.local).toBe('local value');expect(result.other).toBe('remote value');
});
test('S12 reload accepts existing chunked v11 without a new cloud generation',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false});const saved=await page.evaluate(()=>({docs:[...__sync3.docs],current:__sync3.current(),financial:FinizeTransactions.forecast('2026-07')}));
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await cloudFixture(page,{delay:false,orphan:false,initialDocs:saved.docs});
 const result=await page.evaluate(async()=>{const x=__sync3;await x.u.flushImportSync(window);const echo=await x.emit(x.current());await echo.promise;await x.cloud.saveNow(structuredClone(state));return {current:x.current(),metrics:x.metrics,financial:FinizeTransactions.forecast('2026-07'),queue:await x.u.ImportStore.listSync()};});
 expect(result.current).toEqual(saved.current);expect(result.metrics.coreWrites).toBe(0);expect(result.financial).toEqual(saved.financial);expect(result.queue).toHaveLength(1);
});
test('S9/S13 already atomically published import receipt retries without another core generation',async({page})=>{
 await boot(page);await cloudFixture(page,{delay:false,orphan:false});
 const result=await page.evaluate(async()=>{const x=__sync3,u=x.u,cloud=x.cloud;cloud.importRef=id=>({path:'imports/'+id});cloud.importChunkRef=(id,chunk)=>({path:'imports/'+id+'/chunks/'+chunk});
  const record={id:'confirmed-import',version:1,baseVersion:0,operationId:'confirmed-operation',lifecycle:'active',status:'concept',rows:[],summary:{}};u.updateDraftSummary(record);state.importSummaries.push(u.compactSummary(record));await u.ImportStore.putImport(record);await u.queueImportSync(record);await cloud.saveNow(structuredClone(state));await Promise.all(x.echoes.map(e=>e.promise));
  const current=structuredClone(x.current()),writes=x.metrics.coreWrites;await u.queueImportSync(await u.ImportStore.getImport(record.id));await u.flushImportSync(window);
  return {current,after:x.current(),writes,afterWrites:x.metrics.coreWrites,queue:await u.ImportStore.listSync(),retained:!!await u.ImportStore.getImport(record.id)};
 });expect(result.after).toEqual(result.current);expect(result.afterWrites).toBe(result.writes);expect(result.queue).toEqual([]);expect(result.retained).toBe(true);
});
