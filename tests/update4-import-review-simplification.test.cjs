const assert=require('node:assert/strict');
const u4=require('../src/import/update4-runtime.cjs');

function processing(overrides={}){
  return {processingDate:'2026-08-05',processedAmount:100,budgetOwner:'gezamenlijk',category:'Overig',transactionType:'uitgave',include:true,fixedExpenseId:'',fixedAmountMode:'none',savingsGoalId:'',sourceAccountProfileId:'',destinationAccountProfileId:'',repaymentAllocations:[],budgetItemId:'',splits:[],advanceMode:'auto',...overrides};
}
function row(id,overrides={}){
  return {id,certainty:'nakijken',duplicate:false,bankOriginal:{valid:true,bankDate:'2026-08-05',amount:-100,description:'Leverancier',rawDescription:'Leverancier',counterpartyAccount:'NL01BANK0123456789',fingerprint:id},processing:processing(),...overrides};
}

const familyRow=row('family');
u4.applyTransactionFamily(familyRow,'inkomen');
assert.equal(u4.transactionFamily(familyRow.processing),'inkomen');
assert.equal(familyRow.processing.transactionType,'overige-inkomsten');
assert.equal(familyRow.processing.fixedExpenseId,'');

u4.applyTransactionFamily(familyRow,'sparen');
assert.equal(familyRow.processing.transactionType,'sparen');
assert.equal(familyRow.processing.category,'Sparen');

familyRow.processing.budgetOwner='gezamenlijk';
u4.applyTransactionFamily(familyRow,'zakgeld');
assert.equal(familyRow.processing.transactionType,'maandelijkse-bijdrage');
assert.equal(familyRow.processing.budgetOwner,'');

u4.applyTransactionFamily(familyRow,'extra-bijdrage');
assert.equal(familyRow.processing.transactionType,'extra-bijdrage');

u4.applyTransactionFamily(familyRow,'niet-meetellen');
assert.equal(familyRow.processing.transactionType,'niet-meetellen');
assert.equal(familyRow.processing.include,false);

const source=row('source');
const approved=row('approved',{certainty:'zeker'});
const pending=row('pending');
const matches=u4.matchCandidates({rows:[source,approved,pending]},source);
assert.deepEqual(matches.map(match=>match.row.id),['pending'],'alleen nog niet goedgekeurde regels worden voorgesteld');

const learned=u4.learnedRecognitionRules({rows:[row('fixed-approved',{
  certainty:'zeker',
  processing:processing({category:'Vaste lasten',transactionType:'vaste-last',fixedExpenseId:'fixed-energy'})
})]});
assert.equal(learned.length,1);
assert.equal(learned[0].level,'counterparty');
assert.equal(learned[0].transactionType,'vaste-last');
assert.equal(learned[0].fixedExpenseId,'fixed-energy');
assert.equal(learned[0].category,'Vaste lasten');
assert.equal('budgetOwner' in learned[0],false,'een herkenningsregel leert geen eigenaar');

const profile={id:'joint',identifier:'NL01TEST',accountOwner:'gezamenlijk'};
const fixedExpenses=[{id:'fixed-energy',naam:'Energie',financialFor:'gezamenlijk',rekening:'gezamenlijk',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}],monthOverrides:{}}];
const fixedRule={id:'energy',enabled:true,level:'counterparty',value:'NL01BANK0123456789',category:'Vaste lasten',transactionType:'vaste-last',fixedExpenseId:'fixed-energy'};
const safe=u4.classifyOriginal(row('safe').bankOriginal,profile,[fixedRule],[profile],fixedExpenses);
assert.equal(safe.processing.transactionType,'vaste-last');
assert.equal(safe.processing.fixedExpenseId,'fixed-energy');
assert.equal(safe.certainty,'zeker','sterke vaste-lastenmatch binnen tolerantie wordt zeker');
assert.equal(u4.expenseImpact('vaste-last',100,true),0,'vaste lasten tellen niet dubbel als variabele uitgave');

const deviatingOriginal={...row('deviating').bankOriginal,amount:-121};
const deviating=u4.classifyOriginal(deviatingOriginal,profile,[fixedRule],[profile],fixedExpenses);
assert.equal(deviating.certainty,'nakijken','bedrag buiten max 5 euro of 15 procent blijft nakijken');
assert.ok(deviating.reasons.some(reason=>reason.includes('bedrag wijkt')));

const missing=u4.classifyOriginal(row('missing').bankOriginal,profile,[fixedRule],[profile],[]);
assert.equal(missing.certainty,'nakijken','verdwenen vaste last blijft nakijken');

const invalidSaving={accountProfileId:'joint',rows:[row('saving',{processing:processing({transactionType:'sparen',category:'Sparen',savingsGoalId:''})})]};
const validation=u4.validateDraft(invalidSaving,{accountProfiles:[profile],spaardoelen:{gezamenlijk:[],dion:[],dara:[]},recurringFixedExpenses:{voor:[],na:[]}});
assert.ok(validation.errors.some(error=>error.code==='goal-choice'));

console.log('UPDATE4_IMPORT_REVIEW_SIMPLIFICATION_OK');
