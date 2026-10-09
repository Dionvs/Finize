const {test}=require('node:test'),assert=require('node:assert/strict');
const u=require('../src/import/update4-runtime.cjs'),model=require('../src/core/transaction-model.mjs');
const e=require('../src/core/transaction-engine.mjs'),outcomes=require('../src/storage/commit-outcome.mjs');
const {state,row,materialize,memory,copy}=require('./helpers/package5-fixture.cjs');
const {runApprovalGroup}=require('../src/import/approval-group.mjs');
const {assertCloudBase}=require('../src/storage/sync-protocol.mjs');

async function editor(rows=[row('r')]){
  const mem=memory(),s=state(),batch=materialize(s,rows,'v117');mem.imports.set(batch.id,copy(batch));
  const root={state:s,commitChange(fn){fn();return true;}};
  return {mem,s,batch,root,draft:await u.beginImportEditor(root,batch)};
}
async function pendingEditor(rows){
  const mem=memory(),s=state(),batch={id:'v117',accountProfileId:'joint',accountOwner:'gezamenlijk',version:0,status:'concept',lifecycle:'active',rows,summary:{}};
  rows.forEach(r=>Object.assign(r,{processingStatus:'onbekend',reviewStatus:'onbekend',certainty:'onbekend',approvalSource:'',approvedAt:''}));
  const root={state:s,commitChange(fn){fn();return true;}};
  await u.persistImportDraft(root,batch,{syncCloud:false});
  return {mem,s,batch,root,draft:await u.beginImportEditor(root,batch)};
}

test('V117 P1 prepared intent never proves commit; unreadable state is uncertain',async()=>{
  const s=state(),op={importId:'a',intent:{operationId:'op'},batch:{version:2},baseSignature:JSON.stringify(s)};
  assert.equal(outcomes.inspectCommitOutcome(s,op),'rejected');
  const changed=copy(s);changed.meta.revision++;
  assert.equal(outcomes.inspectCommitOutcome(changed,op),'uncertain');
  changed.importSummaries.push({id:'a',operationId:'op',version:2});
  assert.equal(outcomes.inspectCommitOutcome(changed,op),'committed');
  assert.equal((await outcomes.readCommitOutcome(async()=>{throw Error('blocked');},op)).outcome,'uncertain');
});

test('V117 P1 seven successes survive storage failure and remaining sources are not attempted',async()=>{
  const requests=Array.from({length:10},(_,i)=>({rowId:'r'+i,operationId:'op'+i})),called=[];
  const result=await runApprovalGroup(requests,async request=>{called.push(request.rowId);if(request.rowId==='r7')throw outcomes.commitOutcomeError(Error('quota'),'rejected',request.operationId);return {outcome:'committed'};});
  assert.equal(result.committed,7);assert.equal(called.length,8);
  assert.deepEqual(result.results.slice(8).map(r=>r.status),['niet-geprobeerd','niet-geprobeerd']);
});

test('V117 P1 invalid/conflicting sources allow next source; uncertainty stops',async()=>{
  const result=await runApprovalGroup([0,1,2,3,4].map(i=>({rowId:String(i),operationId:'o'+i})),async r=>{
    if(r.rowId==='0')throw Object.assign(Error('invalid'),{code:'approval-validation'});
    if(r.rowId==='1')throw Object.assign(Error('conflict'),{code:'import-conflict'});
    if(r.rowId==='3')throw outcomes.commitOutcomeError(Error('read blocked'),'uncertain',r.operationId);
    return {outcome:'committed'};
  });
  assert.deepEqual(result.results.map(r=>r.status),['ongeldig','conflicterend','geslaagd','onzeker','niet-geprobeerd']);
});

test('V117 P1 explicit approval has one status despite old reviewStatus',()=>{
  const r=row('status');r.reviewStatus='nakijken';u.markExplicitlyApproved(r);
  assert.equal(u.importReviewState(r),'goedgekeurd');
  assert.equal(model.getTransactionProcessingStatus({...r,source:'csv'}),'goedgekeurd');
});

test('V117 P1 double failure cannot replay a reported failure at restart',async()=>{
  const x=await editor(),before=copy(x.s),put=u.ImportStore.putJournal;
  try{
    x.root.commitChange=()=>{throw Error('financial storage full');};
    u.ImportStore.putJournal=async j=>{if(j.status==='rolled-back')throw Error('rollback journal full');return put(j);};
    x.draft.rows[0].processing.category='Boodschappen';
    await assert.rejects(u.commitImportEditor(x.root,x.draft,{approveIds:['r']}),error=>['rejected','uncertain'].includes(error.commitOutcome));
    assert.deepEqual(x.s,before);
    u.ImportStore.putJournal=put;x.root.commitChange=fn=>{fn();return true;};
    await u.recoverJournal(x.root);await u.recoverJournal(x.root);
    assert.deepEqual(x.s,before);
    assert.equal(x.mem.imports.get('v117').rows[0].processing.category,'Kleding');
  }finally{x.mem.restore();}
});

test('V117 P1 lost acknowledgement reconciles a committed operation exactly once',async()=>{
  const x=await editor();try{
    x.root.commitChange=fn=>{fn();throw Error('acknowledgement interrupted');};
    x.draft.rows[0].processing.category='Boodschappen';
    const result=await u.commitImportEditor(x.root,x.draft,{approveIds:['r']});
    assert.equal(result.outcome,'committed');
    assert.equal(e.sumTransactionEffects(x.s,'realExpense'),300);
    await u.recoverJournal(x.root);await u.recoverJournal(x.root);
    assert.equal(e.sumTransactionEffects(x.s,'realExpense'),300);
    assert.equal(x.s.transactions.filter(t=>t.recordRole!=='bank-source').length,1);
  }finally{x.mem.restore();}
});

test('V117 P1 selected five keep individual bank identities and amounts',async()=>{
  const rows=Array.from({length:10},(_,i)=>row('r'+i,'uitgave',-[35,42,35,35,18,25,40,20,11,60][i]));
  const x=await pendingEditor(rows);try{
    const selected=['r0','r2','r4','r6','r8'],originals=copy(x.batch.rows.map(r=>r.bankOriginal));
    const result=await u.approveSelectedSources(x.root,x.draft,selected);
    assert.equal(result.results.filter(r=>r.status==='geslaagd').length,5);
    const saved=x.mem.imports.get('v117');
    assert.deepEqual(saved.rows.map(r=>r.bankOriginal),originals);
    assert.equal(saved.rows.filter(r=>u.importReviewState(r)==='goedgekeurd').length,5);
    assert.equal(e.sumTransactionEffects(x.s,'realExpense'),139);
    assert.ok(saved.rows.filter(r=>!selected.includes(r.id)).every(r=>u.importReviewState(r)==='onbekend'));
  }finally{x.mem.restore();}
});

test('V117 P1 failure at each preparation boundary retains previous financial state',async()=>{
  for(const boundary of ['journal','import','outbox','financial','rollback']){
    const x=await editor(),before=copy(x.s);
    const original={putJournal:u.ImportStore.putJournal,putImport:u.ImportStore.putImport,putSync:u.ImportStore.putSync,rollbackImport:u.ImportStore.rollbackImport};
    try{
      x.draft.rows[0].processing.category='Boodschappen';
      if(boundary==='journal')u.ImportStore.putJournal=async()=>{throw Error('journal unavailable');};
      if(boundary==='import')u.ImportStore.putImport=async()=>{throw Error('import unavailable');};
      if(boundary==='outbox')u.ImportStore.putSync=async()=>{throw Error('outbox unavailable');};
      if(['financial','rollback'].includes(boundary))x.root.commitChange=()=>{throw Error('financial unavailable');};
      if(boundary==='rollback')u.ImportStore.rollbackImport=async()=>{throw Error('rollback unavailable');};
      await assert.rejects(u.commitImportEditor(x.root,x.draft,{approveIds:['r']}),err=>err.commitOutcome===(boundary==='rollback'?'uncertain':'rejected'),boundary);
      assert.deepEqual(x.s,before,boundary);
      Object.assign(u.ImportStore,original);x.root.commitChange=fn=>{fn();return true;};
      await u.recoverJournal(x.root);await u.recoverJournal(x.root);
      assert.deepEqual(x.s,before,boundary+' restart');
      assert.equal(x.mem.imports.get('v117').rows[0].processing.category,'Kleding',boundary);
    }finally{Object.assign(u.ImportStore,original);x.mem.restore();}
  }
});

test('V117 P1 unreadable durable state blocks retry until readback; no replay',async()=>{
  const x=await editor(),before=copy(x.s);try{
    x.root.DataAdapter={readDurableState(){throw Error('durable read unavailable');}};
    x.root.commitChange=()=>{throw Error('financial unavailable');};
    x.draft.rows[0].processing.category='Boodschappen';
    await assert.rejects(u.commitImportEditor(x.root,x.draft,{approveIds:['r']}),err=>err.commitOutcome==='uncertain');
    await assert.rejects(u.commitImportEditor(x.root,x.draft,{approveIds:['r']}),err=>err.commitOutcome==='uncertain');
    await assert.rejects(u.recoverJournal(x.root),err=>err.commitOutcome==='uncertain');
    x.root.DataAdapter.readDurableState=()=>copy(before);
    await u.recoverJournal(x.root);
    assert.deepEqual(x.s,before);assert.equal(x.mem.imports.get('v117').rows[0].processing.category,'Kleding');
  }finally{x.mem.restore();}
});

test('V117 P1 returned uncertain outcome is never counted as success',async()=>{
  const result=await runApprovalGroup([{rowId:'a'},{rowId:'b'}],async()=>({outcome:'uncertain'}));
  assert.equal(result.committed,0);assert.deepEqual(result.results.map(r=>r.status),['onzeker','niet-geprobeerd']);
  const missing=await runApprovalGroup([{rowId:'a'}],async()=>undefined);
  assert.equal(missing.committed,0);assert.equal(missing.results[0].status,'onzeker');
});

test('V117 P1 confirmed empty cloud accepts initial commit; disappearance remains a conflict',()=>{
  assert.equal(assertCloudBase(null,0,''),0);
  assert.throws(()=>assertCloudBase(null,1,''),err=>err.code==='finize/cloud-conflict');
  assert.throws(()=>assertCloudBase(null,0,'1|time|device'),err=>err.code==='finize/cloud-conflict');
  assert.throws(()=>assertCloudBase({syncVersion:1,state:{meta:{revision:1}}},0,''),err=>err.code==='finize/cloud-conflict');
});
