import {readFile} from 'node:fs/promises';
import {parseBootstrap,promoteJointBootstrap} from '../src/bank-bootstrap.mjs';
import {parseBankRegistry} from '../src/bank-registry.mjs';

const args=process.argv.slice(2);
if(args.includes('--help')) {
  console.log('node functions/scripts/promote-bank-bootstrap.mjs --config <private-config.json> [--apply]');
  console.log('Default: plan. Requires existing ADC, exact live server configuration, explicit expectedRevision and a candidate verified in Finize within 60 seconds. No Secret Manager, provider JWT or financial writes.');
}else try {
  if(args.filter(x=>x==='--config').length!==1||args.filter(x=>x==='--apply').length>1||
      args.some((x,i)=>!['--config','--apply'].includes(x)&&args[i-1]!=='--config'))throw Error('invalid-arguments');
  const filename=args[args.indexOf('--config')+1];if(!filename||filename.startsWith('--'))throw Error('private-config-required');
  const config=JSON.parse(await readFile(filename,'utf8'));
  if(config.projectId!=='financien-7dd43')throw Error('wrong-project');
  if(!config.expectedRevision||!parseBootstrap(config)||!parseBankRegistry(config))throw Error('promotion-config-required');
  const {initializeApp,applicationDefault}=await import('firebase-admin/app');
  const credential=applicationDefault(),token=await credential.getAccessToken();
  const response=await fetch('https://cloudfunctions.googleapis.com/v2/projects/financien-7dd43/locations/europe-west4/functions/enableBanking',
    {headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('live-config-unavailable');
  const fn=await response.json(),env=fn.serviceConfig?.environmentVariables;
  const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  if(fn.state!=='ACTIVE'||env.ENABLE_BANKING_ENABLED!=='true'||config.enabled!==true||fn.serviceConfig.revision!==config.expectedRevision||fn.serviceConfig.serviceAccountEmail!=='finize-bank@financien-7dd43.iam.gserviceaccount.com')throw Error('live-config-mismatch');
  for(const [property,name] of Object.entries({applicationId:'APP_ID',uid:'UID',email:'EMAIL',householdId:'HOUSEHOLD_ID',accountProfileId:'ACCOUNT_PROFILE_ID',iban:'IBAN',accountHash:'ACCOUNT_HASH',aspspName:'ASPSP_NAME',redirectUrl:'REDIRECT_URL'}))
    if((config[property]||'')!==(env['ENABLE_BANKING_'+name]||''))throw Error('live-config-mismatch');
  if(stable(JSON.parse(env.ENABLE_BANKING_ACCOUNTS||'null'))!==stable(typeof config.registry==='string'?JSON.parse(config.registry):config.registry)||
      stable(JSON.parse(env.ENABLE_BANKING_BOOTSTRAP||'null'))!==stable(typeof config.bootstrap==='string'?JSON.parse(config.bootstrap):config.bootstrap))throw Error('live-config-mismatch');
  const {getFirestore,Timestamp,FieldPath}=await import('firebase-admin/firestore');
  const {getAuth}=await import('firebase-admin/auth');
  const {createBankMetadataStore}=await import('../src/bank-retention.mjs');
  const {readBankProfile}=await import('../src/bank-profile.mjs');
  const app=initializeApp({projectId:config.projectId,credential}),db=getFirestore(app),auth=getAuth(app);
  const result=await promoteJointBootstrap({config,store:createBankMetadataStore({db,Timestamp,FieldPath}),apply:args.includes('--apply'),
    verifyIdentity:async(uid,email)=>{const user=await auth.getUser(uid);return !user.disabled&&user.emailVerified&&user.email?.toLowerCase()===email.toLowerCase();},
    readAssignment:async email=>(await db.doc('accountLinks/'+email).get()).data(),readProfile:(household,id)=>readBankProfile(db,household,id)});
  console.log(JSON.stringify(result));
}catch(error){
  const code=error.code||error.message;
  console.error(/^[a-z-]+$/.test(code||'')?code:'bank-promotion-not-completed');process.exitCode=1;
}
