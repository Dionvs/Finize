const assert=require('node:assert/strict');
const u4=require('../update4.js');

const state=u4.normalizeCore({
  meta:{schemaVersion:4},accountProfiles:[],recognitionRules:[],transactions:[],
  spaardoelen:{gezamenlijk:[{id:'buffer',naam:'Buffer',algespaard:100}],dion:[],dara:[]},
  advanceLedger:[
    {id:'a',transactionId:'t1',month:'2026-06',debtor:'gezamenlijk',creditor:'dion',originalAmount:65,outstandingAmount:65,status:'open',createdAt:'2026-06-01'},
    {id:'b',transactionId:'t2',month:'2026-06',debtor:'dion',creditor:'gezamenlijk',originalAmount:20,outstandingAmount:20,status:'open',createdAt:'2026-06-02'},
    {id:'c',transactionId:'t3',month:'2026-07',debtor:'gezamenlijk',creditor:'dara',originalAmount:20,outstandingAmount:20,status:'open',createdAt:'2026-07-01'}
  ],
  importSummaries:[{id:'import',status:'concept'}],activeImportId:'import',monthRecords:{}
});

assert.deepEqual(u4.directionalBalances(state),[
  {debtor:'gezamenlijk',creditor:'dion',amount:65},
  {debtor:'dion',creditor:'gezamenlijk',amount:20},
  {debtor:'gezamenlijk',creditor:'dara',amount:20}
]);
assert.deepEqual(u4.proposeRepaymentAllocations(state,'gezamenlijk','dion',70),[
  {id:'allocation-a',advanceId:'a',amount:65}
]);

const tx={id:'save',date:'2026-07-02',amount:50,kind:'interne-overboeking',transactionType:'sparen',savingsGoalId:'buffer',accountOwner:'dion',budgetOwner:'dion',processing:{advanceMode:'none'},createdAt:'2026-07-02'};
const plan={importId:'import',transactions:[tx],replacements:[],savingsEntries:[u4.savingsForTransaction(tx)],advances:[],repayments:[],internalPairs:[],affectedMonths:['2026-07'],counts:{},duplicateCount:0,totalIncome:0,totalExpenses:0};
u4.applyImportPlan(state,plan);
assert.equal(state.spaardoelen.gezamenlijk[0].algespaard,150);
u4.applyImportPlan(state,plan);
assert.equal(state.spaardoelen.gezamenlijk[0].algespaard,150,'spaardoelimpact is idempotent');
console.log('UPDATE4_LEDGERS_OK');
