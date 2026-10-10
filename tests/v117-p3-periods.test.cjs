const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize,copy}=require('./helpers/package5-fixture.cjs');
const {buildRecordSnapshot}=require('../src/storage/cloud-record-model.mjs');
const {workspaceState,assertWorkspaceMutation,refreshWorkspaceTotals,requiredMutationPeriods,mergeWorkspaceIntent,workspaceNeedsFullHistory}=require('../src/storage/period-workspace.mjs');
const {verifyRecordManifests}=require('../src/storage/record-manifest.mjs');
const {calculateGoalSavedAmount,contributionAmount}=require('../src/core/data-normalization.mjs');
const engine=require('../src/core/transaction-engine.mjs');
async function example(){
  const full=state();full.monthRecords={};full.meta.selectedMonth='2026-10';
  const old=[row('old-expense','uitgave',-100),row('old-saving','naar-spaarrekening',-75,{savingsGoalId:'goal'})];for(const r of old){r.bankOriginal.bankDate='2026-08-03';r.processing.processingDate='2026-08-03';}
  materialize(full,old,'old-batch');materialize(full,[row('current-expense','uitgave',-40)],'current-batch');
  const snapshot=await buildRecordSnapshot(full),{records:allRecords,periods:allPeriods,global,settings,manifests,...metadata}=snapshot,head={...metadata,phase:'ready',epoch:'unit',revision:1};
  const ids=new Set(snapshot.settings.dependencies.map(row=>row.id)),records=snapshot.records.filter(row=>ids.has(row.id)||row.periods.includes('2026-10'));
  const visibleLedger=records.filter(row=>row.collection==='savingsGoalLedger').map(row=>JSON.parse(row.payload));
  const proof={head,epoch:'unit',revision:1,records,periods:snapshot.periods.filter(row=>row.month==='2026-10'),global:snapshot.global,settings:snapshot.settings,ledgerBaseline:{goal:calculateGoalSavedAmount(full,'goal')-visibleLedger.reduce((sum,row)=>sum+contributionAmount(row),0)}};
  return {full,snapshot,partial:await workspaceState(proof,'2026-10')};
}
test('P3 partial month preserves budget, forecast, allowance and goal balances with old bank and goal-ledger rows absent',async()=>{
  const {full,partial}=await example();assert.equal(partial.transactions.length,2);assert(!partial.transactions.some(row=>row.importBatchId==='old-batch'));assert(!partial.savingsGoalLedger.some(row=>row.month==='2026-08'));
  assert.deepEqual(engine.categoryFinancialActuals(partial,'2026-10'),engine.categoryFinancialActuals(full,'2026-10'));
  assert.deepEqual(engine.financialForecastForMonth(partial,'2026-10'),engine.financialForecastForMonth(full,'2026-10'));
  assert.equal(calculateGoalSavedAmount(partial,'goal'),calculateGoalSavedAmount(full,'goal'));
  assert.equal(engine.sumTransactionEffects(partial,'budgetImpact'),140);
});
test('P3 partial month rejects unknown periods and unsupported cumulative slices instead of inventing zero totals',async()=>{
  const {partial}=await example();assert.throws(()=>engine.financialForecastForMonth(partial,'2026-08'),{code:'period-incomplete'});
  assert.throws(()=>engine.sumTransactionEffects(partial,'budgetImpact',{owner:'dion'}),{code:'period-incomplete'});
  assert.throws(()=>engine.selectTransactionProjections(partial),{code:'period-incomplete'});
  delete partial.__finizePeriodContext.ledgerBaseline.goal;assert.throws(()=>calculateGoalSavedAmount(partial,'goal'),{code:'period-incomplete'});
});
test('P3 partial ten savings uses the existing approval engine and verified historical goal baseline',async()=>{
  const {partial,full}=await example(),next=copy(partial),amounts=[50,100,75,25,200,40,60,90,30,80];
  materialize(next,amounts.map((n,i)=>row('ten-'+i,'naar-spaarrekening',-n,{savingsGoalId:'goal'})),'ten');
  materialize(full,amounts.map((n,i)=>row('ten-'+i,'naar-spaarrekening',-n,{savingsGoalId:'goal'})),'ten');refreshWorkspaceTotals(partial,next);
  assert.equal(engine.sumTransactionEffects(next,'savingsDeposit'),825);assert.equal(engine.sumTransactionEffects(next,'budgetImpact'),140);
  assert.equal(next.spaardoelen.gezamenlijk[0].algespaard,full.spaardoelen.gezamenlijk[0].algespaard);
  assert.deepEqual(requiredMutationPeriods(partial,next),['2026-10']);
});
test('P3 partial writes require explicit historical dependencies and global planning review',async()=>{
  const {partial}=await example(),missing=copy(partial);missing.transactions[0].date='2026-07-03';missing.transactions[0].transactionDate='2026-07-03';
  assert.throws(()=>assertWorkspaceMutation(partial,missing),{code:'dependency-required'});
  const planning=copy(partial);planning.planning.spaarpotDezeMaand=999;assert.throws(()=>assertWorkspaceMutation(partial,planning),{code:'full-history-required'});
  const closed=copy(partial);closed.monthRecords['2026-08']={status:'open'};assert.throws(()=>assertWorkspaceMutation(partial,closed),{code:'dependency-required'});
});
test('P3 partial source pairs include all linked financial months in commit dependencies',async()=>{
  const {partial}=await example(),next=copy(partial);next.internalTransferPairs=[{id:'pair',transactionIds:[partial.transactions[0].id,'not-loaded'],status:'bevestigd'}];
  assert.throws(()=>assertWorkspaceMutation(partial,next),{code:'dependency-required'});
});
test('P3 manifest integrity rejects a corrupt record even when its payload hash is not the changed field',async()=>{
  const {snapshot}=await example();await verifyRecordManifests(snapshot,snapshot.records,snapshot.manifests);
  const records=copy(snapshot.records);records[0].ordinal+=1;await assert.rejects(()=>verifyRecordManifests(snapshot,records,snapshot.manifests),{code:'record-integrity'});
});

test('P3 dependency expansion merges only the original intent and rejects concurrent field changes',async()=>{
  const {partial}=await example(),intent=copy(partial),expanded=copy(partial);intent.transactions[1].description='Nieuwe tekst';expanded.transactions.push({id:'historical',amount:200});
  const merged=mergeWorkspaceIntent(partial,intent,expanded);assert.equal(merged.transactions.length,3);assert.equal(merged.transactions[1].description,'Nieuwe tekst');assert.equal(merged.transactions[2].amount,200);
  expanded.transactions[1].description='Ander apparaat';assert.throws(()=>mergeWorkspaceIntent(partial,intent,expanded),{code:'storage-conflict'});
});

test('P3 global planning and import withdrawal explicitly require history; ordinary monthly edits do not',async()=>{
  const {partial}=await example(),next=copy(partial);next.monthlyBudgets={'2026-10':{Kleding:100}};
  assert.equal(workspaceNeedsFullHistory(partial,next),false);assert.deepEqual(requiredMutationPeriods(partial,next),['2026-10']);
  next.monthlyBudgets['2026-08']={Kleding:200};assert.throws(()=>assertWorkspaceMutation(partial,next),{code:'dependency-required'});
  const withdrawn=copy(partial);withdrawn.importSummaries[0].lifecycle='withdrawn';assert.equal(workspaceNeedsFullHistory(partial,withdrawn),true);
});
