const fs=require('node:fs'),path=require('node:path');
const {test,expect}=require('@playwright/test');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
const key='finize-budget-planner-v1',backupKey=key+'-pre-schema-v5';
async function boot(page){
  const input=structuredClone(fixture);input.meta.selectedMonth='2026-09';
  input.recurringFixedExpenses.voor.push({id:'history-hyp',naam:'Historische hypotheek',categorie:'Huis',bedrag:1807,rekening:'gezamenlijk',financialFor:'gezamenlijk',frequentieAantal:1,frequentieEenheid:'maanden',begindatum:'2026-05-01',actief:true,amountHistory:[{id:'hyp-initial',effectiveFrom:'2026-05-01',amount:1807}],monthOverrides:{}});
  input.budgetDefaultsHistory=input.budgetDefaultsHistory||{voor:{}};
  input.budgetDefaultsHistory.voor.gezamenlijk=[{id:'groceries-initial',effectiveFrom:'0000-01',rows:[{id:'groceries',categorie:'Variabel',post:'Boodschappen',bedrag:500}]}];
  input.monthlyBudgets={};
  await page.addInitScript(({input,key})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(input));
    const original=Storage.prototype.setItem;window.__writes=0;
    Storage.prototype.setItem=function(name,value){if(name===key)window.__writes++;return original.call(this,name,value);};
  },{input,key});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  return input;
}
async function month(page,value){
  await page.locator('#monthPickerButton').click();
  await page.locator(`[data-month-year="${value.slice(0,4)}"]`).click();
  await page.locator(`[data-month-value="${value}"]`).click();
  await expect(page.locator('#monthPickerButton')).toContainText(value.slice(0,4));
}
async function nav(page,tab){await page.evaluate(tab=>document.querySelector(`#tabs [data-tab="${tab}"]`).click(),tab);}
async function fixedValue(page,selected){return page.evaluate(month=>FinizePlanning.fixed(month).find(item=>item.id==='history-hyp')?.bedrag,selected);}
for(const width of [390,1440])test(`Historische/future editors en herladen op ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const input=await boot(page);
  expect(await fixedValue(page,'2026-09')).toBe(1807);
  await expect(page.locator('[data-scenario],#scenarioToggle')).toHaveCount(0);
  const initial=await page.evaluate(()=>({writes:window.__writes,revision:state.meta.revision}));
  for(const tab of ['dashboard','gezamenlijk','dion','dara','spaardoelen','data']){await nav(page,tab);await expect(page.locator(`#tab-${tab}`)).not.toBeEmpty();}
  expect(await page.evaluate(()=>({writes:window.__writes,revision:state.meta.revision}))).toEqual(initial);
  await month(page,'2027-01');await nav(page,'gezamenlijk');
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();
  await page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Historische hypotheek'}).getByRole('button',{name:'Bewerken'}).click();
  await page.locator('#u3RecAmount').fill('1900');await page.locator('#u3RecName').fill('Hypotheek januari');await page.locator('#u3RecSave').click();
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Hypotheek januari'})).toContainText('1.900,00');
  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await page.locator('#tab-gezamenlijk [data-open-owner-variable="gezamenlijk"]').first().click();
  await page.locator('[data-variable-field="bedrag"]').first().fill('600');await page.locator('[data-variable-save]').click();
  expect(await fixedValue(page,'2027-01')).toBe(1900);
  expect(await page.evaluate(()=>FinizePlanning.budgets('2027-01','gezamenlijk')[0].bedrag)).toBe(600);
  await month(page,'2026-09');
  expect(await fixedValue(page,'2026-09')).toBe(1807);
  expect(await page.evaluate(()=>FinizePlanning.budgets('2026-09','gezamenlijk')[0].bedrag)).toBe(500);
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();
  await expect(page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Historische hypotheek'})).toContainText('1.807,00');
  await page.getByRole('dialog').getByRole('button',{name:'Sluiten'}).click();
  await page.setViewportSize({width:width===390?1440:390,height:900});await page.evaluate(()=>renderActiveTab());
  expect(await fixedValue(page,'2026-09')).toBe(1807);
  const backupBefore=await page.evaluate(backupKey=>localStorage.getItem(backupKey),backupKey);
  const backup=JSON.parse(backupBefore);expect(backup.package2Original.state.na).toEqual(input.na);expect(backup.package2Original.v10State.meta.schemaVersion).toBe(10);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await fixedValue(page,'2026-09')).toBe(1807);expect(await fixedValue(page,'2027-01')).toBe(1900);
  expect(await page.evaluate(()=>FinizePlanning.budgets('2026-09','gezamenlijk')[0].bedrag)).toBe(500);
  expect(await page.evaluate(backupKey=>localStorage.getItem(backupKey),backupKey)).toBe(backupBefore);
  expect(errors).toEqual([]);
});
test('v10-back-upfout verwijdert Na niet uit opslag',async({page})=>{
  const input=require('../../src/core/data-normalization.mjs').migrateStateData(fixture,{normalizeLegacy:require('../helpers/migration-runtime.cjs')().normalizeLegacyBudgetState,targetVersion:10});
  await page.addInitScript(({input,key,backupKey})=>{
    localStorage.setItem(key,JSON.stringify(input));const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===backupKey)throw new DOMException('Pakket 2 back-up quota','QuotaExceededError');return original.call(this,name,value);};
  },{input,key,backupKey});
  await page.goto('/');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).na,key)).toEqual(fixture.na);
  expect(await page.evaluate(()=>window.__finizeInitError.message)).toContain('back-up quota');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).meta.schemaVersion,key)).toBe(10);
});
test('Kaartposities en afmetingen behouden op mobiel/tablet/desktop',async({page})=>{
  await page.addInitScript(({fixture,key})=>localStorage.setItem(key,JSON.stringify(fixture)),{fixture,key});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  for(const [width,y,height]of [[390,126.40625,100],[768,189,132],[1024,164,140.375],[1440,121,142]]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>renderActiveTab());
    const bounds=await page.locator(width<768?'.mobile-kpi-grid':'.u5-primary-kpi').first().boundingBox();
    expect(bounds.y).toBeCloseTo(y,1);expect(bounds.height).toBeCloseTo(height,1);
  }
});
test('twee devices/cloudmock delen historie; echo heeft geen nieuwe write',async({page,browser})=>{
  await boot(page);await month(page,'2026-10');await nav(page,'gezamenlijk');
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]').first().click();
  await page.getByRole('dialog').locator('.u3-admin-row').filter({hasText:'Historische hypotheek'}).getByRole('button',{name:'Bewerken'}).click();
  await page.locator('#u3RecAmount').fill('1850');await page.locator('#u3RecSave').click();
  const documentData=await page.evaluate(()=>({state:structuredClone(state),syncVersion:15,commitId:'timeline-device-a'}));
  const secondContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  const deviceB=await secondContext.newPage();await boot(deviceB);
  expect(await fixedValue(deviceB,'2026-10')).toBe(1807);
  const result=await deviceB.evaluate(async documentData=>{
    const cloud=CloudAdapter;let writes=0;cloud.db={};cloud.docRef={};cloud.modules={firestore:{runTransaction:async()=>{writes++;throw new Error('Unexpected write');}}};
    await cloud.acceptRemote(documentData,migrateBudgetState(documentData.state),null);
    await cloud.acceptRemote(documentData,migrateBudgetState(documentData.state),null);
    return {writes,sep:FinizePlanning.fixed('2026-09').find(row=>row.id==='history-hyp').bedrag,oct:FinizePlanning.fixed('2026-10').find(row=>row.id==='history-hyp').bedrag};
  },documentData);
  expect(result).toEqual({writes:0,sep:1807,oct:1850});
  await secondContext.close();
});
