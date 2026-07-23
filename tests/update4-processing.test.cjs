const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const u4=require('../update4.js');

const text=fs.readFileSync(path.join(__dirname,'fixtures','ing-dion.csv'),'utf8');
const profile={id:'dion-ing',name:'ING Dion',identifier:'NL01INGB0000000001',bank:'ING',csvFormat:'ing',accountOwner:'dion'};
const state=u4.normalizeCore({
  meta:{schemaVersion:4,scenario:'voor'},
  accountProfiles:[profile],recognitionRules:[],transactions:[],importSummaries:[],
  spaardoelen:{gezamenlijk:[],dion:[],dara:[]},recurringFixedExpenses:{voor:[],na:[]},
  monthRecords:{'2026-07':{month:'2026-07',status:'afgesloten',closureHistory:[]}}
});
const draft=u4.createImportDraft({text,fileName:'dion.csv',profiles:[profile],rules:[],transactions:[],id:'process-one'});
draft.rows[1].processing.category='Boodschappen';
draft.rows[1].processing.budgetOwner='gezamenlijk';
draft.rows[1].processing.splits=[
  {id:'joint',amount:40,budgetOwner:'gezamenlijk',category:'Boodschappen',include:true},
  {id:'personal',amount:2.18,budgetOwner:'dion',category:'Overig',include:true}
];
state.importSummaries.push({id:draft.id,status:'concept'});
state.activeImportId=draft.id;

const invalid=u4.planImportEffects(draft,state);
assert.equal(invalid.ok,true);
assert.equal(invalid.transactions.length,3,'salaris plus twee splits verwacht');
assert.equal(invalid.transactions.filter(tx=>tx.importTransactionId===draft.rows[1].id).reduce((sum,tx)=>sum+tx.accountDelta,0),-42.18);
assert.equal(invalid.counts.advances,1);

u4.applyImportPlan(state,invalid);
assert.equal(state.transactions.length,3);
assert.equal(state.activeImportId,'');
assert.equal(state.monthRecords['2026-07'].status,'correctie-nodig');
assert.equal(state.importSummaries[0].status,'correctie-nodig');
u4.applyImportPlan(state,invalid);
assert.equal(state.transactions.length,3,'opnieuw toepassen mag niet dubbel tellen');

draft.rows[1].processing.splits[0].amount=39;
const broken=u4.validateDraft(draft,state);
assert.equal(broken.ok,false);
assert.ok(broken.errors.some(error=>error.code==='splits'));
console.log('UPDATE4_PROCESSING_OK');
