const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60000);test.use({actionTimeout:7000});
async function boot(page,width=390){
 await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
 await page.route('https://www.gstatic.com/**',route=>route.abort());await page.route('https://firestore.googleapis.com/**',route=>route.abort());
 await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify({...seed,accountProfiles:[{id:'p2-joint',name:'Gezamenlijk betalen',accountOwner:'gezamenlijk',accountType:'payment',identifier:'NL91ABNA0417164300',status:'active'}]}));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.evaluate(()=>openBankAccountDetails('p2-joint'));await expect(page.locator('[data-liquidity-form]')).toBeVisible();
}
async function fill(page){await page.locator('[name="primaryForOwner"]').check();await expect(page.locator('[name="buffer"]')).toHaveValue('200');await page.locator('[name="buffer"]').fill('275.50');await page.locator('[name="salary-dion"]').fill('25');await page.locator('[name="salary-dara"]').fill('27');}
const submit=page=>page.locator('[data-liquidity-form] button[type="submit"]').click();
const saved=page=>expect.poll(()=>page.evaluate(()=>state.accountProfiles[0].liquidity?.bufferCents)).toBe(27550);
for(const width of [1440,390,320])test(`P2 ${width}px instellingen opslaan herladen en gedeelde pure uitkomst`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);
 const before=await page.evaluate(()=>({forecast:FinizeTransactions.forecast('2026-10'),transactions:state.transactions,checkpoints:state.balanceCheckpoints||[]}));
 await fill(page);await submit(page);await saved(page);await expect(page.locator('[data-liquidity-form] button[type="submit"]')).toBeEnabled();
 const after=await page.evaluate(()=>({forecast:FinizeTransactions.forecast('2026-10'),transactions:state.transactions,checkpoints:state.balanceCheckpoints||[]}));expect(after).toEqual(before);
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.evaluate(()=>openBankAccountDetails('p2-joint'));await expect(page.locator('[name="buffer"]')).toHaveValue('275.5');await expect(page.locator('[name="salary-dara"]')).toHaveValue('27');
 await page.locator('[data-balance-add]').click();await page.locator('[data-balance-amount]').fill('1000');await page.locator('[data-balance-date]').fill('2026-10-14');await page.locator('[data-balance-check]').click();await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-value]')).toContainText('1.000,00');
 const result=await page.evaluate(async()=>{const before=JSON.stringify(state),options={accountProfileId:'p2-joint',asOfDate:'2026-10-14',imports:await FinizeUpdate4.importStore.listImports()},a=FinizeLiquidity.select(options),b=await FinizeLiquidity.project(options);return {same:JSON.stringify(a)===JSON.stringify(b),unchanged:before===JSON.stringify(state),opening:a.opening.balanceCents,buffer:a.bufferCents,horizon:a.horizon.endDate};});
 expect(result).toEqual({same:true,unchanged:true,opening:100000,buffer:27550,horizon:'2026-10-24'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 fs.mkdirSync(path.join(__dirname,'../../.cache/v118-p2'),{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(__dirname,`../../.cache/v118-p2/settings-${width}.png`),fullPage:true});
});
test('P2 IndexedDB abort bewaart eerdere instellingen en opnieuw proberen is atomair',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>JSON.stringify(state.accountProfiles));await fill(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__restore=()=>IDBObjectStore.prototype.put=original;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='financialRecords'&&value.collection==='accountProfiles'){this.transaction.abort();throw new DOMException('P2 opslagtest','QuotaExceededError');}return original.call(this,value,...args);};});
 await submit(page);await expect(page.locator('[data-liquidity-error]')).not.toBeEmpty();expect(await page.evaluate(()=>JSON.stringify(state.accountProfiles))).toBe(before);expect(await page.evaluate(async()=>JSON.stringify((await DataAdapter.readDurableState()).accountProfiles))).toBe(before);
 await page.evaluate(()=>__restore());await submit(page);await saved(page);
});
test('P2 verloren ontvangstbevestiging herstelt instellingen zonder voortijdig zichtbaar maken',async({page})=>{
 await boot(page);await fill(page);await page.evaluate(()=>{const store=DataAdapter.store(),original=store.commit;store.commit=async function(...args){await new Promise(resolve=>window.__release=resolve);await original.apply(this,args);store.commit=original;throw new Error('Verloren bevestiging P2');};});
 await submit(page);await page.waitForFunction(()=>window.__release);expect(await page.evaluate(()=>state.accountProfiles[0].liquidity)).toBeUndefined();await expect(page.locator('[data-liquidity-form] button')).toBeDisabled();await page.evaluate(()=>__release());await saved(page);
});
test('P2 cloudconflict bewaart instellingen en keuze overleeft herladen',async({page})=>{
 await boot(page);await fill(page);await submit(page);await saved(page);
 const result=await page.evaluate(async()=>{const remote=structuredClone(state);remote.accountProfiles[0].liquidity.bufferCents=30000;remote.meta.revision++;let code;try{await CloudAdapter.acceptRemote({syncVersion:1,state:remote},remote,'');}catch(e){code=e.code;}const journal=await FinizeUpdate4.importStore.getJournal('conflict-account-profiles');return {code,local:journal.localChoice.state.accountProfiles[0].liquidity.bufferCents,remote:journal.cloudChoice.state.accountProfiles[0].liquidity.bufferCents};});
 expect(result).toEqual({code:'finize/cloud-conflict',local:27550,remote:30000});await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>state.accountProfiles[0].liquidity.bufferCents)).toBe(27550);
});
test('P2 native validatie en verouderde invoer beschermen gehele instelling',async({page})=>{
 await boot(page);await fill(page);await page.locator('[name="salary-dion"]').fill('32');await submit(page);expect(await page.evaluate(()=>state.accountProfiles[0].liquidity)).toBeUndefined();await page.locator('[name="salary-dion"]').fill('25');
 await page.evaluate(async()=>{const p=structuredClone(state.accountProfiles[0]);await FinizeAccountsSave({type:'update',id:p.id,expectedProfile:p,values:{...p,name:'Andere naam'},operationId:'other-change',createdAt:'2026-10-14T12:00:00Z'});});await submit(page);await expect(page.locator('[data-liquidity-error]')).toContainText('intussen gewijzigd');await expect(page.locator('[name="salary-dion"]')).toHaveValue('25');expect(await page.evaluate(()=>state.accountProfiles[0].liquidity)).toBeUndefined();
});
