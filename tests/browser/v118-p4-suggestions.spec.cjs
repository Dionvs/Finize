const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const visual=require('../fixtures/v50-visual-state.json'),{state:fixture}=require('../helpers/package5-fixture.cjs');
test.setTimeout(60000);test.use({actionTimeout:7000});
async function boot(page,width,incoming=false){
 await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
 await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
 const s={...visual,...fixture()};s.monthRecords={};s.meta.selectedMonth='2026-10';s.budgetDefaultsHistory.gezamenlijk[0].rows.push({id:'other',post:'Overig',bedrag:200});
 s.recognitionRules=[{id:'clothes',level:'keyword',value:'winkel',category:'Kleding',budgetItemId:'food',transactionType:'uitgave'},{id:'other',level:'keyword',value:'winkel',category:'Overig',budgetItemId:'other',transactionType:'uitgave'}];
 await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},s);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
 const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+Array.from({length:10},(_,i)=>`2026-10-03;Winkel ${String.fromCharCode(65+i)};NL01JOINT;NL99SHOP;-${i+10}.00`).join('\n');
 await page.locator('[data-u4-file]').setInputFiles({name:'p4-review.csv',mimeType:'text/csv',buffer:Buffer.from(incoming?csv.replaceAll(';-',';'):csv)});await expect(page.locator('[data-u4-row]')).toHaveCount(10);
}
for(const width of [1440,390,320])test(`P4 ${width}px conflict alternatief bulk expliciete approval en duurzame herstart`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);
 const before=await page.evaluate(()=>({goals:state.savingsGoalLedger,months:state.monthRecords,impact:FinizeTransactions.total('budgetImpact',{month:'2026-10'})}));
 const first=page.locator('[data-u4-row]').first();await expect(first.locator('[data-suggestion-status=conflict]')).toBeVisible();await expect(first.locator('[data-suggestion-status=conflict]')).toContainText('Meerdere herkenningsregels');
 await first.locator('.u4-suggestion summary').click();await expect(first.locator('.u4-suggestion')).toContainText('Herkomst onbekend');
 await first.locator('[data-u4-suggestion-rule]').selectOption('clothes');await expect(first.locator('[data-u4-field=category]')).toHaveValue('Kleding');await expect(first.locator('.u4-status')).toHaveText('Nakijken');
 for(let i=0;i<5;i++)await page.locator('[data-u4-select-approval]').nth(i).check();
 await page.locator('.u4-bulk-section summary').click();await page.locator('[data-u4-bulk-scope]').selectOption('selected');await page.locator('[data-u4-bulk-category]').selectOption('Overig');
 page.once('dialog',dialog=>dialog.accept());await page.locator('[data-u4-apply-bulk]').click();
 const batchId=await page.evaluate(async()=>{const drafts=await FinizeUpdate4.importStore.listImports();return drafts.find(d=>d.fileName==='p4-review.csv').id;});
 await expect.poll(async()=>page.evaluate(async id=>{const journal=await FinizeUpdate4.importStore.getJournal('editor-draft-'+id);return journal?.draft.rows.map(r=>r.processing.category);},batchId)).toEqual([...Array(5).fill('Overig'),...Array(5).fill('Ongecategoriseerd')]);
 expect(await page.evaluate(()=>({goals:state.savingsGoalLedger,months:state.monthRecords,impact:FinizeTransactions.total('budgetImpact',{month:'2026-10'})}))).toEqual(before);
 await page.locator('[data-u4-close]').click();await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),batchId);await expect(page.locator('[data-u4-row]')).toHaveCount(10);
 await expect(page.locator('[data-u4-row]').first().locator('[data-u4-field=category]')).toHaveValue('Overig');
 const card=page.locator('[data-u4-row]').first();await card.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-only]')).toBeVisible();await page.locator('[data-u4-match-only]').click();await expect.poll(()=>page.evaluate(()=>state.transactions.filter(t=>t.recordRole!=='bank-source'&&t.approvalSource==='manual').length)).toBe(1);
 const approved=await page.evaluate(()=>state.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>({id:t.id,amount:t.amount,source:t.importTransactionId})));expect(approved).toHaveLength(1);expect(approved[0].amount).toBe(10);
 await page.locator('[data-u4-row]').nth(5).locator('.u4-suggestion summary').click();
 fs.mkdirSync(path.join(__dirname,'../../.cache/v118-p4'),{recursive:true});await page.screenshot({path:path.join(__dirname,`../../.cache/v118-p4/review-${width}.png`),fullPage:true});
 expect(await page.locator('.u4-import-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const metrics=await page.locator('[data-u4-row]').nth(5).locator('.u4-suggestion').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.getBoundingClientRect().width}));expect(metrics.font).toBeGreaterThanOrEqual(12);expect(metrics.width).toBeGreaterThan(150);
 await page.locator('[data-u4-close]').click();await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.evaluate(()=>state.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>({id:t.id,amount:t.amount,source:t.importTransactionId})))).toEqual(approved);expect(await page.evaluate(()=>state.recognitionRules.some(r=>r.provenance?.sourceRowId))).toBe(true);expect(errors).toEqual([]);
});

test('P4 refund en refundsplits tonen een lege correctiemaand en blijven onbevestigd',async({page})=>{await boot(page,390,true);let first=page.locator('[data-u4-row]').first();await first.locator('[data-u4-family]').selectOption('terugbetaling');await expect(first.locator('[data-u4-field=refundMonth]')).toHaveValue('');await first.locator('summary').filter({hasText:'Meer opties voor deze verwerking'}).click();await first.locator('[data-u4-add-split]').click();await expect(first.locator('[data-u4-split-field=refundMonth]')).toHaveCount(2);for(const input of await first.locator('[data-u4-split-field=refundMonth]').all())await expect(input).toHaveValue('');expect(await page.evaluate(()=>FinizeTransactions.total('refundCashflow',{month:'2026-10'}))).toBe(0);await expect(first.locator('.u4-status')).toHaveText('Nakijken');});
