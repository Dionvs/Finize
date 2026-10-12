const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
test.setTimeout(240000);
test.use({actionTimeout:15000});

test('P4 storage inventory includes protected backup databases and scopes every byte',async({page})=>{
  const moduleSource=require('esbuild').buildSync({stdin:{contents:'export {createMigrationBackupStore} from "./src/storage/migration-backups.mjs";export {createStateBackupStore} from "./src/storage/state-backups.mjs";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false}).outputFiles[0].text;
  await page.route('**/p4-backup-test.mjs',route=>route.fulfill({contentType:'text/javascript',body:moduleSource}));
  const f=await newHousehold();await boot(page,f);
  expect(await page.evaluate(async()=>{
    const {createMigrationBackupStore,createStateBackupStore}=await import('/p4-backup-test.mjs');
    const migration=createMigrationBackupStore(),backup=createStateBackupStore(),scope=DataAdapter.store().scope;
    const old=structuredClone(state);old.meta.schemaVersion=10;
    const save=async household=>{
      const suffix=':account:'+household+':browser-p4';
      await migration.persist('finize-budget-planner-v1-pre-schema-v5'+suffix,{package2Original:{fromVersion:10,state:old}},{sourceSchema:10,household});
      await backup.persist('finize-budget-planner-v1-last-good-backup'+suffix,{state:structuredClone(state)},{household});
      localStorage.setItem('finize-budget-planner-v1-pre-schema-v5'+suffix,JSON.stringify({protected:true}));
    };
    await save(scope);const before=await DataAdapter.store().cache.usage();await save(scope+'-other');const after=await DataAdapter.store().cache.usage();
    return before.externalStorage.migrationBackups>0&&before.externalStorage.emergencyBackups>0&&before.externalStorage.localStorage.migrationBackups>0&&before.totalBytes===after.totalBytes&&after.categoryBytes===after.totalBytes;
  })).toBe(true);
});

test('P4 blocked database upgrade preserves the old records and can be retried',async({page})=>{
  const moduleSource=require('esbuild').buildSync({entryPoints:[require.resolve('../../src/storage/household-store.mjs')],bundle:true,format:'esm',platform:'browser',write:false}).outputFiles[0].text;
  await page.route('**/p4-storage-test.mjs',route=>route.fulfill({contentType:'text/javascript',body:moduleSource}));
  const f=await newHousehold();await boot(page,f);
  expect(await page.evaluate(async()=>{
    const scope='p4-upgrade-'+crypto.randomUUID(),name='finize-imports-v1-'+scope;
    const old=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,2);r.onupgradeneeded=()=>r.result.createObjectStore('imports',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=old.transaction('imports','readwrite');tx.objectStore('imports').put({id:'protected',originalCsv:'immutable bank source'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const {openHouseholdDatabase}=await import('/p4-storage-test.mjs');
    let code;try{await openHouseholdDatabase(scope);}catch(e){code=e.code;}finally{old.close();}
    await new Promise(resolve=>setTimeout(resolve,50));
    const db=await openHouseholdDatabase(scope),saved=await new Promise(resolve=>{const r=db.transaction('imports').objectStore('imports').get('protected');r.onsuccess=()=>resolve(r.result);});
    const result={code,version:db.version,saved};db.close();return result;
  })).toEqual({code:'storage-blocked',version:4,saved:{id:'protected',originalCsv:'immutable bank source'}});
});

test('P4 cache eviction, offline pin, corruption and reload preserve canonical financial totals',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  for(const month of ['2024-01','2024-02','2026-07','2026-08','2026-09','2026-10']){const r=row(month,'uitgave',-12.34);r.bankOriginal.bankDate=month+'-03';r.processing.processingDate=month+'-03';materialize(s,[r],month);}
  await boot(page,f,s);console.log('P4_CACHE_STEP boot');await attach(page,f,{initialize:true});console.log('P4_CACHE_STEP attach');
  const baseline=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());
  for(const month of ['2024-01','2024-02']){expect((await page.evaluate(month=>p4.openMonth(month),month)).outcome).toBe('committed');console.log('P4_CACHE_STEP '+month);}
  await page.locator('#saveStatus').click();await page.locator('#offlinePeriodMonth').fill('2024-01');
  // The button loads and commits the historical period before pinning it.
  // Wait for that durable action, rather than treating five seconds of UI text
  // polling as evidence that its asynchronous storage operation has failed.
  await page.evaluate(()=>{const cache=DataAdapter.store().cache,pin=cache.pin;window.p4PinCompleted=false;cache.pin=async(...args)=>{try{return await pin(...args);}finally{window.p4PinCompleted=true;}};});
  await page.locator('#btnPinOfflinePeriod').click();await page.waitForFunction(()=>window.p4PinCompleted);
  await expect(page.locator('#offlinePeriodList')).toContainText('2024-01');
  await page.locator('#btnUnpinOfflinePeriod').click();await expect(page.locator('#offlinePeriodList')).toContainText('geen extra maanden');
  await page.evaluate(()=>window.p4PinCompleted=false);
  await page.locator('#btnPinOfflinePeriod').click();await page.waitForFunction(()=>window.p4PinCompleted);
  await expect(page.locator('#offlinePeriodList')).toContainText('2024-01');
  await expect(page.locator('#periodCacheUsage')).toContainText('64 MiB');await page.locator('#btnTrimPeriodCache').click();
  await page.getByRole('heading',{name:'Offline opslag',exact:true}).locator('../..').screenshot({path:'backups/v117-stabilisatie/p4-offline-storage-ui.png'});
  await page.evaluate(()=>p4.openMonth('2026-10'));
  const before=await page.evaluate(()=>DataAdapter.store().cache.usage());expect(before.periods.some(row=>row.id==='2024-01'&&row.pinned)).toBe(true);
  // Abort after the first deletion request: IndexedDB must restore every cache
  // copy and the canonical financial head, even when cleanup was interrupted.
  const interrupted=await page.evaluate(async()=>{
    const original=IDBObjectStore.prototype.delete,head=await DataAdapter.readDurableState();let attempted=false,code;
    IDBObjectStore.prototype.delete=function(...args){const result=original.apply(this,args);if(this.name==='periodCache'){attempted=true;this.transaction.abort();}return result;};
    try{await DataAdapter.store().cache.evict({selectedMonth:'2026-10',targetBytes:0});}catch(error){code=error.code||error.name;}finally{IDBObjectStore.prototype.delete=original;}
    return {attempted,code,unchanged:JSON.stringify(await DataAdapter.readDurableState())===JSON.stringify(head),periods:(await DataAdapter.store().cache.usage()).periods};
  });expect(interrupted.attempted).toBe(true);expect(interrupted.code).toBeTruthy();expect(interrupted.unchanged).toBe(true);expect(interrupted.periods).toEqual(before.periods);
  const trimmed=await page.evaluate(()=>DataAdapter.store().cache.evict({selectedMonth:'2026-10',targetBytes:0}));expect(trimmed.removed).toContain('2024-02');expect(trimmed.removed).not.toContain('2024-01');
  const after=await page.evaluate(()=>DataAdapter.store().cache.usage());expect(after.totalBytes).toBeLessThan(before.totalBytes);expect(after.categoryBytes).toBe(after.totalBytes);
  expect(await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).toEqual(baseline);
  await page.evaluate(()=>commitChange(()=>state.meta.p4OfflineRevisionCheck=true,{render:false}));expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
  expect(await page.evaluate(async()=>{const base=(await p4.readLocal()).cloudBase;return Boolean(await DataAdapter.store().cache.read('2024-01',{epoch:base.epoch,revision:base.revision}));})).toBe(true);
  await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,r=>r.abort());
  expect((await page.evaluate(()=>p4.openMonth('2024-01'))).outcome).toBe('committed');
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2024-01'}))).toBeCloseTo(12.34,2);
  await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);
  // A genuine network outage permits verified offline data; denied access does not.
  await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,r=>r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{status:'PERMISSION_DENIED',message:'test denied access'}})}));
  expect(await page.evaluate(async()=>{const before=JSON.stringify(await DataAdapter.readDurableState());try{await p4.openMonth('2024-01');return false;}catch(e){return e.code==='permission-denied'&&JSON.stringify(await DataAdapter.readDurableState())===before;}})).toBe(true);
  await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);await page.evaluate(()=>p4.openMonth('2024-02'));
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2024-02'}))).toBeCloseTo(12.34,2);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact'))).toBeCloseTo(74.04,2);
  const proof=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('finize-imports-v1-'+DataAdapter.store().scope);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('periodCache','readwrite'),store=tx.objectStore('periodCache'),read=store.get('2024-01');read.onsuccess=()=>store.put({...read.result,sha256:'corrupt'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
    const base=(await DataAdapter.store().readCloudSnapshot()).cloudBase;try{await DataAdapter.store().cache.read('2024-01',{epoch:base.epoch,revision:base.revision});return false;}catch(e){return e.code==='cache-integrity';}
  });expect(proof).toBe(true);
});

test('P4 cache quota failure cannot undo or misreport an already durable period commit',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const f=await newHousehold();await boot(page,f);await attach(page,f,{initialize:true});
  expect(await page.evaluate(async()=>{
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(row,...args){if(this.name==='periodCache'){this.transaction.abort();throw new DOMException('cache full','QuotaExceededError');}return put.call(this,row,...args);};
    try{const result=await p4.openMonth('2026-09');return result.outcome==='committed'&&(await DataAdapter.readDurableState()).meta.selectedMonth==='2026-09';}finally{IDBObjectStore.prototype.put=put;}
  })).toBe(true);
  await page.waitForTimeout(100);expect(errors).toEqual([]);
});

test('P4 cache is household scoped and pending financial changes prevent cleanup',async({page,browser})=>{
  const f=await newHousehold(),other=await newHousehold();await boot(page,f);await attach(page,f,{initialize:true});await page.evaluate(()=>DataAdapter.store().cache.pin('2026-10',true));
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{const second=await context.newPage();await boot(second,other);const usage=await second.evaluate(()=>DataAdapter.store().cache.usage());expect(usage.scope).toBe(other.householdId);expect(usage.periods).toHaveLength(0);}finally{await context.close();}
  await page.evaluate(()=>commitChange(()=>state.meta.p4PendingChange='protected',{render:false}));
  expect(await page.evaluate(()=>DataAdapter.store().cache.evict({selectedMonth:'2026-10',targetBytes:0}))).toMatchObject({blocked:true,removed:[]});
  expect(await page.evaluate(()=>DataAdapter.readDurableState())).toMatchObject({meta:{p4PendingChange:'protected'}});
  expect(await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('finize-imports-v1-'+DataAdapter.store().scope,2);request.onerror=()=>resolve(request.error.name);request.onsuccess=()=>{request.result.close();resolve('unsafe old client');};}))).toBe('VersionError');
});

test('P4 same bank source changed on two clients stays blocked with both approvals and proofs preserved',async({page,browser})=>{
  const f=await newHousehold();await boot(page,f);await page.evaluate(()=>commitChange(()=>{
    state.accountProfiles=[{id:'joint',accountOwner:'gezamenlijk',identifier:'NL01JOINT'},{id:'savings',accountOwner:'gezamenlijk',identifier:'NL02SAVINGS'}];state.spaardoelen={gezamenlijk:['p4-goal','choice-a','choice-b'].map(id=>({id,naam:id,doelbedrag:10000,algespaard:0})),dion:[],dara:[]};state.savingsGoalLedger=[];
  },{render:false}));await attach(page,f,{initialize:true});await importTen(page);await page.evaluate(()=>p4.sync());await page.evaluate(()=>p4.openMonth('2026-10'));
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f);await attach(second,f);
    for(const [client,goal]of [[page,'choice-a'],[second,'choice-b']]){
      await client.evaluate(()=>FinizeUpdate4.openTransactionSource(state.transactions.find(row=>row.recordRole==='bank-source').id));
      await client.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
      const first=client.locator('[data-u4-row]').first();await first.locator('[data-u4-field="savingsGoalId"]').selectOption(goal);await first.locator('[data-u4-approve]').click();
      await expect.poll(()=>client.evaluate(goal=>state.savingsGoalLedger.filter(row=>row.goalId===goal&&row.active!==false).length,goal)).toBe(1);
    }
    expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');const result=await second.evaluate(()=>p4.sync());expect(result.outcome).toBe('conflict');
    expect(await second.evaluate(async value=>{try{await p4.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'p4-reapproval-block',reviewedRemoteChanges:p4.conflictApprovalReview(value).map(row=>row.id)});return 'unsafe success';}catch(e){return e.code;}},result.conflict)).toBe('financial-reapproval-required');
    const evidence=await second.evaluate(()=>p4.readLocal());expect(evidence.conflicts).toHaveLength(1);expect(evidence.operations.length).toBeGreaterThan(0);expect(evidence.operations.every(row=>row.receipt?.outcome==='committed')).toBe(true);
    expect(evidence.conflicts[0].local.transactions.some(row=>row.processing?.savingsGoalId==='choice-b')).toBe(true);expect(evidence.conflicts[0].remote.transactions.some(row=>row.processing?.savingsGoalId==='choice-a')).toBe(true);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await second.evaluate(async()=>(await DataAdapter.store().readCloudSnapshot()).conflicts.length)).toBe(1);
  }finally{await context.close();}
});

test.describe('P4 new installation with actual offline application shell',()=>{
test.use({serviceWorkers:'allow'});
test('P4 new household without legacy: first CSV bulk approval, full localStorage, offline restart and second client',async({page,browser})=>{
  await page.setViewportSize({width:1440,height:1100});
  const f=await newHousehold();await boot(page,f);
  await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.getRegistration();return registration?.active&&navigator.serviceWorker.controller;});
  expect(await page.evaluate(()=>DataAdapter.store().head.migration.sourceSha256)).toBeFalsy();
  expect(await page.evaluate(()=>({sources:state.transactions.filter(row=>row.recordRole==='bank-source').length,income:FinizeTransactions.total('incomeImpact'),expenses:FinizeTransactions.total('realExpense'),deposits:FinizeTransactions.total('savingsDeposit')}))).toEqual({sources:0,income:0,expenses:0,deposits:0});
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="dion"]').click());await page.locator('#tab-dion [data-u3-planning-owner="dion"]').first().click();await page.getByRole('dialog').getByRole('button',{name:'+ Inkomstenbron'}).click();
  await page.locator('#u3RecName').fill('P4 salaris');await page.locator('#u3RecAmount').fill('3100');await page.locator('#u3RecStart').fill('2026-10-01');await page.locator('#u3RecSave').click();await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await expect.poll(()=>page.evaluate(()=>state.recurringIncomeSources.find(row=>row.naam==='P4 salaris')?.verwachtBedrag)).toBe(3100);
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());await page.locator('#tab-gezamenlijk [data-open-owner-variable="gezamenlijk"]').first().click();await page.locator('[data-variable-add]').click();
  await page.locator('[data-variable-field="post"]').last().fill('P4 boodschappen');await page.locator('[data-variable-field="bedrag"]').last().fill('450');await page.locator('[data-variable-save]').click();
  await expect(page.locator('[data-variable-save]')).toHaveCount(0);
  await page.locator('#tab-gezamenlijk [data-open-owner-variable="gezamenlijk"]').first().click();await page.locator('[data-variable-field="bedrag"]').last().fill('475');await page.locator('[data-variable-save]').click();
  await expect(page.locator('[data-variable-save]')).toHaveCount(0);
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();await page.getByRole('dialog').getByRole('button',{name:'+ Vaste last'}).click();await page.locator('#u3RecName').fill('P4 huur');await page.locator('#u3RecAmount').fill('900');await page.locator('#u3RecStart').fill('2026-10-01');await page.locator('#u3RecSave').click();
  await page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'P4 huur'}).getByRole('button',{name:'Bewerken'}).click();await page.locator('#u3RecAmount').fill('925');await page.locator('#u3RecSave').click();await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await expect.poll(()=>page.evaluate(()=>FinizePlanning.fixed('2026-10').find(row=>row.naam==='P4 huur')?.bedrag)).toBe(925);
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="spaardoelen"]').click());await page.locator('[data-add-goal="gezamenlijk"]').first().click();
  await page.locator('#goalEditName').fill('P4 eerste spaardoel');await page.locator('#goalEditTarget').fill('1000');await page.locator('#goalEditSaved').fill('0');await page.locator('#goalEditSave').click();
  await expect.poll(()=>page.evaluate(()=>state.spaardoelen.gezamenlijk.some(row=>row.naam==='P4 eerste spaardoel'))).toBe(true);
  const goalId=await page.evaluate(()=>state.spaardoelen.gezamenlijk.find(row=>row.naam==='P4 eerste spaardoel').id);
  await page.evaluate(()=>commitChange(()=>{
    state.accountProfiles=[{id:'p4-joint',name:'Gezamenlijk',accountOwner:'gezamenlijk',identifier:'NL01JOINT'},{id:'p4-savings',name:'Spaarrekening',accountOwner:'gezamenlijk',identifier:'NL02SAVINGS'}];
  },{render:true}));
  await attach(page,f,{initialize:true});
  await page.evaluate(()=>{try{for(let i=0;i<100;i++)localStorage.setItem('p4-fill-'+i,'x'.repeat(200000));}catch(e){if(e.name!=='QuotaExceededError')throw e;}});
  await page.context().setOffline(true);
  await importTen(page,{goalId});
  const durable=await page.evaluate(()=>DataAdapter.readDurableState());expect(durable.transactions.filter(row=>row.recordRole==='bank-source')).toHaveLength(10);
  const sources=durable.transactions.filter(row=>row.recordRole==='bank-source').map(row=>({id:row.id,amount:row.bankOriginal.amount,date:row.bankOriginal.bankDate,account:row.bankOriginal.accountIdentifier})).sort((a,b)=>a.id.localeCompare(b.id));
  const amounts=[50,100,75,25,200,40,60,90,30,80];
  for(const source of sources){expect(source.account).toBe('NL01JOINT');expect(source.date).toBe('2026-10-'+String(amounts.indexOf(-source.amount)%3+1).padStart(2,'0'));}
  expect(new Set(durable.transactions.filter(row=>row.recordRole==='bank-source').map(row=>row.id)).size).toBe(10);
  expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(750);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(750);
  await page.context().setOffline(false);
  await page.evaluate(async options=>{window.p4=await FinizeCloudRecords.createEmulatorSession(options);await p4.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:require('../helpers/v117-p3-emulator.cjs').token(f.email)});
  expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
  const projection=await page.evaluate(async()=>(await p4.loadPeriod('2026-10')).financials);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f);await attach(second,f);expect(await second.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(750);
    expect(await second.evaluate(()=>state.transactions.filter(row=>row.recordRole==='bank-source').map(row=>({id:row.id,amount:row.bankOriginal.amount,date:row.bankOriginal.bankDate,account:row.bankOriginal.accountIdentifier})).sort((a,b)=>a.id.localeCompare(b.id)))).toEqual(sources);
    expect(await second.evaluate(()=>state.__finizePeriodContext.summaries['2026-10'])).toEqual(projection);
    expect(await second.evaluate(()=>FinizePlanning.fixed('2026-10').find(row=>row.naam==='P4 huur').bedrag)).toBe(925);
    expect(await second.evaluate(id=>state.spaardoelen.gezamenlijk.find(row=>row.id===id).algespaard,goalId)).toBe(750);
  }finally{await context.close();}
});
});
