const {test}=require('node:test'),assert=require('node:assert/strict');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const {newHousehold}=require('../helpers/v117-p4-browser.cjs');
const {token}=require('../helpers/v117-p3-emulator.cjs');
const {createEmulatorRecordTransport}=require('../../src/storage/firestore-record-transport.mjs');
const {createRecordCloudStore}=require('../../src/storage/cloud-records.mjs');
async function empty(){const f=await newHousehold();return {...f,store:createRecordCloudStore({householdId:f.householdId,transport:createEmulatorRecordTransport({token:token(f.email)})})};}
test('P4 actual rules: initialize empty cloud with local CSV history, without a legacy document',async()=>{
  const f=await empty(),s=state(),batch=materialize(s,[row('first','naar-spaarrekening',-50,{savingsGoalId:'goal'})]);
  await f.store.initializeNew({state:s,imports:[batch],epoch:'fresh',approveTestCutover:true});
  const result=await f.store.verifyIntegrity();assert.deepEqual(result.state,s);assert.deepEqual(result.imports,[batch]);
  assert.equal(await f.store.transport.get(`households/${f.householdId}/budgetState/current`),null);
  await assert.rejects(()=>f.store.transport.commit([{path:`households/${f.householdId}/budgetState/current`,data:{syncVersion:1,commitId:'v116',state:s}}]),{code:'permission-denied'});
});
test('P4 actual rules: interrupted fresh initialization resumes exact source once',async()=>{
  const f=await empty(),s=state();
  await assert.rejects(()=>f.store.migrate({state:s,imports:[],epoch:'resume',legacyPointer:null,initialization:true,checkpoint:phase=>{if(phase==='protected')throw Error('browser closed');}}),/browser closed/);
  await f.store.initializeNew({state:s,epoch:'resume',approveTestCutover:true});assert.equal((await f.store.verifyIntegrity()).head.revision,1);
  await f.store.initializeNew({state:s,epoch:'resume',approveTestCutover:true});assert.equal((await f.store.verifyIntegrity()).head.revision,1);
});
test('P4 actual rules: fresh initialization never replaces an existing legacy administration',async()=>{
  const {fixture}=require('../helpers/v117-p3-emulator.cjs'),f=await fixture();
  await assert.rejects(()=>f.store.initializeNew({state:state(),epoch:'unsafe',approveTestCutover:true}),{code:'migration-source-conflict'});
});
