const assert = require('node:assert/strict');
const { test } = require('node:test');
const model = require('../src/core/transaction-model.mjs');
const data = require('../src/core/data-normalization.mjs');
const runtime = require('./helpers/migration-runtime.cjs');
const u4 = require('../src/import/update4-runtime.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(version = 9) {
  const account=()=>({vasteLasten:[],variabel:[]});
  const scenario=()=>({verdeling:{minimumDion:.4},gezamenlijk:account(),dion:account(),dara:account()});
  const original={bankDate:'2026-07-01',amount:-12.345,description:'Bank',accountIdentifier:'nl01 bank 001',counterpartyAccount:'nl02 bank 002',rawCells:['original','-12,345'],custom:{original:true}};
  return {
    meta:{schemaVersion:version,scenario:'voor',selectedMonth:'2026-07',revision:12,updatedAt:'stored',updatedBy:'stored-device',incomeHistoryMigrated:true},
    personen:{dion:{salaris:2000,vasteTeruggaven:[]},dara:{salaris:2500,vasteTeruggaven:[]}},
    voor:scenario(),na:{...scenario(),gezamenlijk:{...account(),hypotheek:[{id:'na-only',bedrag:900}]}},
    recurringFixedExpenses:{voor:[],na:[]},recurringIncomeSources:[],
    spaardoelen:{gezamenlijk:[{id:'goal',algespaard:123,doelbedrag:500,subdoelen:[],custom:'keep'}],dion:[],dara:[]},
    transactions:[
      {id:'manual-legacy',owner:'dion',amount:15.125,date:'2026-07-01',custom:'keep'},
      {id:'csv',account:'dion',owner:'gezamenlijk',financialFor:'gezamenlijk',amount:12.345,date:'2026-07-02',reviewStatus:'bevestigd',importBatchId:'batch',importTransactionId:'row',bankOriginal:original,processing:{processedAmount:12.345,processingDate:'2026-07-02',include:true,custom:'keep'}}
    ],
    savingsGoalLedger:[{id:'opening',goalId:'goal',effectiveAmount:100,source:'legacy-opening',custom:'keep'},{id:'correction',goalId:'goal',effectiveAmount:23,source:'manual-correction'}],
    importSummaries:[{id:'batch',status:'verwerkt',custom:'keep'}],activeImportId:'batch',
    transactionReviewQueue:[{id:'pending',owner:'dara',account:'dara',date:'2026-07-01',amount:5,reviewStatus:'te-controleren',rawData:{cells:['original']}}],
    recognitionRules:[{id:'rule',value:'shop',text:'shop',account:'dion',custom:'keep'}],
    accountProfiles:[{id:'profile',accountOwner:'dion',identifier:'NL01BANK001',custom:'keep'}],
    accountSettings:{dion:{openingBalance:1,effectiveMonth:'2026-01',custom:'keep'}},
    monthlySavingOverrides:{'2026-07':{gezamenlijkVoor:10,gezamenlijkNa:25}},
    monthRecords:{},monthlyBudgets:{},monthlyIncome:{},foreignExtension:{nested:{value:['unchanged']}}
  };
}
const migrate = input => data.migrateStateData(input,{normalizeLegacy:runtime().normalizeLegacyBudgetState,validate:runtime().validateBudgetState,targetVersion:10});
test('TEST 1 — old state without schema loads without changing input',()=>{
  const input=fixture();delete input.meta.schemaVersion;const before=copy(input);
  const migrated=migrate(input);assert.equal(migrated.meta.schemaVersion,10);assert.deepEqual(input,before);
});
test('TEST 2 — migration is idempotent, including independent initial migrations',()=>{
  const input=fixture();const first=copy(migrate(input));assert.deepEqual(copy(migrate(first)),first);assert.deepEqual(copy(migrate(input)),first);
});
test('TEST 3 — transaction counts retained',()=>assert.equal(migrate(fixture()).transactions.length,2));
test('TEST 4 — transaction and processed amounts retained exactly',()=>{
  const input=fixture(),after=migrate(input);assert.deepEqual(after.transactions.map(x=>x.amount),input.transactions.map(x=>x.amount));
  assert.equal(after.transactions[1].processing.processedAmount,12.345);
});
test('TEST 5 — original CSV bytes/fields retained',()=>{
  const input=fixture(),after=migrate(input);assert.equal(JSON.stringify(after.transactions[1].bankOriginal),JSON.stringify(input.transactions[1].bankOriginal));
  assert.deepEqual(copy(after.transactionReviewQueue[0].rawData),input.transactionReviewQueue[0].rawData);
});
test('TEST 6 — import references and summaries retained',()=>{
  const input=fixture(),after=migrate(input);assert.deepEqual(copy(after.importSummaries),input.importSummaries);assert.equal(after.activeImportId,'batch');assert.equal(after.transactions[1].importBatchId,'batch');
});
test('TEST 7 — existing savings ledger counts and values retained',()=>{
  const input=fixture(),after=migrate(input);assert.equal(after.savingsGoalLedger.length,input.savingsGoalLedger.length);
  after.savingsGoalLedger.forEach((entry,i)=>Object.entries(input.savingsGoalLedger[i]).forEach(([key,value])=>assert.deepEqual(entry[key],value)));
});
test('TEST 8 — goal balances and opening/correction counts remain stable',()=>{
  const input=fixture(),after=migrate(migrate(input));assert.equal(after.spaardoelen.gezamenlijk[0].algespaard,123);assert.equal(data.calculateGoalSavedAmount(after,'goal'),123);
  const old=fixture(4);old.savingsGoalLedger=[];const seeded=migrate(old);assert.equal(seeded.savingsGoalLedger.length,1);assert.equal(migrate(seeded).savingsGoalLedger.length,1);
});
test('TEST 9 — three explicit account contexts are supported',()=>{
  for(const owner of model.ACCOUNT_CONTEXTS) {const tx=model.markManualTransaction({id:owner,amount:1},owner);assert.equal(model.getTransactionAccountContext(tx),owner);assert.equal(model.getTransactionSource(tx),'manual');assert.equal(model.getTransactionProcessingStatus(tx),'goedgekeurd');}
});
test('TEST 10 — ambiguous legacy owner does not become a physical account',()=>{
  const after=migrate(fixture());assert.equal(model.getTransactionAccountContext(after.transactions[0]),null);assert.equal('account' in after.transactions[0],false);assert.equal('accountContext' in after.transactions[0],false);
  assert.equal(model.getTransactionAccountContext({account:'dion',accountOwner:'dara'}),null);assert.equal(after.transactions[1].owner,'gezamenlijk');assert.equal(after.transactions[1].accountContext,'dion');
  const conflict=model.normalizeDataTransaction({account:'gezamenlijk',bankOriginal:{accountIdentifier:'NL01BANK001'}},{accountProfiles:fixture().accountProfiles});
  assert.equal(model.getTransactionAccountContext(conflict),null,'Unresolved evidence remains ambiguous without profile options');
});
test('TEST 11 — original data is immutable through canonical/processing paths',()=>{
  const tx=fixture().transactions[1],before=copy(tx);const original=model.getTransactionOriginalBankData(tx);assert.ok(Object.isFrozen(original.rawCells));
  const normalized=u4.normalizeTransaction(copy(tx));normalized.processing.category='Changed';assert.deepEqual(normalized.bankOriginal,before.bankOriginal);assert.deepEqual(tx,before);
  u4.applyTransactionFamily({bankOriginal:tx.bankOriginal,processing:{splits:[]}},'sparen');assert.deepEqual(tx.bankOriginal,before.bankOriginal);
  const changed=copy(tx);changed.bankOriginal.description='changed';assert.throws(()=>model.assertOriginalBankDataUnchanged([tx],[changed]));
  const reordered=copy(tx);reordered.bankOriginal=Object.fromEntries(Object.entries(reordered.bankOriginal).reverse());
  assert.doesNotThrow(()=>model.assertOriginalBankDataUnchanged([tx],[reordered]),'Cloud object-key ordering is not a source change');
  assert.doesNotThrow(()=>model.assertOriginalBankDataUnchanged([tx],[]),'Existing deletion/undo remains possible');
});
test('TEST 12 — status/approval compatibility never auto-approves a proposal',()=>{
  const status=model.getTransactionProcessingStatus;
  assert.equal(status({}),'onbekend');assert.equal(status({processingStatus:'nakijken'}),'nakijken');
  assert.equal(status({certainty:'onbekend'}),'onbekend');assert.equal(status({certainty:'zeker'}),'nakijken');
  assert.equal(status({certainty:'goedgekeurd'}),'nakijken');assert.equal(status({certainty:'goedgekeurd',approvalSource:'manual'}),'goedgekeurd');
  assert.equal(status({reviewStatus:'bevestigd'}),'goedgekeurd');assert.equal(status({reviewStatus:'genegeerd'}),'niet-meetellen');
  assert.equal(status({certainty:'nakijken',processing:{include:false}}),'nakijken');
  assert.equal(status({certainty:'goedgekeurd',approvalSource:'manual',processing:{include:false}}),'niet-meetellen');
  const tx=migrate(fixture()).transactions[1];assert.equal(tx.approvalSource,'legacy-confirmed');assert.equal('approvedAt' in tx,false);assert.equal(model.isTransactionFinanciallyActive(tx),true);
});
test('TEST 13 — unknown nested fields preserved',()=>{
  const input=fixture(),after=migrate(input);assert.deepEqual(copy(after.foreignExtension),input.foreignExtension);
  for(const key of ['accountProfiles','recognitionRules','importSummaries'])assert.equal(after[key][0].custom,'keep');assert.equal(after.accountSettings.dion.custom,'keep');assert.equal(after.spaardoelen.gezamenlijk[0].custom,'keep');
});
test('TEST 14 — both scenarios and savings overrides preserved',()=>{
  const input=fixture(),after=migrate(input);assert.deepEqual(copy(after.voor),input.voor);assert.deepEqual(copy(after.na),input.na);assert.deepEqual(copy(after.monthlySavingOverrides),input.monthlySavingOverrides);
});
test('TEST 15 — local/cloud JSON roundtrip loses nothing',()=>{
  const after=migrate(fixture());assert.deepEqual(copy(migrate(copy(after))),copy(after));assert.equal(after.meta.revision,12);assert.equal(after.meta.updatedAt,'stored');assert.equal(after.meta.updatedBy,'stored-device');
});
test('TEST 16 — pure migration independent of viewport/device/time and active state',()=>{
  const mobile=runtime({window:{innerWidth:390}}),desktop=runtime({window:{innerWidth:1440}});assert.deepEqual(copy(mobile.migrateBudgetState(fixture())),copy(desktop.migrateBudgetState(fixture())));assert.deepEqual(mobile.state,{sentinel:'active state must not change'});
});
test('Migration errors/future versions/duplicate IDs retain original input',()=>{
  for(const change of [s=>s.meta.schemaVersion=11,s=>s.meta.schemaVersion=0,s=>s.meta=['bad'],s=>s.transactions.push(copy(s.transactions[0])),s=>s.transactions.push(null),
    s=>s.budgetDefaultsHistory={voor:{dion:'bad'}},s=>s.budgetDefaultsHistory={voor:{dion:[{id:'history',rows:'bad'}]}},
    s=>s.accountSettings.dion='bad',s=>s.spaardoelen.gezamenlijk[0].subdoelen='bad',
    s=>s.monthRecords['2026-01']={closureHistory:'bad'},
    s=>s.recurringFixedExpenses.voor=[{id:'fixed',amountHistory:'bad'}]]) {
    const input=fixture();change(input);const before=copy(input);assert.throws(()=>migrate(input));assert.deepEqual(input,before);
  }
});

test('Closure references are retained when closingId supplies the legacy identity',()=>{
  const input=fixture();input.monthRecords['2026-06']={status:'afgesloten',activeClosureId:'closing-existing',closureHistory:[{closingId:'closing-existing',summary:{}}]};
  const after=migrate(input),closure=after.monthRecords['2026-06'].closureHistory[0];assert.equal(closure.id,'closing-existing');assert.equal(closure.status,'actief');assert.deepEqual(copy(migrate(after)),copy(after));
});
test('Missing IDs deterministic; existing populated ledger never filled from goal balance',()=>{
  const input=fixture();delete input.transactions[0].id;input.spaardoelen.gezamenlijk[0].algespaard=999;
  const first=copy(migrate(input));assert.deepEqual(copy(migrate(input)),first);assert.equal(first.savingsGoalLedger.length,2);assert.equal(first.spaardoelen.gezamenlijk[0].algespaard,999);
});
