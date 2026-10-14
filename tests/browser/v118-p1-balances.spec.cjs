const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60000);
async function boot(page,width=390){
  await page.setViewportSize({width,height:900});
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',route=>route.abort());
  await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.addInitScript(state=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(state));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(async()=>{
    await commitChange(()=>{state.meta.selectedMonth='2026-10';state.monthRecords={};state.transactions=[];state.importSummaries=[];state.activeImportId='';state.recognitionRules=[];state.accountProfiles=[{id:'joint',accountOwner:'gezamenlijk',name:'Gezamenlijke betaalrekening',identifier:'NL91ABNA0417164300',accountType:'payment',status:'active'}];});
    const u=window.FinizeUpdate4Runtime;
    const batch=u.createImportDraft({id:'p1-bank',text:'Datum;Omschrijving;Rekening;Bedrag\n2026-10-11;Boodschappen;NL91ABNA0417164300;-100.00',profiles:state.accountProfiles,entryOwner:'gezamenlijk',today:'2026-10-13'});
    await u.persistImportDraft(window,batch,{syncCloud:false});
    window.__p1Before={transactions:structuredClone(state.transactions),forecast:FinizeTransactions.forecast('2026-10'),goals:structuredClone(state.spaardoelen)};
  });
  await open(page);
}
async function open(page){await page.evaluate(()=>openBankAccountDetails('joint'));await expect(page.locator('[data-balance-add]')).toBeVisible();}
async function enter(page,amount,date){
  await page.locator('[data-balance-add]').click();await page.locator('[data-balance-amount]').fill(amount);await page.locator('[data-balance-date]').fill(date);
  await page.locator('[data-balance-check]').click();await expect(page.locator('[data-balance-confirm]')).toBeVisible();
}
const checkpoints=page=>page.evaluate(()=>state.balanceCheckpoints||[]);
for(const width of [1440,390,320])test(`P1 ${width}px invoeren vergelijken corrigeren herladen en validatie`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);
  await page.locator('[data-accounts-back]').click();
  await page.locator('[data-account-open="joint"]').click();
  await expect(page.locator('[data-balance-add]')).toBeVisible();
  await expect(page.locator('[data-balance-value]')).toHaveText('Onbekend');
  await enter(page,'1000','2026-10-10');await page.locator('[data-balance-confirm]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('900,00');await expect(page.locator('[data-balance-status]')).toHaveText('Voorlopig');
  await page.locator('.balance-explanation').evaluate(node=>node.open=true);await expect(page.locator('.balance-explanation')).toContainText('Nakijken');
  await enter(page,'875','2026-10-12');
  await expect(page.locator('[data-balance-comparison]')).toContainText('900,00');await expect(page.locator('[data-balance-comparison]')).toContainText('-25,00');
  await page.locator('[data-balance-comparison]').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath(`comparison-${width}.png`)});
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('.balance-form,.balance-account,.u4-import-modal')].some(el=>el.scrollWidth>el.clientWidth+1));expect(overflow).toBe(false);
  await page.locator('[data-balance-confirm]').click();await expect.poll(()=>checkpoints(page)).toHaveLength(2);
  await page.locator('.balance-history').evaluate(node=>node.open=true);
  await page.locator('[data-balance-correct]').first().click();await expect(page.locator('[data-balance-date]')).toBeEditable();
  await page.locator('[data-balance-amount]').fill('880');await page.locator('[data-balance-check]').click();await page.locator('[data-balance-confirm]').click();
  await expect.poll(()=>checkpoints(page)).toHaveLength(3);
  const stored=await checkpoints(page);expect(stored[2].supersedesId).toBe(stored[1].id);expect(stored[2].revision).toBe(2);
  expect(await page.evaluate(()=>({transactions:state.transactions,forecast:FinizeTransactions.forecast('2026-10'),goals:state.spaardoelen}))).toEqual(await page.evaluate(()=>__p1Before));
  expect(await page.evaluate(async()=>(await DataAdapter.readDurableState()).balanceCheckpoints)).toEqual(stored);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await open(page);
  await expect(page.locator('[data-balance-value]')).toContainText('880,00');expect(await checkpoints(page)).toEqual(stored);
  await page.locator('[data-balance-add]').click();await page.locator('[data-balance-amount]').fill('12.345');await page.locator('[data-balance-check]').click();await expect(page.locator('[data-balance-confirm]')).toBeHidden();
  await page.locator('[data-balance-amount]').fill('900');await page.locator('[data-balance-date]').fill('2026-10-12');await page.locator('[data-balance-check]').click();await expect(page.locator('[data-balance-error]')).toContainText('Corrigeren');
  await page.locator('[data-balance-cancel]').click();await page.locator('.balance-history').evaluate(node=>node.open=true);
  await page.locator('.balance-history').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath(`history-${width}.png`)});
  expect(errors).toEqual([]);
});
test('P1 real IndexedDB abort retains old state, then same operation retry commits once',async({page})=>{
  await boot(page);await enter(page,'1000','2026-10-10');
  const before=await page.evaluate(async()=>DataAdapter.readDurableState());
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__p1Restore=()=>IDBObjectStore.prototype.put=original;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='financialRecords'&&value.collection==='balanceCheckpoints'){this.transaction.abort();throw new DOMException('P1 opslagtest','QuotaExceededError');}return original.call(this,value,...args);};});
  await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-error]')).not.toBeEmpty();
  expect(await checkpoints(page)).toEqual([]);expect(await page.evaluate(async()=>DataAdapter.readDurableState())).toEqual(before);
  await page.evaluate(()=>__p1Restore());await page.locator('[data-balance-confirm]').click();await expect.poll(()=>checkpoints(page)).toHaveLength(1);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await checkpoints(page)).toHaveLength(1);
});
test('P1 lost acknowledgement is reconciled through existing operation receipt',async({page})=>{
  await boot(page);await enter(page,'-25','2026-10-10');
  await page.evaluate(()=>{const store=DataAdapter.store(),original=store.commit;store.commit=async function(...args){await original.apply(this,args);store.commit=original;throw new Error('P1 lost acknowledgement');};});
  await page.locator('[data-balance-confirm]').click();await expect.poll(()=>checkpoints(page)).toHaveLength(1);
  await expect(page.locator('[data-balance-value]')).toContainText('-125,00');
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await checkpoints(page)).toHaveLength(1);
});
test('P1 candidate is not visible before durable commit finishes',async({page})=>{
  await boot(page);await enter(page,'1000','2026-10-10');
  await page.evaluate(()=>{const store=DataAdapter.store(),original=store.commit;store.commit=async function(...args){await new Promise(resolve=>window.__p1Release=resolve);store.commit=original;return original.apply(this,args);};});
  await page.locator('[data-balance-confirm]').click();await page.waitForFunction(()=>window.__p1Release);
  expect(await checkpoints(page)).toEqual([]);await expect(page.locator('[data-balance-confirm]')).toBeDisabled();
  await page.evaluate(()=>__p1Release());await expect.poll(()=>checkpoints(page)).toHaveLength(1);
});
test('P1 changed source between preview and save requires new confirmation',async({page})=>{
  await boot(page);await enter(page,'1000','2026-10-10');await page.locator('[data-balance-confirm]').click();
  await enter(page,'875','2026-10-12');await page.evaluate(()=>commitChange(()=>{state.transactions.find(tx=>tx.recordRole==='bank-source').processingStatus='goedgekeurd';state.transactions.find(tx=>tx.recordRole==='bank-source').approvalSource='manual';}));
  await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-error]')).toContainText('opnieuw');expect(await checkpoints(page)).toHaveLength(1);
});
test('P1 actual cloud acceptance preserves history and blocks a snapshot that drops it',async({page})=>{
  await boot(page);await enter(page,'1000','2026-10-10');await page.locator('[data-balance-confirm]').click();await expect.poll(()=>checkpoints(page)).toHaveLength(1);
  const result=await page.evaluate(async()=>{
    const before=structuredClone(state),remote=structuredClone(state);delete remote.balanceCheckpoints;remote.meta.revision++;
    let code;try{await CloudAdapter.acceptRemote({syncVersion:1,state:remote},remote,'');}catch(error){code=error.code;}
    const preserved=JSON.stringify(await DataAdapter.readDurableState())===JSON.stringify(before);
    const added=structuredClone(before);added.meta.revision++;
    added.balanceCheckpoints.push({...added.balanceCheckpoints[0],id:'balance-remote',operationId:'remote',asOfDate:'2026-10-12',amountCents:88000});
    const accepted=await CloudAdapter.acceptRemote({syncVersion:2,state:added},added,'');
    return {code,preserved,accepted,checkpoints:state.balanceCheckpoints,durable:(await DataAdapter.readDurableState()).balanceCheckpoints};
  });
  expect(result.code).toBe('finize/cloud-conflict');expect(result.preserved).toBe(true);expect(result.accepted).toBe(true);expect(result.checkpoints).toHaveLength(2);expect(result.durable).toEqual(result.checkpoints);
});
test('P1 same UI supports a personal savings account without changing joint balance',async({page})=>{
  await boot(page,390);
  await page.evaluate(()=>commitChange(()=>state.accountProfiles.push({id:'personal-saving',name:'Persoonlijke spaarrekening',accountOwner:'dion',identifier:'NL20INGB0001234567',accountType:'savings',status:'active'})));
  await page.evaluate(()=>openBankAccountDetails('personal-saving'));await expect(page.locator('[data-balance-add]')).toBeVisible();await expect(page.locator('.balance-account')).toHaveCount(1);
  await enter(page,'250','2026-10-12');await page.locator('[data-balance-confirm]').click();await expect.poll(()=>checkpoints(page)).toHaveLength(1);
  await expect(page.locator('[data-balance-value]')).toContainText('250,00');expect((await checkpoints(page))[0].accountProfileId).toBe('personal-saving');
  await open(page);await expect(page.locator('[data-balance-value]')).toHaveText('Onbekend');
});
