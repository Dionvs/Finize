const assert=require('node:assert/strict');
const u4=require('../src/import/update4-runtime.cjs');

function createState(){
  return u4.normalizeCore({
    meta:{schemaVersion:5},accountProfiles:[],recognitionRules:[],transactions:[],
    importSummaries:[{id:'import',status:'concept'}],activeImportId:'import',
    spaardoelen:{gezamenlijk:[{id:'buffer',naam:'Buffer',algespaard:0}],dion:[],dara:[]},
    savingsGoalLedger:[],monthRecords:{}
  });
}
function planned(state,amount=250){
  state.savingsGoalLedger.push({
    id:'saving-planned-gezamenlijk-2026-07-buffer',goalId:'buffer',month:'2026-07',
    plannedAmount:amount,actualAmount:null,effectiveAmount:amount,status:'gepland',
    source:'planned',transactionId:'',active:true,createdAt:'2026-07-01',updatedAt:'2026-07-01'
  });
  u4.reconcileGoalSavedAmounts(state,['buffer']);
}
function importPlan(state,amount,id='save'){
  const tx={id,date:'2026-07-20',amount,kind:'interne-overboeking',transactionType:'sparen',savingsGoalId:'buffer',accountOwner:'gezamenlijk',budgetOwner:'gezamenlijk',processing:{advanceMode:'none'},createdAt:'2026-07-20'};
  return {importId:'import',transactions:[tx],replacements:[],savingsEntries:[u4.savingsForTransaction(tx,state)],advances:[],repayments:[],internalPairs:[],fixedAdjustments:[],affectedMonths:['2026-07'],counts:{}};
}

const exact=createState();
planned(exact);
const exactPlan=importPlan(exact,250);
u4.applyImportPlan(exact,exactPlan);
assert.equal(u4.calculateGoalSavedAmount(exact,'buffer'),250);
assert.equal(exact.spaardoelen.gezamenlijk[0].algespaard,250);
u4.applyImportPlan(exact,exactPlan);
assert.equal(u4.calculateGoalSavedAmount(exact,'buffer'),250,'dezelfde import is idempotent');

const afwijkend=createState();
planned(afwijkend);
u4.applyImportPlan(afwijkend,importPlan(afwijkend,240,'save-240'));
assert.equal(u4.calculateGoalSavedAmount(afwijkend,'buffer'),240);

const los=createState();
const loosePlan=importPlan(los,100,'save-100');
u4.applyImportPlan(los,loosePlan);
assert.equal(u4.calculateGoalSavedAmount(los,'buffer'),100);
u4.undoImportEffects(los,{id:'import',effectManifest:u4.effectManifest(loosePlan)});
assert.equal(u4.calculateGoalSavedAmount(los,'buffer'),0);

const legacy=u4.normalizeCore({
  meta:{schemaVersion:5},accountProfiles:[],recognitionRules:[],transactions:[],
  spaardoelen:{gezamenlijk:[{id:'legacy-goal',algespaard:321.45}],dion:[],dara:[]},savingsGoalLedger:[]
});
assert.equal(u4.calculateGoalSavedAmount(legacy,'legacy-goal'),321.45,'migratie bewaart bestaand saldo');
u4.normalizeCore(legacy);
assert.equal(legacy.savingsGoalLedger.filter(row=>row.id==='saving-opening-legacy-goal').length,1);
console.log('UPDATE4_2_SAVINGS_LEDGER_OK');
