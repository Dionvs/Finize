const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize}=require('./helpers/package5-fixture.cjs');
const engine=require('../src/core/transaction-engine.mjs');
const imports=require('../src/import/update4-runtime.cjs');
const {proposeSalaryPerson,salarySourceId}=require('../src/core/salary-assignment.mjs');
function fixture(){const s=state();s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:2500}],dara:[{effectiveFrom:'0000-01',salary:3200}]};return s;}
test('P4 unlinked joint salary cannot produce a reliable forecast or guess a person',()=>{
  const s=fixture();materialize(s,[row('salary','salaris',2530)]);const before=structuredClone(s);
  assert.throws(()=>engine.financialForecastForMonth(s,'2026-10'),{code:'salary-person-required'});assert.deepEqual(s,before);
});
test('P4 explicitly reopened legacy salary restores configured forecast and preserves source approval proof',()=>{
  const s=fixture(),payment=row('unassigned-salary','salaris',2530);materialize(s,[payment],'review-salary');
  const source=s.transactions.find(t=>t.recordRole==='bank-source'),effect=s.transactions.find(t=>t.recordRole!=='bank-source');
  const before=structuredClone(s),revision=source.processingRevision;
  require('../src/core/transaction-processing.mjs').reopenTransactionSource(s,effect.importBatchId,effect.importTransactionId);
  const current=s.transactions.find(t=>t.id===source.id),reopened=s.transactions.find(t=>t.id===effect.id);
  assert.deepEqual(current.bankOriginal,source.bankOriginal);assert.deepEqual(reopened.bankOriginal,effect.bankOriginal);
  assert.equal(current.processingStatus,'nakijken');assert.equal(current.processingRevision,revision+1);assert.equal(current.approvalHistory.at(-1).status,'goedgekeurd');assert.deepEqual(current.approvalHistory.at(-1).processing,source.approvedProcessing);assert.equal(reopened.processingStatus,'nakijken');
  const forecast=engine.financialForecastForMonth(s,'2026-10');assert.equal(forecast.owners.dion.salary,2500);assert.equal(forecast.owners.dara.salary,3200);assert.equal(forecast.owners.dion.salarySource,'planned');assert.equal(forecast.owners.dara.salarySource,'planned');
  assert.deepEqual(s.incomeDefaultsHistory,before.incomeDefaultsHistory);
});
function salary(id,person,amount,date='2026-10-03',employer='NL10EMPLOYER'){
  const r=row(id,'salaris',amount,{salaryLinkVersion:117,salaryPersonId:person});r.bankOriginal.bankDate=date;r.bankOriginal.counterpartyAccount=employer;return r;
}
test('P4 actual Dion 2530 and Dara 3200 replace only their planned salaries',()=>{
  const s=fixture(),goals=structuredClone(s.savingsGoalLedger);materialize(s,[salary('dion','dion',2530),salary('dara','dara',3200)],'both');
  const result=engine.financialForecastForMonth(s,'2026-10');
  assert.equal(result.owners.dion.salary,2530);assert.equal(result.owners.dara.salary,3200);assert.equal(result.household.income,5730);assert.equal(result.household.actualIncome,5730);
  assert.equal(result.owners.dion.allowance,2198.85);assert.equal(result.owners.dara.allowance,2781.15);assert.deepEqual(s.savingsGoalLedger,goals);
  assert.deepEqual(s.incomeDefaultsHistory,fixture().incomeDefaultsHistory);
  assert.deepEqual(s.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>t.salarySourceId),['dion','dara'].map(salarySourceId));
});
test('P4 salary proposals use employer and receiving bank accounts, never amount',()=>{
  const s=fixture();materialize(s,[salary('dion','dion',2530)]);
  const source={accountIdentifier:'NL01JOINT',counterpartyAccount:'NL10EMPLOYER',amount:99999};
  assert.equal(proposeSalaryPerson(source,s.transactions),'dion');assert.equal(proposeSalaryPerson({...source,counterpartyAccount:'NL99UNKNOWN',amount:2530},s.transactions),'');
  assert.equal(proposeSalaryPerson({...source,accountIdentifier:'NL02OTHER'},s.transactions),'');
  materialize(s,[salary('dara','dara',3200)],'dara');assert.equal(proposeSalaryPerson(source,s.transactions),'');
  for(const t of s.transactions)t.approvalSource='recognition';assert.equal(proposeSalaryPerson(source,s.transactions),'');
});
test('P4 CSV salary recognition proposes but cannot approve; unknown employer requires choice',()=>{
  const s=fixture();materialize(s,[salary('old','dion',2530)]);
  const make=employer=>imports.createImportDraft({text:`Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n2026-10-04;Salaris werkgever;NL01JOINT;${employer};3200`,profiles:s.accountProfiles,transactions:s.transactions,today:'2026-10-10'});
  const known=make('NL10EMPLOYER').rows[0],unknown=make('NL99UNKNOWN').rows[0];
  assert.equal(known.processing.salaryPersonId,'dion');assert.equal(known.approvalSource,'');assert.equal(imports.importReviewState(known),'nakijken');
  assert.equal(unknown.processing.salaryPersonId,'');assert.equal(imports.rowProcessingValidation(unknown,s).ok,false);
  known.processing.salaryPersonId='dara';assert.equal(imports.rowProcessingValidation(known,s).ok,true);
});
test('P4 holiday and bonus remain extra receipts even if linked to a salary source',()=>{
  const s=fixture();s.recurringIncomeSources=[{id:'old-salary-source',legacyKind:'salary',eigenaar:'dion'}];materialize(s,[salary('dion','dion',2530)]);
  s.transactions.push({id:'holiday',source:'manual',accountContext:'gezamenlijk',budgetOwner:'dion',date:'2026-10-05',amount:500,transactionType:'vakantiegeld',incomeSourceId:'old-salary-source'});
  materialize(s,[row('bonus','overige-inkomsten',100)],'bonus');const result=engine.financialForecastForMonth(s,'2026-10');
  assert.equal(result.owners.dion.salary,2530);assert.equal(result.owners.dion.extraIncome,500);assert.equal(result.household.income,6330);
  const rules=[{id:'salary-rule',enabled:true,level:'counterparty',value:'NL10EMPLOYER',transactionType:'salaris',category:'Inkomen'}];
  for(const [description,type]of [['Vakantiegeld','vakantiegeld'],['Bonus','overige-inkomsten'],['Nabetaling','nabetaling']]){
    const p=imports.classifyOriginal({description,rawDescription:description,amount:100,bankDate:'2026-10-05',counterpartyAccount:'NL10EMPLOYER',accountIdentifier:'NL01JOINT'},s.accountProfiles[0],rules,s.accountProfiles,[],s.transactions);
    assert.equal(p.processing.transactionType,type);assert.equal(p.processing.salaryPersonId,undefined);assert.equal(p.approvalSource,'');
  }
});
test('P4 bank month boundary and later salary planning preserve historic actuals',()=>{
  const s=fixture();materialize(s,[salary('september','dion',2530,'2026-09-30')]);
  require('../src/core/planning-timeline.mjs').setPlannedIncomeFromMonth(s,'dion','2026-11',2700,0);
  assert.equal(engine.financialForecastForMonth(s,'2026-09').owners.dion.salary,2530);assert.equal(engine.financialForecastForMonth(s,'2026-10').owners.dion.salary,2500);assert.equal(engine.financialForecastForMonth(s,'2026-11').owners.dion.salary,2700);
  assert.equal(engine.actualIncomeForMonth(s,'2026-10','dion').amount,0);
});

test('P4 a salary debit cannot be converted into a positive salary receipt',()=>{
  const s=fixture(),before=structuredClone(s);
  const plan=imports.planImportEffects({id:'reversal',accountProfileId:'joint',accountOwner:'gezamenlijk',rows:[salary('reversal','dion',-2530)],status:'concept'},s);
  assert.equal(plan.ok,false);assert.equal(plan.errors[0].code,'salary-direction');
  assert.deepEqual(s,before);
});
