import test from 'node:test';
import assert from 'node:assert/strict';
import { multiFixture, syntheticIban, memoryBankStore, clock } from './helpers/bank-multi-fixture.mjs';
import { parseBankRegistry, metadataKey, digest, validIngIban, adoptLegacyBankMetadata } from '../functions/src/bank-registry.mjs';
import { bankMetadataExpiry } from '../functions/src/bank-retention.mjs';
import { stageProviderSnapshot } from '../src/import/enable-banking-adapter.mjs';
import { ensureImportBankSources, selectBankTransactions } from '../src/core/bank-sources.mjs';
import { sumTransactionEffects } from '../src/core/transaction-engine.mjs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),u=require('../src/import/update4-runtime.cjs'),{state:initialState}=require('./helpers/package5-fixture.cjs');
const clone=value=>structuredClone(value);

test('explicit read-only plan and idempotent adoption preserve exact live session, permanent binding and legacy paths',async()=>{
  const f=multiFixture(),before=clone([...f.records]);
  assert.equal((await f.adopt(false)).outcome,'plan');assert.deepEqual([...f.records],before);
  const result=await f.adopt(true);assert.equal(result.metadataWrites,2);assert.equal(result.financialWrites,0);
  for(const [key,value] of before)assert.deepEqual(f.records.get(key),value);
  const adopted=clone([...f.records]);assert.equal((await f.adopt(true)).outcome,'already-adopted');assert.deepEqual([...f.records],adopted);
  const status=await f.service().status('dion','profile-dion');assert.equal(status.connected,true);
  assert.equal(f.calls.filter(x=>x.path==='/auth'||x.path==='/sessions').length,0);
  assert(!JSON.stringify(status).includes('session-dion'));assert(!JSON.stringify(status).includes('account-dion'));
});
test('registry cannot silently treat an unadopted live account as empty',async()=>{
  const f=multiFixture();await assert.rejects(f.service().status('dion','profile-dion'),{code:'bank-registry-migration-required'});
  await assert.rejects(f.service().start('dion','profile-gezamenlijk'),{code:'bank-registry-migration-required'});assert.equal(f.calls.length,0);
});
for(const scenario of ['missing-binding','wrong-binding','wrong-scope','expired','busy','generation'])test('uncertain legacy transition stops without writes: '+scenario,async()=>{
  const f=multiFixture();
  if(scenario==='missing-binding')f.records.delete('account-binding');
  if(scenario==='wrong-binding')f.records.get('account-binding').accountHash='other';
  if(scenario==='wrong-scope')f.records.get('connection').uid='other';
  if(scenario==='expired')f.records.get('connection').validUntil='2026-01-01T00:00:00Z';
  if(scenario==='busy')f.records.set('sync-lock',{until:clock+1000});
  if(scenario==='generation')f.records.set('connection-control',{...f.dion,generation:1});
  const before=clone([...f.records]);await assert.rejects(f.adopt(true));assert.deepEqual([...f.records],before);assert.equal(f.calls.length,0);
});
test('registry validates maximum three, owner/profile/IBAN/hash uniqueness, ING checksum, legacy match and operator policy',()=>{
  assert(validIngIban(syntheticIban(1)));assert(!validIngIban('NL00INGB0000000001'));
  for(const mutate of [r=>r.accounts.push({...r.accounts[0]}),r=>r.accounts[1].iban=r.accounts[0].iban,r=>r.accounts[1].accountHash=r.accounts[0].accountHash,
    r=>r.accounts[1].accountProfileId=r.accounts[0].accountProfileId,r=>r.accounts[1].owner='dion',r=>r.accounts[1].iban='NL00INGB0000000001',
    r=>r.accounts[0].uid='other',r=>r.accounts[2].actorRole='dion',r=>r.accounts[1].householdId='other',r=>r.accounts[1].providerLinked=false,
    r=>r.providerMode='contracted',r=>r.controlPanelUid='uid-dara',r=>r.accounts[2].uid='uid-dion',r=>r.accounts[1].accountHash='']){
    const f=multiFixture();mutate(f.config.registry);assert.throws(()=>parseBankRegistry(f.config));
  }
});
test('empty legacy configured hash still pins its existing permanent hash and rejects reuse by another account',async()=>{
  const f=multiFixture();f.config.accountHash='';f.entries[0].accountHash='';await f.adopt(true);
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
  f.entries[1].accountHash='hash-dion';await assert.rejects(f.service().status('dion','profile-gezamenlijk'),{code:'duplicate-bank-registry-identity'});
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
});
test('an expired Dion consent does not disable the independent joint connection',async()=>{
  const f=multiFixture();await f.adopt(true);await f.connect('gezamenlijk');f.sessions.get('session-dion').validUntil='2026-01-01T00:00:00Z';
  assert.equal((await f.service().status('dion','profile-dion')).connected,false);assert.equal((await f.service().status('dion','profile-gezamenlijk')).connected,true);
});
test('joint consent exposing multiple accounts persists only selected account, keeping Dion exact',async()=>{
  const f=multiFixture();await f.adopt(true);const dion=clone(f.records.get('connection')),binding=clone(f.records.get('account-binding'));
  await f.connect('gezamenlijk');const joint=f.records.get(metadataKey('profile-gezamenlijk','connection','profile-dion'));
  assert.equal(joint.accountProfileId,'profile-gezamenlijk');assert.equal(joint.sessionId,'session-gezamenlijk');
  assert.deepEqual(f.records.get('connection'),dion);assert.deepEqual(f.records.get('account-binding'),binding);
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
});
test('Dara is blocked in Restricted Production even with a linked hash and her own verified Firebase identity',async()=>{
  const f=multiFixture();await f.adopt(true);const status=await f.service().status('dara','profile-dara');
  assert.equal(status.activationBlocked,true);assert.equal(status.connected,false);
  await assert.rejects(f.connect('dara'),{code:'provider-access-blocked'});
  await assert.rejects(f.connect('dara','dion'),{code:'forbidden-user'});assert.equal(f.calls.length,0);
});
test('Dara requires her own current identity, matching role and approved contracted access before separate consent',async()=>{
  const f=multiFixture();f.config.registry.providerMode='contracted';f.config.registry.agreementRef='synthetic-provider-agreement';await f.adopt(true);
  await assert.rejects(f.connect('dara','dion'),{code:'forbidden-user'});
  f.disabledUsers.add('uid-dara');await assert.rejects(f.connect('dara'),{code:'forbidden-user'});f.disabledUsers.clear();
  f.assignments.get('dara@example.invalid').role='dion';await assert.rejects(f.connect('dara'),{code:'forbidden-user'});f.assignments.get('dara@example.invalid').role='dara';
  await f.connect('dara');assert.equal((await f.service().status('dara','profile-dara')).connected,true);
  assert.equal(f.records.get(metadataKey('profile-dara','connection','profile-dion')).uid,'uid-dara');
});
test('unknown account, stale household, disabled live identity, changed owner and wrong IBAN fail before provider data',async()=>{
  const f=multiFixture();await f.adopt(true);
  await assert.rejects(f.service().start('dion','arbitrary'),{code:'forbidden-account'});
  f.assignments.get('dion@example.invalid').householdId='other';await assert.rejects(f.sync('dion'),{code:'forbidden-household'});f.assignments.get('dion@example.invalid').householdId='synthetic-house';
  f.disabledUsers.add('uid-dion');await assert.rejects(f.sync('dion'),{code:'forbidden-user'});f.disabledUsers.clear();
  f.profiles.get('profile-gezamenlijk').accountOwner='dion';await assert.rejects(f.connect('gezamenlijk'),{code:'account-profile-mismatch'});f.profiles.get('profile-gezamenlijk').accountOwner='gezamenlijk';
  f.profiles.get('profile-gezamenlijk').identifier=syntheticIban(99);await assert.rejects(f.connect('gezamenlijk'),{code:'account-profile-mismatch'});
  assert.equal(f.calls.length,0);
});
test('wrong IBAN in callback rejects and retires only the newly returned session',async()=>{
  const f=multiFixture();await f.adopt(true);f.overrideExchange(e=>({session_id:'rejected-joint',access:{valid_until:new Date(clock+10000).toISOString()},accounts:[{...f.account(e),account_id:{iban:syntheticIban(99)}}]}));
  await assert.rejects(f.connect('gezamenlijk'),{code:'allowed-account-not-returned'});
  assert(f.calls.some(x=>x.method==='DELETE'&&x.path==='/sessions/rejected-joint'));assert(!f.calls.some(x=>x.method==='DELETE'&&x.path==='/sessions/session-dion'));
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
});
test('a callback cannot bind or revoke another connection session, including on rejected identity',async()=>{
  const f=multiFixture();await f.adopt(true);f.overrideExchange(e=>({session_id:'session-dion',access:{valid_until:new Date(clock+10000).toISOString()},accounts:[f.account(e)]}));
  await assert.rejects(f.connect('gezamenlijk'),{code:'session-account-conflict'});assert(!f.calls.some(x=>x.method==='DELETE'));
  assert.equal(f.records.get('connection').sessionId,'session-dion');
  assert.equal(f.records.has(metadataKey('profile-gezamenlijk','connection','profile-dion')),false);
});
test('failed same-account reauthorization never revokes the existing personal session',async()=>{
  const f=multiFixture();await f.adopt(true);const before=clone(f.records.get('connection'));
  f.overrideExchange(e=>({session_id:'session-dion',access:{valid_until:new Date(clock+86400000).toISOString()},accounts:[{...f.account(e),account_id:{iban:syntheticIban(99)}}]}));
  await assert.rejects(f.connect('dion'),{code:'allowed-account-not-returned'});
  assert.deepEqual(f.records.get('connection'),before);assert(!f.calls.some(x=>x.method==='DELETE'));
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
});
test('accepted renewal of the same session updates its ownership expiry atomically, not on status reads',async()=>{
  const f=multiFixture();await f.adopt(true);const key='session-owner-'+digest('session-dion'),before=clone(f.records.get(key));
  await f.service().status('dion','profile-dion');assert.deepEqual(f.records.get(key),before);
  f.advance(1000);await f.connect('dion');
  assert.equal(f.records.get(key).validUntil,f.records.get('connection').validUntil);assert.notEqual(f.records.get(key).validUntil,before.validUntil);
});
test('copied Dion session cannot be used for joint and copied joint session cannot be used for Dara',async()=>{
  const f=multiFixture();f.config.registry.providerMode='contracted';f.config.registry.agreementRef='synthetic-agreement';await f.adopt(true);await f.connect('gezamenlijk');await f.connect('dara');
  const jointKey=metadataKey('profile-gezamenlijk','connection','profile-dion'),daraKey=metadataKey('profile-dara','connection','profile-dion');
  const joint=clone(f.records.get(jointKey));f.records.set(jointKey,clone(f.records.get('connection')));
  await assert.rejects(f.sync('gezamenlijk'),{code:'account-identity-changed'});f.records.set(jointKey,joint);
  f.records.set(daraKey,clone(joint));await assert.rejects(f.sync('dara'),{code:'account-identity-changed'});
});
test('forged scope around a foreign session still fails permanent binding and global session owner checks',async()=>{
  const f=multiFixture();await f.adopt(true);await f.connect('gezamenlijk');const key=metadataKey('profile-gezamenlijk','connection','profile-dion');
  f.records.get(key).sessionId='session-dion';await assert.rejects(f.sync('gezamenlijk'),{code:'session-owner-missing'});
});
test('one account lock never blocks another; duplicate sync on same account is rejected',async()=>{
  const f=multiFixture();await f.adopt(true);await f.connect('gezamenlijk');let release,entered;
  const gate=new Promise(resolve=>entered=resolve);f.onTransactions(async path=>{if(path.includes('account-dion/')){entered();await new Promise(resolve=>release=resolve);}});
  const dion=f.sync('dion');await gate;
  await assert.rejects(f.sync('dion'),{code:'synchronization-busy'});
  const joint=await f.sync('gezamenlijk');assert.equal(joint.accountProfileId,'profile-gezamenlijk');release();await dion;
  assert(f.records.get(metadataKey('profile-gezamenlijk','sync-status','profile-dion')).lastSuccessfulSync.fetchedAt);
});
test('disconnect joint leaves Dion and Dara sessions, bindings, generations and pending states intact',async()=>{
  const f=multiFixture();f.config.registry.providerMode='contracted';f.config.registry.agreementRef='synthetic-agreement';await f.adopt(true);await f.connect('gezamenlijk');await f.connect('dara');
  const before=clone(f.records.get('connection')),dara=clone(f.records.get(metadataKey('profile-dara','connection','profile-dion')));
  await f.service().disconnect('dion','profile-gezamenlijk');assert.deepEqual(f.records.get('connection'),before);assert.deepEqual(f.records.get(metadataKey('profile-dara','connection','profile-dion')),dara);
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);assert.equal((await f.service().status('dara','profile-dara')).connected,true);
  assert(f.calls.filter(x=>x.method==='DELETE').every(x=>x.path==='/sessions/session-gezamenlijk'));
});
test('Dara expiry and failed joint revocation remain isolated',async()=>{
  const f=multiFixture();f.config.registry.providerMode='contracted';f.config.registry.agreementRef='synthetic-agreement';await f.adopt(true);await f.connect('gezamenlijk');await f.connect('dara');
  f.sessions.get('session-dara').validUntil='2026-01-01T00:00:00Z';assert.equal((await f.service().status('dara','profile-dara')).connected,false);
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);assert.equal((await f.service().status('dion','profile-gezamenlijk')).connected,true);
  f.failRevoke(true);await assert.rejects(f.service().disconnect('dion','profile-gezamenlijk'),{code:'revocation-pending'});
  assert.equal((await f.service().status('dion','profile-gezamenlijk')).revocationPending,true);
  assert.equal((await f.service().status('dion','profile-dion')).connected,true);
  f.failRevoke(false);await f.service().disconnect('dion','profile-gezamenlijk');
});
test('callback replay, changed role and revocation generation are checked independently',async()=>{
  const f=multiFixture();await f.adopt(true);await f.service().start('dion','profile-gezamenlijk');const state=f.states.get('gezamenlijk');
  await f.service().disconnect('dion','profile-gezamenlijk');await assert.rejects(f.service().callback({state,code:'code-gezamenlijk'}),{code:'authorization-changed'});
  await assert.rejects(f.service().callback({state,code:'code-gezamenlijk'}),{code:'invalid-state'});
  assert.equal(f.calls.filter(x=>x.path==='/sessions').length,0);assert.equal((await f.service().status('dion','profile-dion')).connected,true);
});
test('same provider reference on different accounts produces isolated identities and unchanged Dion repeats',async()=>{
  const f=multiFixture();await f.adopt(true);await f.connect('gezamenlijk');const state={accountProfiles:[...f.profiles.values()]},scope={householdId:'synthetic-house',accountProfiles:state.accountProfiles};
  const first=stageProviderSnapshot(await f.sync('dion'),state,null,[],()=>null);
  const joint=stageProviderSnapshot(await f.sync('gezamenlijk'),state,null,[first],()=>null);
  const repeat=stageProviderSnapshot(await f.sync('dion'),state,first,[first,joint],()=>null);
  assert.notEqual(first.id,joint.id);assert.notDeepEqual(first.rows.map(x=>x.id),joint.rows.map(x=>x.id));assert.equal(repeat.rows.length,first.rows.length);
  assert.deepEqual(repeat.rows.map(x=>x.bankOriginal),first.rows.map(x=>x.bankOriginal));
});
test('existing explicit Dion approval and proven CSV/API relation survive joint arrival and Dion repeat',async()=>{
  const f=multiFixture();await f.adopt(true);await f.connect('gezamenlijk');
  const state=initialState();state.accountProfiles=[...f.profiles.values()];
  const dion=stageProviderSnapshot(await f.sync('dion'),state,null,[],u.classifyOriginal);
  state.importSummaries.push(u.compactSummary(dion));ensureImportBankSources(state,dion);
  Object.assign(dion.rows[0].processing,{budgetOwner:'gezamenlijk',category:'Kleding',budgetItemId:'food',advanceMode:'none'});
  u.markExplicitlyApproved(dion.rows[0]);const plan=u.planImportEffects(dion,state);assert.equal(plan.ok,true,JSON.stringify(plan.errors));u.applyImportPlan(state,plan);
  // Already explicitly linked source, not a duplicate inferred from amount/date.
  const csv=clone(dion);csv.id='proven-synthetic-csv';csv.channel='csv';csv.rows[0].id='csv-row';csv.rows[0].source='csv';
  state.importSummaries.push(u.compactSummary(csv));ensureImportBankSources(state,csv);
  const before=clone(state.transactions),approval=clone(dion.rows[0]);
  const joint=stageProviderSnapshot(await f.sync('gezamenlijk'),state,null,[dion,csv],u.classifyOriginal);state.importSummaries.push(u.compactSummary(joint));ensureImportBankSources(state,joint);
  const repeat=stageProviderSnapshot(await f.sync('dion'),state,dion,[dion,csv,joint],u.classifyOriginal);ensureImportBankSources(state,repeat);
  assert.deepEqual(repeat.rows[0],approval);
  for(const row of before)assert.deepEqual(state.transactions.find(x=>x.id===row.id),row);
  assert.equal(selectBankTransactions(state).length,2);assert.equal(sumTransactionEffects(state,'realExpense',{month:'2026-10'}),10);
  assert.equal(state.transactions.find(x=>x.recordRole==='bank-source'&&x.accountProfileId==='profile-dion').importReferences.length,2);
});
test('TTL only expires account temporary metadata; permanent bindings, adoption and financial paths remain permanent',()=>{
  const key=name=>metadataKey('profile-gezamenlijk',name,'profile-dion');const session={retentionVersion:1,validUntil:new Date(clock+86400000).toISOString()};
  assert.equal(bankMetadataExpiry(key('connection'),session,clock),clock+8*86400000);
  for(const name of ['account-binding','connection-control','sync-status'])assert.equal(bankMetadataExpiry(key(name),session,clock),null);
  assert.equal(bankMetadataExpiry('registry-control',session,clock),null);assert.equal(bankMetadataExpiry('households/x/transactions',session,clock),null);
});
test('rollback legacy consent can be explicitly re-adopted without resets; a corrupt marker never passes',async()=>{
  const f=multiFixture();await f.adopt(true);f.records.get('connection').sessionId='legacy-renewed-session';
  assert.equal((await f.adopt(false)).metadataWrites,0);assert.equal((await f.adopt(true)).outcome,'adopted');
  f.records.get('registry-control').identity.accountProfileId='other';await assert.rejects(f.service().status('dion','profile-dion'),{code:'bank-registry-migration-required'});
});
