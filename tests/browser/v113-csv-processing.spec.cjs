const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60000);
async function boot(page,width){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
 await page.route('https://www.gstatic.com/**',route=>route.abort());await page.route('https://firestore.googleapis.com/**',route=>route.abort());
 await page.addInitScript(s=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>commitChange(()=>{
  state.meta.selectedMonth='2026-10';state.transactions=[];state.importSummaries=[];state.activeImportId='';state.monthRecords={};state.recognitionRules=[];state.recurringFixedExpenses=[];state.manualTransactionReplacements=[];state.internalTransferPairs=[];state.savingsCoverageAllocations=[];state.advanceLedger=[];state.advanceRepayments=[];
  state.accountProfiles=[{id:'v113-joint',name:'Gezamenlijk',accountOwner:'gezamenlijk',identifier:'NL01JOINT'}];
  state.budgetDefaultsHistory={gezamenlijk:[{effectiveFrom:'0000-01',rows:[{id:'clothing',post:'Kleding',bedrag:100},{id:'food',post:'Boodschappen',bedrag:100}]}],dion:[],dara:[]};
  state.spaardoelen={gezamenlijk:[{id:'v113-goal',naam:'Vakantie',doelbedrag:3000,algespaard:2000}],dion:[],dara:[]};state.savingsGoalLedger=[{id:'v113-opening',goalId:'v113-goal',source:'legacy-opening',effectiveAmount:2000,active:true}];
 },{render:true}));return errors;
}
const csv=(label='Albert Heijn',amount=-100)=>`Datum;Omschrijving;Rekening;Bedrag\n2026-10-03;${label};NL01JOINT;${amount}`;
for(const [name,expected] of [['QuotaExceededError','De browseropslag is vol'],['SecurityError','De browser blokkeert lokale opslag'],['Error','Onvoldoende saldo in spaardoel Vakantie: €40,00 beschikbaar, €70,00 nodig.']]){
 test(`CSV opslag toont oorzaak ${name} en behoudt goedgekeurde verwerking`,async({page})=>{
  await boot(page,360);const row=await upload(page,csv());await row.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,row);await expect.poll(()=>totals(page)).toMatchObject({budget:100});await expand(page);
  await row.locator('[data-u4-field="category"]').selectOption('Boodschappen');
  const before=await page.evaluate(()=>JSON.stringify(state));
  const stored=await page.evaluate(async()=>JSON.stringify(await FinizeUpdate4.importStore.getImport(state.importSummaries[0].id)));
  await page.evaluate(({name,expected})=>{
   window.restoreStorageForTest=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key.startsWith('finize-budget-planner-v1'))throw name==='Error'?new Error(expected):new DOMException('Browser storage failure',name);return window.restoreStorageForTest.call(this,key,value);};
  },{name,expected});
  const dialog=page.waitForEvent('dialog');await row.locator('[data-u4-approve]').click();const message=(await dialog).message();expect(message).toContain(expected);expect(message).toContain('De bestaande verwerking is niet gewijzigd');expect(message).not.toContain('Financiële commit is afgebroken');
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  expect(await page.evaluate(async()=>JSON.stringify(await FinizeUpdate4.importStore.getImport(state.importSummaries[0].id)))).toBe(stored);
  expect(await totals(page)).toMatchObject({bank:-100,budget:100,sources:1});
  await page.evaluate(()=>{Storage.prototype.setItem=window.restoreStorageForTest;});
  await save(page,row);await expect.poll(()=>page.evaluate(()=>FinizeTransactions.effects().filter(p=>p.active).map(p=>p.category))).toEqual(['Boodschappen']);
 });
}
test('ING septemberbetaling verwerkt in oktober zonder wijziging bankgegevens',async({page})=>{
 const errors=await boot(page,360);
 const text='"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen"\n"2026/09/26";"Residence Valkenburg B V";"NL01JOINT";"NL55BANK0000000055";"GT";"Af";"189,56";"Overschrijving";"Betaling"';
 const row=await upload(page,text);await row.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,row);
 await expect.poll(()=>page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-09'}))).toBe(189.56);
 expect(await page.evaluate(()=>FinizeTransactions.bankSources({month:'2026-09'}).map(t=>({date:t.date,amount:t.bankAmount})))).toEqual([{date:'2026-09-26',amount:-189.56}]);expect(errors).toEqual([]);
});
test('Centrale commit behoudt financieel saldobericht na rollback en booleancontract',async({page})=>{
 await boot(page,1440);
 const result=await page.evaluate(()=>{
  const before=JSON.stringify(state);let message='';
  try{commitChange(()=>{state.savingsGoalLedger[0].effectiveAmount=-70;},{render:false,throwOnError:true});}catch(error){message=error.message;}
  const rolledBack=JSON.stringify(state)===before;
  const booleanResult=commitChange(()=>{state.savingsGoalLedger[0].effectiveAmount=-70;},{render:false});
  return {message,rolledBack,booleanResult,unchanged:JSON.stringify(state)===before};
 });
 expect(result.message).toContain('Onvoldoende saldo in spaardoel Vakantie');expect(result.message).toContain('Corrigeer eerst');expect(result).toMatchObject({rolledBack:true,booleanResult:false,unchanged:true});
});
async function upload(page,text){await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));await page.locator('[data-u4-file]').setInputFiles({name:'bank.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await expect(page.locator('[data-u4-row]').first()).toBeAttached();await expand(page);return page.locator('[data-u4-row]').first();}
async function expand(page){await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));}
async function save(page,row){await row.locator('[data-u4-approve]').click();if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();}
async function totals(page){return page.evaluate(()=>({bank:FinizeTransactions.bankTotal({month:'2026-10'}),sources:FinizeTransactions.bankSources({month:'2026-10'}).length,budget:FinizeTransactions.total('budgetImpact',{month:'2026-10'}),expense:FinizeTransactions.total('realExpense',{month:'2026-10'}),goal:FinizeUpdate4.calculateGoalSavedAmount('v113-goal')}));}
for(const width of [360,1440]){
 test(`V113 volledige CSV splitsen herwerken annuleren herladen ${width}px`,async({page})=>{
  const errors=await boot(page,width),row=await upload(page,csv());
  expect(await totals(page)).toMatchObject({bank:-100,sources:1,expense:0});
  await row.locator('[data-u4-field="category"]').selectOption('Kleding');await expand(page);await row.locator('[data-u4-add-split]').click();await expand(page);
  await expect(row.locator('[data-u4-split]')).toHaveCount(2);await expect(row.locator('[data-u4-split="0"] [data-u4-split-field="destination"]')).toHaveValue('Kleding');
  const first=row.locator('[data-u4-split="0"] [data-u4-split-field="amount"]');await first.fill('25');await first.press('Tab');await expand(page);await expect(row.locator('[data-u4-split="1"] [data-u4-split-field="amount"]')).toHaveValue('75');
  await row.locator('[data-u4-add-split]').click();await expand(page);await expect(row.locator('[data-u4-split="1"] [data-u4-split-field="amount"]')).toHaveValue('37.5');
  await row.locator('[data-u4-split="2"] [data-u4-split-field="destination"]').selectOption('Niet meetellen');await expand(page);
  await row.locator('.u4-split-list').evaluate(node=>{const scroller=node.closest('.u4-import-modal'),head=scroller.querySelector('.u4-modal-head');scroller.scrollTop+=node.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12;});await page.screenshot({path:`backups/v113-csv-verwerking/editor-${width}.png`,fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await save(page,row);await expect.poll(()=>totals(page)).toMatchObject({bank:-100,sources:1,budget:62.5,expense:62.5});
  const id=await page.evaluate(()=>state.importSummaries[0].id);await page.locator('.u4-modal-head [data-u4-close]').click();await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);await expand(page);
  const current=page.locator('[data-u4-row]').first();await current.locator('[data-u4-split="0"] [data-u4-split-field="amount"]').fill('30');await current.locator('[data-u4-split="0"] [data-u4-split-field="amount"]').press('Tab');
  expect(await totals(page)).toMatchObject({budget:62.5});await page.locator('[data-u4-cancel-concept]').click();await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);await expand(page);
  await expect(current.locator('[data-u4-split="0"] [data-u4-split-field="amount"]')).toHaveValue('25');
  await current.locator('[data-u4-split="2"] [data-u4-split-field="destination"]').selectOption('Boodschappen');await save(page,current);await expect.poll(()=>totals(page)).toMatchObject({budget:100,expense:100,bank:-100,sources:1});
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await totals(page)).toMatchObject({budget:100,bank:-100,sources:1});
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());
  const list=page.locator(width<1000?'#tab-gezamenlijk .joint-transaction-row':'#tab-gezamenlijk [data-edit-joint-transaction]');await expect(list).toHaveCount(1);await expect(list).toContainText('100,00');expect(await page.evaluate(()=>FinizeTransactions.bankSources().length)).toBe(1);
  expect(errors).toEqual([]);
 });
 test(`V113 optionele spaarbudgetcorrectie en negatieve refund ${width}px`,async({page})=>{
  const errors=await boot(page,width),row=await upload(page,csv('Opname sparen',500));
  await row.locator('[data-u4-family]').selectOption('sparen');await row.locator('[data-u4-field="transactionType"]').selectOption('van-spaarrekening');await row.locator('[data-u4-field="savingsGoalId"]').selectOption('v113-goal');await expand(page);await row.locator('[data-u4-add-split]').click();await expand(page);
  await row.locator('[data-u4-split="0"] [data-u4-split-field="amount"]').fill('300');await row.locator('[data-u4-split="0"] [data-u4-split-field="amount"]').press('Tab');await expand(page);await row.locator('[data-u4-split="0"] [data-u4-split-field="withdrawalBudgetCategory"]').selectOption('Kleding');await save(page,row);
  await expect.poll(()=>totals(page)).toMatchObject({goal:1500,bank:500,budget:-300,sources:1});
  await page.locator('.u4-modal-head [data-u4-close]').click();const refund=await upload(page,csv('Terugbetaling aankoop',100));await refund.locator('[data-u4-family]').selectOption('terugbetaling');await refund.locator('[data-u4-field="refundCategory"]').selectOption('Kleding');await save(page,refund);
  await expect.poll(()=>totals(page)).toMatchObject({budget:-400,bank:600,sources:2,goal:1500});expect(await page.evaluate(()=>FinizeTransactions.total('incomeImpact'))).toBe(0);await page.locator('.u4-modal-head [data-u4-close]').click();await page.evaluate(()=>document.querySelector('#tabs [data-tab="dashboard"]').click());const budget=page.locator('#tab-dashboard [data-open-budget-transactions="Kleding"]');await expect(budget.locator('.neutral-amount').first()).toHaveText(/-.*400,00/);await expect(budget.locator('.progress-fill')).toHaveAttribute('style','width:0%');await budget.click();await expect(page.locator('.budget-transactions-list [data-open-budget-transaction-id]')).toHaveCount(2);expect(errors).toEqual([]);
 });
 test(`V113 overlap terugtrekken verwijderen en herwerken via B ${width}px`,async({page})=>{
  const errors=await boot(page,width),row=await upload(page,csv());await row.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,row);
  const A=await page.evaluate(()=>state.importSummaries[0].id);await page.locator('.u4-modal-head [data-u4-close]').click();await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));await page.locator('[data-u4-file]').setInputFiles({name:'overlap.csv',mimeType:'text/csv',buffer:Buffer.from(csv())});await expect(page.locator('.u4-modal-body')).toContainText('overgeslagen');
  const B=await page.evaluate(a=>state.importSummaries.find(b=>b.id!==a).id,A);await page.evaluate(id=>FinizeUpdate4.batchCommand(id,'withdraw'),A);expect(await totals(page)).toMatchObject({bank:-100,budget:100,sources:1});await page.evaluate(id=>FinizeUpdate4.batchCommand(id,'delete'),A);expect(await totals(page)).toMatchObject({bank:-100,budget:100,sources:1});
  await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),B);await expand(page);const alias=page.locator('[data-u4-row]').first();await alias.locator('[data-u4-field="category"]').selectOption('Boodschappen');await save(page,alias);await expect.poll(()=>totals(page)).toMatchObject({bank:-100,budget:100,sources:1});await expect.poll(()=>page.evaluate(()=>FinizeTransactions.effects().filter(p=>p.active).map(p=>p.category))).toEqual(['Boodschappen']);expect(errors).toEqual([]);
 });
}
test('V113 echte herstelback-up in IndexedDB en CSV bronkoppeling zonder extra betaling',async({page})=>{
 const errors=await boot(page,360),row=await upload(page,csv());await row.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,row);await expect.poll(()=>totals(page)).toMatchObject({budget:100,expense:100});const before=await totals(page);
 const txId=await page.evaluate(async()=>{const tx=state.transactions.find(t=>t.recordRole!=='bank-source');await FinizeUpdate4.importStore.deleteImport(tx.importBatchId);return tx.id;});
 await page.evaluate(id=>FinizeUpdate4.openTransactionSource(id),txId);await expect(page.locator('[data-u4-repair-file]')).toBeVisible();await page.locator('[data-u4-repair-file]').setInputFiles({name:'original.csv',mimeType:'text/csv',buffer:Buffer.from(csv())});await expect(page.locator('[data-u4-repair-match]')).toHaveCount(1);await page.locator('[data-u4-repair-match]').click();await expect(page.locator('[data-u4-row]')).toHaveCount(1);expect(await totals(page)).toEqual(before);expect(errors).toEqual([]);
});

test.describe('V113 offline',()=>{
 test.use({serviceWorkers:'allow'});
 test('goedgekeurde CSV blijft offline herbewerkbaar na herladen',async({page,context})=>{
  const errors=await boot(page,360),row=await upload(page,csv());await row.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,row);
  await expect.poll(()=>totals(page)).toMatchObject({bank:-100,budget:100});const id=await page.evaluate(()=>state.importSummaries[0].id);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);await expand(page);
  const current=page.locator('[data-u4-row]').first();await current.locator('[data-u4-field="category"]').selectOption('Boodschappen');await save(page,current);
  await expect.poll(()=>page.evaluate(()=>FinizeTransactions.effects().filter(p=>p.active).map(p=>p.category))).toEqual(['Boodschappen']);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await totals(page)).toMatchObject({bank:-100,budget:100,sources:1});expect(errors).toEqual([]);
 });
});

for(const decision of ['same','distinct'])test(`V113 mogelijke overlap vereist expliciete keuze ${decision}`,async({page})=>{
 const errors=await boot(page,360),first=await upload(page,csv());await first.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,first);await expect.poll(()=>totals(page)).toMatchObject({budget:100});await page.locator('.u4-modal-head [data-u4-close]').click();
 const overlapping=csv()+'\n2026-10-04;Andere betaling;NL01JOINT;-20';const pending=await upload(page,overlapping);await expect(pending.locator('[data-u4-identity="same"]')).toBeVisible();
 await pending.locator(`[data-u4-identity="${decision}"]`).click();await expect(page.locator('[data-u4-identity]')).toHaveCount(0);await expand(page);
 await expect.poll(()=>totals(page)).toMatchObject({sources:decision==='same'?2:3,bank:decision==='same'?-120:-220,budget:100});
 if(decision==='distinct'){const separate=page.locator('[data-u4-row]').first();await separate.locator('[data-u4-field="category"]').selectOption('Kleding');await save(page,separate);await expect.poll(()=>totals(page)).toMatchObject({budget:200});}
 await page.locator('.u4-modal-head [data-u4-close]').click();await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));await page.locator('[data-u4-file]').setInputFiles({name:'herhaling.csv',mimeType:'text/csv',buffer:Buffer.from(overlapping)});await expect(page.locator('.u4-modal-body')).toContainText('overgeslagen');await expect(page.locator('[data-u4-identity]')).toHaveCount(0);expect(await totals(page)).toMatchObject({sources:decision==='same'?2:3,bank:decision==='same'?-120:-220});expect(errors).toEqual([]);
});

test('V113 oude onverwerkte import blijft na herladen leesbaar zonder gegevensconversie',async({page})=>{
 const errors=await boot(page,360);await upload(page,csv());const id=await page.evaluate(()=>state.importSummaries[0].id);
 await page.evaluate(()=>commitChange(()=>{state.transactions=state.transactions.filter(tx=>tx.recordRole!=='bank-source');},{render:false}));
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await totals(page)).toMatchObject({sources:1,bank:-100,budget:0});expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
 await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());await page.locator('#tab-gezamenlijk [data-edit-joint-transaction]').first().click();await expect(page.locator('[data-u4-row]').first()).toBeVisible();await expect(page.locator('[data-u4-repair-file]')).toHaveCount(0);await page.locator('.u4-modal-head [data-u4-close]').click();
 await page.evaluate(id=>FinizeUpdate4.batchCommand(id,'withdraw'),id);expect(await totals(page)).toMatchObject({sources:0,bank:0,budget:0});await page.evaluate(id=>FinizeUpdate4.batchCommand(id,'restore'),id);expect(await totals(page)).toMatchObject({sources:1,bank:-100,budget:0});expect(await page.evaluate(()=>state.transactions.length)).toBe(0);expect(errors).toEqual([]);
});
