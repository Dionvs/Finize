const {test,expect}=require('@playwright/test');
const {fixture,admin,token}=require('../helpers/v117-p3-emulator.cjs');
const visual=require('../fixtures/v50-visual-state.json');
test.setTimeout(120000);
async function boot(page,f,seed=visual){
  page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
  await page.addInitScript(({seed,householdId})=>{
    const user={uid:'browser-p3',email:'browser@example.invalid',emailVerified:true};
    const key=`finize-budget-planner-v1:account:${householdId}:${user.uid}`;
    if(seed&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
    window.__FINIZE_AUTH_ENABLED__=true;window.__FINIZE_AUTH_TEST_DRIVER__={initialize:cb=>setTimeout(()=>cb(user),0),loadAssignment:async()=>({householdId,role:'dion'}),setPersistence:async()=>{}};
  },{seed,householdId:f.householdId});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
}
async function session(page,f,migrate=false){
  if(migrate){const snapshot=await page.evaluate(async options=>{const session=await FinizeCloudRecords.createEmulatorSession(options);return session.readLocal();},{householdId:f.householdId,token:token(f.email)});f.legacy={syncVersion:1,commitId:'browser-legacy',state:snapshot.state};await admin.commit([{path:`households/${f.householdId}/budgetState/current`,data:f.legacy}]);}
  return page.evaluate(async({householdId,token,legacy,migrate})=>{
    window.p3=await FinizeCloudRecords.createEmulatorSession({householdId,token});
    if(migrate){const s=await p3.readLocal();await p3.cloudStore.migrate({state:s.state,imports:s.imports,epoch:'browser-epoch',legacyPointer:legacy});await p3.cloudStore.activate({approveTestCutover:true});}
    await p3.attach({automatic:false,periodLoading:false});return p3.establishBase();
  },{householdId:f.householdId,token:token(f.email),legacy:f.legacy,migrate});
}
async function savings(page){
  await page.evaluate(()=>commitChange(()=>{
    state.meta.selectedMonth='2026-10';state.transactions=[];state.importSummaries=[];state.activeImportId='';state.monthRecords={};state.recognitionRules=[];state.recurringFixedExpenses=[];state.manualTransactionReplacements=[];state.internalTransferPairs=[];state.savingsCoverageAllocations=[];state.advanceLedger=[];state.advanceRepayments=[];
    state.accountProfiles=[{id:'p3-joint',name:'Gezamenlijk',accountOwner:'gezamenlijk',identifier:'NL01JOINT'},{id:'p3-savings',name:'Spaarrekening',accountOwner:'gezamenlijk',identifier:'NL02SAVINGS'}];
    state.spaardoelen={gezamenlijk:[{id:'p3-goal',naam:'Buffer',doelbedrag:10000,algespaard:0}],dion:[],dara:[]};state.savingsGoalLedger=[];
  },{render:true}));
}
async function inspect(page){return page.evaluate(async()=>{
  const batch=await FinizeUpdate4.importStore.getImport(state.importSummaries[0].id);
  return {approved:batch.rows.filter(r=>FinizeUpdate4.getTransactionProcessingStatus({...r,source:'csv'})==='goedgekeurd').length,
    originals:batch.rows.map(r=>r.bankOriginal),bankSources:FinizeTransactions.bankSources({month:'2026-10'}).length,
    effects:state.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>({id:t.id,source:t.bankSourceId,amount:t.amount})),savings:FinizeTransactions.total('savingsDeposit',{month:'2026-10'})};
});}
test('V117 P3 partial history: real screens, ten CSV approvals, offline restart, historical correction and second client',async({page,browser})=>{
  const f=await fixture();await boot(page,f);await savings(page);
  await page.evaluate(()=>commitChange(()=>{
    for(let i=0;i<36;i++){const month=`${2023+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;state.transactions.push({id:'history-'+month,source:'manual',date:month+'-03',transactionDate:month+'-03',amount:10,expenseImpact:10,kind:'uitgave',transactionType:'uitgave',account:'gezamenlijk',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',category:'Boodschappen',description:'Historisch '+month,processingStatus:'goedgekeurd',reviewStatus:'bevestigd',certainty:'goedgekeurd',approvalSource:'manual'});}
  },{render:false}));
  expect((await session(page,f,true)).outcome).toBe('matched');await page.evaluate(()=>p3.sync());
  const full=await page.evaluate(()=>({scenario:FinizeUpdate3.scenarioResult(),budget:FinizeUpdate3.budgetSummary('gezamenlijk','2026-10')}));
  const opened=await page.evaluate(async()=>{const start={...p3.transport.metrics};const result=await p3.openMonth('2026-10');return {...result,reads:p3.transport.metrics.reads-start.reads};});
  expect(opened).toMatchObject({outcome:'committed',loadedTransactions:0});
  expect(await page.evaluate(()=>({scenario:FinizeUpdate3.scenarioResult(),budget:FinizeUpdate3.budgetSummary('gezamenlijk','2026-10')}))).toEqual(full);
  const readAudit=()=>{const original=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args){if(this.name==='financialRecords')sessionStorage.setItem('wholeFinancialReads',String(Number(sessionStorage.getItem('wholeFinancialReads')||0)+1));return original.apply(this,args);};};
  await page.evaluate(readAudit);await page.addInitScript(readAudit);
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  const amounts=[50,100,75,25,200,40,60,90,30,80],csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+amounts.map((n,i)=>`2026-10-0${i%3+1};Periode sparen X;NL01JOINT;NL02SAVINGS;-${n}`).join('\n');
  await page.locator('[data-u4-file]').setInputFiles({name:'partial-ten.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('[data-u4-row]')).toHaveCount(10);await page.locator('#u4ImportModalRoot details').evaluateAll(ns=>ns.forEach(n=>n.open=true));
  const first=page.locator('[data-u4-row]').first();await first.locator('[data-u4-family]').selectOption('sparen');await first.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');await first.locator('[data-u4-field="savingsGoalId"]').selectOption('p3-goal');
  await first.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (10)');await page.locator('[data-u4-match-apply]').click();
  await expect.poll(()=>inspect(page)).toMatchObject({approved:10,bankSources:10,savings:750});const approved=await inspect(page);
  expect(await page.evaluate(()=>state.transactions.some(row=>row.id.startsWith('history-')))).toBe(false);
  await page.route('http://127.0.0.1:8181/**',r=>r.abort());
  expect(await page.evaluate(async()=>{try{await p3.openMonth('2023-01');return false;}catch{return state.meta.selectedMonth==='2026-10'&&state.transactions.length===20;}})).toBe(true);
  expect(await page.evaluate(async()=>{try{await p3.sync();return false;}catch{return (await DataAdapter.store().readCloudSnapshot()).operations.length>0;}})).toBe(true);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect(page)).toEqual(approved);
  await page.unroute('http://127.0.0.1:8181/**');await page.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email)});
  const committed=await page.evaluate(async()=>{const start={...p3.transport.metrics};const result=await p3.sync();return {...result,reads:p3.transport.metrics.reads-start.reads};});expect(committed.outcome).toBe('committed');expect((await page.evaluate(()=>p3.sync())).outcome).toBe('idle');
  await page.locator('#monthPickerButton').click();await page.locator('[data-month-year="2025"]').click();await page.locator('[data-month-value="2025-03"]').click();await expect.poll(()=>page.evaluate(()=>state.meta.selectedMonth)).toBe('2025-03');
  expect(await page.evaluate(()=>state.transactions.filter(row=>row.id.startsWith('history-')).length)).toBeLessThan(4);
  expect(await page.evaluate(async()=>{const row=state.transactions.find(row=>row.id==='history-2025-03');return FinizeManual.save({...row,amount:25,expenseImpact:25},'gezamenlijk');})).toBe(true);
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');expect(await page.evaluate(async()=>(await p3.loadPeriod('2025-03')).financials.totalsCents.budgetImpact)).toBe(2500);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f,null);await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false});},{householdId:f.householdId,token:token(f.email,'partial-second')});
    expect(await second.evaluate(()=>({count:state.transactions.length,savings:FinizeTransactions.total('savingsDeposit'),goal:state.spaardoelen.gezamenlijk[0].algespaard}))).toEqual({count:20,savings:750,goal:750});
    expect((await second.evaluate(()=>p3.sync())).outcome).toBe('idle');
  }finally{await context.close();}
  const wholeFinancialReads=await page.evaluate(()=>Number(sessionStorage.getItem('wholeFinancialReads')||0));expect(wholeFinancialReads).toBe(0);
  expect(await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('finize-imports-v1-'+DataAdapter.store().scope);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('financialRecords','readonly'),read=tx.objectStore('financialRecords').get(JSON.stringify(['transactions','history-2023-01']));read.onsuccess=()=>resolve(read.result?.value?.id==='history-2023-01');tx.oncomplete=()=>db.close();};}))).toBe(true);
  console.log('P3_BROWSER_TARGETED '+JSON.stringify({initialHistorySources:36,activeMonthTransactions:opened.loadedTransactions,monthReads:opened.reads,tenApprovalSyncReads:committed.reads,wholeFinancialReads}));
});
test('V117 P3 real Firestore: offline ten savings approvals, restart, repeated sync and second browser client',async({page,browser})=>{
  const f=await fixture();await boot(page,f);await savings(page);expect((await session(page,f,true)).outcome).toBe('matched');
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  const amounts=[50,100,75,25,200,40,60,90,30,80],csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+amounts.map((n,i)=>`2026-10-0${i%3+1};Sparen X;NL01JOINT;NL02SAVINGS;-${n}`).join('\n');
  await page.locator('[data-u4-file]').setInputFiles({name:'p3-ten.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('[data-u4-row]')).toHaveCount(10);await page.locator('#u4ImportModalRoot details').evaluateAll(ns=>ns.forEach(n=>n.open=true));
  const first=page.locator('[data-u4-row]').first();await first.locator('[data-u4-family]').selectOption('sparen');await first.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');await first.locator('[data-u4-field="savingsGoalId"]').selectOption('p3-goal');
  await first.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (10)');await page.locator('[data-u4-match-apply]').click();
  await expect.poll(()=>inspect(page)).toMatchObject({approved:10,bankSources:10,savings:750});const before=await inspect(page);
  expect(new Set(before.effects.map(r=>r.source)).size).toBe(10);
  await page.route('http://127.0.0.1:8181/**',r=>r.abort());
  expect(await page.evaluate(async()=>{try{await p3.sync();return false;}catch{return (await DataAdapter.store().readCloudSnapshot()).operations.length>0;}})).toBe(true);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect(page)).toEqual(before);
  await page.unroute('http://127.0.0.1:8181/**');
  // Resume from the durable cursor, never establish a different base over pending edits.
  await page.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email)});
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
  const cloud=await page.evaluate(async()=>({all:await p3.cloudStore.verifyIntegrity(),period:await p3.loadPeriod('2026-10'),snapshot:await DataAdapter.store().readCloudSnapshot(),queue:await FinizeUpdate4.importStore.listSync()}));
  expect(cloud.snapshot.operations).toHaveLength(0);expect(cloud.queue).toHaveLength(0);expect(cloud.period.financials.totalsCents.savingsDeposit).toBe(75000);expect(cloud.period.financials.approvedEffectCount).toBe(10);
  expect(cloud.period.financials.application.monthResult).toMatchObject({savings:750});
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('idle');expect(await page.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision)).toBe(cloud.all.head.revision);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f,null);
    await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email,'second-browser')});
    const period=await second.evaluate(()=>p3.loadPeriod('2026-10'));expect(period.financials).toEqual(cloud.period.financials);
    expect(await second.evaluate(async()=>{
      const before=await DataAdapter.readDurableState(),ui=JSON.stringify(state),put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(record,...args){if(this.name==='imports'){this.transaction.abort();throw new DOMException('abort remote imports','AbortError');}return put.call(this,record,...args);};
      try{await p3.pull();return false;}catch{return JSON.stringify(before)===JSON.stringify(await DataAdapter.readDurableState())&&ui===JSON.stringify(state)&&(await FinizeUpdate4.importStore.listImports()).length===0;}finally{IDBObjectStore.prototype.put=put;}
    })).toBe(true);
    expect((await second.evaluate(async()=>{
      const store=DataAdapter.store(),commit=store.commit;store.commit=async function(...args){await commit.apply(this,args);throw Error('lost pull acknowledgment');};
      try{return await p3.pull();}finally{store.commit=commit;}
    })).outcome).toBe('committed');
    expect(await second.evaluate(()=>DataAdapter.readDurableState())).toEqual(cloud.all.state);
    await second.evaluate(()=>FinizeUpdate4.openImportDetails(state.importSummaries[0].id));expect(await inspect(second)).toEqual(before);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect(second)).toEqual(before);
    await page.evaluate(()=>commitChange(()=>state.p3RemoteChange='newer'));expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
    expect(await second.evaluate(async options=>{
      window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});
      const before=await DataAdapter.readDurableState();localStorage.setItem(DataAdapter.store().head.migration.sourceKey,JSON.stringify({...before,oldClientOfflineChoice:'protected'}));
      try{await p3.pull();return false;}catch(e){return e.code==='storage-migration-conflict'&&e.commitOutcome==='rejected'&&JSON.stringify(before)===JSON.stringify(await DataAdapter.readDurableState())&&!state.p3RemoteChange;}
    },{householdId:f.householdId,token:token(f.email,'second-browser')})).toBe(true);
  }finally{await context.close();}
});

test('V117 P3 real Firestore: divergent offline clients preserve both versions and reject silent replacement',async({page,browser})=>{
  const f=await fixture();await boot(page,f);expect((await session(page,f,true)).outcome).toBe('matched');await page.evaluate(()=>p3.sync());
  const baseline=await page.evaluate(()=>DataAdapter.readDurableState()),context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f,baseline);expect((await session(second,f)).outcome).toBe('matched');await second.evaluate(()=>p3.sync());
    // Match the latest unchanged cloud base after device B's initial local migration proof.
    await page.evaluate(()=>p3.establishBase());
    await page.evaluate(()=>commitChange(()=>state.deviceChoice='A'));await second.evaluate(()=>commitChange(()=>state.deviceChoice='B'));
    expect((await second.evaluate(()=>p3.pull())).outcome).toBe('pending-local');expect(await second.evaluate(()=>state.deviceChoice)).toBe('B');
    expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
    const conflict=await second.evaluate(()=>p3.sync());expect(conflict.outcome).toBe('conflict');expect(conflict.conflict.local.deviceChoice).toBe('B');expect(conflict.conflict.remote.deviceChoice).toBe('A');
    expect(await second.evaluate(()=>state.deviceChoice)).toBe('B');
    expect(await second.evaluate(async value=>{value.remote.deviceChoice='modified-review-copy';try{await p3.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'tampered-review'});return false;}catch(e){return e.code==='cloud-conflict';}},conflict.conflict)).toBe(true);
    expect(await second.evaluate(async value=>{try{await p3.resolveConflict(value,{choice:'remote',expectedRemoteRevision:value.remoteRevision,operationId:'unsafe-replace'});return false;}catch(e){return e.code==='approval-review-required';}},conflict.conflict)).toBe(true);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    expect(await second.evaluate(()=>state.deviceChoice)).toBe('B');
    await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email)});
    expect((await second.evaluate(()=>p3.sync())).outcome).toBe('conflict');
    expect(await second.evaluate(async value=>{
      const store=DataAdapter.store(),ack=store.acknowledgeRecordCloud;
      store.acknowledgeRecordCloud=async()=>{throw Error('lost local conflict acknowledgment');};
      try{await p3.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'reviewed-conflict-choice'});return false;}
      catch(e){return e.message==='lost local conflict acknowledgment';}finally{store.acknowledgeRecordCloud=ack;}
    },conflict.conflict)).toBe(true);
    const revision=await second.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email)});
    expect((await second.evaluate(()=>p3.sync())).outcome).toBe('committed');
    expect(await second.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision)).toBe(revision);
    expect(await second.evaluate(async()=>(await p3.cloudStore.verifyIntegrity()).state.deviceChoice)).toBe('B');
    expect((await page.evaluate(()=>p3.pull())).outcome).toBe('committed');expect(await page.evaluate(()=>state.deviceChoice)).toBe('B');
    expect(await second.evaluate(async()=>{const db=await new Promise(resolve=>{const q=indexedDB.open('finize-imports-v1-'+DataAdapter.store().scope);q.onsuccess=()=>resolve(q.result);});return new Promise(resolve=>{const q=db.transaction('journal').objectStore('journal').getAll();q.onsuccess=()=>{db.close();resolve(q.result.some(r=>r.operation==='record-cloud-conflict'&&r.status==='resolved'&&r.local.deviceChoice==='B'&&r.remote.deviceChoice==='A'));};});})).toBe(true);
  }finally{await context.close();}
});

test('V117 P3 browser gateway refuses household and production addresses',async({page})=>{
  const f=await fixture();await boot(page,f);
  expect(await page.evaluate(async f=>{const codes=[];for(const options of [{householdId:'foreign',token:f.token},{householdId:f.householdId,token:f.token,host:'firestore.googleapis.com',projectId:'production'}])try{await FinizeCloudRecords.createEmulatorSession(options);}catch(e){codes.push(e.code);}return codes;},{householdId:f.householdId,token:token(f.email)})).toEqual(['household-scope','emulator-only']);
});

test('V117 P3 partial history: commit hydrates historical dependencies once and ordinary edits stay targeted',async({page})=>{
  const f=await fixture();await boot(page,f);await savings(page);
  await page.evaluate(()=>commitChange(()=>{state.transactions.push({id:'dependency-old',source:'manual',date:'2025-03-03',transactionDate:'2025-03-03',amount:10,expenseImpact:10,kind:'uitgave',transactionType:'uitgave',account:'gezamenlijk',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',category:'Boodschappen',processingStatus:'goedgekeurd',reviewStatus:'bevestigd',certainty:'goedgekeurd',approvalSource:'manual'});},{render:false}));
  await session(page,f,true);await page.evaluate(()=>p3.sync());await page.evaluate(()=>p3.openMonth('2026-10'));
  expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  expect(await page.evaluate(()=>commitChange(()=>{state.monthlyBudgets=state.monthlyBudgets||{};state.monthlyBudgets['2025-03']={gezamenlijkVariabel:[{id:'once-old',categorie:'Boodschappen',post:'Boodschappen',bedrag:125}]};},{throwOnError:true}))).toBe(true);
  expect(await page.evaluate(()=>({old:state.transactions.some(row=>row.id==='dependency-old'),budget:state.monthlyBudgets['2025-03'].gezamenlijkVariabel[0].bedrag}))).toEqual({old:true,budget:125});
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
  expect(await page.evaluate(()=>commitChange(()=>state.planning.spaarpotDezeMaand=150,{throwOnError:true}))).toBe(true);
  expect(await page.evaluate(()=>state.__finizePeriodContext.explicitFullHistory)).toBe(true);expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
  expect(await page.evaluate(()=>({loaded:state.transactions.length,months:state.verifiedPeriods,full:state.__finizePeriodContext.explicitFullHistory}))).toEqual({loaded:0,months:['2026-10'],full:false});
  expect(await page.evaluate(()=>commitChange(()=>{state.monthlyBudgets['2026-10']={gezamenlijkVariabel:[{id:'once-current',categorie:'Boodschappen',post:'Boodschappen',bedrag:250}]};},{throwOnError:true}))).toBe(true);
  expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
  const touched=await page.evaluate(async()=>{const s=await p3.cloudStore.context(),ops=await p3.transport.query(s.root+'/operations');const latest=ops.map(row=>row.data).sort((a,b)=>b.targetHead.revision-a.targetHead.revision)[0];return (await p3.transport.query(s.root+'/operations/'+latest.id+'/changes')).filter(row=>row.data.path.startsWith('periods/')).map(row=>row.data.path);});
  expect(touched).toEqual(['periods/2026-10']);
});

test('V117 P3 partial history: reviewed disjoint offline approvals preserve both clients after lost acknowledgment',async({page,browser})=>{
  const f=await fixture();await boot(page,f);await savings(page);await session(page,f,true);await page.evaluate(()=>p3.sync());await page.evaluate(()=>p3.openMonth('2026-10'));
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second,f,null);
    await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false});},{householdId:f.householdId,token:token(f.email)});
    const approve=async(p,id,amount)=>p.evaluate(({id,amount})=>commitChange(()=>{state.transactions.push({id,source:'manual',date:'2026-10-03',transactionDate:'2026-10-03',amount,expenseImpact:amount,kind:'uitgave',transactionType:'uitgave',account:'gezamenlijk',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',category:'Boodschappen',processingStatus:'goedgekeurd',reviewStatus:'bevestigd',certainty:'goedgekeurd',approvalSource:'manual'});},{throwOnError:true}),{id,amount});
    await approve(page,'device-A-expense',10);await approve(second,'device-B-expense',20);expect((await page.evaluate(()=>p3.sync())).outcome).toBe('committed');
    const conflict=await second.evaluate(()=>p3.sync());expect(conflict.outcome).toBe('conflict');
    expect(await second.evaluate(async value=>{value.remote.transactions[0].amount=999;try{await p3.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'tampered-partial'});return false;}catch(e){return e.code==='cloud-conflict';}},conflict.conflict)).toBe(true);
    expect(await second.evaluate(async value=>{try{await p3.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'unreviewed-partial'});return false;}catch(e){return e.code==='approval-review-required';}},conflict.conflict)).toBe(true);
    expect(await second.evaluate(async value=>{const store=DataAdapter.store(),ack=store.acknowledgeRecordCloud;store.acknowledgeRecordCloud=async()=>{throw Error('lost partial resolution acknowledgment');};try{await p3.resolveConflict(value,{choice:'local',expectedRemoteRevision:value.remoteRevision,operationId:'reviewed-partial',reviewedRemoteChanges:p3.conflictApprovalReview(value).map(row=>row.id)});return false;}catch(e){return e.message==='lost partial resolution acknowledgment';}finally{store.acknowledgeRecordCloud=ack;}},conflict.conflict)).toBe(true);
    const revision=await second.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    await second.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);await p3.attach({automatic:false,periodLoading:false});},{householdId:f.householdId,token:token(f.email)});
    expect((await second.evaluate(()=>p3.sync())).outcome).toBe('committed');expect(await second.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision)).toBe(revision);
    expect(await second.evaluate(()=>({ids:state.transactions.map(row=>row.id).sort(),total:FinizeTransactions.total('budgetImpact')}))).toEqual({ids:['device-A-expense','device-B-expense'],total:30});
    expect((await page.evaluate(()=>p3.pull())).outcome).toBe('committed');expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact'))).toBe(30);
  }finally{await context.close();}
});

test('V117 P3 actual browser close resumes locked migration and transfers household image bytes',async({page,context})=>{
  const f=await fixture(),seed=structuredClone(visual),photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW0sAAAAASUVORK5CYII=';
  seed.spaardoelen.gezamenlijk=[{id:'p3-photo',naam:'Foto behouden',doelbedrag:1000,algespaard:0,afbeelding:photo}];
  await boot(page,f,seed);
  const options={householdId:f.householdId,token:token(f.email)};
  const snapshot=await page.evaluate(async options=>{window.p3=await FinizeCloudRecords.createEmulatorSession(options);return p3.readLocal();},options);
  expect(snapshot.state.spaardoelen.gezamenlijk[0].afbeelding).toBe(photo);
  expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].afbeelding)).toBe('idb:goal-image:p3-photo');
  f.legacy={syncVersion:1,commitId:'browser-locked-migration',state:snapshot.state};await admin.commit([{path:`households/${f.householdId}/budgetState/current`,data:f.legacy}]);
  const pending=page.evaluate(async({legacy})=>{const snapshot=await p3.readLocal();await p3.cloudStore.migrate({state:snapshot.state,imports:snapshot.imports,epoch:'photo-epoch',legacyPointer:legacy,checkpoint:async phase=>{if(phase==='locked'){window.__p3Checkpoint=phase;await new Promise(()=>{});}}});},{legacy:f.legacy}).catch(()=>{});
  await page.waitForFunction(()=>window.__p3Checkpoint==='locked');await page.close();await pending;
  const resumed=await context.newPage();await boot(resumed,f,seed);
  const result=await resumed.evaluate(async({options,legacy})=>{
    window.p3=await FinizeCloudRecords.createEmulatorSession(options);const snapshot=await p3.readLocal();
    await p3.cloudStore.migrate({state:snapshot.state,imports:snapshot.imports,epoch:'photo-epoch',legacyPointer:legacy});await p3.cloudStore.activate({approveTestCutover:true});await p3.attach({automatic:false,periodLoading:false});await p3.establishBase();await p3.sync();
    return {verified:await p3.cloudStore.verifyIntegrity(),local:await DataAdapter.readDurableState()};
  },{options,legacy:f.legacy});
  expect(result.verified.state.spaardoelen.gezamenlijk[0].afbeelding).toBe(photo);expect(result.local.spaardoelen.gezamenlijk[0].afbeelding).toBe('idb:goal-image:p3-photo');
  expect(result.verified.state).toEqual(snapshot.state);
  const revision=result.verified.head.revision;
  await resumed.evaluate(()=>commitChange(()=>state.spaardoelen.gezamenlijk[0].afbeelding='idb:goal-image:missing-photo'));
  expect(await resumed.evaluate(async()=>{try{await p3.sync();return false;}catch(e){return e.message.includes('Spaardoelfoto ontbreekt')&&(await DataAdapter.store().readCloudSnapshot()).operations.length>0;}})).toBe(true);
  expect(await resumed.evaluate(async()=>(await p3.cloudStore.context()).head.data.revision)).toBe(revision);
  expect(await resumed.evaluate(()=>state.spaardoelen.gezamenlijk[0].afbeelding)).toBe('idb:goal-image:missing-photo');
});
