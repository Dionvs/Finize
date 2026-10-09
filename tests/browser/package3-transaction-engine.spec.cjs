const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
test.setTimeout(60_000);test.use({actionTimeout:5000});
async function boot(page,width){
 await page.setViewportSize({width,height:900});
 await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());
 await page.route('https://firestore.googleapis.com/**',route=>route.abort());
 await page.addInitScript(input=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input));},fixture);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>commitChange(()=>{
  state.meta.selectedMonth='2026-10';state.transactions=[];
  state.accountProfiles=['gezamenlijk','dion','dara'].map(owner=>({id:owner,name:owner,accountOwner:owner,identifier:'NL01'+owner.toUpperCase()}));
  state.recurringFixedExpenses=[{id:'p3-hyp',naam:'Hypotheek test',bedrag:100,categorie:'Wonen',financialFor:'gezamenlijk',rekening:'gezamenlijk',actief:true,begindatum:'2026-01-01',frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}],monthOverrides:{}}];
  state.importSummaries=[];state.activeImportId='';
 },{render:true}));
}
async function draft(page,id,owner,lines){
 await page.evaluate(async({id,owner,lines})=>{
  const u=FinizeUpdate4Runtime;
  const rows=lines.map((line,index)=>({id:id+'-'+index,accountOwner:owner,source:'csv',certainty:line.unknown?'onbekend':'nakijken',recognitionState:line.unknown?'unknown':'known',duplicate:false,reasons:[],bankOriginal:{valid:true,bankDate:line.date||'2026-11-01',amount:line.amount,description:line.label,rawDescription:line.label,accountIdentifier:'NL01'+owner.toUpperCase(),counterpartyAccount:'',fingerprint:id+'-'+index,lineNumber:index+2},processing:{processingDate:line.date||'2026-11-01',processedAmount:Math.abs(line.amount),description:line.label,category:line.category||'Overig',budgetOwner:owner,transactionType:line.type||'uitgave',include:true,splits:[],advanceMode:'none',fixedAmountMode:'none',...line.processing}}));
  window.__p3Draft={id,fileName:id+'.csv',status:'concept',entryOwner:owner,accountOwner:owner,accountProfileId:owner,rows,summary:{}};
  u.updateDraftSummary(__p3Draft);
  commitChange(()=>{state.activeImportId=id;state.importSummaries.push(u.compactSummary(__p3Draft));},{render:false});
  await u.ImportStore.putImport(__p3Draft);u.testRenderDraftModal(window,__p3Draft);
  document.querySelectorAll('.u4-section-unknown,.u4-section-review,.u4-section-approved').forEach(section=>section.open=true);
 },{id,owner,lines});
}
async function editPersonalSource(page,width,label){
 if(width>=1000){await page.locator('#tab-dion').getByRole('button',{name:'Open transacties voor Overig',exact:true}).click();await page.locator('[data-open-budget-transaction-id]').filter({hasText:label}).first().click();}
 else await page.locator('#tab-dion [data-edit-personal-transaction]').filter({hasText:label}).first().click();
}
async function sections(page){await page.evaluate(()=>document.querySelectorAll('.u4-section-unknown,.u4-section-review,.u4-section-approved').forEach(section=>section.open=true));}
async function approve(page,id){await sections(page);await page.locator(`[data-u4-row="${id}"] [data-u4-approve]`).click();await expect.poll(()=>page.evaluate(id=>state.transactions.some(tx=>tx.importTransactionId===id&&['goedgekeurd','niet-meetellen'].includes(tx.processingStatus)),id)).toBe(true);}
async function process(page){await page.locator('[data-u4-process]').click();await expect.poll(()=>page.evaluate(()=>__p3Draft.status)).toBe('verwerkt');await expect(page.getByRole('heading',{name:'Import verwerkt'})).toBeVisible();}
async function openMore(page,id){const more=page.locator(`[data-u4-row="${id}"] details`).first();await more.evaluate(node=>node.open=true);}
for(const width of [390,1440])test(`Pakket 3 transacties, splits, fixed actuals, salaris en reload op ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await boot(page,width);
 for(const tab of ['dashboard','gezamenlijk','dion','dara']){await page.evaluate(tab=>document.querySelector(`#tabs [data-tab="${tab}"]`).click(),tab);await expect(page.locator('#tab-'+tab)).not.toBeEmpty();}
 await page.locator('#tab-dara [data-open-personal-transaction]').first().click();await page.locator('#transactionModal').getByRole('button',{name:/Handmatig invoeren/}).click();
 await page.locator('#personalTxAmount').fill('12.34');await page.locator('#personalTxDescription').fill('Manual pakket 3');await page.locator('#btnSavePersonalTransaction').click();
 expect(await page.evaluate(()=>FinizeTransactions.project(state.transactions.at(-1)))).toMatchObject({accountContext:'dara',financialFor:'dara',status:'goedgekeurd',active:true});
 await draft(page,'p3-fixed','gezamenlijk',[{amount:-150,label:'Hypotheekdeel',unknown:true},{amount:-20,label:'Extra afschrijving',processing:{transactionType:'vaste-last',category:'Vaste lasten',fixedExpenseId:'p3-hyp',fixedOccurrenceMonth:'2026-10',fixedOccurrenceId:'p3-hyp:2026-10-01'}},{amount:-9,label:'Niet meetellen',processing:{transactionType:'niet-meetellen',include:false}}]);
 const originals=await page.evaluate(()=>__p3Draft.rows.map(row=>structuredClone(row.bankOriginal)));
 const row=page.locator('[data-u4-row="p3-fixed-0"]');await openMore(page,'p3-fixed-0');await row.locator('[data-u4-add-split]').click();
 await openMore(page,'p3-fixed-0');await row.locator('[data-u4-split="0"] [data-u4-split-field="amount"]').fill('100');
 await row.locator('[data-u4-split="1"] [data-u4-split-field="amount"]').fill('40');await row.locator('[data-u4-approve]').click();
 await expect(page.locator('.u4-validation-dialog')).toContainText('te verdelen');await page.locator('[data-u4-validation-close]').click();expect(await page.evaluate(()=>state.transactions.filter(tx=>tx.recordRole!=='bank-source'&&tx.importBatchId==='p3-fixed').length)).toBe(0);
 await openMore(page,'p3-fixed-0');await row.locator('[data-u4-split="1"] [data-u4-split-field="amount"]').fill('50');
 await row.locator('[data-u4-split="0"] [data-u4-split-field="destination"]').selectOption('Vaste lasten');await openMore(page,'p3-fixed-0');
 await row.locator('[data-u4-split="0"] [data-u4-split-field="fixedOccurrenceMonth"]').fill('2026-10');await openMore(page,'p3-fixed-0');
 await row.locator('[data-u4-split="0"] [data-u4-split-field="fixedExpenseId"]').selectOption('p3-hyp');await openMore(page,'p3-fixed-0');
 await row.locator('[data-u4-split="0"] [data-u4-split-field="fixedOccurrenceId"]').selectOption('p3-hyp:2026-10-01');
 for(const id of ['p3-fixed-0','p3-fixed-1','p3-fixed-2'])await approve(page,id);await process(page);
 const fixed=()=>page.evaluate(()=>FinizeTransactions.fixedActual({id:'p3-hyp:2026-10-01',month:'2026-10',amount:100}));
 expect(await fixed()).toMatchObject({planned:100,actual:120,deviation:20,status:'Betaald'});
 expect(await page.evaluate(()=>({budget:FinizeTransactions.total('budgetImpact',{month:'2026-11'}),cash:FinizeTransactions.total('accountCashflow',{month:'2026-11',account:'gezamenlijk'}),income:FinizeUpdate3.actualIncome('2026-11')}))).toEqual({budget:50,cash:-170,income:0});
 await page.evaluate(()=>FinizeUpdate4Runtime.testRenderDraftModal(window,__p3Draft));await sections(page);await page.locator('[data-u4-row="p3-fixed-0"] [data-u4-reopen]').click();await expect.poll(()=>fixed().then(p=>p.actual)).toBe(120); // editing keeps the approved payment active
 await approve(page,'p3-fixed-0');await expect.poll(()=>fixed().then(p=>p.actual)).toBe(120);
 expect(await page.evaluate(()=>__p3Draft.rows.map(row=>row.bankOriginal))).toEqual(originals);
 await page.locator('[data-u4-close]').first().click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await draft(page,'p3-income','dion',[{amount:2645,label:'Werkgever expliciet',date:'2026-10-25',type:'salaris'},{amount:100,label:'Losse vergoeding',date:'2026-10-12',type:'vergoeding'}]);
 for(const id of ['p3-income-0','p3-income-1'])await approve(page,id);await process(page);
 expect(await page.evaluate(()=>FinizeUpdate3.actualIncome('2026-10','dion'))).toBe(2745);
 await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());
 const incomeCard=width===390?page.locator('#tab-gezamenlijk .mobile-kpi-card.joint-total-income-card'):page.locator('#tab-gezamenlijk .overview-kpi-row .icon-kpi').filter({hasText:'Totaal gezamenlijk inkomen'});await expect(incomeCard).toContainText('5.655,00'); // actual salary and extra income; purchase refund is not salary or income
 await page.locator('[data-u4-close]').first().click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 const before=await page.evaluate(()=>({tx:structuredClone(state.transactions),ledger:structuredClone(state.savingsGoalLedger),planning:structuredClone(state.planning),revision:state.meta.revision}));
 await page.setViewportSize({width:width===390?1440:390,height:900});await page.evaluate(()=>{state.meta.selectedMonth='2026-09';renderActiveTab();});
 expect(await page.evaluate(()=>FinizeUpdate3.actualIncome('2026-09'))).toBe(0);
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await fixed()).toMatchObject({actual:120,status:'Betaald'});
 expect(await page.evaluate(()=>({tx:state.transactions,ledger:state.savingsGoalLedger,planning:state.planning,revision:state.meta.revision}))).toEqual(before);
 expect(errors).toEqual([]);await page.screenshot({path:test.info().outputPath('package3-'+width+'.png'),fullPage:false});
});
for(const width of [390,1440])test(`Pakket 3 expliciete replacement en transferpaar op ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await boot(page,width);
 await page.evaluate(()=>commitChange(()=>state.transactions.push({id:'p3-manual',source:'manual',processingStatus:'goedgekeurd',accountContext:'dion',account:'dion',owner:'dion',financialFor:'dion',budgetOwner:'dion',kind:'uitgave',transactionType:'uitgave',date:'2026-10-12',amount:50,category:'Overig',description:'Manual duplicate',splits:[{id:'copy-1',amount:30,category:'Overig',budgetOwner:'dion',transactionType:'uitgave'},{id:'copy-2',amount:20,category:'Overig',budgetOwner:'dion',transactionType:'uitgave'}]}),{render:false}));
 await draft(page,'p3-replacement','dion',[{amount:-55,label:'Official bank source',date:'2026-10-13'}]);
 expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(50);
 await openMore(page,'p3-replacement-0');const row=page.locator('[data-u4-row="p3-replacement-0"]');await row.locator('[data-u4-replacement-choice]').selectOption('p3-manual');await row.locator('[data-u4-confirm-replacement]').click();
 await expect.poll(()=>page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(0);
 expect(await page.evaluate(()=>state.transactions.some(tx=>tx.id==='p3-manual'))).toBe(true);
 expect(await page.evaluate(()=>({status:__p3Draft.rows[0].certainty,amount:__p3Draft.rows[0].processing.processedAmount,description:__p3Draft.rows[0].processing.description}))).toEqual({status:'nakijken',amount:55,description:'Official bank source'});
 await row.locator('[data-u4-approve]').click();await expect(page.locator('.u4-validation-dialog')).toContainText('te verdelen');await page.locator('[data-u4-validation-close]').click();
 await openMore(page,'p3-replacement-0');await row.locator('[data-u4-split="1"] [data-u4-split-field="amount"]').fill('25');await approve(page,'p3-replacement-0');await process(page);
 expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(55);
 await page.locator('[data-u4-close]').first().click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await page.evaluate(()=>document.querySelector('#tabs [data-tab="dion"]').click());
 await editPersonalSource(page,width,'Official bank source');
 await expect(page.locator('#u4ImportModalRoot')).toHaveClass(/open/);await expect(page.locator('[data-u4-row="p3-replacement-0"]')).toBeVisible();
 await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(55);
 await page.locator('[data-u4-close]').first().click();await expect(page.locator('#u4ImportModalRoot')).not.toHaveClass(/open/);
 await page.evaluate(async()=>{
  const make=(id,account,amount)=>({id,date:'2026-10-10',transactionDate:'2026-10-10',amount:Math.abs(amount),source:'csv',bankOriginal:{bankDate:'2026-10-10',amount,description:'Internal '+id},importBatchId:'p3-transfers',importTransactionId:id,accountContext:account,account:account,accountOwner:account,budgetOwner:account,financialFor:account,owner:account,kind:'interne-overboeking',transactionType:'interne-overboeking',processingStatus:'goedgekeurd',certainty:'goedgekeurd',approvalSource:'manual'});
  commitChange(()=>{state.transactions.push(make('transfer-out','dion',-500),make('transfer-in','gezamenlijk',500));state.internalTransferPairs.push({id:'p3-pair',status:'voorgesteld',transactionIds:['transfer-out','transfer-in'],amount:500});},{render:false});
  window.__transferDraft={id:'p3-transfers',fileName:'transfers.csv',status:'verwerkt',accountProfileId:'dion',accountOwner:'dion',rows:[],summary:{}};FinizeUpdate4Runtime.testRenderDraftModal(window,__transferDraft);
 });
 expect(await page.evaluate(()=>FinizeTransactions.total('unconfirmedTransferCashflow',{month:'2026-10',account:'dion'}))).toBe(-500);
 await page.locator('[data-u4-confirm-pair="p3-pair"]').evaluate(node=>node.closest('details').open=true);await page.locator('[data-u4-confirm-pair="p3-pair"]').click();
 expect(await page.evaluate(()=>state.internalTransferPairs.find(pair=>pair.id==='p3-pair').status)).toBe('bevestigd');
 expect(await page.evaluate(()=>({dion:FinizeTransactions.total('accountCashflow',{month:'2026-10',account:'dion'}),joint:FinizeTransactions.total('accountCashflow',{month:'2026-10',account:'gezamenlijk'}),household:FinizeTransactions.total('externalHouseholdCashflow',{month:'2026-10'})}))).toEqual({dion:-555,joint:500,household:-55});expect(errors).toEqual([]);
});

for(const width of [390,1440])test(`Legacy CSV zonder importreferentie blijft intact op ${width}px`,async({page})=>{
 await boot(page,width);
 await page.evaluate(()=>{commitChange(()=>state.transactions.push({id:'legacy-bank',source:'csv',approvalSource:'legacy-confirmed',processingStatus:'goedgekeurd',accountContext:'dion',account:'dion',owner:'dion',financialFor:'dion',budgetOwner:'dion',date:'2026-10-01',amount:25,kind:'uitgave',category:'Overig',description:'Legacy bank source',bankOriginal:{bankDate:'2026-10-01',amount:-25,description:'Legacy bank source'}}),{render:false});document.querySelector('#tabs [data-tab="dion"]').click();});
 const before=await page.evaluate(()=>JSON.stringify(state));let message='';page.on('dialog',async dialog=>{message=dialog.message();await dialog.accept();});
 await editPersonalSource(page,width,'Legacy bank source');
 await expect(page.locator('[data-u4-repair-file]')).toBeVisible();await expect(page.locator('#u4ImportModalRoot')).toContainText('bronkoppeling ontbreekt');expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(25);
 await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
});
