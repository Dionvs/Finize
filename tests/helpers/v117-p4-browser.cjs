const {expect}=require('@playwright/test');
const {admin,token}=require('./v117-p3-emulator.cjs');
async function newHousehold(){
  const householdId='p4-'+crypto.randomUUID(),email=householdId+'@example.invalid';
  await admin.commit([{path:'accountLinks/'+email,data:{householdId,role:'dion',displayName:'P4'}},{path:'households/'+householdId,data:{label:'isolated P4 emulator'}}]);
  return {householdId,email};
}
async function boot(page,f,seed=null){
  await require('./isolated-emulator.cjs').isolateBrowser(page);
  if(process.env.FINIZE_BROWSER_DIAGNOSTIC){page.on("console",m=>console.log("P4_BROWSER",m.type(),m.text()));page.on("requestfailed",r=>console.log("P4_REQUEST_FAILED",r.method(),r.url(),r.failure()));}
  if(seed)seed={...require('./migration-runtime.cjs')().migrateBudgetState(require('../fixtures/v50-visual-state.json')),...seed};
  page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-10T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
  await page.addInitScript(({seed,householdId})=>{
    const user={uid:'browser-p4',email:'browser@example.invalid',emailVerified:true},key=`finize-budget-planner-v1:account:${householdId}:${user.uid}`;
    if(seed&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
    window.__FINIZE_AUTH_ENABLED__=true;window.__FINIZE_AUTH_TEST_DRIVER__={initialize:cb=>setTimeout(()=>cb(user),0),loadAssignment:async()=>({householdId,role:'dion'}),setPersistence:async()=>{}};
  },{seed,householdId:f.householdId});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered,null,{timeout:15000});
}
async function attach(page,f,{initialize=false}={}){
  return page.evaluate(async({householdId,token,initialize})=>{
    window.p4=await FinizeCloudRecords.createEmulatorSession({householdId,token});
    if(initialize){const snapshot=await p4.readLocal();await p4.cloudStore.initializeNew({state:snapshot.state,imports:snapshot.imports,epoch:'p4-new',approveTestCutover:true});await p4.establishBase();await p4.sync();}
    await p4.attach({automatic:false});return true;
  },{householdId:f.householdId,token:token(f.email),initialize});
}
async function importTen(page,{goalId='p4-goal',prefix='P4 sparen',amounts=[50,100,75,25,200,40,60,90,30,80],beforeApprove=null,expectedCount=amounts.length,completionTimeoutMs=20000}={}){
  const existingSourceIds=await page.evaluate(()=>state.transactions.filter(r=>r.recordRole==='bank-source').map(r=>r.id));
  const baseline=await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}));
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+amounts.map((n,i)=>`2026-10-${String(i%3+1).padStart(2,'0')};${prefix};NL01JOINT;NL02SAVINGS;-${n}`).join('\n');
  const importStarted=performance.now();
  await page.locator('[data-u4-file]').setInputFiles({name:prefix+'.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  // Import creation awaits a durable commit before rendering its rows. Measure
  // that work separately; the default five-second assertion is not a latency SLA.
  await expect(page.locator('[data-u4-row]')).toHaveCount(amounts.length,{timeout:20000});
  const importMs=performance.now()-importStarted;
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  const first=page.locator('[data-u4-row]').first();await first.locator('[data-u4-family]').selectOption('sparen');await first.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');await first.locator('[data-u4-field="savingsGoalId"]').selectOption(goalId);
  await page.evaluate(existingSourceIds=>{
    if(!window.p4ApprovalObserved){
      window.p4ApprovalObserved=true;const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(row,...args){
        const request=put.call(this,row,...args);
        if(this.name==='operationReceipts'&&row.outcome==='committed')this.transaction.addEventListener('complete',()=>{if(window.p4ApprovalClock)window.p4ApprovalClock.commits.push({operationId:row.id,revision:row.storageRevision,ms:performance.now()-window.p4ApprovalClock.started,preparation:window.idbPerformanceMeter?.checkpoint()});});
        return request;
      };
    }
    const originals=state.transactions.filter(r=>r.recordRole==='bank-source'&&!existingSourceIds.includes(r.id));
    window.p4ApprovalClock={started:performance.now(),commits:[],sourceIds:originals.map(r=>r.id),bankSourceIds:originals.map(r=>r.bankSourceId),originals:originals.map(r=>({id:r.id,bankOriginal:r.bankOriginal}))};
  },existingSourceIds);
  if(beforeApprove)await beforeApprove();
  const started=performance.now();await first.locator('[data-u4-approve]').click();
  if(amounts.length>1){await expect(page.locator('[data-u4-match-apply]')).toHaveText(`Geselecteerde transacties goedkeuren (${amounts.length})`);await page.locator('[data-u4-match-apply]').click();}
  await expect.poll(()=>page.evaluate(()=>state.transactions.filter(row=>row.recordRole==='bank-source').length)).toBeGreaterThanOrEqual(amounts.length);
  await expect(page.locator('[data-u4-group-result]')).toContainText(`${expectedCount} van ${amounts.length} transacties goedgekeurd`,{timeout:completionTimeoutMs});
  const approvedAmount=expectedCount===amounts.length?amounts.reduce((sum,n)=>sum+n,0):await page.evaluate(()=>state.transactions.filter(r=>r.recordRole==='bank-source'&&p4ApprovalClock.sourceIds.includes(r.id)&&r.processingStatus==='goedgekeurd').reduce((sum,r)=>sum+Math.abs(r.bankOriginal.amount),0));
  expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(baseline+approvedAmount);
  const local=await page.evaluate(()=>({...p4ApprovalClock,uiResultMs:performance.now()-p4ApprovalClock.started}));
  expect(local.commits).toHaveLength(expectedCount);
  return {approvalMs:performance.now()-started,importMs,localDurableMs:local.commits.at(-1)?.ms,uiResultMs:local.uiResultMs,performanceGoalMs:20000,performanceGoalMet:local.commits.at(-1)?.ms<=20000,commits:local.commits,sourceIds:local.sourceIds,bankSourceIds:local.bankSourceIds,originals:local.originals};
}
module.exports={boot,attach,newHousehold,importTen};
