const {createEmulatorRecordTransport}=require('../../src/storage/firestore-record-transport.mjs');
const {createRecordCloudStore}=require('../../src/storage/cloud-records.mjs');
const {state,copy}=require('./package5-fixture.cjs');
const projectId='demo-finize-v117';
const token=(email,uid='p3-user')=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:'https://securetoken.google.com/'+projectId,aud:projectId,sub:uid,user_id:uid,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,email,email_verified:true,firebase:{sign_in_provider:'password'}})).toString('base64url'),''].join('.');
const admin=createEmulatorRecordTransport({token:'owner'});
async function fixture(input=null){
  const householdId='p3-'+crypto.randomUUID(),email=householdId+'@example.invalid';
  await admin.commit([{path:'accountLinks/'+email,data:{householdId,role:'dion',displayName:'P3'}},{path:'households/'+householdId,data:{label:'isolated emulator'}}]);
  const transport=createEmulatorRecordTransport({token:token(email)}),store=createRecordCloudStore({transport,householdId}),s=input?copy(input):state();
  const legacy={syncVersion:1,commitId:'legacy',state:copy(s)};await admin.commit([{path:`households/${householdId}/budgetState/current`,data:legacy}]);
  return {householdId,email,transport,store,s,legacy};
}
async function active(input=null){const f=await fixture(input);await f.store.migrate({state:f.s,epoch:'epoch-one',legacyPointer:f.legacy});await f.store.activate({approveTestCutover:true});return f;}
module.exports={fixture,active,token,admin,projectId};
