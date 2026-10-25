import test from 'node:test';
import assert from 'node:assert/strict';
import { multiFixture, syntheticIban, clock } from './helpers/bank-multi-fixture.mjs';
import { createJointBootstrapService, parseBootstrap, promoteJointBootstrap, JOINT_PROFILE_ID } from '../functions/src/bank-bootstrap.mjs';
import { digest, metadataKey, adoptLegacyBankMetadata } from '../functions/src/bank-registry.mjs';
import { bankMetadataExpiry } from '../functions/src/bank-retention.mjs';
const clone=x=>structuredClone(x);
function fixture(){
  const f=multiFixture(),joint=f.entries[1];
  f.profiles.delete(joint.accountProfileId);joint.accountProfileId=JOINT_PROFILE_ID;
  f.profiles.set(JOINT_PROFILE_ID,{id:JOINT_PROFILE_ID,accountOwner:'gezamenlijk',identifier:joint.iban,status:'active'});
  f.config.registry='';f.config.bootstrap={enabled:true,accountProfileId:JOINT_PROFILE_ID,iban:joint.iban,providerLinked:true,holderConfirmed:true,providerMode:'restricted'};
  const service=()=>createJointBootstrapService(f.dependencies);
  const key=n=>metadataKey(JOINT_PROFILE_ID,n,f.config.accountProfileId);
  const start=()=>service().start('dion',JOINT_PROFILE_ID);
  const callback=()=>service().callback({state:f.states.get('gezamenlijk'),code:'code-gezamenlijk'});
  const connect=async()=>{await start();return callback();};
  const registry=()=>{f.config.registry={version:1,providerMode:'restricted',controlPanelUid:f.config.uid,accounts:f.entries};};
  const adopt=async()=>{registry();await adoptLegacyBankMetadata({config:f.config,store:f.store,now:clock,apply:true});};
  const promote=apply=>promoteJointBootstrap({...f.dependencies,now:()=>clock,apply});
  return {...f,service,key,start,callback,connect,registry,adopt,promote};
}

test('bootstrap defaults off and accepts only explicitly allowed joint owner context',()=>{
 const f=fixture();delete f.config.bootstrap;assert.equal(f.service().available,false);
 for(const mutate of [b=>b.accountProfileId='profile-dion',b=>b.accountProfileId='account-18a27a81',b=>b.iban='NL00INGB0000000001',b=>b.providerLinked=false,b=>b.holderConfirmed=false,b=>b.providerMode='contracted']){
  const f=fixture();mutate(f.config.bootstrap);assert.throws(()=>parseBootstrap(f.config));
 }
});
for(const scenario of ['user','role','household','profile','iban','disabled-user'])test('bootstrap rejects changed '+scenario+' before any provider request',async()=>{
 const f=fixture();let token='dion',profile=JOINT_PROFILE_ID;
 if(scenario==='user')token='dara';if(scenario==='role')f.assignments.get('dion@example.invalid').role='dara';
 if(scenario==='household')f.assignments.get('dion@example.invalid').householdId='other';
 if(scenario==='profile')profile='profile-dion';if(scenario==='iban')f.profiles.get(JOINT_PROFILE_ID).identifier=syntheticIban(77);
 if(scenario==='disabled-user')f.disabledUsers.add('uid-dion');
 await assert.rejects(f.service().start(token,profile));assert.equal(f.calls.length,0);
});
test('unknown hash is obtained only in an isolated inactive candidate; opening status does nothing',async()=>{
 const f=fixture(),before=clone([...f.records]);
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).connected,false);assert.deepEqual([...f.records],before);assert.equal(f.calls.length,0);
 await f.connect();const candidate=f.records.get(f.key('bootstrap-candidate'));
 assert.equal(candidate.accountHash,'hash-gezamenlijk');assert(candidate.candidate);assert.equal(candidate.bootstrapVerifiedAt,clock);
 assert.equal(f.records.has(f.key('connection')),false);assert.equal(f.records.has(f.key('account-binding')),false);
 assert.deepEqual(f.records.get('connection'),before.find(([k])=>k==='connection')[1]);
 assert.deepEqual(f.records.get('account-binding'),before.find(([k])=>k==='account-binding')[1]);
 const status=await f.service().status('dion',JOINT_PROFILE_ID);assert.equal(status.connected,false);assert.equal(status.candidateVerified,true);
 assert(!JSON.stringify(status).includes('session-gezamenlijk'));assert(!JSON.stringify(status).includes('hash-gezamenlijk'));
 assert(!f.calls.some(c=>/balances|transactions/.test(c.path)));
});
test('state purpose and IBAN are pinned; replay and expiry cannot exchange twice',async()=>{
 const f=fixture();await f.start();const pendingKey='state-'+digest(f.states.get('gezamenlijk'));
 assert.equal(f.records.get(pendingKey).purpose,'joint-bootstrap');
 await f.callback();await assert.rejects(f.callback(),{code:'invalid-state'});assert.equal(f.calls.filter(c=>c.path==='/sessions').length,1);
 for(const scenario of ['purpose','iban','expired']){
  const f=fixture();await f.start();const state=f.records.get('state-'+digest(f.states.get('gezamenlijk')));
  if(scenario==='purpose')state.purpose='bank-connection';if(scenario==='iban')state.ibanHash=digest(syntheticIban(3));if(scenario==='expired')state.expiresAt=clock-1;
  await assert.rejects(f.callback());assert(!f.calls.some(c=>c.path==='/sessions'));
 }
});
test('changed identity during SCA cannot install a candidate',async()=>{
 const f=fixture();await f.start();f.assignments.get('dion@example.invalid').role='dara';
 await assert.rejects(f.callback());assert(!f.calls.some(c=>c.path==='/sessions'));assert(!f.records.has(f.key('bootstrap-candidate')));
});
test('legacy Dion session is protected even without a global owner and even on a rejected callback',async()=>{
 for(const wrongAccount of [false,true]){
  const f=fixture(),before=clone(f.records.get('connection'));
  f.overrideExchange(e=>({session_id:'session-dion',access:{valid_until:new Date(clock+86400000).toISOString()},accounts:[{...f.account(e),...(wrongAccount?{account_id:{iban:syntheticIban(99)}}:{})}]}));
  await f.start();await assert.rejects(f.callback(),{code:'bootstrap-session-protected'});
  assert.deepEqual(f.records.get('connection'),before);assert(!f.records.has('session-owner-'+digest('session-dion')));assert(!f.calls.some(c=>c.method==='DELETE'));
 }
});
test('a copied legacy account hash with a new session is protected, never adopted or revoked',async()=>{
 const f=fixture();f.overrideExchange(e=>({session_id:'unknown-shared',access:{valid_until:new Date(clock+86400000).toISOString()},accounts:[{...f.account(e),identification_hash:'hash-dion'}]}));
 await f.start();await assert.rejects(f.callback(),{code:'bootstrap-session-protected'});assert(!f.calls.some(c=>c.method==='DELETE'));
});
test('foreign global session ownership is rejected without revocation',async()=>{
 const f=fixture();f.records.set('session-owner-'+digest('session-gezamenlijk'),{uid:'uid-dara',householdId:'synthetic-house',accountProfileId:'profile-dara',purpose:'joint-bootstrap'});
 await f.start();await assert.rejects(f.callback(),{code:'bootstrap-session-protected'});assert(!f.calls.some(c=>c.method==='DELETE'));
});
for(const scenario of ['wrong-iban','missing-hash','duplicate-account','invalid-session'])test('invalid provider result: '+scenario+' is not installed',async()=>{
 const f=fixture();f.overrideExchange(e=>{
  const account=f.account(e);
  if(scenario==='wrong-iban')account.account_id.iban=syntheticIban(99);
  if(scenario==='missing-hash')delete account.identification_hash;
  const accounts=scenario==='duplicate-account'?[account,clone(account)]:[account];
  return {session_id:'new-own',access:{valid_until:new Date(clock+86400000).toISOString()},accounts};
 });
 if(scenario==='invalid-session')f.sessions.set('new-own',{entry:f.entries[1],account:f.account(f.entries[1]),validUntil:'2020-01-01T00:00:00Z'});
 await f.start();await assert.rejects(f.callback());assert(!f.records.has(f.key('bootstrap-candidate')));assert(f.calls.some(c=>c.method==='DELETE'&&c.path==='/sessions/new-own'));
});
test('pending revocation is durable; explicit retry revokes only the own new session',async()=>{
 const f=fixture();f.overrideExchange(e=>({session_id:'bad-own',access:{valid_until:new Date(clock+86400000).toISOString()},accounts:[{...f.account(e),account_id:{iban:syntheticIban(99)}}]}));
 f.failRevoke(true);await f.start();await assert.rejects(f.callback());
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).revocationPending,true);
 const pending=f.records.get(f.key('bootstrap-retired-'+digest('bad-own')));assert(pending.revokePending);assert(pending.sessionId);
 f.failRevoke(false);await f.service().disconnect('dion',JOINT_PROFILE_ID);
 assert(f.calls.filter(c=>c.method==='DELETE').every(c=>c.path==='/sessions/bad-own'));
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).revocationPending,false);
});
test('parallel starts/callbacks yield only one own candidate and one code exchange',async()=>{
 const f=fixture();const starts=await Promise.allSettled([f.start(),f.start()]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
 const callbacks=await Promise.allSettled([f.callback(),f.callback()]);assert.equal(callbacks.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(f.calls.filter(c=>c.path==='/sessions').length,1);assert(f.records.get(f.key('bootstrap-candidate')));
});
test('promotion requires adoption, exact configured identity and fresh provider verification',async()=>{
 const f=fixture();await f.connect();f.registry();await assert.rejects(f.promote(false),{code:'bank-registry-migration-required'});await f.adopt();
 const c=f.records.get(f.key('bootstrap-candidate'));c.bootstrapVerifiedAt=clock-60001;
 await assert.rejects(f.promote(true),{code:'bootstrap-candidate-not-ready'});
 await f.service().verify('dion',JOINT_PROFILE_ID);const before=clone([...f.records]);assert.equal((await f.promote(false)).outcome,'plan');assert.deepEqual([...f.records],before);
 f.entries[1].accountHash='other';await assert.rejects(f.promote(true),{code:'bootstrap-candidate-not-ready'});
});
test('promotion is atomic, idempotent and preserves all Dion records; reused candidate cannot revoke promoted session',async()=>{
 const f=fixture();await f.connect();await f.adopt();const dion=clone(f.records.get('connection')),binding=clone(f.records.get('account-binding'));
 assert.equal((await f.promote(true)).metadataWrites,5);assert.equal((await f.promote(true)).outcome,'already-promoted');
 assert.deepEqual(f.records.get('connection'),dion);assert.deepEqual(f.records.get('account-binding'),binding);
 assert.equal(f.records.get(f.key('connection')).accountProfileId,JOINT_PROFILE_ID);assert.equal(f.records.get(f.key('bootstrap-candidate')),null);
 await f.service().disconnect('dion',JOINT_PROFILE_ID);assert(!f.calls.some(c=>c.method==='DELETE'));
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).activeConnectionExists,true);
});
test('existing permanent joint identity is never replaced by bootstrap',async()=>{
 const f=fixture();f.records.set(f.key('account-binding'),{...f.entries[1],ibanHash:digest(f.entries[1].iban)});
 await assert.rejects(f.start(),{code:'bootstrap-candidate-exists'});assert.equal(f.calls.length,0);
});
test('bootstrap retention uses original consent expiry, not TTL as revocation',()=>{
 const f=fixture(),session={retentionVersion:1,validUntil:new Date(clock+86400000).toISOString()};
 for(const key of ['bootstrap-candidate','bootstrap-retired-'+digest('x')])assert.equal(bankMetadataExpiry(f.key(key),session,clock),clock+8*86400000);
 assert.equal(bankMetadataExpiry(f.key('bootstrap-identity'),{},clock),null);
});

test('uncertain exchange cannot be silently retried or cleared through disconnect',async()=>{
 const f=fixture(),provider=f.dependencies.provider;
 f.dependencies.provider=async(method,path,...args)=>{if(method==='POST'&&path==='/sessions')throw new Error('Synthetic interrupted exchange');return provider(method,path,...args);};
 await f.start();await assert.rejects(f.callback());
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).bootstrapReviewRequired,true);
 await assert.rejects(f.start(),{code:'bootstrap-review-required'});
 await assert.rejects(f.service().disconnect('dion',JOINT_PROFILE_ID),{code:'bootstrap-review-required'});
 await assert.rejects(f.callback(),{code:'invalid-state'});
 assert.equal((await f.service().status('dion',JOINT_PROFILE_ID)).bootstrapReviewRequired,true);
});
test('a replay during code exchange cannot release the lock of the original callback',async()=>{
 const f=fixture(),provider=f.dependencies.provider;let entered,release;
 const gate=new Promise(resolve=>entered=resolve);
 f.dependencies.provider=async(method,path,...args)=>{if(method==='POST'&&path==='/sessions'){entered();await new Promise(resolve=>release=resolve);}return provider(method,path,...args);};
 await f.start();const first=f.callback();await gate;
 await assert.rejects(f.callback(),{code:'invalid-state'});
 assert(f.records.get(f.key('bootstrap-lock')).until>clock);
 await assert.rejects(f.start(),{code:'bootstrap-busy'});release();await first;
});
test('uncertain legacy binding stops bootstrap before any bank request',async()=>{
 const f=fixture();f.records.delete('account-binding');await assert.rejects(f.start(),{code:'legacy-bank-migration-uncertain'});assert.equal(f.calls.length,0);
});
test('a legacy renewal after adoption must be re-adopted before joint promotion',async()=>{
 const f=fixture();await f.connect();await f.adopt();f.records.get('connection').sessionId='later-legacy-session';
 const before=clone([...f.records]);await assert.rejects(f.promote(true),{code:'bank-registry-migration-required'});assert.deepEqual([...f.records],before);
});
