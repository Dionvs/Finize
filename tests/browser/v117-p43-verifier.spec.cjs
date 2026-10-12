
const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const fs=require('node:fs');
test('P4.3 small verifier uses source identities after ten savings approvals',async({page})=>{
  test.setTimeout(120000);const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};materialize(s,Array.from({length:20},(_,i)=>row('verifier-'+i,'uitgave',-10)),'verifier-base');
  await boot(page,f,s);await attach(page,f,{initialize:true});
  const before=await page.evaluate(()=>state.transactions.filter(r=>r.recordRole==='bank-source').map(r=>r.id));
  const approval=await importTen(page,{goalId:'goal',prefix:'P4 bulk 0'});
  const local=await page.evaluate(async before=>{const durable=await DataAdapter.readDurableState(),old=new Set(before),sources=durable.transactions.filter(r=>r.recordRole==='bank-source'&&!old.has(r.id)),ids=new Set(sources.map(r=>r.bankSourceId));return {sources,effects:durable.transactions.filter(r=>r.recordRole!=='bank-source'&&ids.has(r.bankSourceId)),wrongEffectLookup:durable.transactions.filter(r=>r.recordRole!=='bank-source'&&sources.some(s=>s.id===r.bankSourceId)).length,oldTextFilter:durable.transactions.filter(r=>r.recordRole==='bank-source'&&r.bankOriginal?.description==='P4 bulk 0').length,savings:FinizeTransactions.total('savingsDeposit',{month:'2026-10'})};},before);
  console.log('P43_VERIFIER '+JSON.stringify({sources:local.sources.length,effects:local.effects.length,oldTextFilter:local.oldTextFilter,first:local.sources[0]}));
  expect(local.sources).toHaveLength(10);expect(local.effects).toHaveLength(10);expect(local.wrongEffectLookup).toBe(0);expect(local.sources.map(r=>r.id)).toEqual(approval.sourceIds);expect(local.savings).toBe(750);
  expect(local.sources.map(r=>r.bankOriginal.amount).sort((a,b)=>a-b)).toEqual([-50,-100,-75,-25,-200,-40,-60,-90,-30,-80].sort((a,b)=>a-b));
  for(const r of local.sources){expect(r.processingStatus).toBe('goedgekeurd');expect(r.approvedProcessing.savingsGoalId).toBe('goal');}
  expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');const cloud=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());expect(JSON.parse(cloud.global.payload).bankSourceCount).toBe(30);expect(JSON.parse(cloud.global.payload).totalsCents.savingsDeposit).toBe(75000);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(750);
  fs.writeFileSync('backups/v117-stabilisatie/p43-small-verifier.json',JSON.stringify({appSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('app.js')).digest('hex'),approval,local,cloudGlobal:cloud.global},null,2));
});
