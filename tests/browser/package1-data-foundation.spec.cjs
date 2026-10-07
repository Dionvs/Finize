const fs=require('node:fs');
const path=require('node:path');
const {test,expect}=require('@playwright/test');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
const key='finize-budget-planner-v1';
const migrationKey=key+'-pre-schema-v5';
async function boot(page,state=fixture){
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.addInitScript(({state,key})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
    const set=Storage.prototype.setItem;
    window.__stateWrites=0;
    Storage.prototype.setItem=function(name,value){if(name===key)window.__stateWrites++;return set.call(this,name,value);};
  },{state,key});
  await page.goto('/');
  await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
}
for(const width of [390,1440])test(`Pakket 1: zes schermen, data en stabiele herstart op ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const state=structuredClone(fixture);
  state.transactions=[{id:'retained',date:state.meta.selectedMonth+'-01',owner:'dion',account:'dion',amount:12.345,description:'Bewaarde transactie',category:'Overig',reviewStatus:'bevestigd',bankOriginal:{description:'Origineel',amount:-12.345,bankDate:state.meta.selectedMonth+'-01',rawCells:['original']},importBatchId:'retained-import'}];
  state.importSummaries=[{id:'retained-import',status:'verwerkt',accountOwner:'dion',fileName:'behouden.csv',importDate:'2026-07-01',periodFrom:'2026-07-01',periodTo:'2026-07-01',newCount:1}];
  await boot(page,state);
  const before=await page.evaluate(()=>({writes:window.__stateWrites,revision:window.state.meta.revision}));
  for(const tab of ['dashboard','gezamenlijk','dion','dara','spaardoelen','data']){
    await page.evaluate(tab=>document.querySelector(`#tabs [data-tab="${tab}"]`).click(),tab);
    await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
    await expect(page.locator(`#tab-${tab}`)).not.toBeEmpty();
  }
  const after=await page.evaluate(()=>({writes:window.__stateWrites,revision:window.state.meta.revision,schema:window.state.meta.schemaVersion,tx:window.state.transactions[0],goals:Object.values(window.state.spaardoelen).flat().length,ledger:window.state.savingsGoalLedger.length,imports:window.state.importSummaries.length,fixed:window.state.recurringFixedExpenses.length,budgets:window.state.planning.gezamenlijk.variabel.length}));
  expect(after.writes).toBe(before.writes);expect(after.revision).toBe(before.revision);expect(after.schema).toBe(11);
  expect(after.tx.amount).toBe(12.345);expect(after.tx.bankOriginal).toEqual(state.transactions[0].bankOriginal);
  expect(after.imports).toBe(1);expect(after.fixed).toBeGreaterThan(0);expect(after.budgets).toBeGreaterThan(0);expect(after.goals).toBe(6);expect(after.ledger).toBe(6);
  const backup=await page.evaluate(async()=>JSON.parse((await FinizeMigrationBackups.list())[0].payload));
  expect(backup.package1Original.state).toEqual(state);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>window.state.meta.revision)).toBe(before.revision);expect(errors).toEqual([]);
});
test('lokale laadfout bewaart originele opslag en laadt geen defaults',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,'{"broken":'),key);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeInitError);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{"broken":');
  expect(await page.evaluate(()=>window.__finizeInitError?.message)).toBeTruthy();
  expect(await page.evaluate(()=>window.state)).toBeUndefined();
});
test('migratieback-upfout bewaart v9-opslag zonder default- of cloudwrite',async({page})=>{
  await page.addInitScript(({state,key,migrationKey})=>{
    localStorage.setItem(key,JSON.stringify(state));const set=Storage.prototype.setItem;
    const open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{if(name==='finize-migration-backups')throw new DOMException('Test quota','QuotaExceededError');return open(name,...args);};
  },{state:fixture,key,migrationKey});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeInitError);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).meta.schemaVersion,key)).toBe(9);
  expect(await page.evaluate(()=>window.__finizeInitError?.message)).toContain('Test quota');
});

test('state-opslagfout bij migratie behoudt de originele state en alle back-ups',async({page})=>{
  await page.addInitScript(({state,key})=>{
    localStorage.setItem(key,JSON.stringify(state));localStorage.setItem(key+'-last-good-backup','retained-backup');
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Test state quota','QuotaExceededError');return set.call(this,name,value);};
  },{state:fixture,key});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeInitError);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).toEqual(fixture);
  expect(await page.evaluate(key=>localStorage.getItem(key+'-last-good-backup'),key)).toBe('retained-backup');
  expect(await page.evaluate(async()=>JSON.parse((await FinizeMigrationBackups.list())[0].payload).package1Original.state)).toEqual(fixture);
  expect(await page.evaluate(()=>window.__finizeInitError?.message)).toContain('Test state quota');
});

test('herstel stopt als de back-up van de huidige state niet kan worden gemaakt',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const before=JSON.stringify(window.state),cloud=window.CloudAdapter;let writes=0;
    cloud.db={};cloud.docRef={};cloud.initialSyncComplete=true;cloud.cloudVersion=1;
    cloud.saveNow=async()=>{writes++;return true;};window.DataAdapter.backup=()=>false;
    let error='';try{await cloud.restoreBackup(window.state,'test');}catch(e){error=e.message;}
    return {error,writes,unchanged:JSON.stringify(window.state)===before};
  });
  expect(result.error).toContain('Back-up maken mislukt');expect(result.writes).toBe(0);expect(result.unchanged).toBe(true);
});
test('bankOriginal wordt bij state-commit en ImportStore-write beschermd',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const bankOriginal={description:'Original',amount:-10,rawCells:['original']};
    const tx={id:'source-guard',date:window.state.meta.selectedMonth+'-01',account:'dion',owner:'dion',amount:10,bankOriginal,importBatchId:'guard-import',reviewStatus:'bevestigd'};
    const created=window.commitChange(()=>window.state.transactions.push(tx));
    const edited=window.commitChange(()=>window.state.transactions.find(t=>t.id===tx.id).bankOriginal.description='wrong');
    const store=window.FinizeUpdate4.importStore,record={id:'guard-import',status:'verwerkt',rawText:'original CSV text',rows:[{id:'row',bankOriginal}]};
    await store.putImport(record);const altered=structuredClone(record);altered.rows[0].bankOriginal.amount=-99;
    let rejected=false;try{await store.putImport(altered);}catch(error){rejected=true;}
    const persisted=await store.getImport(record.id);
    return {created,edited,rejected,original:window.state.transactions.find(t=>t.id===tx.id).bankOriginal.description,raw:persisted.rawText,amount:persisted.rows[0].bankOriginal.amount};
  });
  expect(result).toEqual({created:true,edited:false,rejected:true,original:'Original',raw:'original CSV text',amount:-10});
});
// The production client stores chunked generations; count core commits separately from chunk uploads.
async function installMigrationCloudMock(page,entries){
  await page.evaluate(entries=>{
    const docs=new Map(entries),ref={path:'households/isolated-p1/budgetState/current'},metrics={coreWrites:0};
    const snapshot=reference=>({exists:()=>docs.has(reference.path),data:()=>structuredClone(docs.get(reference.path))});
    const firestore={
      doc:(_,path)=>({path}),getDoc:async reference=>snapshot(reference),
      setDoc:async(reference,value)=>docs.set(reference.path,structuredClone(value)),
      updateDoc:async(reference,value)=>docs.set(reference.path,{...docs.get(reference.path),...structuredClone(value)}),
      serverTimestamp:()=> 'isolated-p1-server-time',
      runTransaction:async(_,callback)=>{
        const writes=[];const result=await callback({get:async reference=>snapshot(reference),set:(reference,value)=>writes.push([reference.path,structuredClone(value)])});
        for(const [path,value]of writes){docs.set(path,value);if(path===ref.path)metrics.coreWrites++;}return result;
      }
    };
    Object.assign(CloudAdapter,{db:{},docRef:ref,modules:{firestore},initialSyncComplete:false,cloudVersion:null,pendingState:null,confirmedState:null,conflict:false});
    window.__p1CloudMock={docs,ref,metrics};
  },entries);
}
test('twee devices lezen v11; cloudmigratie schrijft eenmaal en echo schrijft niet opnieuw',async({page,browser})=>{
  await boot(page);
  await installMigrationCloudMock(page,[['households/isolated-p1/budgetState/current',{syncVersion:3,commitId:'old',state:structuredClone(fixture)}]]);
  await page.evaluate(async()=>{const x=__p1CloudMock,data=x.docs.get(x.ref.path);await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);});
  await page.waitForFunction(()=>!CloudAdapter.writeInFlight&&!CloudAdapter.pendingState&&__p1CloudMock.metrics.coreWrites===1);
  const migratedCloud=await page.evaluate(async()=>{
    const x=__p1CloudMock,manifest=x.docs.get(x.ref.path),data=await CloudAdapter.cloudStore().hydrate(manifest),before=JSON.stringify([...x.docs]);
    await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);
    await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);
    const backups=await FinizeMigrationBackups.list();
    return {writes:x.metrics.coreWrites,manifest,data,loadedState:structuredClone(state),forecast:FinizeTransactions.forecast(getSelectedMonth()),effects:FinizeTransactions.effects(),docs:[...x.docs],echoUnchanged:before===JSON.stringify([...x.docs]),original:backups.map(row=>JSON.parse(row.payload)).find(row=>row.package1CloudOriginal)?.package1CloudOriginal.state};
  });
  expect(migratedCloud.writes).toBe(1);expect(migratedCloud.manifest.syncVersion).toBe(4);expect(migratedCloud.data.state.meta.schemaVersion).toBe(11);
  expect(migratedCloud.manifest.stateFormat).toBe('finize-json-chunks-v1');expect(migratedCloud.manifest).not.toHaveProperty('state');
  expect(migratedCloud.echoUnchanged).toBe(true);expect(migratedCloud.original).toEqual(fixture);
  const deviceB=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await deviceB.newPage();await boot(second);await installMigrationCloudMock(second,migratedCloud.docs);
    const result=await second.evaluate(async()=>{
      const x=__p1CloudMock,before=JSON.stringify([...x.docs]),data=await CloudAdapter.cloudStore().hydrate(x.docs.get(x.ref.path));
      await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);
      return {writes:x.metrics.coreWrites,state:structuredClone(state),forecast:FinizeTransactions.forecast(getSelectedMonth()),effects:FinizeTransactions.effects(),cloudUnchanged:before===JSON.stringify([...x.docs]),version:CloudAdapter.cloudVersion};
    });
    expect(result.writes).toBe(0);expect(result.state).toEqual(migratedCloud.loadedState);expect(result.forecast).toEqual(migratedCloud.forecast);expect(result.effects).toEqual(migratedCloud.effects);expect(result.cloudUnchanged).toBe(true);expect(result.version).toBe(4);
  }finally{await deviceB.close();}
});
