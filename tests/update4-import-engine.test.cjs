const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const u4=require('../update4.js');

const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8');
const profiles=[
  {id:'dion-ing',name:'ING Dion',identifier:'NL01INGB0000000001',bank:'ING',csvFormat:'ing',accountOwner:'dion'},
  {id:'dara-ing',name:'ING Dara',identifier:'NL02INGB0000000002',bank:'ING',csvFormat:'ing',accountOwner:'dara'},
  {id:'joint-ing',name:'ING Gezamenlijk',identifier:'NL03INGB0000000003',bank:'ING',csvFormat:'ing',accountOwner:'gezamenlijk'}
];
const rules=[
  {id:'ah',enabled:true,level:'organization',value:'albert heijn',category:'Boodschappen',transactionType:'uitgave'},
  {id:'netflix',enabled:true,level:'description',value:'netflix abonnement',category:'Entertainment',transactionType:'uitgave',fixedExpenseId:'netflix'}
];

const dion=u4.createImportDraft({text:fixture('ing-dion.csv'),fileName:'dion.csv',profiles,rules,id:'batch-dion'});
assert.equal(dion.format,'ing');
assert.equal(dion.accountOwner,'dion');
assert.equal(dion.summary.newCount,2);
assert.equal(dion.rows[0].processing.transactionType,'salaris');
assert.equal(dion.rows[0].certainty,'nakijken');
assert.equal(dion.rows[1].accountOwner,'dion');
assert.equal(dion.rows[1].processing.budgetOwner,'dion');
assert.equal(dion.rows[1].certainty,'zeker');

const dara=u4.createImportDraft({text:fixture('ing-dara.csv'),fileName:'dara.csv',profiles,rules,id:'batch-dara'});
assert.equal(dara.accountOwner,'dara');
assert.equal(dara.rows[1].certainty,'nakijken','vaste-lastenkoppeling blijft nakijken');

const joint=u4.createImportDraft({text:fixture('ing-gezamenlijk.csv'),fileName:'joint.csv',profiles,rules,id:'batch-joint'});
assert.equal(joint.accountOwner,'gezamenlijk');
assert.equal(joint.rows[1].processing.transactionType,'interne-overboeking');
assert.equal(joint.rows[1].certainty,'nakijken');

const duplicate=u4.createImportDraft({text:fixture('ing-dion.csv'),fileName:'overlap.csv',profiles,rules,id:'batch-overlap',transactions:[{bankOriginal:{fingerprint:dion.rows[1].bankOriginal.fingerprint}}]});
assert.equal(duplicate.summary.duplicateCount,1);
assert.equal(duplicate.summary.newCount,1);

const conflict=u4.classifyOriginal(dion.rows[1].bankOriginal,profiles[0],[
  {id:'a',enabled:true,level:'counterparty',value:'NL22BANK0000000022',category:'Boodschappen',transactionType:'uitgave'},
  {id:'b',enabled:true,level:'counterparty',value:'NL22BANK0000000022',category:'Overig',transactionType:'uitgave'}
],profiles);
assert.equal(conflict.certainty,'nakijken');
assert.ok(conflict.reasons.includes('conflicterende herkenningsregels'));

const changed={...dion.rows[1].bankOriginal,amount:-40,bankDate:'2026-08-01'};
assert.notEqual(u4.fingerprint(changed,'dion-ing'),dion.rows[1].bankOriginal.fingerprint);
console.log('UPDATE4_IMPORT_ENGINE_OK');
