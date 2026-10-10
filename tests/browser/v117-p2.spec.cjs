const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60000);
async function boot(page){
  page.on('dialog',dialog=>dialog.accept());await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',route=>route.abort());await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.addInitScript(state=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(state));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>commitChange(()=>{state.meta.selectedMonth='2026-10';state.monthRecords={};state.transactions=[];state.importSummaries=[];state.activeImportId='';state.recognitionRules=[];state.accountProfiles=[{id:'joint',accountOwner:'gezamenlijk',name:'Gezamenlijk',identifier:'NL01JOINT'}];}));
}
async function upload(page,count=1){
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  await page.locator('[data-u4-file]').setInputFiles({name:'quota.csv',mimeType:'text/csv',buffer:Buffer.from('Datum;Omschrijving;Rekening;Bedrag\n'+Array.from({length:count},(_,i)=>`2026-10-${String(i%3+1).padStart(2,'0')};P2 test;NL01JOINT;-${35+i}`).join('\n'))});
  await expect(page.locator('[data-u4-row]')).toHaveCount(count);
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  await page.locator('[data-u4-field="category"]').first().selectOption('Overig');
}
async function durable(page){return page.evaluate(async()=>({state:await DataAdapter.readDurableState(),batch:await FinizeUpdate4.importStore.getImport(state.importSummaries[0].id)}));}

test('V117 P2 migration readback is verified and original localStorage remains byte-identical',async({page})=>{
  await boot(page);const result=await page.evaluate(async()=>{
    const raw=localStorage.getItem('finize-budget-planner-v1'),stored=await DataAdapter.readDurableState();
    return {raw,same:JSON.stringify(stored)===JSON.stringify(state),head:DataAdapter.store().head,bytes:new TextEncoder().encode(JSON.stringify(stored)).length};
  });
  expect(result.raw).toBe(JSON.stringify(fixture));expect(result.same).toBe(true);expect(result.head.verified).toBe(true);expect(result.head.storageVersion).toBe(1);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>localStorage.getItem('finize-budget-planner-v1'))).toBe(result.raw);
  expect(await page.evaluate(()=>state.meta.selectedMonth)).toBe('2026-10');
});

test('V117 P2 actual full localStorage does not block ten durable CSV group approvals',async({page})=>{
  await boot(page);await upload(page,10);const originals=(await durable(page)).batch.rows.map(row=>row.bankOriginal);
  const filled=await page.evaluate(()=>{
    let count=0,name='';try{for(;count<30;count++)localStorage.setItem('v117-full-'+count,'x'.repeat(524288));}catch(error){name=error.name;}
    const original=Storage.prototype.setItem;window.__p2MainWrites=0;
    Storage.prototype.setItem=function(key,value){if(key==='finize-budget-planner-v1'){window.__p2MainWrites++;throw new DOMException('full localStorage','QuotaExceededError');}return original.call(this,key,value);};
    return {count,name};
  });
  expect(filled.name).toBe('QuotaExceededError');
  await page.locator('[data-u4-approve]').first().click();await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (10)');await page.locator('[data-u4-match-apply]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('10 van 10');
  expect(await page.evaluate(()=>({writes:__p2MainWrites,total:FinizeTransactions.total('budgetImpact',{month:'2026-10'})}))).toEqual({writes:0,total:395});
  const committed=await durable(page);expect(committed.batch.rows.map(row=>row.bankOriginal)).toEqual(originals);
  expect(committed.state.transactions.filter(tx=>tx.recordRole==='bank-source')).toHaveLength(10);
  const effects=committed.state.transactions.filter(tx=>tx.recordRole!=='bank-source');expect(effects).toHaveLength(10);expect(new Set(effects.map(tx=>tx.bankSourceId)).size).toBe(10);
  const before=await durable(page);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await durable(page)).toEqual(before);
});

for(const boundary of ['financialRecords','financialHead','imports','syncQueue','operationReceipts','financialOutbox','journal'])test(`V117 P2 IndexedDB abort at ${boundary} leaves all financial components unchanged`,async({page})=>{
  await boot(page);await upload(page);const before=await durable(page);
  await page.evaluate(boundary=>{
    const original=IDBObjectStore.prototype.put;window.__p2Restore=()=>{IDBObjectStore.prototype.put=original;};
    IDBObjectStore.prototype.put=function(record,...args){
      if(this.name===boundary&&(boundary!=='journal'||record.status==='completed')){this.transaction.abort();throw new DOMException('injected IndexedDB quota','QuotaExceededError');}
      return original.call(this,record,...args);
    };
  },boundary);
  await page.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-group-result]')).toContainText('0 van 1');
  expect(await durable(page)).toEqual(before);
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(0);
  await page.evaluate(()=>__p2Restore());await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await durable(page)).toEqual(before);
});

test('V117 P2 candidate remains unpublished until durable transaction completion',async({page})=>{
  await boot(page);const result=await page.evaluate(async()=>{
    const storage=DataAdapter.store(),original=storage.commit,before=JSON.stringify(state);let release;
    storage.commit=async function(...args){await new Promise(resolve=>release=resolve);return original.apply(this,args);};
    const pending=commitChange(()=>state.unknownDeferredFinancialSetting='confirmed only');
    while(!release)await new Promise(resolve=>setTimeout(resolve,1));
    const unpublished=JSON.stringify(state)===before;release();const ok=await pending;storage.commit=original;
    return {unpublished,ok,value:state.unknownDeferredFinancialSetting,durable:(await DataAdapter.readDurableState()).unknownDeferredFinancialSetting};
  });
  expect(result).toEqual({unpublished:true,ok:true,value:'confirmed only',durable:'confirmed only'});
});

test('V117 P2 month picker waits for the year commit before accepting a month',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const store=DataAdapter.store(),original=store.commit;
    store.commit=async function(...args){await new Promise(resolve=>window.__p2ReleaseMonth=resolve);store.commit=original;return original.apply(this,args);};
  });
  await page.locator('#monthPickerButton').click();await page.locator('[data-month-year="2027"]').click();
  await page.waitForFunction(()=>window.__p2ReleaseMonth);
  expect(await page.evaluate(()=>getSelectedMonth())).toBe('2026-10');
  await expect(page.locator('#monthPickerPanel button:enabled')).toHaveCount(0);
  await page.evaluate(()=>window.__p2ReleaseMonth());await expect.poll(()=>page.evaluate(()=>getSelectedMonth())).toBe('2027-10');
  await page.locator('[data-month-value="2027-09"]').click();await expect.poll(()=>page.evaluate(()=>getSelectedMonth())).toBe('2027-09');
  expect(await page.evaluate(async()=>(await DataAdapter.readDurableState()).meta.selectedMonth)).toBe('2027-09');
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>getSelectedMonth())).toBe('2027-09');
});

test('V117 P2 browser close with pending approval never executes it during restart',async({page,context})=>{
  await boot(page);await upload(page);const before=await durable(page);
  await page.evaluate(()=>{DataAdapter.save=async()=>{window.__p2PendingApproval=true;await new Promise(()=>{});};});
  await page.locator('[data-u4-approve]').click();await page.waitForFunction(()=>window.__p2PendingApproval);
  await page.close();const restarted=await context.newPage();
  await restarted.route('https://www.gstatic.com/**',r=>r.abort());await restarted.route('https://firestore.googleapis.com/**',r=>r.abort());
  await restarted.goto('/');await restarted.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await durable(restarted)).toEqual(before);
  const recovery=await restarted.evaluate(()=>FinizeUpdate4.importStore.listJournal());
  expect(recovery.map(({operation,status,intent})=>({operation,status,intent:intent?.type}))).toContainEqual({operation:'import-command',status:'rolled-back',intent:expect.any(String)});
  expect(await restarted.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(0);
  await restarted.evaluate(()=>FinizeUpdate4.openImportDetails(state.importSummaries[0].id));
  await restarted.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  await restarted.locator('[data-u4-field="category"]').selectOption('Overig');await restarted.locator('[data-u4-approve]').click();
  await expect(restarted.locator('[data-u4-group-result]')).toContainText('1 van 1');
  expect(await restarted.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(35);
});

test('V117 P2 IndexedDB abort plus failed rollback registration cannot execute a rejected intent on restart',async({page})=>{
  await boot(page);await upload(page);const before=await durable(page);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(record,...args){
      if(this.name==='financialRecords'||this.name==='journal'&&record.status==='rolled-back'){this.transaction.abort();throw new DOMException('commit and rollback registration both unavailable','QuotaExceededError');}
      return original.call(this,record,...args);
    };
  });
  await page.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-group-result]')).toContainText('0 van 1');
  expect(await durable(page)).toEqual(before);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await durable(page)).toEqual(before);expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(0);
});

test('V117 P2 18 MiB administration commits to actual IndexedDB and reloads without rewriting unchanged payload',async({page})=>{
  test.setTimeout(90000);await boot(page);
  const result=await page.evaluate(async()=>{
    const started=performance.now();
    const first=await commitChange(()=>{state.longHistoricalArchive={preservedOriginal:'e'.repeat(18*1024*1024)};});
    const commitMs=performance.now()-started,store=DataAdapter.store(),largeHash=store.head.sha256;
    const put=IDBObjectStore.prototype.put;let archiveWrites=0;
    IDBObjectStore.prototype.put=function(record,...args){if(this.name==='financialRecords'&&record.collection==='longHistoricalArchive')archiveWrites++;return put.call(this,record,...args);};
    const approvalStart=performance.now(),second=await commitChange(()=>state.revisionAfterLargeArchive='kept'),changeMs=performance.now()-approvalStart;
    IDBObjectStore.prototype.put=put;
    return {first,second,commitMs,changeMs,archiveWrites,bytes:new TextEncoder().encode(JSON.stringify(state)).length,largeHash,hash:store.head.sha256};
  });
  expect(result.first).toBe(true);expect(result.second).toBe(true);expect(result.bytes).toBeGreaterThan(18*1024*1024);expect(result.archiveWrites).toBe(0);expect(result.hash).not.toBe(result.largeHash);
  const start=Date.now();await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>state.longHistoricalArchive.preservedOriginal.length)).toBe(18*1024*1024);expect(await page.evaluate(()=>state.revisionAfterLargeArchive)).toBe('kept');
  console.log('V117 P2 LARGE '+JSON.stringify({...result,reloadMs:Date.now()-start,browser:await page.evaluate(()=>navigator.userAgent)}));
});
