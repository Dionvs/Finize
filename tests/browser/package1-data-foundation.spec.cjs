const fs=require('node:fs');
const path=require('node:path');
const {test,expect}=require('@playwright/test');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
const key='finize-budget-planner-v1';
const migrationKey=key+'-pre-schema-v5';
async function boot(page,state=fixture){
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
test('twee devices lezen v11; cloudmigratie schrijft eenmaal en echo schrijft niet opnieuw',async({page,context})=>{
  await boot(page);
  const migratedCloud=await page.evaluate(async raw=>{
    const copy=value=>JSON.parse(JSON.stringify(value));
    let documentData={syncVersion:3,commitId:'old',state:copy(raw)},writes=0;
    const cloud=window.CloudAdapter;cloud.db={};cloud.docRef={};
    cloud.modules={firestore:{serverTimestamp:()=>0,runTransaction:async(_,callback)=>callback({get:async()=>({exists:()=>true,data:()=>documentData}),set:(_,payload)=>{writes++;documentData=copy(payload);}})}};
    await cloud.acceptRemote(documentData,window.migrateBudgetState(raw),null);
    while(cloud.writeInFlight||cloud.pendingState)await new Promise(resolve=>setTimeout(resolve,10));
    await cloud.acceptRemote(documentData,window.migrateBudgetState(documentData.state),null);
    await cloud.acceptRemote(documentData,window.migrateBudgetState(documentData.state),null);
    return {writes,documentData};
  },fixture);
  expect(migratedCloud.writes).toBe(1);expect(migratedCloud.documentData.syncVersion).toBe(4);expect(migratedCloud.documentData.state.meta.schemaVersion).toBe(11);
  const second=await context.newPage();await second.goto('/');await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const secondWrites=await second.evaluate(async documentData=>{
    const cloud=window.CloudAdapter;let writes=0;cloud.db={};cloud.docRef={};cloud.modules={firestore:{runTransaction:async()=>{writes++;throw new Error('Unexpected migration write');}}};
    await cloud.acceptRemote(documentData,window.migrateBudgetState(documentData.state),null);return writes;
  },migratedCloud.documentData);
  expect(secondWrites).toBe(0);
});
