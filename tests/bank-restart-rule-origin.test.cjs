const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize}=require('./helpers/package5-fixture.cjs'),u=require('../src/import/update4-runtime.cjs');
const {planImportCommand}=require('../src/import/import-lifecycle.mjs'),{providerBatchId}=require('../src/import/enable-banking-adapter.mjs'),{assertProviderRestartState}=require('../src/import/bank-import-generation.mjs');
function fixture(){const s=state(),id=providerBatchId('joint','synthetic-rule-origin'),batch=materialize(s,[row('synthetic-approved')],id);u.rememberRecognitionRules(s,batch);const deleted=planImportCommand(s,batch,{type:'delete',operationId:'synthetic-delete',timestamp:'2026-10-26T00:00:00Z'});return {s:deleted.state,proof:deleted.batch,id};}
test('actual learned manual rule survives source deletion and does not block a new generation',()=>{
 const {s,proof}=fixture(),before=structuredClone(s);assert.equal(s.transactions.length,0);assert.equal(s.recognitionRules.length,1);assertProviderRestartState(s,proof);assert.deepEqual(s,before);
 s.recognitionRules.push({...structuredClone(s.recognitionRules[0]),id:'second-rule'});assertProviderRestartState(s,proof);
});
for(const mutate of [p=>delete p.kind,p=>p.kind='legacy-rule',p=>delete p.sourceRowId,p=>p.sourceRowId='',p=>p.sourceRowId=' padded ',p=>delete p.approvedAt,p=>p.approvedAt='not-a-date',p=>p.approvedAt='12',p=>p.approvedAt='2026-02-30T12:00:00Z',p=>p.unknown={note:'unproven'}])test('incomplete or unsupported learned-rule provenance never permits the exception '+mutate.toString(),()=>{
 const {s,proof}=fixture();mutate(s.recognitionRules[0].provenance);assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});
});
test('exception applies to one exact field only, with all other financial/historical/nested references blocked',()=>{
 for(const location of ['transactions','monthRecords','manualTransactionReplacements','advanceLedger','bankCoverage']){const {s,proof,id}=fixture();s[location]=[{provenance:{importBatchId:id}}];assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});}
 for(const field of ['extra','context']){const {s,proof,id}=fixture();s.recognitionRules[0][field]={nested:{importBatchId:id}};assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});}
 const {s,proof,id}=fixture();s.transactions=[{importDeletionProofs:[{id}]}];assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});
});
test('existing prefixed source keys and legacy replacement identities remain blocking dependencies',()=>{
 for(const key of [id=>'bank-'+id+':row',id=>'source-bank-'+id+':row',id=>id+':row',id=>'replacement-'+id+'-manual']){const {s,proof,id}=fixture();s.manualTransactionReplacements=[{id:key(id)}];assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});}
});
test('replacement identity of a separate child generation does not masquerade as the deleted root',()=>{
 const {s,proof,id}=fixture(),child=id+'-g'+'a'.repeat(32);s.manualTransactionReplacements=[{id:'replacement-'+child+'-manual',importBatchId:child}];assertProviderRestartState(s,proof);
 s.manualTransactionReplacements[0].importBatchId=id;assert.throws(()=>assertProviderRestartState(s,proof),{code:'bank-import-restart-blocked'});
});
test('historical rule does not excuse pending parent journals or a conflicting queue',()=>{
 const {s,proof,id}=fixture();for(const status of ['pending','conflict','uncertain'])assert.throws(()=>assertProviderRestartState(s,proof,{journals:[{importId:id,status}]}),{code:'bank-import-restart-blocked'});
 assert.throws(()=>assertProviderRestartState(s,proof,{journals:[{importId:'other',status:'pending',candidate:s}]}),{code:'bank-import-restart-blocked'});
 assert.throws(()=>assertProviderRestartState(s,proof,{queue:[{importId:id,version:proof.version+1}]}),{code:'bank-import-restart-blocked'});
});
