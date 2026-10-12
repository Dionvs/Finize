const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize,copy}=require('./helpers/package5-fixture.cjs');
const {buildRecordSnapshot,decodeRecordSnapshot,decodeRecordValues,recordChanges}=require('../src/storage/cloud-record-model.mjs');
const {periodFinancials,verifiedPeriodResult,digest}=require('../src/storage/period-projections.mjs');
const {createEmulatorRecordTransport}=require('../src/storage/firestore-record-transport.mjs');
const engine=require('../src/core/transaction-engine.mjs');

test('P3 record snapshot losslessly preserves imports, original CSV, unknown fields and multi-part payloads',async()=>{
  const s=state();s.extension={large:'α'.repeat(100001)};s.spaardoelen.gezamenlijk[0].afbeelding='data:image/png;base64,'+'A'.repeat(1100000);const batch=materialize(s,[row('identical-one'),row('identical-two')]);batch.originalCsv='Datum;Bedrag\n2026-10-03;-300';
  const snapshot=await buildRecordSnapshot(s,[batch]);
  assert(snapshot.records.some(record=>record.partCount>1));
  assert(snapshot.global.payload.length<10000);assert.equal(JSON.parse(snapshot.global.payload).goals.gezamenlijk[0].afbeelding,undefined);
  assert.deepEqual(await decodeRecordSnapshot(snapshot,snapshot.records),{state:s,imports:[batch]});
});

test('P3 historical refunds, fixed months, coverage and source groups have explicit period dependencies',async()=>{
  const s=state();s.recurringFixedExpenses=[{id:'fixed',naam:'Hypotheek',categorie:'Wonen',bedrag:100,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}]}];
  materialize(s,[row('expense','uitgave',-100),row('fixed','vaste-last',-120,{fixedExpenseId:'fixed',fixedOccurrenceId:'fixed:2026-08-01',fixedOccurrenceMonth:'2026-08'}),row('refund','terugbetaling',25,{refundCategory:'Kleding',refundMonth:'2026-08'})]);
  const snapshot=await buildRecordSnapshot(s),august=snapshot.periods.find(row=>row.month==='2026-08');
  assert(august.dependencies.length>=4);
  assert.deepEqual(JSON.parse(august.payload),periodFinancials(s,'2026-08'));
  const head={...snapshot,phase:'ready',epoch:'test',revision:1};
  const result=await verifiedPeriodResult(head,august,snapshot.records.filter(row=>row.periods.includes('2026-08')),snapshot.global);
  assert.deepEqual(result.financials.totalsCents,periodFinancials(s,'2026-08').totalsCents);
});

test('P3 missing period, missing dependencies, damaged hashes and partial raw-state totals never return zero',async()=>{
  const s=state();materialize(s,[row('a')]);const snapshot=await buildRecordSnapshot(s),head={...snapshot,phase:'ready',epoch:'test',revision:1},period=snapshot.periods.find(row=>row.month==='2026-10'),records=snapshot.records.filter(row=>row.periods.includes('2026-10'));
  await assert.rejects(()=>verifiedPeriodResult(head,null,records,snapshot.global),{code:'period-incomplete'});
  await assert.rejects(()=>verifiedPeriodResult(head,period,records.slice(1),snapshot.global),{code:'period-incomplete'});
  const damaged=copy(records);damaged[0].payload='corrupt';await assert.rejects(()=>verifiedPeriodResult(head,period,damaged,snapshot.global),{code:'record-integrity'});
  assert.throws(()=>engine.sumTransactionEffects({...s,__finizePartialHistory:true},'budgetImpact',{month:'2026-10'}),{code:'period-incomplete'});
});

test('P3 historical edits recalculate affected projections and preserve unrelated month results',async()=>{
  const s=state();materialize(s,[row('a'),row('b','uitgave',-20)]);const before=await buildRecordSnapshot(s,[],{periods:['2026-09']});
  const next=copy(s);for(const tx of next.transactions.filter(tx=>tx.importTransactionId==='a'&&tx.recordRole!=='bank-source')){tx.amount=125;tx.expenseImpact=125;}
  const after=await buildRecordSnapshot(next,[],{periods:['2026-09']});
  assert.notEqual(before.periodHashes['2026-10'],after.periodHashes['2026-10']);assert.equal(before.periodHashes['2026-09'],after.periodHashes['2026-09']);
  const changes=recordChanges(before,after);assert(changes.some(change=>change.path==='periods/2026-10'));assert(!changes.some(change=>change.path==='periods/2026-09'));
});

test('P3 immutable bank originals cannot be overwritten by a record sync',async()=>{
  const s=state();materialize(s,[row('a')]);const before=await buildRecordSnapshot(s);const next=copy(s);next.transactions[0].bankOriginal.amount=-999;
  const changed=await buildRecordSnapshot(next);assert.throws(()=>recordChanges(before,changed),{code:'source-immutable'});
});

test('P3 transport rejects production and non-loopback addresses before any request',()=>{
  for(const options of [{host:'firestore.googleapis.com:443',projectId:'demo-test'},{host:'127.0.0.1:8181',projectId:'financien-7dd43'}])assert.throws(()=>createEmulatorRecordTransport({...options,token:'test'}),{code:'emulator-only'});
});

test('P4 record transport distinguishes offline fetch failure from permission and malformed responses',async()=>{
  const offline=new TypeError('Failed to fetch');
  await assert.rejects(()=>createEmulatorRecordTransport({token:'test',fetch:async()=>{throw offline;}}).get('households/test/head/current'),{code:'cloud-offline',cause:offline});
  await assert.rejects(()=>createEmulatorRecordTransport({token:'test',fetch:async()=>({status:403,ok:false,json:async()=>({error:{message:'denied'}})})}).get('households/test/head/current'),{code:'permission-denied'});
  await assert.rejects(()=>createEmulatorRecordTransport({token:'test',fetch:async()=>({status:200,ok:true,json:async()=>{throw new SyntaxError('damaged response');}})}).get('households/test/head/current'),SyntaxError);
});

test('P4 reopening a pending record import proves epoch, revision and the durable operation chain',async()=>{
  const {createRecordSync}=require('../src/storage/record-sync.mjs');
  const local={id:'batch',version:2,operationId:'edit',baseVersion:0};
  const base={importQueue:[{importId:'batch',version:2,operationId:'edit'}],imports:[local],operations:[{status:'pending',previousHash:'base',sha256:'current'}],head:{sha256:'current'},cloudBase:{epoch:'epoch',revision:5,localSha256:'base'}};
  const check=snapshot=>createRecordSync({localStore:{scope:'test',readCloudSnapshot:async()=>snapshot},cloudStore:{householdId:'test',context:async()=>({head:{data:{epoch:'epoch',revision:5}}})}}).pendingImportBaseMatches(local);
  assert.equal(await check(base),true);
  for(const mutate of [s=>s.cloudBase.revision++,s=>s.cloudBase.epoch='old',s=>s.operations[0].previousHash='wrong',s=>s.operations[0].status='conflict',s=>s.head.sha256='newer',s=>s.importQueue[0].operationId='other']){const changed=copy(base);mutate(changed);assert.equal(await check(changed),false);}
});

test('P3 conflict review identifies every differing existing approval before explicit resolution',()=>{
  const {conflictApprovalReview}=require('../src/storage/record-sync.mjs'),remote=state(),local=state();
  materialize(remote,[row('cloud-approved','naar-spaarrekening',-75,{savingsGoalId:'goal'})]);
  const review=conflictApprovalReview({remote,local});assert(review.length>=1);assert(review.every(item=>item.remote&&item.local===null));
  assert.deepEqual(conflictApprovalReview({remote,local:copy(remote)}),[]);
});

test('P3 oversized publication is rejected before sending any request',async()=>{
  let requested=false;const transport=createEmulatorRecordTransport({token:'test',fetch:async()=>{requested=true;throw Error('unexpected network');}});
  await assert.rejects(()=>transport.commit([{path:'test/large',data:{payload:'x'.repeat(800001)}}]),{code:'document-too-large'});assert.equal(requested,false);
});

test('P3 independently verifies immutable source hashes even when mutable payload hashes are consistent',async()=>{
  const s=state();materialize(s,[row('forged-source')]);const snapshot=await buildRecordSnapshot(s),record=copy(snapshot.records.find(row=>row.collection==='transactions'&&row.sourceHash));
  const value=JSON.parse(record.payload);value.bankOriginal.amount=-999;record.payload=JSON.stringify(value);record.hash=record.logicalHash=await digest(record.payload);
  await assert.rejects(()=>decodeRecordValues([record]),{code:'source-integrity'});
});
