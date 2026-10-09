const {test,expect}=require('@playwright/test'),fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60000);
async function boot(page){
  page.on('dialog',d=>d.accept());await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
  await page.addInitScript(s=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>commitChange(()=>{
    state.meta.selectedMonth='2026-10';state.transactions=[];state.importSummaries=[];state.activeImportId='';state.monthRecords={};state.recognitionRules=[];state.recurringFixedExpenses=[];state.manualTransactionReplacements=[];state.internalTransferPairs=[];state.savingsCoverageAllocations=[];state.advanceLedger=[];state.advanceRepayments=[];
    state.accountProfiles=[{id:'v117-joint',name:'Gezamenlijk',accountOwner:'gezamenlijk',identifier:'NL01JOINT'},{id:'v117-savings',name:'Spaarrekening',accountOwner:'gezamenlijk',identifier:'NL02SAVINGS'}];
    state.budgetDefaultsHistory={gezamenlijk:[{effectiveFrom:'0000-01',rows:[{id:'food',post:'Boodschappen',bedrag:1000}]}],dion:[],dara:[]};
    state.spaardoelen={gezamenlijk:[{id:'v117-goal',naam:'Buffer',doelbedrag:10000,algespaard:0}],dion:[],dara:[]};state.savingsGoalLedger=[];
  },{render:true}));
}
const amounts=[50,100,75,25,200,40,60,90,30,80];
async function upload(page,saving=false,sourceAmounts=amounts){
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+sourceAmounts.map((n,i)=>`2026-10-0${i%3+1};${saving?'Sparen X':'Albert Heijn'};NL01JOINT;${saving?'NL02SAVINGS':'NL03SHOP'};-${n}`).join('\n');
  await page.locator('[data-u4-file]').setInputFiles({name:'synthetic-v117.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('[data-u4-row]')).toHaveCount(sourceAmounts.length);
  await page.locator('#u4ImportModalRoot details').evaluateAll(ns=>ns.forEach(n=>n.open=true));
  return page.locator('[data-u4-row]').first();
}
async function inspect(page){return page.evaluate(async()=>{
  const b=await FinizeUpdate4.importStore.getImport(state.importSummaries[0].id);
  return {approved:b.rows.filter(r=>FinizeUpdate4.getTransactionProcessingStatus({...r,source:'csv'})==='goedgekeurd').length,
    bankSources:FinizeTransactions.bankSources({month:'2026-10'}).length,
    rows:b.rows.map(r=>({id:r.id,original:r.bankOriginal,type:r.processing.transactionType,status:FinizeUpdate4.getTransactionProcessingStatus({...r,source:'csv'})})),
    effects:state.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>({id:t.id,source:t.bankSourceId,amount:t.amount,type:t.transactionType})),
    savings:FinizeTransactions.total('savingsDeposit',{month:'2026-10'}),budget:FinizeTransactions.total('budgetImpact',{month:'2026-10'})};
});}
for(const width of [390,1440]){
  test(`V117 one confirmation approves all ten savings sources ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await boot(page);const first=await upload(page,true),before=await inspect(page);
    await first.locator('[data-u4-family]').selectOption('sparen');
    await first.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');
    await first.locator('[data-u4-field="savingsGoalId"]').selectOption('v117-goal');
    await first.locator('[data-u4-approve]').click();
    await expect(page.locator('[data-u4-match-id]')).toHaveCount(10);
    await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (10)');
    await page.locator('[data-u4-match-apply]').click();
    await expect.poll(()=>inspect(page)).toMatchObject({approved:10,bankSources:10,savings:750});
    const result=await inspect(page);expect(result.effects).toHaveLength(10);expect(new Set(result.effects.map(r=>r.source)).size).toBe(10);
    expect(result.rows.map(r=>r.original)).toEqual(before.rows.map(r=>r.original));
    expect(result.rows.every(r=>r.type==='naar-spaarrekening')).toBe(true);
    await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    expect(await inspect(page)).toEqual(result);
  });
}
test('V117 exactly five selected matches change, five remain untouched',async({page})=>{
  await boot(page);const first=await upload(page),before=await inspect(page);
  await first.locator('[data-u4-field="category"]').selectOption('Boodschappen');await first.locator('[data-u4-approve]').click();
  const inputs=page.locator('[data-u4-match-id]');for(let i=0;i<10;i++)await inputs.nth(i).setChecked([0,2,4,6,8].includes(i));
  const ids=await page.locator('[data-u4-match-id]:checked').evaluateAll(ns=>ns.map(n=>n.dataset.u4MatchId));
  await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (5)');await page.locator('[data-u4-match-apply]').click();
  await expect.poll(()=>inspect(page)).toMatchObject({approved:5,bankSources:10});
  const result=await inspect(page);expect(result.rows.filter(r=>r.status==='goedgekeurd').map(r=>r.id).sort()).toEqual(ids.sort());
  expect(result.budget).toBe(before.rows.filter(row=>ids.includes(row.id)).reduce((sum,row)=>sum+Math.abs(row.original.amount),0));
  expect(result.rows.map(r=>r.original)).toEqual(before.rows.map(r=>r.original));
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect(page)).toEqual(result);
});

test('V117 seven durable successes survive storage failure and retry processes only remainder',async({page})=>{
  await boot(page);const first=await upload(page);
  await first.locator('[data-u4-field="category"]').selectOption('Boodschappen');
  await page.evaluate(()=>{const save=DataAdapter.save;let commits=0;DataAdapter.save=function(...args){if(++commits===8)throw new DOMException('synthetic quota','QuotaExceededError');return save.apply(this,args);};});
  await first.locator('[data-u4-approve]').click();await page.locator('[data-u4-match-apply]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('7 van 10 transacties goedgekeurd');
  await expect(page.locator('[data-u4-group-result]')).toContainText('2 niet geprobeerd');
  const partial=await inspect(page);expect(partial.approved).toBe(7);expect(partial.effects).toHaveLength(7);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect(page)).toEqual(partial);
  await page.evaluate(()=>FinizeUpdate4.openImportDetails(state.importSummaries[0].id));
  await page.locator('#u4ImportModalRoot details').evaluateAll(ns=>ns.forEach(n=>n.open=true));
  await expect(page.locator('[data-u4-select-approval]')).toHaveCount(3);
  for(const checkbox of await page.locator('[data-u4-select-approval]').all())await checkbox.check();
  await page.locator('[data-u4-approve-selection]').click();
  await expect.poll(()=>inspect(page)).toMatchObject({approved:10,bankSources:10});
  const result=await inspect(page);expect(result.effects).toHaveLength(10);expect(new Set(result.effects.map(r=>r.id)).size).toBe(10);
});

test('V117 individual approval finishes before subsequent close; no late reopening',async({page})=>{
  await boot(page);const first=await upload(page,false,[50]);
  await first.locator('[data-u4-field="category"]').selectOption('Boodschappen');
  await page.evaluate(()=>{
    const original=FinizeUpdate4Runtime.ImportStore.putJournal;
    FinizeUpdate4Runtime.ImportStore.putJournal=async function(record){
      if(record.operation==='import-command'&&record.status==='completed'){
        window.__v117AckWaiting=true;await new Promise(resolve=>window.__v117ReleaseAck=resolve);
      }
      return original.call(this,record);
    };
  });
  await first.locator('[data-u4-approve]').click();
  await page.waitForFunction(()=>window.__v117AckWaiting);
  expect(await page.locator('#u4ImportModalRoot').evaluate(node=>node.inert)).toBe(true);
  expect((await inspect(page)).approved).toBe(1);
  await page.evaluate(()=>__v117ReleaseAck());
  await page.locator('#u4ImportModalRoot > .u4-import-modal > header [data-u4-close]').click();
  await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect((await inspect(page)).approved).toBe(1);
});

async function installCloudDouble(page,entries=[]){
  await page.evaluate(entries=>{
    const docs=new Map(entries),ref={path:'budgetPlanners/finize'},metrics={coreWrites:0};
    const snapshot=reference=>({exists:()=>docs.has(reference.path),data:()=>structuredClone(docs.get(reference.path))});
    const firestore={
      doc:(_, ...parts)=>({path:parts.map(part=>part.path||part).join('/')}),getDoc:async reference=>snapshot(reference),
      setDoc:async(reference,value)=>docs.set(reference.path,structuredClone(value)),
      updateDoc:async(reference,value)=>docs.set(reference.path,{...docs.get(reference.path),...structuredClone(value)}),
      serverTimestamp:()=> 'v117-isolated-server-time',
      runTransaction:async(_,callback)=>{
        const writes=[],result=await callback({get:async reference=>snapshot(reference),set:(reference,value)=>writes.push([reference.path,structuredClone(value)])});
        for(const [path,value]of writes){docs.set(path,value);if(path===ref.path)metrics.coreWrites++;}return result;
      }
    };
    Object.assign(CloudAdapter,{db:{},docRef:ref,modules:{firestore},initialSyncComplete:true,cloudVersion:entries.length?null:0,pendingState:null,confirmedState:null,conflict:false});
    window.__v117Cloud={docs,ref,metrics};
  },entries);
}

test('V117 ten savings approvals survive existing cloud protocol and second browser client',async({page,browser})=>{
  page.on('console',message=>{if(message.type()==='error'||message.type()==='warning')console.log('V117 CLOUD',message.text());});
  await boot(page);const first=await upload(page,true);
  await first.locator('[data-u4-family]').selectOption('sparen');
  await first.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');
  await first.locator('[data-u4-field="savingsGoalId"]').selectOption('v117-goal');
  await first.locator('[data-u4-approve]').click();await page.locator('[data-u4-match-apply]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('10 van 10');
  const before=await inspect(page);await installCloudDouble(page);
  const exported=await page.evaluate(async()=>{
    if(!await CloudAdapter.saveNow(state))throw Error('Cloud protocol commit failed: '+JSON.stringify({status:CloudAdapter.status,conflict:CloudAdapter.conflict,diagnostics:FinizeImportSync.pendingDiagnostics,docs:[...__v117Cloud.docs.keys()]}));
    return {docs:[...__v117Cloud.docs],writes:__v117Cloud.metrics.coreWrites};
  });
  expect(exported.writes).toBe(1);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await context.newPage();await boot(second);await installCloudDouble(second,exported.docs);
    await second.evaluate(async()=>{
      const x=__v117Cloud,data=await CloudAdapter.cloudStore().hydrate(x.docs.get(x.ref.path));
      await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);
      await FinizeUpdate4.openImportDetails(state.importSummaries[0].id);
      await CloudAdapter.acceptRemote(data,migrateBudgetState(data.state),null);
    });
    expect(await inspect(second)).toEqual(before);
    expect(await second.evaluate(()=>__v117Cloud.metrics.coreWrites)).toBe(0);
    await second.reload();await second.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    expect(await inspect(second)).toEqual(before);
  }finally{await context.close();}
});
