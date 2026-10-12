const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const {savingsSourceProof,assertSavingsSourceProof}=require('../helpers/v117-source-proof.cjs');
const fs=require('node:fs');

test('P4.4 release: pending group stays visibly busy and duplicate clicks cannot approve twice',async({page})=>{
  test.setTimeout(180000);
  const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  materialize(s,Array.from({length:20},(_,i)=>row('busy-original-'+i,'uitgave',-10)),'busy-original');
  await boot(page,f,s);await attach(page,f,{initialize:true});
  const operation=importTen(page,{goalId:'goal',prefix:'P44 busy',beforeApprove:()=>page.evaluate(()=>{
    const store=DataAdapter.store(),commit=store.commit;
    window.p44CommitCalls=0;window.p44Held=false;
    const gate=new Promise(resolve=>window.p44Release=resolve);
    store.commit=async(...args)=>{
      if(++window.p44CommitCalls===1){window.p44Held=true;await gate;}
      return commit.apply(store,args);
    };
  })});
  // Observe the real UI while its first financial commit is still pending.
  try{
    await page.waitForFunction(()=>window.p44Held);
    await expect(page.locator('[data-u4-match-feedback]')).toContainText('afzonderlijk opgeslagen');
    await expect(page.locator('[data-u4-match-apply]')).toBeDisabled();
    await expect(page.locator('[data-u4-match-close]')).toBeDisabled();
    expect(await page.locator('#u4ImportModalRoot').evaluate(node=>node.inert)).toBe(true);
    expect(await page.locator('[data-u4-group-result]').count()).toBe(0);
    await page.evaluate(()=>{
      const button=document.querySelector('[data-u4-match-apply]');
      button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    });
    expect(await page.evaluate(()=>window.p44CommitCalls)).toBe(1);
    const pending=await page.evaluate(async()=>{
      const durable=await DataAdapter.readDurableState();
      return durable.transactions.filter(r=>r.recordRole==='bank-source'&&p4ApprovalClock.sourceIds.includes(r.id)&&r.processingStatus==='goedgekeurd').length;
    });
    expect(pending).toBe(0);
  }finally{await page.evaluate(()=>window.p44Release?.());}
  const approved=await operation;
  expect(new Set(approved.commits.map(r=>r.operationId)).size).toBe(10);
  const proof=await savingsSourceProof(page,approved.sourceIds);assertSavingsSourceProof(proof,10,approved.originals);
  expect(proof.savings).toBe(750);
  expect(await page.evaluate(()=>window.p44CommitCalls)).toBe(10);
  expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);
  expect(await savingsSourceProof(page,approved.sourceIds)).toEqual(proof);
  fs.writeFileSync('backups/v117-stabilisatie/p44-visible-busy-proof.json',JSON.stringify({approved,proof,pendingApproved:0,duplicateClicks:2},null,2));
});

test('P4.4 release: completed 500-source household survives real offline PWA restart and repeated synchronization',async({browser})=>{
  test.setTimeout(180000);
  const evidence='backups/v117-stabilisatie/p44-scale-3.json';
  if(!fs.existsSync(evidence))throw Error('Run the verified 500-source gate before this recovery check.');
  const previous=JSON.parse(fs.readFileSync(evidence,'utf8'));
  expect(previous.financiallyVerified).toBe(true);
  const f={householdId:previous.householdId,email:previous.householdId+'@example.invalid'};
  const ids=previous.sourceProof.sources.map(r=>r.id),originals=previous.sourceProof.sources.map(r=>({id:r.id,bankOriginal:r.bankOriginal}));
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'allow'});
  try{
    const page=await context.newPage();await boot(page,f);
    await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active&&navigator.serviceWorker.controller;});
    await attach(page,f);
    const before=await savingsSourceProof(page,ids);assertSavingsSourceProof(before,11,originals);expect(before).toEqual(previous.sourceProof);
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
    const offline=await savingsSourceProof(page,ids);expect(offline).toEqual(before);
    await context.setOffline(false);await attach(page,f);
    expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
    expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
    expect(await savingsSourceProof(page,ids)).toEqual(before);
    fs.writeFileSync('backups/v117-stabilisatie/p44-500-offline-proof.json',JSON.stringify({householdId:f.householdId,offline,sourceCount:await page.evaluate(()=>state.transactions.filter(r=>r.recordRole==='bank-source').length),repeatedSync:'idle'},null,2));
  }finally{await context.close();}
});
