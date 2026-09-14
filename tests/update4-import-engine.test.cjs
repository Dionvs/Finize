const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const u4=require('../src/import/update4-runtime.cjs');

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
assert.equal(dion.rows[1].certainty,'nakijken','herkende boodschappen blijven wachten op expliciete goedkeuring');
assert.equal(dion.rows[1].processing.category,'Boodschappen');

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

const unknown=u4.classifyOriginal({...dion.rows[1].bankOriginal,counterpartyAccount:'',rawDescription:'Nieuwe winkel 42',description:'Nieuwe winkel 42'},profiles[0],[],profiles);
assert.equal(unknown.certainty,'onbekend','een uitgave zonder herkenning hoort bij Onbekend');

const lidlText='"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen"\n"20260705";"LIDL 1234 AMSTERDAM";"";"";"BA";"Af";"38,90";"Betaalautomaat";"PASVOLGNR 007"';
const lidl=u4.createImportDraft({text:lidlText,fileName:'lidl.csv',profiles,rules:[{id:'lidl',enabled:true,level:'organization',value:'lidl',category:'Boodschappen',transactionType:'uitgave'}],entryOwner:'gezamenlijk',id:'batch-lidl'});
assert.equal(lidl.accountOwner,'gezamenlijk','de eigenaargebonden rekeningfallback wordt voor herkenning toegepast');
assert.equal(lidl.rows[0].certainty,'nakijken');
assert.equal(lidl.rows[0].processing.category,'Boodschappen');
assert.equal(lidl.rows[0].processing.description,'Lidl','transactiedetails en locatie komen niet in de nette omschrijving');
assert.match(lidl.rows[0].bankOriginal.description,/AMSTERDAM/,'de originele CSV-omschrijving blijft bewaard');
u4.markExplicitlyApproved(lidl.rows[0]);
const learnedLidl=u4.learnedRecognitionRules(lidl);
assert.equal(learnedLidl[0].level,'organization','een goedgekeurde winkel leert de winkelnaam in plaats van alle locatiegegevens');
assert.equal(learnedLidl[0].value,'lidl');
const nextLidl=u4.classifyOriginal({...lidl.rows[0].bankOriginal,rawDescription:'LIDL 9876 UTRECHT',description:'LIDL 9876 UTRECHT — PASVOLGNR 008'},profiles[2],learnedLidl,profiles);
assert.equal(nextLidl.processing.category,'Boodschappen');
assert.equal(nextLidl.processing.description,'Lidl');
assert.equal(nextLidl.certainty,'nakijken','ook een geleerde Lidl-match vraagt steeds opnieuw expliciete goedkeuring');

const changed={...dion.rows[1].bankOriginal,amount:-40,bankDate:'2026-08-01'};
assert.notEqual(u4.fingerprint(changed,'dion-ing'),dion.rows[1].bankOriginal.fingerprint);
console.log('UPDATE4_IMPORT_ENGINE_OK');
