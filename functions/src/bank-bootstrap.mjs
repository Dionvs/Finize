import { randomUUID } from 'node:crypto';
import { createSingleBankService, failure } from './enable-banking.mjs';
import { digest, metadataKey, normalizeIban, validIngIban, parseBankRegistry } from './bank-registry.mjs';

export const JOINT_PROFILE_ID = 'account-388ed1e4';
const DARA_PROFILE_ID = 'account-18a27a81';
const PURPOSE = 'joint-bootstrap';
const sameScope = (a,b) => a?.uid === b?.uid && a?.householdId === b?.householdId && a?.accountProfileId === b?.accountProfileId;
const ownerKey = id => 'session-owner-' + digest(id);
const fail = code => { throw failure(code,409); };

export function parseBootstrap(config) {
  if (!config.bootstrap) return null;
  let value;
  try { value = typeof config.bootstrap === 'string' ? JSON.parse(config.bootstrap) : structuredClone(config.bootstrap); }
  catch { throw failure('invalid-bank-bootstrap',503); }
  if (value.enabled === false) return null;
  if (value.enabled !== true || value.accountProfileId !== JOINT_PROFILE_ID || value.providerLinked !== true ||
      value.holderConfirmed !== true || value.providerMode !== 'restricted' || !validIngIban(value.iban) ||
      normalizeIban(value.iban) === normalizeIban(config.iban) || config.accountProfileId === JOINT_PROFILE_ID ||
      !config.uid || !config.email || !config.householdId) throw failure('invalid-bank-bootstrap',503);
  const registry = parseBankRegistry(config);
  if (registry && (registry.providerMode !== 'restricted' || registry.controlPanelUid !== config.uid)) throw failure('invalid-bank-bootstrap',503);
  return { ...config, enabled: config.enabled, accountProfileId: JOINT_PROFILE_ID, iban: normalizeIban(value.iban),
    accountHash:'', actorRole:'dion', accountOwner:'gezamenlijk', authorizationPurpose:PURPOSE };
}

function bootstrapStorage(dependencies, target) {
  const { store, config, provider, now = Date.now } = dependencies;
  const key = name => name.startsWith('state-') ? name : metadataKey(target.accountProfileId,
    'bootstrap-' + ({connection:'candidate','account-binding':'identity','connection-control':'control','sync-lock':'lock'}[name] || name),config.accountProfileId);
  const regular = (profile,name) => metadataKey(profile,name,config.accountProfileId);
  const profiles = [...new Set([config.accountProfileId,JOINT_PROFILE_ID,DARA_PROFILE_ID,
    ...(parseBankRegistry(config)?.accounts || []).map(x=>x.accountProfileId)])];
  async function guard(tx, sessionId, accountHashes = []) {
    for (const profile of profiles) {
      const active = await tx.get(regular(profile,'connection')), binding = await tx.get(regular(profile,'account-binding'));
      if(profile===config.accountProfileId && (!binding||!sameScope(binding,config)||!binding.accountHash||
          binding.ibanHash!==digest(normalizeIban(config.iban))||config.accountHash&&config.accountHash!==binding.accountHash||
          active&&(!sameScope(active,config)||active.accountHash!==binding.accountHash)))fail('legacy-bank-migration-uncertain');
      if (active?.sessionId === sessionId || binding?.accountHash && accountHashes.includes(binding.accountHash)) fail('bootstrap-session-protected');
    }
    if(!sessionId)return null;
    const owner = await tx.get(ownerKey(sessionId));
    if (owner && (!sameScope(owner,target) || owner.purpose !== PURPOSE)) fail('bootstrap-session-protected');
    return owner;
  }
  const scoped = {
    get:name=>store.get(key(name)),
    set:(name,value)=>store.set(key(name),name==='connection' && value ? {...value,bootstrapVerifiedAt:now(),candidate:true} : value),
    update:(name,fn)=>store.update(key(name),fn),
    listRetired:async(limit=6)=>(await store.listRetired(limit,key('retired-'))).map(row=>({...row,key:row.key.slice(key('retired-').length-'retired-'.length)})),
    transaction:action=>store.transaction(tx=>action({
      get:name=>tx.get(key(name)),
      set:(name,value)=>tx.set(key(name),name==='connection' && value ? {...value,bootstrapVerifiedAt:now(),candidate:true} : value),
      getSessionOwner:async(id,accountHash)=>guard(tx,id,accountHash?[accountHash]:[]),
      setSessionOwner:session=>tx.set(ownerKey(session.sessionId),{uid:target.uid,householdId:target.householdId,
        accountProfileId:target.accountProfileId,validUntil:session.validUntil,version:1,purpose:PURPOSE})
    })),
    async claimSession(session) {
      if (!session.sessionId) return;
      await store.transaction(async tx=>{
        const owner=await guard(tx,session.sessionId,session.accountHashes);
        if(!owner)tx.set(ownerKey(session.sessionId),{uid:target.uid,householdId:target.householdId,
          accountProfileId:target.accountProfileId,validUntil:session.validUntil||null,version:1,purpose:PURPOSE});
      });
    },
    async assertSession(session) {
      await store.transaction(async tx=>{const owner=await guard(tx,session.sessionId);if(!owner)fail('session-owner-missing');});
    },
    async verifyProviderSession(result, account) {
      const validUntil=await checkSession(provider,result.session_id,account.uid,account.identification_hash,result.access.valid_until,now());
      result.access.valid_until=validUntil;
    }
  };
  return { scoped,key,regular,guard };
}

async function checkSession(provider,id,accountUid,accountHash,storedUntil,now) {
  const result=await provider('GET','/sessions/'+encodeURIComponent(id));
  const account=result.accounts_data?.find(x=>x.uid===accountUid);
  if(result.status!=='AUTHORIZED'||!result.accounts?.includes(accountUid)||!account||
      !(account.identification_hashes||[account.identification_hash]).includes(accountHash)||
      !Number.isFinite(Date.parse(result.access?.valid_until))||Date.parse(result.access.valid_until)<=now) fail('bootstrap-provider-session-invalid');
  return new Date(Math.min(Date.parse(storedUntil),Date.parse(result.access.valid_until))).toISOString();
}

export function createJointBootstrapService(dependencies) {
  const {config,store,now=Date.now}=dependencies,target=parseBootstrap(config);
  if(!target)return { available:false, isTarget:()=>false, callback:async()=>{throw failure('bootstrap-disabled',403);} };
  const {scoped,key,regular,guard}=bootstrapStorage(dependencies,target);
  const makeService=receipt=>createSingleBankService({...dependencies,config:target,store:receipt?{
    ...scoped,update:async(name,updater)=>{const value=await scoped.update(name,updater);if(name.startsWith('state-')&&value?.used)receipt.consumed=true;return value;}
  }:scoped,provider:async(method,path,...args)=>{
    if(method==='POST'&&path==='/sessions'){
      receipt.started=true;
      await scoped.update('connection-control',value=>({...value,exchangePending:true}));
      const result=await dependencies.provider(method,path,...args);
      receipt.returned=!!result?.session_id;
      return result;
    }
    return dependencies.provider(method,path,...args);
  }});
  const service=makeService(null);
  const access=(token,profile)=>service.authorizeAccess(token,profile);
  return {
    available:true, isTarget:profile=>profile===JOINT_PROFILE_ID,
    async status(token,profile) {
      await access(token,profile);
      const candidate=await scoped.get('connection'), lock=await scoped.get('sync-lock'), control=await scoped.get('connection-control');
      const pending=(await scoped.listRetired(1)).length>0 || !!candidate?.disabled;
      const verified=!!candidate?.sessionId&&!candidate.disabled&&sameScope(candidate,target)&&Date.parse(candidate.validUntil)>now();
      return {connected:false,backendReady:true,accountProfileId:profile,bootstrapAvailable:true,
        candidateVerified:verified,bootstrapBusy:lock?.until>now(),revocationPending:pending,validUntil:verified?candidate.validUntil:null,
        activeConnectionExists:!!await store.get(regular(profile,'connection')),bootstrapReviewRequired:!!(control?.exchangePending||control?.reviewRequired)};
    },
    async start(token,profile) {
      await access(token,profile);
      if((await scoped.listRetired(1)).length)fail('revocation-pending');
      const generation=await store.transaction(async tx=>{
        const lock=await tx.get(key('sync-lock')),candidate=await tx.get(key('connection')),
          control=await tx.get(key('connection-control')),binding=await tx.get(regular(profile,'account-binding'));
        await guard(tx,null);
        if(binding||candidate?.sessionId)fail('bootstrap-candidate-exists');
        if(lock?.until>now())fail('bootstrap-busy');
        if(control?.exchangePending||control?.reviewRequired)fail('bootstrap-review-required');
        if(control&&(!sameScope(control,target)||!Number.isSafeInteger(control.generation)))fail('account-identity-changed');
        const generation=(control?.generation||0)+1;if(!Number.isSafeInteger(generation))fail('authorization-changed');
        tx.set(key('connection-control'),{uid:target.uid,householdId:target.householdId,accountProfileId:profile,generation});
        tx.set(key('sync-lock'),{until:now()+600000,expiresAt:now()+600000,generation,attemptId:randomUUID()});return generation;
      });
      try{return await service.start(token,profile);}
      catch(error){await store.update(key('sync-lock'),x=>x?.generation===generation?{...x,until:0}:x);throw error;}
    },
    async callback(input) {
      if(typeof input.state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.state))throw failure('invalid-state',403);
      const pending=await scoped.get('state-'+digest(input.state));
      if(!pending||pending.used||pending.expiresAt<=now()||pending.purpose!==PURPOSE||!sameScope(pending,target))throw failure('invalid-state',403);
      const exchange={started:false,returned:false,consumed:false};
      try{
        await makeService(exchange).callback(input);
        await scoped.update('connection-control',x=>x?.generation===pending.revocationVersion?{...x,exchangePending:false}:x);
        return {connected:false,candidateVerified:true};
      }catch(error){
        if(exchange.started)await scoped.update('connection-control',x=>x?.generation===pending.revocationVersion?
          {...x,exchangePending:!exchange.returned,reviewRequired:error.code==='bootstrap-session-protected'}:x);
        throw error;
      }finally{if(exchange.consumed)await scoped.update('sync-lock',x=>x?.generation===pending.revocationVersion?{...x,until:0}:x);}
    },
    async verify(token,profile) {
      await access(token,profile);
      const candidate=await scoped.get('connection');
      if(!candidate||candidate.disabled||!sameScope(candidate,target)||Date.parse(candidate.validUntil)<=now())fail('bootstrap-candidate-unavailable');
      await scoped.assertSession(candidate);
      const until=await checkSession(dependencies.provider,candidate.sessionId,candidate.accountUid,candidate.accountHash,candidate.validUntil,now());
      await store.transaction(async tx=>{
        const current=await tx.get(key('connection')),owner=await guard(tx,candidate.sessionId,[candidate.accountHash]);
        if(!current||current.disabled||current.sessionId!==candidate.sessionId||current.accountHash!==candidate.accountHash)fail('connection-changed');
        tx.set(key('connection'),{...current,validUntil:until,bootstrapVerifiedAt:now()});
        tx.set(ownerKey(candidate.sessionId),{...owner,validUntil:until});
      });
      return this.status(token,profile);
    },
    async disconnect(token,profile){
      await access(token,profile);
      const control=await scoped.get('connection-control');
      if(control?.exchangePending||control?.reviewRequired)fail('bootstrap-review-required');
      return service.disconnect(token,profile);
    }
  };
}

// Administrator process only; never exposed as a frontend HTTP route.
export async function promoteJointBootstrap({config,store,verifyIdentity,readAssignment,readProfile,now=Date.now,apply=false}) {
  const target=parseBootstrap(config),registry=parseBankRegistry(config);
  const entry=registry?.accounts.find(x=>x.accountProfileId===JOINT_PROFILE_ID);
  if(!target||!entry||!entry.enabled||!entry.providerLinked||entry.owner!=='gezamenlijk'||entry.actorRole!=='dion'||
      !sameScope(entry,target)||entry.email!==target.email.toLowerCase()||normalizeIban(entry.iban)!==target.iban)fail('bootstrap-promotion-not-configured');
  const assignment=await readAssignment(entry.email),profile=await readProfile(entry.householdId,entry.accountProfileId);
  if(!await verifyIdentity(entry.uid,entry.email)||assignment?.householdId!==entry.householdId||assignment?.role!=='dion'||
      !profile||profile.status==='archived'||profile.accountOwner!=='gezamenlijk'||normalizeIban(profile.identifier||profile.iban)!==target.iban)fail('authorization-changed');
  const key=n=>metadataKey(JOINT_PROFILE_ID,n,config.accountProfileId);
  return store.transaction(async tx=>{
    const marker=await tx.get('registry-control'),legacy=await tx.get('connection'),legacyBinding=await tx.get('account-binding'),
      candidate=await tx.get(key('bootstrap-candidate')),identity=await tx.get(key('bootstrap-identity')),
      active=await tx.get(key('connection')),binding=await tx.get(key('account-binding')),
      control=await tx.get(key('bootstrap-control')),activeControl=await tx.get(key('connection-control')),
      receipt=await tx.get(key('bootstrap-promotion'));
    const legacyOwner=legacy?.sessionId?await tx.get(ownerKey(legacy.sessionId)):null;
    if(!marker||marker.version!==1||!sameScope(marker.identity,config)||!sameScope(legacyBinding,config)||
        legacyBinding.ibanHash!==digest(normalizeIban(config.iban))||legacy&&(!sameScope(legacy,config)||legacy.accountHash!==legacyBinding.accountHash)||marker.identity.ibanHash!==digest(normalizeIban(config.iban))||
        marker.identity.accountHash!==legacyBinding?.accountHash||legacy?.sessionId&&(!sameScope(legacyOwner,config)||legacyOwner.validUntil!==legacy.validUntil))fail('bank-registry-migration-required');
    if(!candidate&&receipt&&active&&binding&&receipt.sessionDigest===digest(active.sessionId)&&
        sameScope(active,entry)&&active.accountHash===entry.accountHash&&binding.accountHash===entry.accountHash&&
        sameScope(binding,entry)&&binding.ibanHash===digest(target.iban)){
      const owner=await tx.get(ownerKey(active.sessionId));
      if(!sameScope(owner,entry)||owner.purpose||legacy?.sessionId===active.sessionId)fail('bootstrap-promotion-conflict');
      return {outcome:'already-promoted',metadataWrites:0,financialWrites:0};
    }
    if(!candidate||!sameScope(candidate,entry)||candidate.disabled||!candidate.candidate||candidate.accountHash!==entry.accountHash||
        !identity||!sameScope(identity,entry)||identity.accountHash!==entry.accountHash||identity.ibanHash!==digest(target.iban)||
        !Number.isFinite(Date.parse(candidate.validUntil))||Date.parse(candidate.validUntil)<=now()||
        !Number.isSafeInteger(candidate.bootstrapVerifiedAt)||candidate.bootstrapVerifiedAt>now()||now()-candidate.bootstrapVerifiedAt>60000||
        control?.exchangePending||control?.reviewRequired||(candidate.revocationVersion||0)!==(control?.generation||0))fail('bootstrap-candidate-not-ready');
    if(legacy?.sessionId===candidate.sessionId||legacyBinding?.accountHash===candidate.accountHash||active||binding||activeControl)fail('bootstrap-promotion-conflict');
    const owner=await tx.get(ownerKey(candidate.sessionId)),retired=await tx.get(key('bootstrap-retired-'+digest(candidate.sessionId))),
      other=await tx.get(metadataKey(DARA_PROFILE_ID,'connection',config.accountProfileId));
    if(!sameScope(owner,entry)||owner.purpose!==PURPOSE||retired?.revokePending||other?.sessionId===candidate.sessionId)fail('bootstrap-promotion-conflict');
    if(apply){
      const {candidate:_,bootstrapVerifiedAt:__,...session}=candidate;
      tx.set(key('connection'),{...session,revocationVersion:0});
      tx.set(key('account-binding'),{...identity,establishedAt:now()});
      tx.set(ownerKey(session.sessionId),{uid:entry.uid,householdId:entry.householdId,accountProfileId:entry.accountProfileId,validUntil:session.validUntil,version:1});
      tx.set(key('bootstrap-candidate'),null);
      tx.set(key('bootstrap-promotion'),{version:1,sessionDigest:digest(session.sessionId),promotedAt:now()});
    }
    return {outcome:apply?'promoted':'plan',metadataWrites:apply?5:0,financialWrites:0,accountProfileId:JOINT_PROFILE_ID};
  });
}
