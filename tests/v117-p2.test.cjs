const {test}=require('node:test'),assert=require('node:assert/strict');
const {encodeHouseholdState,decodeHouseholdState,LOCAL_STORAGE_VERSION}=require('../src/storage/household-store.mjs');
const {state,row,materialize,copy}=require('./helpers/package5-fixture.cjs');
const engine=require('../src/core/transaction-engine.mjs');

test('V117 P2 lossless record roundtrip preserves financial invariants and unknown legacy data',()=>{
  const s=state();materialize(s,[row('a','uitgave',-300),row('b','naar-spaarrekening',-75,{savingsGoalId:'goal'})]);
  s.futureCompatible={nested:['keep',{value:17}]};s.legacyArrayWithoutIds=[{name:'preserve'},42,null];
  const original=copy(s),encoded=encodeHouseholdState(s),decoded=decodeHouseholdState({storageVersion:LOCAL_STORAGE_VERSION,schemaVersion:11,layout:encoded.layout},encoded.records);
  assert.deepEqual(s,original);assert.deepEqual(decoded,original);
  for(const effect of ['accountCashflow','budgetImpact','realExpense','goalDelta','incomeImpact','savingsDeposit'])assert.equal(engine.sumTransactionEffects(decoded,effect),engine.sumTransactionEffects(original,effect),effect);
  assert.equal(encoded.records.filter(record=>record.collection==='transactions').length,s.transactions.length);
});

test('V117 P2 period index includes bank month, historical fixed month and split refund months',()=>{
  const s=state();s.transactions=[{id:'historical',date:'2026-10-03',bankOriginal:{bankDate:'2026-10-03'},fixedOccurrenceMonth:'2026-08',splits:[{id:'refund',refundMonth:'2026-07'}]}];
  const record=encodeHouseholdState(s).records.find(row=>row.collection==='transactions');
  assert.deepEqual(record.periods.sort(),['2026-07','2026-08','2026-10']);
});

test('V117 P2 missing referenced record is an integrity error, never an empty financial total',()=>{
  const s=state();materialize(s,[row('a')]);const encoded=encodeHouseholdState(s);
  assert.throws(()=>decodeHouseholdState({storageVersion:LOCAL_STORAGE_VERSION,schemaVersion:11,layout:encoded.layout},encoded.records.filter(record=>record.collection!=='transactions')),error=>error.code==='storage-integrity');
});

test('V117 P2 every financial storage caller awaits or returns its asynchronous result',()=>{
  const fs=require('node:fs'),{babelParse,traverse}=require('../node_modules/playwright/lib/transform/babelBundle.js'),violations=[];
  for(const file of ['src/core/runtime.js','src/import/runtime.js']){
    const source=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
    traverse(babelParse(source,file,false),{CallExpression(p){
      const c=p.node.callee,critical=c.type==='Identifier'&&['commitChange','persist','localSave'].includes(c.name)||c.type==='MemberExpression'&&['root','window'].includes(c.object?.name)&&c.property?.name==='commitChange'||c.type==='MemberExpression'&&c.object?.name==='DataAdapter'&&c.property?.name==='save';
      if(!critical)return;
      const parent=p.parent;
      if(parent.type==='AwaitExpression'||parent.type==='ReturnStatement'||parent.type==='ArrowFunctionExpression'&&parent.body===p.node)return;
      violations.push(`${file}:${p.node.loc.start.line}`);
    }});
  }
  assert.deepEqual(violations,[]);
});

test('V117 P2 unsupported storage/schema versions are rejected without a default-state fallback',()=>{
  for(const [storageVersion,schemaVersion]of [[0,11],[2,11],[1,10]])assert.throws(()=>decodeHouseholdState({storageVersion,schemaVersion,layout:{}},[]),error=>error.code==='storage-version');
});

test('V117 P2 recovery compares the confirmed commit base rather than derived UI defaults',()=>{
  const {inspectCommitOutcome}=require('../src/storage/commit-outcome.mjs'),durable=state(),display=copy(durable);
  display.monthlyBudgets={'2026-10':{}};
  const operation={importId:'pending',intent:{operationId:'pending-op'},batch:{version:2},baseSignature:JSON.stringify(display),durableBaseSignature:JSON.stringify(durable)};
  assert.equal(inspectCommitOutcome(durable,operation),'rejected');
  const advanced=copy(durable);advanced.meta.revision++;
  assert.equal(inspectCommitOutcome(advanced,operation),'uncertain');
  advanced.importSummaries.push({id:'pending',operationId:'pending-op',version:2});
  assert.equal(inspectCommitOutcome(advanced,operation),'committed');
});

test('V117 P2 storage error explanations retain uncertain/rejected commit outcomes and operation IDs',()=>{
  const {describeMutationError}=require('../src/core/mutation-errors.mjs');
  for(const name of ['QuotaExceededError','SecurityError'])for(const outcome of ['rejected','uncertain']){
    const original=Object.assign(new DOMException('Storage failure',name),{commitOutcome:outcome,operationId:'p2-proof',storageFailure:true});
    const explained=describeMutationError(original);
    assert.equal(explained.cause,original);assert.equal(explained.commitOutcome,outcome);assert.equal(explained.operationId,'p2-proof');assert.equal(explained.storageFailure,true);
  }
});
