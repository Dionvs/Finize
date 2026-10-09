const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
async function boot(page,width){
 await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
 await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
 await page.addInitScript(s=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
}
for(const width of [390,1440]){
 test(`P7 Q1/Q2 configuration and status are inert text ${width}px`,async({page})=>{
  await boot(page,width);const payload='</textarea><img src=x onerror="window.__p7Xss=1">';
  await page.evaluate(payload=>{window.__p7Xss=0;CloudAdapter.config={apiKey:'isolated',authDomain:'isolated.example.test',appId:'isolated-app',projectId:payload};CloudAdapter.status=payload;document.querySelector('#tabs [data-tab="data"]').click();},payload);
  await expect(page.locator('#tab-data img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>window.__p7Xss)).toBe(0);
  expect(JSON.parse(await page.locator('#firebaseConfigInput').inputValue()).projectId).toBe(payload);await expect(page.locator('#cloudStatus')).toHaveText(payload);
 });
 test(`P7 Q9 data instructions cannot recommend public legacy Firestore rules ${width}px`,async({page})=>{
  await boot(page,width);await page.evaluate(()=>document.querySelector('#tabs [data-tab="data"]').click());const rules=page.locator('#tab-data pre');
  await expect(rules).not.toContainText('allow read: if true');await expect(rules).not.toContainText('allow read, write: if true');await expect(rules).toContainText('firestore.rules');await expect(rules).toContainText('huishouden');
 });
 test(`P7 Q7 legacy planning identifiers cannot create HTML attributes ${width}px`,async({page})=>{
  await boot(page,width);await page.evaluate(()=>{window.__p7PlanningXss=0;commitChange(()=>{state.recurringFixedExpenses=[{id:'"><img src=x onerror="window.__p7PlanningXss=1"><x a="',naam:'<img src=x onerror="window.__p7PlanningXss=2">',categorie:'Wonen',rekening:'gezamenlijk',financialFor:'gezamenlijk',bedrag:100,begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{id:'p7-security-history',effectiveFrom:'2026-01-01',amount:100}],monthOverrides:{}}];},{render:false});document.querySelector('#tabs [data-tab="gezamenlijk"]').click();});
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);expect(await page.evaluate(()=>window.__p7PlanningXss)).toBe(0);await expect(page.getByRole('dialog')).toContainText('<img src=x onerror="window.__p7PlanningXss=2">');
 });
 test(`P7 Q7/Q8 legacy review and transfer metadata are inert ${width}px`,async({page})=>{
  await boot(page,width);await page.evaluate(()=>{window.__p7LegacyXss=0;commitChange(()=>{const id='"><img src=x onerror="window.__p7LegacyXss=1"><x a="',text='<img src=x onerror="window.__p7LegacyXss=2">';state.transactionReviewQueue=[{id,source:'csv',account:'gezamenlijk',date:getSelectedMonth()+'-03',amount:10,kind:'uitgave',description:text,reviewStatus:'te-controleren'}];state.internalTransfers=[{id,month:getSelectedMonth(),sourceAccount:'dion',targetAccount:'gezamenlijk',destination:text,status:text,calculatedAmount:10}];},{render:false});});
  // Invoke retained private compatibility renderers using their actual source. No new product export.
  const source=fs.readFileSync(path.join(__dirname,'../../src/core/runtime.js'),'utf8');
  const code=source.slice(source.indexOf('function textSafe('),source.indexOf('function safeImageUrl('))+source.slice(source.indexOf('function u3PendingReviews('),source.indexOf('function assertMonthMutationAllowed('))+source.slice(source.indexOf('function u3ReviewOccurrenceOptions('),source.indexOf('function u3OpenClose('))+source.slice(source.indexOf('function u3OpenTransfers('),source.indexOf('// Update 41/42:'));
  for(const view of ['review','transfers']){
   await page.evaluate(({code,view})=>{const helpers={u3SuggestedRecognition:()=>null,u3AccountLabel:value=>value||'gezamenlijk',u3FixedOccurrences:()=>[],u3IncomeOccurrences:()=>[],U3_ACCOUNTS:['dion','dara','gezamenlijk'],monthLabel:value=>value,eur:value=>String(value),u3AdminModal:html=>{const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.innerHTML=html;document.body.append(modal);modal.querySelector('[data-u3-close]').onclick=()=>modal.remove();return {modal};}};new Function('state','getSelectedMonth',...Object.keys(helpers),code+`;${view==='review'?'u3OpenReview':'u3OpenTransfers'}();`)(state,getSelectedMonth,...Object.values(helpers));},{code,view});
   await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);expect(await page.evaluate(()=>window.__p7LegacyXss)).toBe(0);await expect(page.getByRole('dialog')).toContainText('<img src=x onerror="window.__p7LegacyXss=2">');await page.getByRole('dialog').locator('[data-u3-close]').evaluate(node=>node.click());
  }
 });
 test(`P7 M12/M13/UI invalid processing is rejected before state change ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await boot(page,width);
  const invalidDate=await page.evaluate(()=>{const before=JSON.stringify(state);try{FinizeManual.save({id:'future-p7',date:'2026-10-07',amount:1,transactionType:'uitgave',category:'Overig'},'gezamenlijk');}catch(error){return {error:error.message,same:before===JSON.stringify(state)};}return {error:'',same:before===JSON.stringify(state)};});
  expect(invalidDate.error).toContain('verleden');expect(invalidDate.same).toBe(true);
  await page.evaluate(()=>{document.querySelector('#tabs [data-tab="gezamenlijk"]').click();});await page.locator('#tab-gezamenlijk [data-open-joint-transaction]').first().click();await page.locator('#transactionModal').getByRole('button',{name:/Handmatig invoeren/}).click();
  await page.locator('#jointTxDate').fill('2026-10-03');await page.locator('#jointTxAmount').fill('100000000000000');await page.locator('#jointTxDescription').fill('Unrepresentable cents');
  const before=await page.evaluate(()=>JSON.stringify(state));await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('[data-p4-error]')).toContainText('eurocenten');expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  await page.locator('#btnCancelJointTransaction').click();
  const result=await page.evaluate(()=>{const before=JSON.stringify(state);try{FinizeManual.save({id:'orphan-p7',source:'manual',date:'2026-10-03',amount:100,transactionType:'uitgave',category:'Overig',fixedOccurrenceId:'missing:2026-10-01',fixedOccurrenceMonth:'2026-10'},'gezamenlijk');}catch(error){return {error:error.message,same:before===JSON.stringify(state)};}return {error:'',same:before===JSON.stringify(state)};});
  expect(result.error).toContain('vaste last');expect(result.same).toBe(true);expect(await page.evaluate(()=>state.transactions.some(tx=>tx.id==='orphan-p7'))).toBe(false);
  expect(errors).toEqual([]);
 });
 test(`P7 Q3-Q8 financial/source/category/diagnostic strings remain inert ${width}px`,async({page})=>{
  await boot(page,width);const result=await page.evaluate(()=>{
   const text='<img src=x onerror="window.__p7FinancialXss=1">',id='id-" onmouseover="window.__p7FinancialXss=2';window.__p7FinancialXss=0;
   const before=JSON.stringify(state);const host=document.createElement('div');state.transactions.push({id,source:'manual',accountContext:'dion',financialFor:'dion',date:getSelectedMonth()+'-01',amount:1,category:text,description:text,note:text,processingStatus:'goedgekeurd'});
   host.innerHTML=renderTransactionsTable('dion');state.transactions.pop();
   const draft={id:'p7-security',fileName:text,bank:text,status:'concept',accountOwner:'gezamenlijk',rows:[{id,certainty:'nakijken',reasons:[text],bankOriginal:{valid:true,bankDate:'2026-10-03',amount:-1,description:text,rawDescription:text,accountIdentifier:text,counterpartyAccount:text,lineNumber:2},processing:{processingDate:'2026-10-03',processedAmount:1,description:text,category:text,budgetOwner:'gezamenlijk',transactionType:'uitgave',include:true,splits:[],note:text}}],summary:{}};
   FinizeUpdate4Runtime.testRenderDraftModal(window,draft);const modal=document.getElementById('u4ImportModalRoot');
   return {transactionImages:host.querySelectorAll('img').length,importImages:modal.querySelectorAll('img').length,transactionText:host.textContent.includes(text),importText:modal.textContent.includes(text),safeUrl:safeImageUrl('javascript:alert(1)'),same:before===JSON.stringify(state)};
  });expect(result).toEqual({transactionImages:0,importImages:0,transactionText:true,importText:true,safeUrl:'',same:true});expect(await page.evaluate(()=>window.__p7FinancialXss)).toBe(0);
 });
}
test.describe('P7 W1-W8 PWA/cache/reconnect',{tag:'@pwa'},()=>{
 test.use({serviceWorkers:'allow'});
 test('P7 W1/W2/W3/W5/W7 old cache eviction and versioned shell match',async({page})=>{
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  const result=await page.evaluate(async()=>{await caches.open('finize-obsolete-p7');await caches.open('other-app-p7');const registration=await navigator.serviceWorker.getRegistration();const installing=registration.installing;return {marker:(await caches.keys()).find(k=>k.startsWith('finize-v')),installing:!!installing,assets:[document.querySelector('script[src*="app.js"]').getAttribute('src'),document.querySelector('link[href*="app.css"]').getAttribute('href')]};});
  expect(result.marker).toBe('finize-v116-cache-isolatie');expect(result.assets).toEqual(['./app.js?v=116-cache-isolatie','./app.css?v=116-cache-isolatie']);
  // Exercise the actual worker activate handler, preserving another application's cache.
  const source=fs.readFileSync(path.join(__dirname,'../../service-worker.js'),'utf8');const evicted=await page.evaluate(async source=>{let activate;const self={addEventListener:(type,fn)=>{if(type==='activate')activate=fn;},skipWaiting:()=>{},clients:{claim:()=>{}}};new Function('self','caches',source)(self,caches);let promise;activate({waitUntil:p=>{promise=p;}});await promise;return caches.keys();},source);
  expect(evicted).not.toContain('finize-obsolete-p7');expect(evicted).toContain('other-app-p7');expect(evicted).toContain(result.marker);
  const cached=await page.evaluate(async assets=>{const cache=await caches.open('finize-v116-cache-isolatie');return Promise.all(assets.map(async asset=>{const response=await cache.match(asset);return {ok:!!response,text:response?await response.text():''};}));},result.assets);
  expect(cached.every(item=>item.ok)).toBe(true);expect(cached[0].text).toBe(fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8'));expect(cached[1].text).toBe(fs.readFileSync(path.join(__dirname,'../../app.css'),'utf8'));
 });
 test('P7 W4/W6/W8 offline/reconnect retains persisted state, journal and source details',async({page,context})=>{
  await boot(page,390);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const saved=await page.evaluate(async()=>{const store=FinizeUpdate4Runtime.ImportStore;await store.putImport({id:'p7-offline',version:1,operationId:'p7-offline-op',rows:[{id:'source',processingStatus:'nakijken',bankOriginal:{amount:-10,bankDate:'2026-10-03',description:'Offline source'}}]});await store.putSync({id:'p7-offline',importId:'p7-offline',version:1,operationId:'p7-offline-op'});await store.putJournal({id:'p7-offline-audit',importId:'p7-offline',operation:'p7-test-receipt',status:'completed'});return JSON.stringify(state);});
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(saved);await expect(page.locator('#tab-dashboard')).not.toBeEmpty();
  expect(await page.evaluate(async()=>({batch:(await FinizeUpdate4Runtime.ImportStore.getImport('p7-offline')).rows[0].id,queue:(await FinizeUpdate4Runtime.ImportStore.listSync()).map(x=>x.operationId),journal:(await FinizeUpdate4Runtime.ImportStore.getJournal('p7-offline-audit')).status}))).toEqual({batch:'source',queue:['p7-offline-op'],journal:'completed'});
  await context.setOffline(false);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(saved);expect(await page.evaluate(async()=> (await FinizeUpdate4Runtime.ImportStore.getImport('p7-offline')).rows[0].bankOriginal)).toEqual({amount:-10,bankDate:'2026-10-03',description:'Offline source'});
 });
});
