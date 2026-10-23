import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify, createHash } from 'node:crypto';
import { createBankService, providerJwt, createProviderClient } from '../functions/src/enable-banking.mjs';
import { bankMetadataExpiry, bankMetadataDocument } from '../functions/src/bank-retention.mjs';

const clock = Date.parse('2026-10-23T12:00:00Z');
function setup() {
  const records = new Map(), calls = [];
  let time = clock, exchangeHook = null, queue = Promise.resolve();
  const config = { enabled: true, applicationId: 'synthetic-app', uid: 'synthetic-user', email: 'synthetic@example.invalid', householdId: 'test-house',
    accountProfileId: 'ing', iban: 'NL20INGB0001234567', accountHash: 'test-account-hash', aspspName: 'ING',
    redirectUrl: 'https://backend.invalid/callback' };
  const store = { get: async key => structuredClone(records.get(key) ?? null), set: async (key, value) => records.set(key, structuredClone(value)),
    transaction: action => {
      const task = queue.then(async () => {
        const writes = new Map(); let writing = false;
        const result = await action({ get: async key => { assert(!writing, 'transaction reads precede writes'); return structuredClone(records.get(key) ?? null); },
          set: (key, value) => { writing = true; writes.set(key, structuredClone(value)); } });
        for (const [key, value] of writes) records.set(key, value);
        return result;
      }); queue = task.catch(() => {}); return task;
    },
    listRetired: async (limit = 6) => [...records.entries()].filter(([key, value]) => key.startsWith('retired-') && value?.revokePending)
      .sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([key, value]) => ({ key, value: structuredClone(value) })),
    update: async (key, fn) => { const value = fn(structuredClone(records.get(key) ?? null)); records.set(key, structuredClone(value)); return value; } };
  let stateValue, mode = '', page = 0;
  const provider = async (method, path, body, headers) => {
    calls.push({ method, path, body, headers });
    if (path.startsWith('/aspsps')) return { aspsps: [{ name: 'ING', country: 'NL', psu_types: ['personal'], maximum_consent_validity: 86400,
      required_psu_headers:['Psu-Ip-Address','Psu-Accept'] }] };
    if (path === '/auth') { stateValue = body.state; return { url: 'https://auth.enablebanking.com/ais/start?synthetic=1' }; }
    if (path === '/sessions') {
      const result = { session_id: mode.startsWith('renewed')?'renewed-session':'synthetic-session', access: { valid_until: new Date(time + 86400000).toISOString() },
        accounts: [{ uid: mode.startsWith('renewed')?'account-2':'account-1', identification_hash: mode === 'wrong-account' ? 'not-allowed' : 'test-account-hash', account_id: { iban: config.iban } }] };
      return exchangeHook ? exchangeHook(result, body) : result;
    }
    if (method === 'DELETE') {if(mode.includes('revoke-fails'))throw new Error('Temporary provider failure');return {};}
    if (path.startsWith('/sessions/')) return { status: mode === 'expired' ? 'EXPIRED' : 'AUTHORIZED', access: { valid_until: new Date(time + 86400000).toISOString() },
      accounts: [mode.startsWith('renewed')?'account-2':'account-1'], accounts_data: [{ uid: mode.startsWith('renewed')?'account-2':'account-1', identification_hash:'test-account-hash' }] };
    if (path.endsWith('/balances')) return { balances: [{ balance_type: 'ITBD', balance_amount: { amount: '10.00', currency: 'EUR' } }] };
    if (path.includes('/transactions?')) {
      page++;
      if(mode==='revoke-during-fetch')records.set('connection',{...records.get('connection'),disabled:true});
      if (mode === 'partial' && page > 1) throw new Error('temporary');
      const query = new URL('https://synthetic.invalid' + path).searchParams;
      return query.has('continuation_key') ? { transactions: [{ entry_reference: 'two' }], continuation_key: null } : { transactions: [], continuation_key: 'next' };
    }
    throw new Error('Unexpected test operation: ' + path);
  };
  const service = createBankService({ config, store, provider, now: () => time,
    verifyToken: async token => ({ uid: token === 'good' ? config.uid : 'other', email: config.email, email_verified: true }),
    verifyIdentity: async () => mode!=='disabled-user', readAssignment: async () => mode==='unlinked'?null:({ householdId: config.householdId }),
    readProfile: async () => ({ id: 'ing', identifier: config.iban, status: 'active' }) });
  const connect = async () => { await service.start('good', 'ing'); return service.callback({ state: stateValue, code: 'synthetic-code' }); };
  return { config, records, calls, service, connect, state: () => stateValue, mode: value => { mode = value; page = 0; },
    advance: value => { time += value; }, onExchange: hook => { exchangeHook = hook; } };
}
const period = { accountProfileId: 'ing', fromDate: '2026-10-16', toDate: '2026-10-23' };

test('server-side JWT is RS256, short-lived and verifiable with synthetic public key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = providerJwt('synthetic-app', privateKey, clock), [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { typ: 'JWT', alg: 'RS256', kid: 'synthetic-app' });
  const body = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(body.aud, 'api.enablebanking.com'); assert.equal(body.exp - body.iat, 300);
  assert(verify('RSA-SHA256', Buffer.from(header + '.' + payload), publicKey, Buffer.from(signature, 'base64url')));
});
test('wrong user, wrong profile and disabled configuration are rejected before provider calls', async () => {
  const f = setup();
  await assert.rejects(f.service.sync('wrong', period), { code: 'forbidden-user' });
  await assert.rejects(f.service.sync('good', { ...period, accountProfileId: 'other' }), { code: 'forbidden-account' });
  f.config.enabled = false; await assert.rejects(f.service.status('good', 'ing'), { code: 'backend-not-configured' });
  assert.equal(f.calls.length, 0);
});
test('callback uses unpredictable state once; replay never exchanges code twice', async () => {
  const f = setup(); await f.connect();
  await assert.rejects(f.service.callback({ state: f.state(), code: 'replay' }), { code: 'invalid-state' });
  assert.equal(f.calls.filter(row => row.path === '/sessions').length, 1);
  assert(!JSON.stringify(await f.service.status('good', 'ing')).includes('synthetic-session'));
});
test('expired or foreign state is rejected and foreign account session is closed', async () => {
  const f = setup(); await f.service.start('good', 'ing');
  await assert.rejects(f.service.callback({ state: 'A'.repeat(43), code: 'other' }), { code: 'invalid-state' });
  for (const [key, value] of f.records) if (key.startsWith('state-')) f.records.set(key, { ...value, expiresAt: 0 });
  await assert.rejects(f.service.callback({ state: f.state(), code: 'old' }), { code: 'invalid-state' });
  f.mode('wrong-account'); await assert.rejects(f.connect(), { code: 'allowed-account-not-returned' });
  assert(f.calls.some(row => row.method === 'DELETE'));
});
test('pagination continues after an empty page, preserves date parameters, returns no session secret', async () => {
  const f = setup(); await f.connect();
  const result = await f.service.sync('good', period);
  assert.equal(result.complete, true); assert.equal(result.transactions.length, 1);
  const pages = f.calls.filter(row => row.path.includes('/transactions?'));
  assert.equal(pages.length, 2);
  for (const row of pages) {
    const query = new URL('https://test.invalid' + row.path).searchParams;
    assert.equal(query.get('date_from'), period.fromDate); assert.equal(query.get('transaction_status'), 'BOOK');
  }
  assert(!JSON.stringify(result).includes('synthetic-session')); assert(!JSON.stringify(result).includes('account-1'));
});
test('partial page failure remains explicitly incomplete, expiry requests reauthorization', async () => {
  const f = setup(); await f.connect(); f.mode('partial');
  assert.equal((await f.service.sync('good', period)).complete, false);
  f.mode('expired'); await assert.rejects(f.service.sync('good', period), { code: 'reauthorization-required' });
  assert.equal((await f.service.status('good', 'ing')).reauthorize, true);
});
test('synchronization lease prevents overlap and disconnect preserves only public status', async () => {
  const f = setup(); await f.connect(); f.records.set('sync-lock', { id: 'other-run', until: clock + 60000 });
  await assert.rejects(f.service.sync('good', period), { code: 'synchronization-busy' });
  await f.service.disconnect('good', 'ing'); assert.equal(f.records.get('connection'), null);
});
test('provider transport has fixed host, blocks payment routes and ignores client auth headers', async () => {
  let calls = 0;
  const provider = createProviderClient({ applicationId: 'test', privateKey: () => 'unused', fetchImpl: async () => { calls++; } });
  await assert.rejects(provider('POST', '/payments', {}), { code: 'unsupported-provider-operation' });
  assert.equal(calls, 0);
});
test('membership or disabled identity changed during authorization blocks callback exchange',async()=>{
  for(const mode of ['unlinked','disabled-user']){
    const f=setup();await f.service.start('good','ing');f.mode(mode);
    await assert.rejects(f.service.callback({state:f.state(),code:'synthetic'}),{code:'authorization-changed'});
    assert(!f.calls.some(row=>row.path==='/sessions'));
  }
});
test('reauthorization retains stable account identity while session-specific IDs change',async()=>{
  const f=setup();await f.connect();f.mode('renewed');await f.connect();
  assert.equal(f.records.get('connection').accountUid,'account-2');
  assert(f.calls.some(row=>row.method==='DELETE'&&row.path==='/sessions/synthetic-session'));
  const result=await f.service.sync('good',period);assert.equal(result.account.identificationHash,'test-account-hash');
});
test('first stable hash can be bound only after configured IBAN and authenticated callback match',async()=>{
  const f=setup();f.config.accountHash='';await f.connect();
  assert.equal(f.records.get('connection').accountHash,'test-account-hash');
  assert.equal((await f.service.sync('good',period)).account.identificationHash,'test-account-hash');
});
test('failed provider revocation still disables local access and retains private retry metadata',async()=>{
  const f=setup();await f.connect();f.mode('revoke-fails');
  await assert.rejects(f.service.disconnect('good','ing'));
  assert.equal(f.records.get('connection').disabled,true);
  await assert.rejects(f.service.sync('good',period),{code:'reauthorization-required'});
  f.mode('');await f.service.disconnect('good','ing');assert.equal(f.records.get('connection'),null);
});
test('revocation during fetch prevents delivery; incomplete PSU headers are never forwarded',async()=>{
  const f=setup();await f.connect();
  await f.service.sync('good',period,{'Psu-Ip-Address':'127.0.0.1'});
  assert.deepEqual(f.calls.find(row=>row.path.endsWith('/balances')).headers,{});
  f.mode('revoke-during-fetch');await assert.rejects(f.service.sync('good',period),{code:'connection-changed'});
});

test('retention deadlines use original validity and never target permanent identity or financial paths', () => {
  const day = 86400000, stateKey = 'state-' + 'a'.repeat(64), retiredKey = 'retired-' + 'b'.repeat(64);
  assert.equal(bankMetadataExpiry(stateKey, { expiresAt: clock + 600000, used: false }, clock), clock + 600000 + day);
  assert.equal(bankMetadataExpiry(stateKey, { expiresAt: clock + 600000, used: true }, clock + day), clock + 600000 + day);
  assert.equal(bankMetadataExpiry('sync-lock', { until: 0, expiresAt: clock + 180000 }, clock), clock + 180000 + day);
  const session = { retentionVersion: 1, validUntil: '2026-10-24T12:00:00Z' };
  assert.equal(bankMetadataExpiry('connection', session, clock), clock + 8 * day);
  assert.equal(bankMetadataExpiry(retiredKey, session, clock + 3 * day), clock + 8 * day);
  for (const key of ['account-binding', 'connection-control', 'transactions', 'households/x/budgetState/current']) assert.equal(bankMetadataExpiry(key, session, clock), null);
  assert.equal(bankMetadataExpiry('connection', { validUntil: session.validUntil }, clock), null);
  assert.equal(bankMetadataExpiry(retiredKey, { sessionId: 'old', validUntil: null }, clock), null);
  assert.equal(bankMetadataExpiry(retiredKey, null, clock), clock + day);
  const wrapped = bankMetadataDocument('connection', session, { now: clock, timestamp: milliseconds => ({ firestoreTimestamp: milliseconds }) });
  assert.deepEqual(wrapped.finizeBankExpiresAt, { firestoreTimestamp: clock + 8 * day });
});

test('fixed binding survives session TTL cleanup and rejects a changed hash even with empty configured hash', async () => {
  const f = setup(); f.config.accountHash = ''; await f.connect();
  const binding = structuredClone(f.records.get('account-binding'));
  assert.equal(binding.accountHash, 'test-account-hash');
  f.advance(8 * 86400000); f.records.delete('connection');
  f.mode('wrong-account'); await assert.rejects(f.connect(), { code: 'account-identity-changed' });
  assert.deepEqual(f.records.get('account-binding'), binding);
  assert.equal(f.records.has('connection'), false);
  assert(f.calls.some(c => c.method === 'DELETE'));
  f.mode('renewed'); await f.connect();
  assert.equal(f.records.get('connection').accountHash, binding.accountHash);
});

test('legacy session gains a durable binding atomically before becoming eligible for TTL', async () => {
  const f = setup(); await f.connect();
  f.records.delete('account-binding');
  const legacy = { ...f.records.get('connection') }; delete legacy.retentionVersion;
  f.records.set('connection', legacy);
  assert.equal(bankMetadataExpiry('connection', legacy, clock), null);
  await f.service.status('good', 'ing');
  assert.equal(f.records.get('account-binding').accountHash, legacy.accountHash);
  assert.equal(f.records.get('connection').retentionVersion, 1);
  assert.notEqual(bankMetadataExpiry('connection', f.records.get('connection'), clock), null);
});

test('missing fixed binding on an already migrated session fails closed', async () => {
  const f = setup(); await f.connect(); f.records.delete('account-binding');
  await assert.rejects(f.service.status('good', 'ing'), { code: 'account-binding-missing' });
  assert.equal(f.records.has('account-binding'), false);
});

test('status reads do not renew session validity, state expiry or permanent binding', async () => {
  const f = setup(); await f.connect(); const before = structuredClone([...f.records]);
  await f.service.status('good', 'ing'); f.advance(1000); await f.service.status('good', 'ing');
  assert.deepEqual([...f.records], before);
  f.advance(86400000);
  const count = f.calls.filter(c => c.path.startsWith('/sessions/')).length;
  assert.equal((await f.service.status('good', 'ing')).connected, false);
  assert.equal(f.calls.filter(c => c.path.startsWith('/sessions/')).length, count);
});

test('old revocation failures preserve original deadline and retry on explicit disconnect', async () => {
  const f = setup(); await f.connect(); const until = f.records.get('connection').validUntil;
  f.mode('renewed-revoke-fails'); await f.connect();
  const [key, old] = [...f.records].find(([k, v]) => k.startsWith('retired-') && v?.revokePending);
  assert.equal(old.validUntil, until);
  assert.equal((await f.service.status('good', 'ing')).revocationPending, true);
  const deadline = bankMetadataExpiry(key, old, clock);
  await assert.rejects(f.service.disconnect('good', 'ing'), { code: 'revocation-pending' });
  assert.equal(f.records.get('connection').disabled, true);
  assert.equal(bankMetadataExpiry(key, f.records.get(key), clock + 1000), deadline);
  f.mode(''); await f.service.disconnect('good', 'ing');
  assert.equal(f.records.get('connection'), null);
  assert(![...f.records].some(([k, v]) => k.startsWith('retired-') && v?.revokePending));
  assert(f.records.get('account-binding'));
});

test('disconnect during code exchange prevents the pending callback from restoring access', async () => {
  const f = setup(); await f.service.start('good', 'ing'); const state = f.state();
  f.onExchange(async result => { await f.service.disconnect('good', 'ing'); return result; });
  await assert.rejects(f.service.callback({ state, code: 'synthetic' }), { code: 'authorization-changed' });
  assert.equal(f.records.get('connection'), null);
  assert.equal(f.records.get('connection-control').generation, 1);
  assert(f.calls.some(c => c.method === 'DELETE' && c.path === '/sessions/synthetic-session'));
});

test('concurrent first callbacks cannot bind two provider identities', async () => {
  const f = setup(); f.config.accountHash = '';
  await f.service.start('good', 'ing'); const a = f.state();
  await f.service.start('good', 'ing'); const b = f.state();
  f.onExchange(async (result, body) => ({ ...result, session_id: 'session-' + body.code,
    accounts: [{ ...result.accounts[0], identification_hash: 'identity-' + body.code }] }));
  const outcomes = await Promise.allSettled([f.service.callback({ state: a, code: 'a' }), f.service.callback({ state: b, code: 'b' })]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(x => x.status === 'rejected' && x.reason.code === 'account-identity-changed').length, 1);
  assert.equal(f.records.get('connection').accountHash, f.records.get('account-binding').accountHash);
});

test('expired states are invalid both before and after physical TTL cleanup', async () => {
  const f = setup(); await f.service.start('good', 'ing'); const state = f.state();
  f.advance(600001);
  await assert.rejects(f.service.callback({ state, code: 'expired' }), { code: 'invalid-state' });
  for (const key of f.records.keys()) if (key.startsWith('state-')) f.records.delete(key);
  await assert.rejects(f.service.callback({ state, code: 'expired' }), { code: 'invalid-state' });
  assert(!f.calls.some(c => c.path === '/sessions'));
});

test('explicit revocation works in bounded batches and leaves further work visible', async () => {
  const f = setup();
  for (let i = 0; i < 7; i++) {
    const sessionId = 'synthetic-old-' + i;
    f.records.set('retired-' + createHash('sha256').update(sessionId).digest('hex'), { sessionId, revokePending: true, validUntil: '2026-10-24T12:00:00Z' });
  }
  await assert.rejects(f.service.disconnect('good', 'ing'), { code: 'revocation-pending' });
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 5);
  assert.equal((await f.service.status('good', 'ing')).revocationPending, true);
  await f.service.disconnect('good', 'ing');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 7);
  assert.equal((await f.service.status('good', 'ing')).revocationPending, false);
});

test('expired retired session is cleared without a redundant provider revoke', async () => {
  const f = setup(), sessionId = 'expired';
  f.records.set('retired-' + createHash('sha256').update(sessionId).digest('hex'), { sessionId, revokePending: true, validUntil: '2026-10-22T12:00:00Z' });
  await f.service.disconnect('good', 'ing');
  assert(!f.calls.some(c => c.method === 'DELETE'));
  assert.equal((await f.service.status('good', 'ing')).revocationPending, false);
});
