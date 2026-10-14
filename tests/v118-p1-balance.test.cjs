const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectAccountBalance,prepareBalanceCheckpoint,applyBalanceCheckpoint,checkpointHistory,balanceRequiredMonths}=require('../src/core/balance-checkpoints.mjs');
const {state,row,materialize,copy}=require('./helpers/package5-fixture.cjs');
const engine=require('../src/core/transaction-engine.mjs');
const model=require('../src/core/transaction-model.mjs');
const {encodeHouseholdState,decodeHouseholdState}=require('../src/storage/household-store.mjs');
const {buildRecordSnapshot}=require('../src/storage/cloud-record-model.mjs');
const {workspaceState,assertWorkspaceMutation,workspaceNeedsFullHistory,mergeWorkspaceIntent}=require('../src/storage/period-workspace.mjs');
const {rebaseLocalChanges,assertCheckpointHistoryPreserved}=require('../src/storage/sync-protocol.mjs');
const {encodeCloudState,decodeCloudState,cloudStateManifest}=require('../src/storage/cloud-chunks.mjs');
const ctx=s=>({scope:{householdId:'legacy',accountProfiles:s.accountProfiles},today:'2026-10-13'});
let nextId=0;
const command=(changes={})=>({operationId:'test-'+(++nextId),createdAt:'2026-10-13T10:00:00Z',accountProfileId:'joint',amountCents:100000,asOfDate:'2026-10-10',actor:'user-test',note:'Waargenomen in bankapp',...changes});
function checkpoint(s,changes={}){const cmd=command(changes),p=prepareBalanceCheckpoint(s,cmd,ctx(s));applyBalanceCheckpoint(s,{...cmd,confirmed:true,previewSignature:p.previewSignature},ctx(s));return p;}
function setup(){const s=state();s.meta.selectedMonth='2026-10';checkpoint(s);return s;}
function source(s,{id='bank',date='2026-10-11',amount=-100,type='uitgave',extra={}}={}){
  const r=row(id,type,amount,extra);r.bankOriginal.currency='EUR';r.bankOriginal.bankDate=date;r.processing.processingDate=date;
  const batch=materialize(s,[r],id+'-import');return {batch,header:s.transactions.find(tx=>tx.recordRole==='bank-source'&&tx.importBatchId===batch.id)};
}
const project=(s,options={})=>selectAccountBalance(s,{...ctx(s),accountProfileId:'joint',toDate:'2026-10-13',...options});
const completeCoverage=s=>[{version:1,recordType:'coverage',householdId:'legacy',accountProfileId:'joint',channel:'bank-api',authority:'test',identity:null,
  facts:{fromDate:'2026-10-11',toDate:'2026-10-13',completeness:'complete',basis:'provider-assertion'},provenance:{payload:{confirmed:true}}}];
test('P1 01/02 end-of-day checkpoint includes same-day debit; later debit counted once',()=>{
  const s=setup();source(s,{id:'same-day',date:'2026-10-10',amount:-50});source(s);
  const p=project(s);assert.equal(p.balanceCents,90000);assert.equal(p.mutations.length,1);assert.equal(p.confirmedCents,-10000);
});
test('P1 03 three splits remain one physical bank mutation',()=>{
  const s=setup();source(s,{amount:-300,extra:{splits:[1,2,3].map(n=>({id:'part-'+n,amount:100,category:'Kleding',budgetOwner:'gezamenlijk',transactionType:'uitgave',include:true}))}});
  assert.equal(s.transactions.filter(tx=>tx.recordRole!=='bank-source').length,3);
  assert.equal(project(s).balanceCents,70000);assert.equal(project(s).mutations.length,1);
});
test('P1 04 multiple proven import references use the same source only once',()=>{
  const s=setup(),{header}=source(s);header.importReferences.push({batchId:'alias',rowId:'alias-row'});s.importSummaries.push({id:'alias',lifecycle:'active'});
  assert.equal(project(s).balanceCents,90000);assert.equal(project(s).mutations.length,1);
});
test('P1 05 replaced manual expense cannot create a second physical debit',()=>{
  const s=setup();source(s);s.transactions.push({id:'manual',source:'manual',accountProfileId:'joint',accountContext:'gezamenlijk',date:'2026-10-11',amount:100});
  s.manualTransactionReplacements.push({id:'replacement',manualTransactionId:'manual',active:true});
  const p=project(s);assert.equal(p.balanceCents,90000);assert(!p.reasons.some(row=>row.code==='manual-without-bank-evidence'));
});
test('P1 06 Niet meetellen still changes the bank balance',()=>{
  const s=setup();source(s,{type:'niet-meetellen',extra:{include:false}});
  assert.equal(project(s).balanceCents,90000);assert.equal(project(s).confirmedCents,-10000);
});
test('P1 07/08 review sources count provisionally; approval changes quality, never amount',()=>{
  const s=setup(),{header}=source(s);header.processingStatus='nakijken';header.approvalSource='';
  const a=project(s,{coverage:completeCoverage(s)});assert.equal(a.balanceCents,90000);assert.equal(a.provisionalCents,-10000);assert.equal(a.status,'provisional');
  header.processingStatus='goedgekeurd';header.approvalSource='manual';
  const b=project(s,{coverage:completeCoverage(s)});assert.equal(b.balanceCents,a.balanceCents);assert.equal(b.quality.bankSources,'confirmed');assert.equal(b.status,'confirmed');
});
test('P1 09 unresolved possible duplicate is excluded and explained',()=>{
  const s=setup(),{batch,header}=source(s);batch.rows[0].possibleDuplicate={batchId:'other',rowId:'other'};batch.rows[0].bankSourceId=header.bankSourceId;
  const p=project(s,{imports:[batch]});assert.equal(p.balanceCents,100000);assert.equal(p.status,'incomplete');assert(p.reasons.some(row=>row.code==='possible-duplicate'));
});
test('P1 10 new observation reports -25 euro difference without creating a transaction',()=>{
  const s=setup();source(s,{amount:-350});const before=copy(s),p=checkpoint(s,{amountCents:62500,asOfDate:'2026-10-12'});
  assert.equal(p.reconciliation.expectedCents,65000);assert.equal(p.reconciliation.differenceCents,-2500);
  assert.deepEqual(s.transactions,before.transactions);assert.equal(project(s).balanceCents,62500);assert.equal(s.balanceCheckpoints.length,2);
});
test('P1 11 correction appends revision and retains original actor, note and observation',()=>{
  const s=setup(),old=copy(s.balanceCheckpoints[0]);checkpoint(s,{supersedesId:old.id,amountCents:95000,actor:'other-user'});
  assert.deepEqual(s.balanceCheckpoints[0],old);assert.equal(s.balanceCheckpoints[1].revision,2);assert.equal(s.balanceCheckpoints[1].supersedesId,old.id);
  assert.equal(project(s).balanceCents,95000);assert.equal(checkpointHistory(s,'joint',ctx(s).scope).active.length,1);
});
test('P1 12 physical accounts of the same owner are independent',()=>{
  const s=setup();s.accountProfiles.push({id:'joint-second',accountOwner:'gezamenlijk',identifier:'NL02JOINT'});checkpoint(s,{accountProfileId:'joint-second',amountCents:50000});source(s);
  assert.equal(project(s).balanceCents,90000);assert.equal(project(s,{accountProfileId:'joint-second'}).balanceCents,50000);
});
test('P1 13 savings goals do not increase bank wealth',()=>{const s=setup();s.spaardoelen.gezamenlijk[0].algespaard=99999;assert.equal(project(s).balanceCents,100000);});
test('P1 14 no checkpoint means unknown, never invented zero',()=>{const s=state();assert.equal(project(s).balanceCents,null);assert.equal(project(s).status,'unknown');assert(!Object.hasOwn(s,'balanceCheckpoints'));});
test('P1 15 zero reconciliation cannot establish coverage',()=>{
  const s=setup(),p=prepareBalanceCheckpoint(s,command({asOfDate:'2026-10-12'}),ctx(s));assert.equal(p.reconciliation.differenceCents,0);assert.equal(p.reconciliation.quality.coverage,'unknown');
  assert.equal(project(s).quality.bankSources,'confirmed');assert.equal(project(s).status,'provisional');
});
test('P1 16 operation retry is idempotent and cannot reuse an ID for different facts',()=>{
  const s=state(),cmd=command(),p=prepareBalanceCheckpoint(s,cmd,ctx(s)),approved={...cmd,confirmed:true,previewSignature:p.previewSignature};
  applyBalanceCheckpoint(s,approved,ctx(s));const before=copy(s);assert.equal(applyBalanceCheckpoint(s,approved,ctx(s)).noop,true);assert.deepEqual(s,before);
  s.balanceCheckpoints[0]=Object.fromEntries(Object.entries(s.balanceCheckpoints[0]).reverse());
  assert.equal(applyBalanceCheckpoint(s,approved,ctx(s)).noop,true,'cloud object-key order cannot create another operation');
  assert.throws(()=>applyBalanceCheckpoint(s,{...approved,amountCents:90000},ctx(s)),{code:'operation-conflict'});
});
test('P1 17 source state, month forecasts, allowances, snapshots and approvals stay identical',()=>{
  const s=setup();source(s);const before=copy(s),forecast=engine.financialForecastForMonth(s,'2026-10');project(s);assert.deepEqual(s,before);
  checkpoint(s,{amountCents:90000,asOfDate:'2026-10-12'});
  assert.deepEqual(engine.financialForecastForMonth(s,'2026-10'),forecast);
  const {balanceCheckpoints,...after}=s,{balanceCheckpoints:ignored,...original}=before;assert.deepEqual(after,original);
});
test('P1 18 checkpoint and P5a envelope are not financially active',()=>{const s=setup();assert.equal(model.isTransactionFinanciallyActive(s.balanceCheckpoints[0]),false);});
test('P1 missing historical dependencies give null balance, not a partial number',()=>{
  const s=setup();source(s);s.__finizePartialHistory=true;s.verifiedPeriods=['2026-09'];
  assert.equal(project(s).balanceCents,null);assert.equal(project(s).quality.storage,'incomplete');
  s.verifiedPeriods=['2026-10'];assert.equal(project(s).balanceCents,90000);
});
test('P1 failed import-detail read marks storage incomplete',()=>{const s=setup();assert.equal(project(s,{importsAvailable:false}).balanceCents,null);});
test('P1 dates are calendar days across year, leap day and invalid dates',()=>{
  assert.deepEqual(balanceRequiredMonths('2024-02-29','2024-03-01'),['2024-02','2024-03']);assert.deepEqual(balanceRequiredMonths('2025-12-31','2026-01-01'),['2025-12','2026-01']);
  const s=setup();assert.equal(project(s,{toDate:'2026-10-09'}).balanceCents,null);
  for(const asOfDate of ['2026-02-29','2026-10-14',''])assert.throws(()=>checkpoint(s,{asOfDate}),{code:'invalid-checkpoint-date'});
});
test('P1 no same-day duplicate unless it is an explicit current revision',()=>{
  const s=setup();assert.throws(()=>checkpoint(s),{code:'checkpoint-date-exists'});
  const first=s.balanceCheckpoints[0];checkpoint(s,{supersedesId:first.id});assert.throws(()=>checkpoint(s,{supersedesId:first.id}),{code:'stale-checkpoint-revision'});
});
test('P1 stale preview requires another explicit confirmation',()=>{
  const s=setup(),cmd=command({asOfDate:'2026-10-12'}),p=prepareBalanceCheckpoint(s,cmd,ctx(s));source(s);
  assert.throws(()=>applyBalanceCheckpoint(s,{...cmd,confirmed:true,previewSignature:p.previewSignature},ctx(s)),{code:'balance-confirmation-required'});assert.equal(s.balanceCheckpoints.length,1);
});
for(const status of ['pending','unknown'])test('P1 '+status+' bank status is excluded',()=>{const s=setup(),{header}=source(s);for(const tx of s.transactions)tx.bankOriginal.bankStatus=status;const p=project(s);assert.equal(p.balanceCents,100000);assert.equal(p.quality.bankSources,'uncertain');});
test('P1 invalid dates, missing currency and conflicting source amounts are explained',()=>{
  for(const mutate of [s=>{for(const tx of s.transactions)tx.bankOriginal.bankDate='bad-date';},s=>{for(const tx of s.transactions)delete tx.bankOriginal.currency;},s=>{s.transactions.find(tx=>tx.recordRole!=='bank-source').bankOriginal.amount=-200;}]){
    const s=setup();source(s);mutate(s);const p=project(s);assert.equal(p.balanceCents,100000);assert.equal(p.status,'incomplete');
  }
});
test('P1 JSON and existing household codec roundtrip preserves optional checkpoint history',()=>{
  const s=setup();checkpoint(s,{supersedesId:s.balanceCheckpoints[0].id,amountCents:0});const encoded=encodeHouseholdState(s);
  assert.deepEqual(decodeHouseholdState({storageVersion:1,schemaVersion:11,layout:encoded.layout},encoded.records),s);assert.deepEqual(copy(s),s);
  assert(encoded.records.filter(row=>row.collection==='balanceCheckpoints').every(row=>row.periods.length===0));
});
test('P1 current cloud chunk wire format preserves checkpoints exactly',async()=>{
  const s=setup(),{descriptor,chunks}=await encodeCloudState(s,'p1-test');descriptor.complete=true;
  const manifest=cloudStateManifest(descriptor,{syncVersion:1,commitId:'p1-test',updatedAt:'2026-10-13',updatedBy:'test'});
  assert.deepEqual(await decodeCloudState(manifest,descriptor,chunks),s);
});
test('P1 partial record workspace includes all checkpoints and permits nonfinancial append',async()=>{
  const s=setup();checkpoint(s,{asOfDate:'2026-09-01',amountCents:85000});const snapshot=await buildRecordSnapshot(s);
  const ids=new Set(snapshot.settings.dependencies.map(row=>row.id));const records=snapshot.records.filter(row=>ids.has(row.id)||row.periods.includes('2026-10'));
  const partial=await workspaceState({head:snapshot,records,periods:snapshot.periods.filter(row=>row.month==='2026-10')},'2026-10');
  assert.deepEqual(partial.balanceCheckpoints,s.balanceCheckpoints);const before=copy(partial);checkpoint(partial,{asOfDate:'2026-10-12',amountCents:80000});
  assert.equal(workspaceNeedsFullHistory(before,partial),false);assert.doesNotThrow(()=>assertWorkspaceMutation(before,partial));
  const merged=mergeWorkspaceIntent(before,partial,s);assert.equal(merged.balanceCheckpoints.length,3);assert.deepEqual(merged.monthRecords,s.monthRecords);
});
test('P1 simultaneous first optional checkpoints and old-client missing fields preserve all history',()=>{
  const base=state(),local=copy(base),remote=copy(base);checkpoint(local);checkpoint(remote,{asOfDate:'2026-10-12'});
  const merged=rebaseLocalChanges(base,local,remote);assert.equal(merged.balanceCheckpoints.length,2);
  const legacy=copy(base);legacy.meta.revision=20;
  assert.equal(rebaseLocalChanges(merged,merged,legacy).balanceCheckpoints.length,2);
  assert.throws(()=>assertCheckpointHistoryPreserved(merged,legacy),{code:'finize/cloud-conflict'});
});
test('P1 sync conflict cannot overwrite an immutable observation',()=>{
  const base=setup(),local=copy(base),remote=copy(base);remote.balanceCheckpoints[0].amountCents++;
  assert.throws(()=>rebaseLocalChanges(base,local,remote),{code:'finize/cloud-conflict'});assert.throws(()=>assertCheckpointHistoryPreserved(base,remote),{code:'finize/cloud-conflict'});
});
test('P1 concurrent same-day observations remain visible as a conflict, never a reliable balance',()=>{
  const base=state(),a=copy(base),b=copy(base);checkpoint(a);checkpoint(b,{amountCents:90000});const merged=rebaseLocalChanges(base,a,b),p=project(merged);
  assert.equal(p.balanceCents,null);assert.equal(p.status,'incomplete');assert.equal(merged.balanceCheckpoints.length,2);
  assert.deepEqual(project({...merged,balanceCheckpoints:[...merged.balanceCheckpoints].reverse()}),p);
});
test('P1 executed manual transfer without bank evidence remains unresolved',()=>{
  const s=setup();s.internalTransfers=[{id:'transfer',date:'2026-10-11',status:'uitgevoerd',sourceAccount:'gezamenlijk',targetAccount:'dion',actualAmount:50}];
  const p=project(s);assert.equal(p.balanceCents,100000);assert(p.reasons.some(row=>row.code==='manual-transfer-unresolved'));assert.equal(p.status,'incomplete');
  const {header}=source(s);s.internalTransfers[0].actualTransactionId=header.id;assert(!project(s).reasons.some(row=>row.code==='manual-transfer-unresolved'));
});
test('P1 shared source ID with conflicting physical accounts is excluded and reported',()=>{
  const s=setup(),{header}=source(s);s.accountProfiles.push({id:'other',accountOwner:'gezamenlijk',identifier:'NL02JOINT'});
  const wrong=copy(header);wrong.id='wrong-header';wrong.accountProfileId='other';s.transactions.unshift(wrong);
  const p=project(s);assert(p.reasons.some(row=>row.code==='conflicting-bank-source'));assert.equal(p.status,'incomplete');assert.equal(p.balanceCents,100000);
});
test('P1 an incorrect checkpoint date can be revised without losing the original',()=>{
  const s=setup(),old=copy(s.balanceCheckpoints[0]);checkpoint(s,{supersedesId:old.id,asOfDate:'2026-10-09'});
  assert.deepEqual(s.balanceCheckpoints[0],old);assert.equal(project(s,{toDate:'2026-10-09'}).balanceCents,100000);
  checkpoint(s,{asOfDate:'2026-10-12'});
  assert.throws(()=>checkpoint(s,{supersedesId:s.balanceCheckpoints[1].id,asOfDate:'2026-10-12'}),{code:'checkpoint-date-exists'});
});
test('P1 malformed checkpoint entries are incomplete without crashing or inventing zero',()=>{
  const s=state();s.balanceCheckpoints=[null];const p=project(s);assert.equal(p.balanceCents,null);assert.equal(p.quality.storage,'incomplete');
});
test('P1 conflicting materializations of the same proven bank identity are not counted twice',()=>{
  const s=setup();source(s,{id:'one'});source(s,{id:'two',amount:-120});
  for(const tx of s.transactions)tx.sourceIdentityProof={kind:'bank-id',authority:'bank',id:'same-bank-id'};
  const p=project(s);assert.equal(p.balanceCents,100000);assert.equal(p.status,'incomplete');assert.equal(p.mutations.length,0);
});
test('P1 withdrawn source cannot conflict with an active bank proof',()=>{
  const s=setup(),old=source(s,{id:'old'});source(s,{id:'active'});
  s.importSummaries.find(row=>row.id===old.batch.id).lifecycle='withdrawn';
  for(const tx of s.transactions)tx.sourceIdentityProof={kind:'bank-id',authority:'bank',id:'same-bank-id'};
  const p=project(s);assert.equal(p.balanceCents,90000);assert.equal(p.mutations.length,1);assert(!p.reasons.some(row=>row.code==='conflicting-bank-source'));
});
