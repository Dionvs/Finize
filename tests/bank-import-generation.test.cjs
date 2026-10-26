const {test}=require('node:test'),assert=require('node:assert/strict');
const {providerBatchId,stageProviderSnapshot}=require('../src/import/enable-banking-adapter.mjs');
const {nextProviderBatchId,providerImportIdentity,assertProviderRestartState,assertProviderRestartParent}=require('../src/import/bank-import-generation.mjs');
const u=require('../src/import/update4-runtime.cjs'),{state}=require('./helpers/package5-fixture.cjs');
const {applyFinancialCandidate}=require('../src/core/transaction-processing.mjs');
const {buildRecordSnapshot,decodeRecordSnapshot}=require('../src/storage/cloud-record-model.mjs');
const root=providerBatchId('joint','synthetic-bank-hash'),proof={id:root,lifecycle:'deleted',version:98,operationId:'synthetic-delete'};
test('new import generation is stable, separate from tombstone and separate between physical accounts',()=>{
 const first=nextProviderBatchId(root,proof);assert.equal(nextProviderBatchId(root,structuredClone(proof)),first);assert.notEqual(first,root);
 const next=nextProviderBatchId(root,{...proof,id:first,version:2,operationId:'next-delete'});assert.notEqual(next,first);
 const other=providerBatchId('personal','synthetic-personal-hash');assert.throws(()=>nextProviderBatchId(other,proof));assert.throws(()=>nextProviderBatchId(root,{...proof,lifecycle:'active'}));
});
test('original deleted-root staging failure is reproduced; explicit generation preserves original provider identity',()=>{
 const s=state();s.accountProfiles=[{id:'joint',accountOwner:'gezamenlijk',identifier:'NL20INGB0001234567',status:'active'}];
 const snapshot={version:1,runId:'synthetic-generation',householdId:'synthetic',accountProfileId:'joint',account:{iban:s.accountProfiles[0].identifier,identificationHash:'synthetic-bank-hash'},fromDate:'2026-10-01',toDate:'2026-10-26',fetchedAt:'2026-10-26T12:00:00Z',transactions:[{entry_reference:'original-bank-id',status:'BOOK',booking_date:'2026-10-23',transaction_amount:{amount:'10.00',currency:'EUR'},credit_debit_indicator:'DBIT',remittance_information:['Synthetic']}],balances:[]};
 const original=stageProviderSnapshot(snapshot,s,null,[],u.classifyOriginal);assert.throws(()=>stageProviderSnapshot(snapshot,s,proof,[],u.classifyOriginal),{code:'provider-batch-conflict'});
 const restored=stageProviderSnapshot(snapshot,s,null,[proof],u.classifyOriginal,proof);assert.notEqual(restored.id,original.id);assert.equal(restored.rows[0].id,original.rows[0].id);assert.deepEqual(restored.rows[0].sourceIdentityProof,original.rows[0].sourceIdentityProof);assert.deepEqual(restored.rows[0].providerInput,original.rows[0].providerInput);assert.equal(restored.rows[0].approvalSource,'');assert.equal(restored.rows[0].processingStatus,'nakijken');
});
test('existing active generation must prove its root and exact deletion operation',()=>{
 const identity=providerImportIdentity(root,null,proof);assert.equal(identity.id,nextProviderBatchId(root,proof));
 assert.deepEqual(providerImportIdentity(root,{...identity}),identity);assert.throws(()=>providerImportIdentity(root,{...identity,providerRootId:'other'}));assert.throws(()=>providerImportIdentity(root,{...identity,providerRestartFrom:{...proof,operationId:'changed'}}));
});
test('restart keeps deletion proof untouched and rejects missing or conflicting financial proof',()=>{
 const s=state();s.importDeletionProofs=[structuredClone(proof)];const before=structuredClone(s);assert.deepEqual(assertProviderRestartState(s,proof),proof);assert.deepEqual(s,before);
 assert.throws(()=>assertProviderRestartState({...s,importDeletionProofs:[]},proof));assert.throws(()=>assertProviderRestartState(s,{...proof,version:99}),{code:'import-conflict'});assert.throws(()=>assertProviderRestartParent(proof,{...proof,operationId:'changed'}),{code:'import-conflict'});
});
for(const location of ['transactions','monthRecords','manualTransactionReplacements','advanceLedger','internalTransferPairs'])test('restart refuses retained dependency in '+location,()=>{
 const s=state();s.importDeletionProofs=[structuredClone(proof)];s[location]=location==='monthRecords'?{'2026-09':{status:'afgesloten',snapshot:{importBatchId:root}}}:[{importBatchId:root}];const before=structuredClone(s);assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});assert.deepEqual(s,before);
});
test('restart refuses parent pending/conflict/uncertain operations and changed queue while allowing own acknowledged deletion cleanup',()=>{
 const s=state();s.importDeletionProofs=[structuredClone(proof)];for(const status of ['pending','conflict','uncertain'])assert.throws(()=>assertProviderRestartState(s,proof,{journals:[{importId:root,status}]}),{code:'bank-import-restart-blocked'});
 assert.throws(()=>assertProviderRestartState(s,proof,{queue:[{importId:root,version:99,operationId:'other'}]}));assertProviderRestartState(s,proof,{queue:[{importId:root,version:98,operationId:proof.operationId}]});
});
test('immutable nested provider arrays survive candidate adoption; divergent source fails before any mutation',()=>{
 const frozen=Object.freeze(['Synthetic original']),s={meta:{revision:1},transactions:[{id:'source',bankOriginal:{payload:{remittance_information:frozen}}}]};
 const candidate=structuredClone(s);candidate.meta.revision=2;applyFinancialCandidate(s,candidate);assert.equal(s.meta.revision,2);assert.equal(s.transactions[0].bankOriginal.payload.remittance_information,frozen);
 const changed=structuredClone(s);changed.meta.revision=3;changed.transactions[0].bankOriginal.payload.remittance_information[0]='Changed';const before=structuredClone(s);assert.throws(()=>applyFinancialCandidate(s,changed),{code:'source-integrity'});assert.deepEqual(s,before);
});
test('frozen source comparison distinguishes absent fields from explicit undefined and preserves ordinary edits',()=>{
 const source=Object.freeze({amount:100,optional:undefined}),s={meta:{revision:1},transactions:[{id:'source',bankOriginal:source}]};
 const changed={meta:{revision:2},transactions:[{id:'source',bankOriginal:{amount:100}}]};assert.throws(()=>applyFinancialCandidate(s,changed),{code:'source-integrity'});assert.equal(s.meta.revision,1);
 applyFinancialCandidate(s,{meta:{revision:2},transactions:[{id:'source',bankOriginal:{amount:100,optional:undefined}}]});assert.equal(s.meta.revision,2);assert.equal(s.transactions[0].bankOriginal,source);
});
test('frozen special object and cyclic source are explicitly rejected before adoption',()=>{
 for(const original of [Object.freeze(new Date('2026-10-26')),(()=>{const v={};v.self=v;return Object.freeze(v);})()]){
  const s={meta:{revision:1},transactions:[{id:'source',bankOriginal:original}]};assert.throws(()=>applyFinancialCandidate(s,{meta:{revision:2},transactions:[{id:'source',bankOriginal:structuredClone(original)}]}),{code:'source-integrity'});assert.equal(s.meta.revision,1);
 }
});
test('legacy cloud transaction validates parent tombstone and target revision before publishing',async()=>{
 const identity=providerImportIdentity(root,null,proof),batch={...identity,channel:'bank-api',version:1,baseVersion:0,operationId:'restart-op',lifecycle:'active',rows:[]};
 const original={getImport:u.ImportStore.getImport,listSync:u.ImportStore.listSync,getJournal:u.ImportStore.getJournal};
 u.ImportStore.getImport=async()=>batch;u.ImportStore.listSync=async()=>[{importId:batch.id,version:1,operationId:batch.operationId}];u.ImportStore.getJournal=async()=>null;
 try{const s=state();s.importDeletionProofs=[proof];s.importSummaries=[{id:batch.id,version:1,operationId:batch.operationId}];
 const documents=new Map([[proof.id,proof]]),writes=[];const cloud={isConnected:()=>true,db:{},importRef:id=>id,modules:{firestore:{runTransaction:()=>{},setDoc:async()=>{},doc:(_,...parts)=>parts.join('/')}}};
 const staged=await u.stageImportCloudWrites({CloudAdapter:cloud},s),tx={get:async id=>({exists:()=>documents.has(id),data:()=>documents.get(id)}),set:(id,value)=>writes.push([id,value])};
 documents.set(proof.id,{...proof,operationId:'changed'});await assert.rejects(()=>staged.readAndValidate(tx),{code:'import-conflict'});assert.equal(writes.length,0);
 documents.set(proof.id,proof);documents.set(batch.id,{...batch,operationId:'other-device'});await assert.rejects(()=>staged.readAndValidate(tx),{code:'import-conflict'});assert.equal(writes.length,0);
 documents.delete(batch.id);await staged.readAndValidate(tx);staged.publish(tx);assert.equal(writes.length,1);assert.equal(writes[0][0],batch.id);assert.deepEqual(documents.get(proof.id),proof);
 }finally{Object.assign(u.ImportStore,original);}
});
test('record cloud preserves restart identity and tombstone; missing or changed proof fails before record generation',async()=>{
 const s=state();s.importDeletionProofs=[proof];const batch={...providerImportIdentity(root,null,proof),channel:'bank-api',version:1,operationId:'record-restart',rows:[]},imports=[{...proof,rows:[]},batch];
 const encoded=await buildRecordSnapshot(s,imports),decoded=await decodeRecordSnapshot(encoded,encoded.records);assert.deepEqual(decoded.imports,imports);assert.deepEqual(decoded.state,s);
 await assert.rejects(()=>buildRecordSnapshot(s,[batch]),{code:'import-conflict'});await assert.rejects(()=>buildRecordSnapshot({...s,importDeletionProofs:[{...proof,version:99}]},imports),{code:'import-conflict'});
});
