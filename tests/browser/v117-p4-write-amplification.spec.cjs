const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {boot,attach,newHousehold}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const {installWriteMeter}=require('../helpers/indexeddb-write-meter.cjs');
const phase=process.env.FINIZE_WRITE_PHASE||'after';
test.setTimeout(180000);
test.use({actionTimeout:15000});
function fixture(count){
  const s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'budget-ov',post:'OV',bedrag:100},{id:'budget-other',post:'Overig',bedrag:200}]}];
  const rows=Array.from({length:20},(_,i)=>row('edit-'+i,'uitgave',-10,{category:'OV',budgetItemId:'budget-ov'}));
  const imports=[materialize(s,rows,'edit-batch')];
  if(count>20){const history=Array.from({length:count-20},(_,i)=>{const r=row('history-'+i,'uitgave',-10,{category:'OV',budgetItemId:'budget-ov'});r.bankOriginal.bankDate='2026-09-03';r.processing.processingDate='2026-09-03';return r;});imports.push(materialize(s,history,'history-batch'));}
  return {state:s,imports};
}
async function edit(page,category,{reopen=false}={}){
  if(reopen||!await page.locator('#u4ImportModalRoot.open [data-u4-row="edit-0"]').isVisible())await page.evaluate(()=>FinizeUpdate4.openTransactionSource(state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0').id));
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  const target=page.locator('[data-u4-row="edit-0"]');
  await target.locator('[data-u4-field="category"]').selectOption(category);await target.locator('[data-u4-approve]').click();
  if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
  try{await expect.poll(()=>page.evaluate(()=>state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0')?.approvedProcessing?.category)).toBe(category);}catch(error){console.log('EDIT_FAILURE '+JSON.stringify(await page.evaluate(async()=>({source:state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0'),conflict:await FinizeUpdate4.importStore.getJournal('conflict-edit-batch'),batch:await FinizeUpdate4.importStore.getImport('edit-batch'),feedback:document.querySelector('[data-u4-group-result]')?.textContent,notice:document.querySelector('[data-u4-local-notice]')?.textContent}))));throw error;}
  await expect(page.locator('[data-u4-group-result]')).toContainText('1 van 1 transacties goedgekeurd');
  await expect(page.locator('#u4ImportModalRoot')).toHaveJSProperty('inert',false);
}
test('P4 repeated edits: ten commits on the same bank source with 20 and 100 movements',async({browser},testInfo)=>{
  // Includes native write observation and a complete small-store inventory
  // after every commit; this is deliberately outside the latency benchmark.
  test.setTimeout(360000);
  const measurements=[];
  for(const count of [20,100]){
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'}),page=await context.newPage();
    try{
      const f=await newHousehold(),seed=fixture(count);await boot(page,f,seed.state);
      await page.evaluate(async imports=>{for(const batch of imports)await FinizeUpdate4Runtime.ImportStore.putImport(batch);},seed.imports);
      await attach(page,f,{initialize:true});
      // Load history in both fixtures; the target, import, planning and ten edits are identical.
      await page.evaluate(()=>p4.openMonth('2025-02'));await page.evaluate(()=>p4.openMonth('2026-10'));
      const baseline=await page.evaluate(async()=>({usage:await DataAdapter.store().cache.usage(),original:state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0').bankOriginal,total:FinizeTransactions.total('budgetImpact'),sources:JSON.parse((await p4.cloudStore.verifyIntegrity()).global.payload).bankSourceCount}));
      await installWriteMeter(page);const commits=[];
      for(let i=0;i<10;i++){
        if(phase==='after'&&i===2)await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,route=>route.abort());
        const label='edit-'+i;await page.evaluate(label=>idbWriteMeter.start(label),label);
        const started=performance.now();
        await edit(page,i%2===0?'Overig':'OV');
        await page.evaluate(()=>idbWriteMeter.stop());
        const approvalMs=performance.now()-started;
        commits.push({...await page.evaluate(async label=>{
          const durable=await DataAdapter.readDurableState(),target=durable.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0');
          return {...await idbWriteMeter.report(label),outcome:'committed',storageRevision:DataAdapter.store().head.storageRevision,durableTarget:{id:target.id,processingRevision:target.processingRevision,category:target.approvedProcessing.category,bankOriginal:target.bankOriginal},storedPayload:await DataAdapter.store().cache.usage()};
        },label),approvalMs});
        expect(commits.at(-1).durableTarget.category).toBe(i%2===0?'Overig':'OV');
        expect(commits.at(-1).durableTarget.bankOriginal).toEqual(baseline.original);
        fs.writeFileSync('backups/v117-stabilisatie/p4-repeated-edits-progress.json',JSON.stringify({phase,count,completed:i+1,commits},null,2));
        console.log('P4_EDIT '+JSON.stringify({count,edit:i+1,approvalMs,bytes:commits.at(-1).bytes}));
      }
      const end=await page.evaluate(async()=>({usage:await DataAdapter.store().cache.usage(),original:state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0').bankOriginal,total:FinizeTransactions.total('budgetImpact'),sources:state.transactions.filter(row=>row.recordRole==='bank-source').length,effects:FinizeTransactions.effects({month:'2026-10'}).length}));
      expect(end.original).toEqual(baseline.original);expect(end.total).toBe(baseline.total);expect(baseline.sources).toBe(count);expect(end.effects).toBe(20);
      await page.locator('.u4-modal-head [data-u4-close]').click();
      await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact'))).toBe(baseline.total);
      if(phase==='after'){
        await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);await attach(page,f);
        expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
        const once=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());await page.evaluate(()=>p4.sync());
        expect(await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).toEqual(once);
        expect(JSON.parse(once.global.payload).bankSourceCount).toBe(count);
        expect(JSON.parse(once.global.payload).totalsCents.budgetImpact).toBe(count*1000);
      }
      measurements.push({count,baseline,end,commits});
    }finally{await context.close();}
  }
  const output='backups/v117-stabilisatie/p4-repeated-edits-'+phase+'.json';
  fs.writeFileSync(output,JSON.stringify({phase,appSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('app.js')).digest('hex'),measurement:'UTF-8 JSON submitted to native IndexedDB; origin estimate separately measured',measurements},null,2));
  await testInfo.attach('write-amplification-'+phase,{path:output,contentType:'application/json'});
  console.log('P4_REPEATED_EDITS '+JSON.stringify(measurements.map(({count,commits})=>({count,bytes:commits.map(row=>row.bytes),writes:commits.map(row=>row.attempted)}))));
  if(phase==='after'){
    for(const {commits}of measurements)for(const commit of commits){expect(commit.completed).toBe(commit.attempted);for(const [store,stats]of Object.entries(commit.stores))expect(stats.unchangedWrites,store+' rewrote unchanged data').toBe(0);}
    for(const {commits}of measurements)for(const commit of commits)for(const row of commit.writes.filter(row=>row.store==='financialRecords'&&String(row.key).startsWith('["transactions",')))expect(['["transactions","tx-edit-0"]','["transactions","source-bank-edit-batch:edit-0"]']).toContain(row.key);
    // Metadata/ID lengths may differ; extra history may not add material write payload.
    const maxima=measurements.map(m=>Math.max(...m.commits.map(c=>c.bytes)));
    expect(maxima[1]).toBeLessThanOrEqual(maxima[0]+16384);
  }
});

test('P4 repeated edits: reopen, rollback failure, lost acknowledgment and offline replay preserve one effect',async({page,browser})=>{
  page.on('console',message=>{if(message.type()==='warning'||message.type()==='error')console.log('P4_EDIT_RECOVERY '+message.text());});
  const f=await newHousehold(),seed=fixture(20);await boot(page,f,seed.state);
  await page.evaluate(async imports=>{for(const batch of imports)await FinizeUpdate4Runtime.ImportStore.putImport(batch);},seed.imports);
  await attach(page,f,{initialize:true});
  const inspect=()=>page.evaluate(async()=>({state:await DataAdapter.readDurableState(),batch:await FinizeUpdate4.importStore.getImport('edit-batch'),total:FinizeTransactions.total('budgetImpact'),effects:FinizeTransactions.effects({month:'2026-10'}).map(row=>row.id).sort()}));
  await edit(page,'Overig');await page.locator('.u4-modal-head [data-u4-close]').click();
  await edit(page,'OV',{reopen:true});await page.locator('.u4-modal-head [data-u4-close]').click();
  const before=await inspect();
  await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,route=>route.abort());
  await page.evaluate(async()=>{
    const put=IDBObjectStore.prototype.put;
    window.restoreEditFault=()=>{IDBObjectStore.prototype.put=put;};
    IDBObjectStore.prototype.put=function(row,...args){
      if(this.name==='financialRecords'||this.name==='journal'&&row.status==='rolled-back'){this.transaction.abort();throw new DOMException('edit commit and rollback unavailable','QuotaExceededError');}
      return put.call(this,row,...args);
    };
    await FinizeUpdate4.openTransactionSource(state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0').id);
  });
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  const target=page.locator('[data-u4-row="edit-0"]');await target.locator('[data-u4-field="category"]').selectOption('Overig');await target.locator('[data-u4-approve]').click();
  if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('0 van 1 transacties goedgekeurd');
  expect(await inspect()).toEqual(before);
  await page.evaluate(()=>restoreEditFault());await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await inspect()).toEqual(before);
  await page.evaluate(()=>{
    const store=DataAdapter.store(),commit=store.commit;window.editCommitCount=0;
    store.commit=async function(...args){window.editCommitCount++;const value=await commit.apply(this,args);throw new Error('lost existing-edit acknowledgment');};
    window.restoreEditAcknowledgment=()=>{store.commit=commit;};
  });
  await edit(page,'Overig');expect(await page.evaluate(()=>editCommitCount)).toBe(1);await page.evaluate(()=>restoreEditAcknowledgment());
  const after=await inspect();expect(after.total).toBe(before.total);expect(after.effects).toEqual(before.effects);
  expect(after.state.transactions.filter(row=>row.recordRole==='bank-source').map(row=>row.bankOriginal)).toEqual(before.state.transactions.filter(row=>row.recordRole==='bank-source').map(row=>row.bankOriginal));
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect()).toEqual(after);
  await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);await attach(page,f);expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
  const once=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());await page.evaluate(()=>p4.sync());expect(await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).toEqual(once);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{const second=await context.newPage();await boot(second,f);await attach(second,f);
    expect(await second.evaluate(()=>FinizeTransactions.total('budgetImpact'))).toBe(before.total);
    expect(await second.evaluate(()=>state.transactions.find(row=>row.recordRole==='bank-source'&&row.importTransactionId==='edit-0').approvedProcessing.category)).toBe('Overig');
    expect(await second.evaluate(()=>FinizeTransactions.effects({month:'2026-10'}).length)).toBe(20);
  }finally{await context.close();}
});
