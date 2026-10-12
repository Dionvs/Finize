const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),crypto=require('node:crypto');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const {installPerformanceMeter}=require('../helpers/indexeddb-performance-meter.cjs');
const {installWriteMeter}=require('../helpers/indexeddb-write-meter.cjs');
const phase=process.env.FINIZE_PERFORMANCE_PHASE||'after';
test.setTimeout(360000);
function fixture(count){
  const s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'budget-ov',post:'OV',bedrag:100},{id:'budget-other',post:'Overig',bedrag:200}]}];
  const rows=Array.from({length:count},(_,i)=>{const r=row('edit-'+i,'uitgave',-10,{category:'OV',budgetItemId:'budget-ov'});if(i>=20){r.bankOriginal.bankDate='2026-09-03';r.processing.processingDate='2026-09-03';}return r;});
  return {state:s,imports:[materialize(s,rows,'edit-batch')]};
}
async function edit(page,category){
  await page.evaluate(()=>FinizeUpdate4.openTransactionSource(state.transactions.find(r=>r.recordRole==='bank-source'&&r.importTransactionId==='edit-0').id));
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  const target=page.locator('[data-u4-row="edit-0"]');await target.locator('[data-u4-field="category"]').selectOption(category);await target.locator('[data-u4-approve]').click();
  if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('1 van 1 transacties goedgekeurd');
  await expect(page.locator('#u4ImportModalRoot')).toHaveJSProperty('inert',false);
}
test('P4.2 small read and CPU measurements: 20 and 100 sources, ten edits and ten savings approvals',async({browser})=>{
  const measurements=[];
  const output='backups/v117-stabilisatie/p42-performance-'+phase+'.json';
  const save=()=>fs.writeFileSync(output,JSON.stringify({phase,appSha256:crypto.createHash('sha256').update(fs.readFileSync('app.js')).digest('hex'),note:'CPU spans are nested; asynchronous request and transaction durations overlap and are not additive. Browser estimate is separate from submitted UTF-8 payload bytes.',measurements},null,2));
  for(const count of [20,100]){
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'}),page=await context.newPage();
    try{
      await installPerformanceMeter(page);const household=await newHousehold(),seed=fixture(count),sample={count,operations:[]};measurements.push(sample);
      let start=performance.now();await boot(page,household,seed.state);
      sample.operations.push({label:'startup',wallMs:performance.now()-start,...await page.evaluate(()=>idbPerformanceMeter.report('startup'))});await page.evaluate(()=>idbPerformanceMeter.stop());
      await page.evaluate(async batches=>{for(const b of batches)await FinizeUpdate4Runtime.ImportStore.putImport(b);},seed.imports);
      await attach(page,household,{initialize:true});await installWriteMeter(page);
      sample.begin=await page.evaluate(()=>navigator.storage.estimate());
      async function measure(label,action){
        await page.evaluate(label=>{idbPerformanceMeter.start(label);idbWriteMeter.start(label);},label);const start=performance.now();
        let result,error;
        try{result=await action();}catch(problem){error=problem;}finally{
          await page.evaluate(()=>{idbPerformanceMeter.stop();idbWriteMeter.stop();});
          sample.operations.push({label,wallMs:performance.now()-start,result,error:error?String(error):undefined,...await page.evaluate(label=>idbPerformanceMeter.report(label),label),writes:await page.evaluate(label=>idbWriteMeter.report(label),label)});save();console.log('P42_MEASURE '+JSON.stringify({phase,count,label,wallMs:sample.operations.at(-1).wallMs,partReads:sample.operations.at(-1).partReads}));
        }
        if(error)throw error;return result;
      }
      await measure('month',()=>page.evaluate(()=>p4.openMonth('2026-09')));await page.evaluate(()=>p4.openMonth('2026-10'));
      const original=await page.evaluate(()=>state.transactions.find(r=>r.recordRole==='bank-source'&&r.importTransactionId==='edit-0').bankOriginal);
      for(let i=0;i<10;i++){
        if(i===2)await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,r=>r.abort());
        await measure('edit-'+i,()=>edit(page,i%2===0?'Overig':'OV'));
        await page.locator('.u4-modal-head [data-u4-close]').click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
      }
      await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);await measure('sync-edits',()=>page.evaluate(()=>p4.sync()));
      await measure('savings-ten',()=>importTen(page,{goalId:'goal',prefix:'P42 ten '+count}));
      await expect(page.locator('[data-u4-group-result]')).toContainText('10 van 10 transacties goedgekeurd');
      await measure('sync-savings',()=>page.evaluate(()=>p4.sync()));
      const before=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());await page.evaluate(()=>p4.sync());expect(await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).toEqual(before);
      expect(JSON.parse(before.global.payload).bankSourceCount).toBe(count+10);
      expect(JSON.parse(before.global.payload).totalsCents.budgetImpact).toBe(count*1000);
      expect(JSON.parse(before.global.payload).totalsCents.savingsDeposit).toBe(75000);
      start=performance.now();await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
      sample.operations.push({label:'warm-startup',wallMs:performance.now()-start,...await page.evaluate(()=>idbPerformanceMeter.report('startup'))});await page.evaluate(()=>idbPerformanceMeter.stop());
      expect(await page.evaluate(()=>state.transactions.find(r=>r.recordRole==='bank-source'&&r.importTransactionId==='edit-0').bankOriginal)).toEqual(original);
      expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(750);
      sample.end=await page.evaluate(()=>navigator.storage.estimate());save();
    }finally{await context.close();}
  }
});
