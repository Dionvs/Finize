const {test}=require('node:test'),assert=require('node:assert/strict');
const u=require('../src/import/update4-runtime.cjs');
const {state,row,copy,materialize,memory}=require('./helpers/package5-fixture.cjs');
const engine=require('../src/core/transaction-engine.mjs');
test('audit controlled merchant aliases preserve raw evidence, categories and independent payments',()=>{
 const expected={'Jumbo Middelburg':'jumbo','Jumbo Vlissingen':'jumbo','Jumbo Foodmarkt':'jumbo','AH Middelburg':'albert heijn','AH Vlissingen':'albert heijn','Albert Heijn 1234':'albert heijn','AH to go Rotterdam':'ah to go'};
 for(const [name,merchant] of Object.entries(expected))assert.equal(u.organizationName(name),merchant);
 for(const name of ['Shahin Restaurant','Bahla','AH Adviesbureau','AH to go Transport','Jumbo Bouwbedrijf','Jumbo Middelburg Consulting']){
  assert(!['jumbo','albert heijn','ah to go'].includes(u.organizationName(name)),name);
 }
 const rows=Array.from({length:8},(_,i)=>{const r=row('shop-'+i,'uitgave',-10);r.bankOriginal.description=r.bankOriginal.rawDescription=i<5?'Jumbo Middelburg':'Jumbo Vlissingen';r.approvalSource='';return r;});
 const before=copy(rows);assert.equal(u.matchCandidates({rows},rows[0]).length,7);assert.deepEqual(rows,before);assert.equal(new Set(rows.map(row=>row.id)).size,8);
 const rules=[{id:'branch-a',level:'organization',value:'Jumbo Middelburg',category:'Kleding',transactionType:'uitgave'},{id:'branch-b',level:'organization',value:'Jumbo Vlissingen',category:'Anders',transactionType:'uitgave'}];
 assert.equal(u.recognitionProposal(rows[0].bankOriginal,rules).conflict,true);assert.deepEqual(rules.map(rule=>rule.category),['Kleding','Anders']);
});
test('audit merchant learning uses canonical organization while context and approval remain mandatory',()=>{
 const s=state(),r=row('learn','uitgave',-10);r.accountProfileId='joint';r.bankOriginal.description=r.bankOriginal.rawDescription='Jumbo Middelburg';
 const learned=u.learnedRecognitionRules({id:'learn',accountProfileId:'joint',accountOwner:'gezamenlijk',rows:[r]});assert.equal(learned[0].value,'jumbo');
 const original={...r.bankOriginal,description:'Jumbo Vlissingen',rawDescription:'Jumbo Vlissingen'};
 const p=u.classifyOriginal(original,s.accountProfiles[0],learned,s.accountProfiles,[],[],s);assert.equal(p.approvalSource,'');assert.equal(p.processing.category,'Kleding');
 assert.equal(u.recognitionProposal(original,learned,{id:'other',accountOwner:'dara'}),null);
});
test('audit existing fixed and salary replacements count actuals once without historical or future changes',()=>{
 const s=state();s.recurringFixedExpenses=[{id:'fixed',naam:'Hypotheek',categorie:'Wonen',bedrag:100,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}]}];const before=copy(s.recurringFixedExpenses);
 materialize(s,[row('paid','vaste-last',-110,{fixedExpenseId:'fixed',fixedOccurrenceId:'fixed:2026-10-01',fixedOccurrenceMonth:'2026-10'})],'fixed-batch');
 const f=engine.financialForecastForMonth(s,'2026-10');assert.equal(f.owners.gezamenlijk.fixedBurden,110);assert.equal(f.owners.gezamenlijk.variableBurden,0);assert.deepEqual(s.recurringFixedExpenses,before);
 assert.equal(engine.financialForecastForMonth(s,'2026-11').owners.gezamenlijk.fixedBurden,100);assert.equal(engine.financialForecastForMonth(s,'2026-09').owners.gezamenlijk.fixedBurden,100);
 materialize(s,[row('salary','salaris',2500,{salaryPersonId:'dion',salaryLinkVersion:117})],'salary-batch');
 assert.equal(engine.financialForecastForMonth(s,'2026-10').owners.dion.salary,2500);assert.equal(engine.financialForecastForMonth(s,'2026-11').owners.dion.salary,3000);
});
test('audit equal actual salaries stay independent until explicit manual replacement preserves original evidence',()=>{
 const s=state(),manual={id:'manual-salary',source:'manual',date:'2026-10-03',amount:2500,accountContext:'dion',financialFor:'dion',budgetOwner:'dion',salaryPersonId:'dion',transactionType:'salaris',category:'Salaris'};
 s.transactions.push(manual);const original=copy(manual),history=copy(s.monthRecords);
 const bank=row('bank-salary','salaris',2500,{salaryPersonId:'dion',salaryLinkVersion:117});bank.processing.manualMatchId=manual.id;
 const unlinked=copy(s);materialize(unlinked,[copy(bank)],'unlinked');
 assert.equal(engine.financialForecastForMonth(unlinked,'2026-10').owners.dion.salary,5000);assert.equal(unlinked.manualTransactionReplacements.length,0);
 engine.confirmManualReplacement(s,bank,manual.id,'explicit-replacement');assert.equal(bank.approvalSource,'');
 u.markExplicitlyApproved(bank);materialize(s,[bank],'explicit-replacement');
 assert.equal(engine.financialForecastForMonth(s,'2026-10').owners.dion.salary,2500);assert.deepEqual(s.transactions.find(row=>row.id===manual.id),original);
 assert.deepEqual(s.manualTransactionReplacements[0].manualTransaction,original);assert.deepEqual(s.monthRecords,history);
});
for(const scenario of ['restore-current','missing-cloud','newer-cloud','concurrent-local','concurrent-new','concurrent-vanished','pending-conflict'])test('audit provider import base '+scenario+' preserves financial state and local choices',async()=>{
 const mem=memory();try{
  const s=state(),old={id:'api-test',channel:'bank-api',lifecycle:'active',status:'concept',version:1,operationId:'old',rows:[row('r')],summary:{}};
  const remote={...copy(old),version:2,operationId:'remote'};remote.rows[0].processing.category='New cloud choice';
  if(scenario!=='concurrent-new')mem.imports.set(old.id,copy(old));s.importSummaries=[u.compactSummary(['restore-current','concurrent-local','concurrent-new','concurrent-vanished'].includes(scenario)?remote:old)];
  const root={state:s,CloudAdapter:{isConnected:()=>true,recordSession:{pendingImportBaseMatches:async()=>false,loadImport:async()=>{
   if(scenario==='missing-cloud')throw Object.assign(Error('missing'),{code:'cloud-missing'});
   if(['concurrent-local','concurrent-new'].includes(scenario))mem.imports.set(old.id,{...copy(old),version:3,operationId:'concurrent'});
   if(scenario==='concurrent-vanished')mem.imports.delete(old.id);
   return copy(remote);
  }}}};
  if(scenario==='pending-conflict')mem.queue.set(old.id,{id:old.id,importId:old.id,version:1,operationId:'old'});
  const financial=copy(s);
  if(scenario==='restore-current'){
   const result=await u.resolveProviderImportBase(root,old.id);assert.equal(result.version,2);assert.equal(result.rows[0].processing.category,'New cloud choice');
  }else{
   await assert.rejects(u.resolveProviderImportBase(root,old.id),{code:scenario==='missing-cloud'?'cloud-missing':'import-conflict'});
   const saved=await u.ImportStore.getImport(old.id);if(scenario==='concurrent-vanished')assert.equal(saved,undefined);else {assert.equal(saved.operationId,['concurrent-local','concurrent-new'].includes(scenario)?'concurrent':'old');assert.equal(saved.rows[0].approvalSource,'manual');assert.deepEqual(saved.rows[0].bankOriginal,old.rows[0].bankOriginal);}
  }
  assert.deepEqual(s,financial);
 }finally{mem.restore();}
});
