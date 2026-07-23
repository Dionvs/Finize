const assert=require('node:assert/strict');
const u4=require('../update4.js');

const manual={id:'manual-1',date:'2026-07-04',amount:25,description:'Handmatig',accountOwner:'dion',budgetOwner:'dion'};
const state=u4.normalizeCore({
  meta:{schemaVersion:4},
  transactions:[manual],
  importSummaries:[{id:'undo-import',status:'concept'}],
  activeImportId:'undo-import',
  accountProfiles:[],
  recognitionRules:[],
  recurringFixedExpenses:{voor:[{id:'rent',naam:'Huur',bedrag:900,amountHistory:[{id:'old',effectiveFrom:'2026-01-01',amount:900}],monthOverrides:{}}],na:[]},
  spaardoelen:{gezamenlijk:[{id:'buffer',naam:'Buffer',algespaard:100}],dion:[],dara:[]},
  advanceLedger:[{id:'older',transactionId:'old-tx',month:'2026-06',debtor:'dion',creditor:'gezamenlijk',originalAmount:40,outstandingAmount:40,status:'open',createdAt:'2026-06-01',repaymentAllocationIds:[]}],
  monthRecords:{'2026-07':{month:'2026-07',status:'afgesloten',lateImportTransactionIds:[]}}
});
const imported={id:'imported-1',date:'2026-07-04',amount:25,description:'Import',kind:'interne-overboeking',transactionType:'sparen',savingsGoalId:'buffer',accountOwner:'dion',budgetOwner:'dion',processing:{advanceMode:'none'},importBatchId:'undo-import',createdAt:'2026-07-04'};
const plan={
  ok:true,
  importId:'undo-import',
  transactions:[imported],
  replacements:[{id:'replacement-1',manualTransaction:u4.clone(manual),replacementTransactionId:imported.id}],
  savingsEntries:[u4.savingsForTransaction(imported)],
  advances:[],
  repayments:[{id:'repayment-1',transactionId:imported.id,advanceId:'older',amount:15,date:'2026-07-04',status:'actief'}],
  internalPairs:[{id:'pair-1',transactionIds:[imported.id,'other'],amount:25,status:'voorgesteld'}],
  fixedAdjustments:[{id:'fixed-adjustment-1',fixedExpenseId:'rent',scenario:'voor',month:'2026-07',mode:'month',amount:925,before:{amountHistory:[{id:'old',effectiveFrom:'2026-01-01',amount:900}],monthOverrides:{}}}],
  affectedMonths:['2026-07'],
  counts:{expenses:0,income:0,internal:1,savings:1,refunds:0,advances:0,uncategorized:0},
  duplicateCount:0,totalIncome:0,totalExpenses:0
};

u4.applyImportPlan(state,plan);
assert.equal(state.transactions.some(tx=>tx.id===manual.id),false);
assert.equal(state.spaardoelen.gezamenlijk[0].algespaard,125);
assert.equal(state.advanceLedger[0].outstandingAmount,25);
assert.equal(state.recurringFixedExpenses.voor[0].monthOverrides['2026-07'],925);
assert.equal(state.monthRecords['2026-07'].status,'correctie-nodig');

const draft={id:'undo-import',status:'correctie-nodig',effectManifest:u4.effectManifest(plan)};
u4.undoImportEffects(state,draft);
assert.equal(state.transactions.some(tx=>tx.id===imported.id),false);
assert.equal(state.transactions.some(tx=>tx.id===manual.id),true);
assert.equal(state.spaardoelen.gezamenlijk[0].algespaard,100);
assert.equal(state.advanceLedger[0].outstandingAmount,40);
assert.deepEqual(state.recurringFixedExpenses.voor[0].monthOverrides,{});
assert.equal(state.advanceRepayments.length,0);
assert.equal(state.internalTransferPairs.length,0);
assert.equal(state.monthRecords['2026-07'].status,'afgesloten');
assert.equal(state.importSummaries[0].status,'teruggedraaid');

u4.undoImportEffects(state,draft);
assert.equal(state.transactions.filter(tx=>tx.id===manual.id).length,1,'dubbele undo herstelt niets dubbel');
assert.equal(state.spaardoelen.gezamenlijk[0].algespaard,100,'dubbele undo trekt spaargeld niet nogmaals af');
assert.equal(state.advanceLedger[0].outstandingAmount,40,'dubbele undo verhoogt aflossing niet nogmaals');
console.log('UPDATE4_UNDO_OK');
