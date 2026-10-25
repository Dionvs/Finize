const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {state:fixture}=require('../helpers/package5-fixture.cjs');
test.setTimeout(90000);
async function boot(page,customCsv=''){
 await page.setViewportSize({width:390,height:900});
 await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
 await page.route('https://**',route=>route.abort());
 const seed={...visual,...fixture()};seed.meta.selectedMonth='2026-10';seed.monthRecords={};
 seed.recognitionRules=[{id:'jumbo',level:'keyword',value:'jumbo',category:'Kleding',budgetItemId:'food',transactionType:'uitgave'}];
 await page.addInitScript(value=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));},seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
 const csv=customCsv||'Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+Array.from({length:7},(_,i)=>`2026-10-03;Jumbo Middelburg;NL01JOINT;NL99SHOP;-${10+i}.00`).join('\n');
 await page.locator('[data-u4-file]').setInputFiles({name:'audit-bulk.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.locator('[data-u4-row]').first()).toBeVisible();
 return page.evaluate(async()=> (await FinizeUpdate4.importStore.listImports()).find(batch=>batch.fileName==='audit-bulk.csv').id);
}
test('audit six selected retain category and approval after native IndexedDB reload; seventh unchanged',async({page},info)=>{
 const id=await boot(page);
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();
 await expect(page.locator('[data-u4-match-id]')).toHaveCount(7);
 await page.locator('[data-u4-match-id]').last().uncheck();
 await expect(page.locator('[data-u4-match-apply]')).toContainText('(6)');
 await page.locator('[data-u4-match-apply]').click();
 await expect(page.locator('[data-u4-group-result]')).toContainText('6 van 6');
 const inspect=()=>page.evaluate(async id=>{const batch=await FinizeUpdate4.importStore.getImport(id);return {rows:batch.rows.map(row=>({id:row.id,category:row.processing.category,status:row.processingStatus,approval:row.approvalSource})),effects:state.transactions.filter(row=>row.recordRole!=='bank-source').map(row=>({id:row.id,amount:row.amount}))};},id);
 const first=await inspect();expect(first.rows.filter(row=>row.approval==='manual')).toHaveLength(6);expect(first.effects).toHaveLength(6);
 expect(first.rows.slice(0,6).every(row=>row.category==='Kleding'&&row.status==='goedgekeurd')).toBe(true);expect(first.rows[6].approval).toBe('');
 await page.screenshot({path:info.outputPath('bulk-six.png'),fullPage:true});
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await inspect()).toEqual(first);
 await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);
 await expect(page.locator('.u4-section-review [data-u4-row]')).toHaveCount(1);
});
test('audit mixed month presentation pins context and limits all matches and bulk to that month',async({page},info)=>{
 const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+Array.from({length:8},(_,i)=>`${i<3?'2026-09-30':'2026-10-03'};Jumbo Middelburg;NL01JOINT;NL99SHOP;-${10+i}.00`).join('\n');
 const id=await boot(page,csv);
 const originals=await page.evaluate(async id=>(await FinizeUpdate4.importStore.getImport(id)).rows.map(row=>row.bankOriginal),id);
 await expect(page.locator('[data-u4-row]')).toHaveCount(5);
 await expect(page.locator('[data-u4-month-context]')).toContainText('oktober');
 await expect(page.locator('.u4-import-summary')).toContainText('75,00');
 await page.locator('.u4-bulk-section summary').click();await page.locator('[data-u4-bulk-scope]').selectOption('all');await page.locator('[data-u4-bulk-category]').selectOption('Ongecategoriseerd');
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('5 transacties');await dialog.accept();});await page.locator('[data-u4-apply-bulk]').click();
 const scoped=await page.evaluate(async id=>(await FinizeUpdate4.importStore.getJournal('editor-draft-'+id))?.draft.rows.map(row=>row.processing.category),id);
 await expect.poll(()=>page.evaluate(async id=>(await FinizeUpdate4.importStore.getJournal('editor-draft-'+id))?.draft.rows.map(row=>row.processing.category),id)).toEqual([...Array(3).fill('Kleding'),...Array(5).fill('Ongecategoriseerd')]);
 await page.locator('[data-u4-row]').first().locator('[data-u4-field=category]').selectOption('Kleding');
 await page.evaluate(()=>{state.meta.selectedMonth='2026-09';});
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();
 await expect(page.locator('[data-u4-match-id]')).toHaveCount(5);
 await page.locator('[data-u4-match-apply]').click();await expect(page.locator('[data-u4-group-result]')).toContainText('5 van 5');
 await expect(page.locator('[data-u4-month-context]')).toContainText('oktober');
 const rows=await page.evaluate(async id=>(await FinizeUpdate4.importStore.getImport(id)).rows,id);
 expect(rows.slice(0,3).every(row=>!row.approvalSource)).toBe(true);expect(rows.map(row=>row.bankOriginal)).toEqual(originals);
 await page.locator('[data-u4-view-month]').selectOption('');await expect(page.locator('[data-u4-row]')).toHaveCount(8);
 await page.locator('[data-u4-view-month]').selectOption('2026-09');await expect(page.locator('[data-u4-row]')).toHaveCount(3);
 await expect(page.locator('.u4-import-summary')).toContainText('33,00');
 await page.screenshot({path:info.outputPath('september-only.png'),fullPage:true});
 expect(await page.locator('.u4-import-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.locator('[data-u4-close]').click();await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
 await expect(page.locator('[data-u4-receipt-totals]')).toContainText('3 transacties');await expect(page.locator('[data-u4-receipt-totals]')).toContainText('33,00');
 await page.locator('[data-u4-all-imports]').click();await page.locator('[data-u4-open-receipt]').click();await expect(page.locator('select[data-u4-view-month]')).toHaveValue('');
 await expect(page.locator('[data-u4-row]')).toHaveCount(8);
 await page.locator('[data-u4-close]').click();await page.evaluate(()=>{FinizeUpdate4.importStore.getImport=async()=>{throw Error('synthetic unavailable details');};openBankImportForOwner('gezamenlijk');});
 await expect(page.locator('[data-u4-receipt-totals]')).toContainText('Maandtotalen nog niet beschikbaar');
});
test('audit native storage failure reports partial group and retry never doubles approved effects',async({page})=>{
 const id=await boot(page);
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();
 await page.locator('[data-u4-match-id]').last().uncheck();
 await page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;let writes=0;
  IDBObjectStore.prototype.put=function(record,...args){
   if(this.name==='imports'&&++writes===2){
    this.transaction.abort();throw new DOMException('Synthetic native import write failed','QuotaExceededError');
   }
   return put.call(this,record,...args);
  };
 });
 await page.locator('[data-u4-match-apply]').click();
 await expect(page.locator('[data-u4-group-result]')).toContainText('1 van 6');
 await expect(page.locator('[data-u4-group-result]')).toContainText('4 niet geprobeerd');
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.evaluate(()=>state.transactions.filter(row=>row.recordRole!=='bank-source').length)).toBe(1);
 await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);
 await page.locator('.u4-section-review [data-u4-approve]').first().click();
 await page.locator('[data-u4-match-id]').last().uncheck();
 await page.locator('[data-u4-match-apply]').click();
 await expect(page.locator('[data-u4-group-result]')).toContainText('5 van 5');
 const final=await page.evaluate(()=>state.transactions.filter(row=>row.recordRole!=='bank-source').map(row=>row.id));
 expect(final).toHaveLength(6);expect(new Set(final).size).toBe(6);
});
test('audit five Middelburg plus three Vlissingen form eight independent approvals; unknown merchant and undated source stay outside',async({page})=>{
 const csv='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n'+Array.from({length:9},(_,i)=>`2026-10-03;${i<5?'Jumbo Middelburg':i<8?'Jumbo Vlissingen':'Jumbo Bouwbedrijf'};NL01JOINT;;-10.00`).join('\n')+'\n;Zonder datum;NL01JOINT;;-11.00';
 const id=await boot(page,csv);
 await expect(page.locator('[data-u4-undated]')).toContainText('1 bronregel');
 const before=await page.evaluate(async id=>(await FinizeUpdate4.importStore.getImport(id)).rows.map(row=>row.bankOriginal),id);
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-id]')).toHaveCount(8);
 await page.locator('[data-u4-match-apply]').click();await expect(page.locator('[data-u4-group-result]')).toContainText('8 van 8');
 const final=await page.evaluate(async id=>({rows:(await FinizeUpdate4.importStore.getImport(id)).rows,effects:state.transactions.filter(row=>row.recordRole!=='bank-source')}),id);
 expect(final.effects).toHaveLength(8);expect(new Set(final.effects.map(row=>row.id)).size).toBe(8);expect(final.rows.map(row=>row.bankOriginal)).toEqual(before);
 expect(final.rows[8].approvalSource).toBe('');expect(final.rows[9].approvalSource).toBe('');
 await page.locator('select[data-u4-view-month]').selectOption('');await expect(page.locator('.u4-modal-body')).toContainText('Importfouten');
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>state.transactions.filter(row=>row.recordRole!=='bank-source').length)).toBe(8);
});
test('audit existing fixed occurrence flow replaces 100 planning with 110 actual and keeps future settings',async({page},info)=>{
 await boot(page,'Datum;Omschrijving;Rekening;Bedrag\n2026-10-03;Hypotheek;NL01JOINT;-110.00');
 await page.evaluate(()=>commitChange(()=>{state.recurringFixedExpenses=[{id:'fixed-test',naam:'Hypotheek',categorie:'Wonen',bedrag:100,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-01-03',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}]}];},{render:false}));
 const card=page.locator('[data-u4-row]').first();await card.locator('[data-u4-field=category]').selectOption('Vaste lasten');
 await card.locator('[data-u4-field=fixedExpenseId]').selectOption('fixed-test');await card.locator('[data-u4-field=fixedOccurrenceId]').selectOption('fixed-test:2026-10-03');
 await expect(card).toContainText('De toekomstige planning blijft behouden');
 await card.screenshot({path:info.outputPath('fixed-occurrence.png')});
 await card.locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-group-result]')).toContainText('1 van 1');
 expect(await page.evaluate(()=>({actual:FinizeTransactions.forecast('2026-10').owners.gezamenlijk.fixedBurden,next:FinizeTransactions.forecast('2026-11').owners.gezamenlijk.fixedBurden,prior:FinizeTransactions.forecast('2026-09').owners.gezamenlijk.fixedBurden}))).toEqual({actual:110,next:100,prior:100});
});
test('audit six approvals use real IndexedDB and simulated record-cloud responses with durable readback',async({page})=>{
 const id=await boot(page);await require('../helpers/audit-record-cloud.cjs').attachMockRecordCloud(page);
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();await page.locator('[data-u4-match-id]').last().uncheck();await page.locator('[data-u4-match-apply]').click();
 await expect(page.locator('[data-u4-group-result]')).toContainText('6 van 6');
 const outcome=await page.evaluate(()=>auditRecordSession.sync());expect(outcome.outcome).toBe('committed');
 const remote=await page.evaluate(async id=>{const batch=await auditRecordSession.loadImport(id);return {approvals:batch.rows.map(row=>row.approvalSource),integrity:(await auditRecordSession.cloudStore.verifyIntegrity()).head.revision};},id);
 expect(remote.approvals.filter(value=>value==='manual')).toHaveLength(6);expect(remote.approvals[6]).toBe('');
 expect((await page.evaluate(()=>auditRecordSession.sync())).outcome).toBe('idle');
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>state.transactions.filter(row=>row.recordRole!=='bank-source').length)).toBe(6);
});
test('audit late import response cannot reopen closed modal and a historical source opens its own month',async({page})=>{
 const csv='Datum;Omschrijving;Rekening;Bedrag\n2026-09-30;Jumbo Middelburg;NL01JOINT;-10.00\n2026-10-03;Jumbo Middelburg;NL01JOINT;-11.00';const id=await boot(page,csv);
 await page.evaluate(async id=>{const batch=await FinizeUpdate4.importStore.getImport(id);window.auditHistoricalRow=batch.rows[0].id;},id);
 await page.evaluate(id=>FinizeUpdate4.openImportDetails(id,auditHistoricalRow),id);await expect(page.locator('select[data-u4-view-month]')).toHaveValue('2026-09');await expect(page.locator('[data-u4-row]')).toHaveCount(1);
 await page.evaluate(id=>{
  const store=FinizeUpdate4.importStore,get=store.getImport.bind(store);let first=true;
  store.getImport=async key=>{if(key===id&&first){first=false;window.auditReadStarted=true;await new Promise(resolve=>window.auditReleaseRead=resolve);}return get(key);};
  window.auditPendingOpen=FinizeUpdate4.openImportDetails(id);
 },id);
 await page.waitForFunction(()=>window.auditReadStarted);await page.locator('[data-u4-close]').click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await page.evaluate(async()=>{auditReleaseRead();await auditPendingOpen;});await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await page.evaluate(id=>FinizeUpdate4.openImportDetails(id),id);
 await page.evaluate(id=>{
  const store=FinizeUpdate4.importStore,get=store.getJournal.bind(store);let first=true;
  store.getJournal=async key=>{if(key==='conflict-'+id&&first){first=false;window.auditJournalStarted=true;await new Promise(resolve=>window.auditReleaseJournal=resolve);}return get(key);};
  window.auditPendingOpen=FinizeUpdate4.openImportDetails(id);
 },id);
 await page.waitForFunction(()=>window.auditJournalStarted);await page.locator('[data-u4-close]').click();
 await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await page.evaluate(async()=>{auditReleaseJournal();await auditPendingOpen;});await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
});
for(const width of [320,430,1440])test('audit import presentation and approval dialog fit '+width+'px without runtime errors',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await boot(page);await page.setViewportSize({width,height:900});
 await expect(page.locator('select[data-u4-view-month]')).toHaveValue('2026-10');
 expect(await page.locator('.u4-import-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.locator('[data-u4-row]').first().locator('[data-u4-approve]').click();await expect(page.locator('[data-u4-match-id]')).toHaveCount(7);
 expect(await page.locator('.u4-match-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('review-'+width+'.png')});expect(errors).toEqual([]);
});
