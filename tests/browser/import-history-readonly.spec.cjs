const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));

for(const width of [390,1440])test(`older CSV opens from history without changing processing or finances ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.addInitScript(input=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(async()=>{
    const u=FinizeUpdate4Runtime;
    commitChange(()=>{
      state.meta.selectedMonth='2026-10';state.importSummaries=[];state.activeImportId='';
      state.accountProfiles=[{id:'history-dion',name:'Dion testrekening',identifier:'NL01TEST',accountOwner:'dion'}];
    },{render:false});
    const draft=u.createImportDraft({id:'history-july',text:'Datum;Omschrijving;Rekening;Bedrag\n2026-07-24;Historische testregel A;NL01TEST;-10\n2026-07-28;Historische testregel B;NL01TEST;-20',profiles:state.accountProfiles,existingImports:[],entryOwner:'dion'});
    // A stored legacy processed batch may still contain review rows; viewing it never approves them.
    draft.status='verwerkt';
    await u.ImportStore.putImport(draft);
    commitChange(()=>state.importSummaries=[u.compactSummary(draft)],{render:false});
  });
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  // Instrument only after bootstrap; opening and closing details must be read-only.
  const before=await page.evaluate(async()=>({state:JSON.parse(JSON.stringify(state)),batch:await FinizeUpdate4Runtime.ImportStore.getImport('history-july'),sync:await FinizeUpdate4Runtime.ImportStore.listSync(),forecast:FinizeTransactions.forecast('2026-10')}));
  await page.evaluate(()=>{const nativeCommit=window.commitChange;window.__historyCommits=0;window.commitChange=(...args)=>{window.__historyCommits++;return nativeCommit(...args);};openBankImportForOwner('dion');});
  const modal=page.locator('#u4ImportModalRoot');
  await expect(modal.locator('[data-u4-open-receipt="history-july"]')).toHaveCount(0);
  await modal.locator('[data-u4-all-imports]').click();
  await expect(modal).toContainText('juli 2026');
  await modal.locator('[data-u4-open-receipt="history-july"]').click();
  await expect(modal.locator('h2')).toHaveText('Importdetails');
  await expect(modal).toContainText('Historische Testregel A');
  await expect(modal).toContainText('Historische Testregel B');
  await expect(modal).toContainText('24-07-2026');
  await modal.locator('[data-u4-close]').click();
  await expect(modal).not.toHaveClass(/open/);
  const after=await page.evaluate(async()=>({state:JSON.parse(JSON.stringify(state)),batch:await FinizeUpdate4Runtime.ImportStore.getImport('history-july'),sync:await FinizeUpdate4Runtime.ImportStore.listSync(),forecast:FinizeTransactions.forecast('2026-10')}));
  expect(after).toEqual(before);
  expect(await page.evaluate(()=>window.__historyCommits)).toBe(0);
  expect(errors).toEqual([]);
});
