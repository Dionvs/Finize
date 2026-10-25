import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { registerHooks } from 'node:module';
import { multiFixture, clock } from '../../tests/helpers/bank-multi-fixture.mjs';

test('actual Functions HTTP entry enforces each configured identity and profile; all provider and SDK operations are synthetic',async()=>{
  const f=multiFixture();await f.adopt(true);
  const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
  const warnings=[];let init,options,secretReads=0;
  const sdkUrl=name=>new URL('./sdk-stub.mjs?module='+encodeURIComponent(name),import.meta.url).href;
  registerHooks({resolve(specifier,context,next){
    if(specifier.startsWith('firebase-admin/')||specifier.startsWith('firebase-functions/'))return {url:sdkUrl(specifier),shortCircuit:true};
    return next(specifier,context);
  }});
  const sdkMock=(name,options)=>mock.module(sdkUrl(name),options);
  const document=key=>({key,get:async()=>({data:()=>f.records.has(key)?{value:structuredClone(f.records.get(key))}:undefined}),set:async value=>f.store.set(key,value.value)});
  const db={collection(path){assert.equal(path,'finizeBankPrivate/ing/metadata');
    return {doc:document,where(){let prefix='',limit=6;const query={orderBy:()=>query,startAt:value=>(prefix=value,query),endAt:()=>query,limit:value=>(limit=value,query),get:async()=>({docs:[...f.records].filter(([k,v])=>k.startsWith(prefix)&&v?.revokePending).slice(0,limit).map(([id,value])=>({id,data:()=>({value})}))})};return query;}};},
    doc(path){if(path.startsWith('accountLinks/'))return {get:async()=>({data:()=>f.assignments.get(path.slice('accountLinks/'.length))})};
      assert.equal(path,'households/synthetic-house/budgetState/current');return {get:async()=>({updateTime:{toMillis:()=>1},data:()=>({state:{accountProfiles:[...f.profiles.values()]}})})};},
    runTransaction:null};
  db.runTransaction=action=>f.store.transaction(tx=>action({get:async ref=>{const value=await tx.get(ref.key);return {data:()=>value===null?undefined:{value}};},set:(ref,value)=>tx.set(ref.key,value.value)}));
  const vars={APP_ID:f.config.applicationId,UID:f.config.uid,EMAIL:f.config.email,HOUSEHOLD_ID:f.config.householdId,ACCOUNT_PROFILE_ID:f.config.accountProfileId,IBAN:f.config.iban,ACCOUNT_HASH:f.config.accountHash,ASPSP_NAME:'ING',REDIRECT_URL:f.config.redirectUrl,ACCOUNTS:JSON.stringify(f.config.registry)};
  sdkMock('firebase-functions/v2/https',{namedExports:{onRequest:(value,handler)=>(options=value,handler)}});
  sdkMock('firebase-functions/v2/core',{namedExports:{onInit:callback=>{init=callback;}}});
  sdkMock('firebase-functions/params',{namedExports:{defineString:name=>({value:()=>vars[name.replace('ENABLE_BANKING_','')]||''}),defineBoolean:name=>({value:()=>name==='ENABLE_BANKING_ENABLED'}),defineSecret:()=>({value:()=>{secretReads++;return key;}})}});
  sdkMock('firebase-admin/app',{namedExports:{initializeApp:()=>({})}});
  sdkMock('firebase-admin/auth',{namedExports:{getAuth:()=>({verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);return f.dependencies.verifyToken(token);},getUser:async uid=>({uid,email:uid==='uid-dion'?'dion@example.invalid':'dara@example.invalid',emailVerified:true,disabled:f.disabledUsers.has(uid)})})}});
  sdkMock('firebase-admin/firestore',{namedExports:{getFirestore:()=>db,Timestamp:{fromMillis:millis=>({millis})},FieldPath:{documentId:()=> '__name__'}}});
  mock.method(Date,'now',()=>clock);mock.method(console,'warn',value=>warnings.push(value));
  mock.method(globalThis,'fetch',async(url,request)=>{assert(String(url).startsWith('https://api.enablebanking.com/'));const u=new URL(url);const result=await f.dependencies.provider(request.method,u.pathname+u.search,request.body?JSON.parse(request.body):undefined);return {ok:true,status:200,json:async()=>result};});
  const {enableBanking}=await import('../src/index.mjs');await init();
  assert.equal(options.serviceAccount,'finize-bank@financien-7dd43.iam.gserviceaccount.com');assert.equal(options.region,'europe-west4');assert.equal(options.maxInstances,1);
  async function call(path,body={},token='dion',extra={}){const output={status:200};
    const req={path,body,method:'POST',query:{},ip:'127.0.0.1',is:()=>true,get:name=>({'Origin':'https://dionvs.github.io',Authorization:'Bearer '+token,'User-Agent':'synthetic'}[name]),...extra};
    const res={set:()=>res,status:value=>(output.status=value,res),json:value=>(output.body=value,res),redirect:(status,url)=>(output.status=status,output.url=url,res),end:()=>res};await enableBanking(req,res);return output;}
  assert.equal((await call('/status',{accountProfileId:'profile-dion'})).body.connected,true);
  const reads=secretReads;
  assert.equal((await call('/sync',{accountProfileId:'profile-dara'})).status,403);
  assert.equal((await call('/status',{accountProfileId:'profile-dara'},'dara')).body.activationBlocked,true);
  assert.equal((await call('/status',{accountProfileId:'unknown'})).status,403);
  f.disabledUsers.add('uid-dion');assert.equal((await call('/status',{accountProfileId:'profile-dion'})).status,403);f.disabledUsers.clear();assert.equal(secretReads,reads);
  const started=await call('/auth/start',{accountProfileId:'profile-gezamenlijk',iban:'attacker-input',householdId:'other'});assert.equal(started.status,200);
  const callback=await call('/callback',{},'dion',{method:'GET',query:{state:f.states.get('gezamenlijk'),code:'code-gezamenlijk'}});assert.equal(callback.status,303);assert.equal(callback.url,'https://dionvs.github.io/Finize/?banklink=complete');
  const sync=await call('/sync',{accountProfileId:'profile-gezamenlijk',fromDate:'2026-10-24',toDate:'2026-10-25',iban:f.config.iban,householdId:'other'});
  assert.equal(sync.status,200);assert.equal(sync.body.accountProfileId,'profile-gezamenlijk');assert.equal(sync.body.account.iban,f.entries[1].iban);assert.equal(sync.body.householdId,'synthetic-house');
  assert(!JSON.stringify(sync.body).includes('session-gezamenlijk'));assert(!JSON.stringify(sync.body).includes('account-gezamenlijk'));
  assert.equal((await call('/disconnect',{accountProfileId:'profile-gezamenlijk'})).body.connected,false);
  assert.equal((await call('/status',{accountProfileId:'profile-dion'})).body.connected,true);
  assert.equal((await call('/path-with-private-value')).status,404);assert(warnings.every(line=>!line.includes('path-with-private-value')&&!line.includes('attacker-input')&&!line.includes('session-')));
  // Directly changed HTTP integration: legacy mode plus the separately enabled bootstrap.
  const joint='account-388ed1e4',dionBefore=structuredClone(f.records.get('connection'));
  assert.equal((await call('/bootstrap/start',{accountProfileId:joint})).status,403);
  const entry=f.entries[1];f.profiles.delete(entry.accountProfileId);entry.accountProfileId=joint;
  f.profiles.set(joint,{id:joint,accountOwner:'gezamenlijk',identifier:entry.iban,status:'active'});
  vars.ACCOUNTS='';vars.BOOTSTRAP=JSON.stringify({enabled:true,accountProfileId:joint,iban:entry.iban,providerLinked:true,holderConfirmed:true,providerMode:'restricted'});
  f.overrideExchange(e=>({session_id:'new-bootstrap-http-session',access:{valid_until:new Date(clock+86400000).toISOString()},accounts:[f.account(e)]}));
  assert.equal((await call('/bootstrap/start',{accountProfileId:'profile-dion'})).status,403);
  assert.equal((await call('/bootstrap/start',{accountProfileId:joint},'dara')).status,403);
  assert.equal((await call('/status',{accountProfileId:joint})).body.bootstrapAvailable,true);
  assert.equal((await call('/bootstrap/start',{accountProfileId:joint,iban:'attacker-input',uid:'attacker-input',householdId:'other'})).status,200);
  const beforeBootstrap=f.calls.length;
  const response=await call('/callback',{},'dion',{method:'GET',query:{state:f.states.get('gezamenlijk'),code:'code-gezamenlijk',purpose:'bank-connection'}});
  assert.equal(response.status,303);
  const candidate=await call('/status',{accountProfileId:joint});assert.equal(candidate.body.connected,false);assert.equal(candidate.body.candidateVerified,true);
  assert(!JSON.stringify(candidate.body).includes('new-bootstrap-http-session'));assert(!JSON.stringify(candidate.body).includes('hash-gezamenlijk'));
  assert.equal((await call('/auth/start',{accountProfileId:joint})).status,403);
  assert.equal((await call('/sync',{accountProfileId:joint})).status,403);
  assert.equal((await call('/bootstrap/verify',{accountProfileId:joint})).status,200);
  assert(!f.calls.slice(beforeBootstrap).some(x=>/\/accounts\//.test(x.path)));
  assert.equal((await call('/bootstrap/disconnect',{accountProfileId:joint})).status,200);
  assert.deepEqual(f.records.get('connection'),dionBefore);
});
