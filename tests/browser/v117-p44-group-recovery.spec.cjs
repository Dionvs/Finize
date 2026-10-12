const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const fs=require('node:fs');
for(const count of [20,100])test(`P4.4 ${count} sources: native failure at approval eight, restart and retry preserve seven durable successes`,async({page,browser})=>{
  test.setTimeout(180000);const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  materialize(s,Array.from({length:count},(_,i)=>row('original-'+i,'uitgave',-10)),'original');
  await boot(page,f,s);await attach(page,f,{initialize:true});
  await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,route=>route.abort());
  const partial=await importTen(page,{goalId:'goal',expectedCount:7,prefix:'P44 failure '+count,beforeApprove:()=>page.evaluate(()=>{
    let receipts=0;const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(row,...args){
      if(this.name==='operationReceipts'&&row.outcome==='committed'&&++receipts===8){this.transaction.abort();throw new DOMException('P44 native commit eight unavailable','QuotaExceededError');}
      return put.call(this,row,...args);
    };
  })});
  await expect(page.locator('[data-u4-group-result]')).toContainText('2 niet geprobeerd');
  const inspect=()=>page.evaluate(async ids=>{
    const durable=await DataAdapter.readDurableState(),sources=durable.transactions.filter(r=>r.recordRole==='bank-source'&&ids.includes(r.id)),bankIds=new Set(sources.map(r=>r.bankSourceId));
    return {sources,effects:durable.transactions.filter(r=>r.recordRole!=='bank-source'&&bankIds.has(r.bankSourceId)),budget:FinizeTransactions.total('budgetImpact'),savings:FinizeTransactions.total('savingsDeposit'),batchId:sources[0].importBatchId};
  },partial.sourceIds);
  const beforeRestart=await inspect();expect(beforeRestart.sources.filter(r=>r.processingStatus==='goedgekeurd')).toHaveLength(7);expect(beforeRestart.effects).toHaveLength(7);expect(beforeRestart.budget).toBe(count*10);expect(beforeRestart.savings).toBe(beforeRestart.sources.filter(r=>r.processingStatus==='goedgekeurd').reduce((sum,r)=>sum+Math.abs(r.bankOriginal.amount),0));
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect()).toEqual(beforeRestart);
  await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),beforeRestart.batchId);
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  await expect(page.locator('[data-u4-select-approval]')).toHaveCount(3);
  // Unattempted sources retain their previous durable choices. Explicitly choose
  // the shared destination again; selecting alone must never invent that choice.
  const remaining=page.locator('[data-u4-row]').filter({has:page.locator('[data-u4-select-approval]')}).first();
  await remaining.locator('[data-u4-family]').selectOption('sparen');await remaining.locator('[data-u4-field="transactionType"]').selectOption('naar-spaarrekening');await remaining.locator('[data-u4-field="savingsGoalId"]').selectOption('goal');
  await remaining.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-apply]')).toHaveText('Geselecteerde transacties goedkeuren (3)');await page.locator('[data-u4-match-apply]').click();
  await expect(page.locator('[data-u4-group-result]')).toContainText('3 van 3 transacties goedgekeurd');
  const final=await inspect();expect(final.sources.filter(r=>r.processingStatus==='goedgekeurd')).toHaveLength(10);expect(final.effects).toHaveLength(10);expect(new Set(final.effects.map(r=>r.id)).size).toBe(10);expect(final.savings).toBe(750);expect(final.budget).toBe(count*10);
  expect(final.sources.map(r=>r.bankOriginal)).toEqual(beforeRestart.sources.map(r=>r.bankOriginal));
  await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);await attach(page,f);const syncStarted=performance.now();expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');const cloudMs=performance.now()-syncStarted;
  const once=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());expect(JSON.parse(once.global.payload).bankSourceCount).toBe(count+10);expect(JSON.parse(once.global.payload).totalsCents.savingsDeposit).toBe(75000);await page.evaluate(()=>p4.sync());expect(await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).toEqual(once);
  const secondContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{const second=await secondContext.newPage();await boot(second,f);await attach(second,f);expect(await second.evaluate(()=>FinizeTransactions.total('savingsDeposit'))).toBe(750);expect(await second.evaluate(()=>FinizeTransactions.total('budgetImpact'))).toBe(count*10);
    expect(await second.evaluate(ids=>state.transactions.filter(r=>r.recordRole==='bank-source'&&ids.includes(r.id)),partial.sourceIds)).toEqual(final.sources);
  }finally{await secondContext.close();}
  fs.writeFileSync(`backups/v117-stabilisatie/p44-group-recovery-${count}.json`,JSON.stringify({appSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('app.js')).digest('hex'),partial,beforeRestart,final,cloudMs,cloudGlobal:once.global},null,2));
});
