const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {state:fixture}=require('../helpers/package5-fixture.cjs');
test.setTimeout(90000);
async function boot(page,width){
 await page.setViewportSize({width,height:900});
 await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
 await page.route('https://**',route=>route.abort());
 const seed={...visual,...fixture()};seed.meta.selectedMonth='2026-10';seed.monthRecords={};
 seed.recognitionRules=[{id:'jumbo',level:'keyword',value:'jumbo',category:'Kleding',budgetItemId:'food',transactionType:'uitgave'}];
 await page.addInitScript(value=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));},seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
 const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+Array.from({length:7},(_,i)=>`2026-10-03;Jumbo Middelburg;NL01JOINT;NL99SHOP;-${10+i}.00`).join('\n');
 await page.locator('[data-u4-file]').setInputFiles({name:'audit-bulk.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.locator('[data-u4-row]').first()).toBeVisible();
 return page.evaluate(async()=> (await FinizeUpdate4.importStore.listImports()).find(batch=>batch.fileName==='audit-bulk.csv').id);
}

for(const width of [390,1440])test('groepsgoedkeuring behoudt zichtbare kaart, terugroute en zes unieke boekingen '+width,async({page})=>{
 const id=await boot(page,width);
 const originals=await page.evaluate(async id=>(await FinizeUpdate4.importStore.getImport(id)).rows.map(row=>row.bankOriginal),id);
 const row=page.locator('[data-u4-row]').first();await row.locator('[data-u4-focus-open]').click();
 await row.locator('[data-u4-approve]').click();await page.locator('[data-u4-match-id]').last().uncheck();await page.locator('[data-u4-match-apply]').click();
 await expect(page.locator('[data-u4-group-result]')).toContainText('6 van 6');
 const focused=page.locator('.u4-focus-row');await expect(focused).toBeVisible();
 await expect(focused.locator('[data-u4-focus-back]')).toBeVisible();
 await expect(page.locator('.u4-section-approved')).toHaveAttribute('open','');
 await focused.locator('[data-u4-focus-back]').click();
 await expect(page.locator('[data-u4-view-month]')).toBeVisible();
 await expect(page.locator('.u4-section-review [data-u4-row]')).toHaveCount(1);
 const inspect=()=>page.evaluate(async id=>{const batch=await FinizeUpdate4.importStore.getImport(id);const effects=state.transactions.filter(row=>row.recordRole!=='bank-source');return {approved:batch.rows.filter(r=>r.approvalSource==='manual').length,seventh:batch.rows[6].approvalSource,ids:effects.map(row=>row.id).sort(),originals:batch.rows.map(row=>row.bankOriginal)};},id);
 const stored=await inspect();expect(stored.approved).toBe(6);expect(stored.seventh).toBe('');expect(stored.ids).toHaveLength(6);expect(new Set(stored.ids).size).toBe(6);expect(stored.originals).toEqual(originals);
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect()).toEqual(stored);
 await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);await expect(page.locator('[data-u4-view-month]')).toBeVisible();
});
