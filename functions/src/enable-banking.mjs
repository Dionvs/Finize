import { createHash, randomBytes, randomUUID, sign } from 'node:crypto';
import { bankAuthorizationUrl } from '../shared/bank-authorization-url.mjs';

export const failure = (code, status = 400) => Object.assign(new Error(code), { code, status });
const hash = value => createHash('sha256').update(value).digest('hex');
const iban = value => String(value || '').replace(/\s/g, '').toUpperCase();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export function providerJwt(applicationId, pem, now = Date.now()) {
  if (!applicationId || !pem) throw failure('backend-not-configured', 503);
  const iat = Math.floor(now / 1000);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: applicationId })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + 300 })).toString('base64url');
  return header + '.' + body + '.' + sign('RSA-SHA256', Buffer.from(header + '.' + body), pem).toString('base64url');
}

// Read-only startup validation; never opens a session or retrieves account data.
export async function checkProviderConfiguration({ config, provider }) {
  if (!config.applicationId || !config.redirectUrl || !config.aspspName) throw failure('backend-not-configured', 503);
  const application = await provider('GET', '/application');
  if (application.kid !== config.applicationId || application.environment !== 'PRODUCTION' || application.active !== true ||
      !application.redirect_urls?.includes(config.redirectUrl) || !application.countries?.includes('NL') ||
      application.services?.length !== 1 || application.services[0] !== 'AIS') throw failure('provider-application-mismatch', 503);
  const banks = await provider('GET', '/aspsps?country=NL');
  const bank = banks.aspsps?.find(row => row.name === config.aspspName && row.country === 'NL' && row.psu_types?.includes('personal'));
  if (!bank || !Number.isFinite(bank.maximum_consent_validity) || bank.maximum_consent_validity <= 0) throw failure('unsupported-ing-connector', 503);
  return { applicationVerified: true, production: true, accountInformationOnly: true, redirectVerified: true,
    connector: bank.name, country: 'NL', personal: true, maximumConsentSeconds: bank.maximum_consent_validity };
}

// Store operations must be atomic. Only this service may read its private collection.
export function createBankService({ config, store, verifyToken, readAssignment, readProfile, provider, verifyIdentity = async () => false, now = () => Date.now() }) {
  function settings() {
    if (!config.enabled || !config.applicationId || !config.uid || !config.householdId || !config.accountProfileId ||
        !/^NL\d{2}INGB\d{10}$/.test(iban(config.iban)) || !config.redirectUrl?.startsWith('https://') ||
        !config.email || !config.aspspName) throw failure('backend-not-configured', 503);
  }
  async function authorize(token, profileId) {
    settings();
    const user = await verifyToken(token);
    if (!user || user.uid !== config.uid || user.email_verified !== true) throw failure('forbidden-user', 403);
    const assignment = await readAssignment(user.email);
    if (assignment?.householdId !== config.householdId) throw failure('forbidden-household', 403);
    if (profileId !== config.accountProfileId) throw failure('forbidden-account', 403);
    const profile = await readProfile(config.householdId, config.accountProfileId);
    if (!profile || profile.status === 'archived' || iban(profile.identifier || profile.iban) !== iban(config.iban)) throw failure('account-profile-mismatch', 403);
    return user;
  }
  const accountMatches = account => typeof account.identification_hash === 'string' && account.identification_hash.length > 0 &&
    (!config.accountHash || (account.identification_hashes || [account.identification_hash]).includes(config.accountHash)) &&
    iban(account.account_id?.iban) === iban(config.iban) && !!account.uid;
  const scope = value => value?.uid === config.uid && value.householdId === config.householdId && value.accountProfileId === config.accountProfileId;
  function bindingIdentity(binding, legacy) {
    if (legacy && (!scope(legacy) || !legacy.accountHash)) throw failure('account-identity-changed', 403);
    if (binding && (!scope(binding) || !binding.accountHash || binding.ibanHash !== hash(iban(config.iban)))) throw failure('account-identity-changed', 403);
    if (!binding && legacy?.retentionVersion === 1) throw failure('account-binding-missing', 403);
    const accountHash = binding?.accountHash || legacy?.accountHash || config.accountHash;
    if ((accountHash && config.accountHash && accountHash !== config.accountHash) || (binding && legacy && binding.accountHash !== legacy.accountHash)) throw failure('account-identity-changed', 403);
    return accountHash || null;
  }
  const bindingRecord = accountHash => ({ version: 1, uid: config.uid, householdId: config.householdId,
    accountProfileId: config.accountProfileId, ibanHash: hash(iban(config.iban)), accountHash, establishedAt: now() });
  function generation(control) {
    if (!control) return 0;
    if (!scope(control) || !Number.isSafeInteger(control.generation) || control.generation < 0) throw failure('account-identity-changed', 403);
    return control.generation;
  }
  const retiredKey = sessionId => 'retired-' + hash(sessionId);
  const retirement = session => ({ sessionId: session.sessionId, validUntil: session.validUntil || null, revokePending: true });
  async function revokeRetired(key, session) {
    try {
      if (!Number.isFinite(Date.parse(session.validUntil)) || Date.parse(session.validUntil) > now()) {
        try { await provider('DELETE', '/sessions/' + encodeURIComponent(session.sessionId)); }
        catch (error) { if (error.code !== 'reauthorization-required') throw error; }
      }
      await store.update(key, old => old?.sessionId === session.sessionId ? null : old);
      return true;
    } catch { return false; }
  }
  async function retireRejected(session) {
    if (!session.sessionId) return;
    const key = retiredKey(session.sessionId);
    // Persist before the remote request; a crash must not lose the revoke retry.
    await store.set(key, retirement(session));
    await revokeRetired(key, session);
  }
  async function current() {
    const session = await store.transaction(async tx => {
      const existing = await tx.get('connection'), binding = await tx.get('account-binding'), control = await tx.get('connection-control');
      if (!existing || existing.disabled || !scope(existing) || !existing.accountHash ||
          !Number.isFinite(Date.parse(existing.validUntil)) || Date.parse(existing.validUntil) <= now() ||
          (existing.revocationVersion || 0) !== generation(control)) throw failure('reauthorization-required', 409);
      bindingIdentity(binding, existing);
      if (!binding) tx.set('account-binding', bindingRecord(existing.accountHash));
      if (existing.retentionVersion !== 1) tx.set('connection', { ...existing, retentionVersion: 1 });
      return existing;
    });
    const status = await provider('GET', '/sessions/' + encodeURIComponent(session.sessionId));
    if (status.status !== 'AUTHORIZED' || !Number.isFinite(Date.parse(status.access?.valid_until)) || Date.parse(status.access.valid_until) <= now() ||
        !status.accounts?.includes(session.accountUid)) throw failure('reauthorization-required', 409);
    const account = status.accounts_data?.find(row => row.uid === session.accountUid);
    if (!account || !(account.identification_hashes || [account.identification_hash]).includes(session.accountHash)) throw failure('account-identity-changed', 403);
    return session;
  }
  const publicStatus = session => ({
    connected: !!session, accountProfileId: config.accountProfileId,
    validUntil: session?.validUntil || null, backendReady: true
  });
  return {
    async start(token, profileId) {
      if (profileId !== config.accountProfileId) throw failure('forbidden-account', 403);
      const user = await authorize(token, profileId);
      const banks = await provider('GET', '/aspsps?country=NL');
      const bank = banks.aspsps?.find(row => row.name === config.aspspName && row.country === 'NL' && row.psu_types?.includes('personal'));
      if (!bank || !Number.isFinite(bank.maximum_consent_validity) || bank.maximum_consent_validity <= 0) throw failure('unsupported-ing-connector', 409);
      const state = randomBytes(32).toString('base64url');
      const revocationVersion = generation(await store.get('connection-control'));
      await store.set('state-' + hash(state), { uid: user.uid, householdId: config.householdId, accountProfileId: profileId, revocationVersion, requiredPsuHeaders: bank.required_psu_headers || [], expiresAt: now() + 600000, used: false });
      const result = await provider('POST', '/auth', {
        access: { valid_until: new Date(now() + Math.min(bank.maximum_consent_validity, 180 * 86400) * 1000).toISOString(), accounts: [{ iban: iban(config.iban) }], balances: true, transactions: true },
        aspsp: { name: bank.name, country: 'NL' }, psu_type: 'personal', language: 'nl',
        psu_id: hash(user.uid), state, redirect_url: config.redirectUrl
      });
      const url = bankAuthorizationUrl(result.url);
      if (!url) throw failure('invalid-authorization-url', 502);
      return { url };
    },
    async callback({ state, code, error }) {
      settings();
      if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw failure('invalid-state', 403);
      // Claim before exchange; retries never reuse a code after an uncertain response.
      const pending = await store.update('state-' + hash(state), value => {
        if (!value || value.used || value.expiresAt <= now() || value.uid !== config.uid ||
            value.householdId !== config.householdId || value.accountProfileId !== config.accountProfileId) throw failure('invalid-state', 403);
        return { ...value, used: true };
      });
      if (error || typeof code !== 'string' || !code || code.length > 4096) throw failure('authorization-cancelled', 409);
      await authorizeAfterCallback(pending);
      if ((pending.revocationVersion || 0) !== generation(await store.get('connection-control'))) throw failure('authorization-changed', 403);
      const result = await provider('POST', '/sessions', { code });
      const accounts = (result.accounts || []).filter(accountMatches);
      if (accounts.length !== 1 || !result.session_id || !Number.isFinite(Date.parse(result.access?.valid_until)) ||
          Date.parse(result.access.valid_until) <= now()) {
        await retireRejected({ sessionId: result.session_id, validUntil: result.access?.valid_until });
        throw failure('allowed-account-not-returned', 403);
      }
      let previous;
      try {
        previous = await store.transaction(async tx => {
          const old = await tx.get('connection'), binding = await tx.get('account-binding'), control = await tx.get('connection-control');
          const retired = await tx.get(retiredKey(result.session_id));
          if ((pending.revocationVersion || 0) !== generation(control)) throw failure('authorization-changed', 403);
          const accountHash = bindingIdentity(binding, old) || accounts[0].identification_hash;
          if (retired?.revokePending || !(accounts[0].identification_hashes || [accounts[0].identification_hash]).includes(accountHash)) throw failure('account-identity-changed', 403);
          if (!binding) tx.set('account-binding', bindingRecord(accountHash));
          if (old?.sessionId && old.sessionId !== result.session_id) tx.set(retiredKey(old.sessionId), retirement(old));
          tx.set('connection', { uid: pending.uid, householdId: pending.householdId, accountProfileId: pending.accountProfileId,
            sessionId: result.session_id, accountUid: accounts[0].uid, accountHash, revocationVersion: pending.revocationVersion || 0,
            retentionVersion: 1, requiredPsuHeaders: pending.requiredPsuHeaders || [], validUntil: result.access.valid_until });
          return old;
        });
      } catch (error) {
        await retireRejected({ sessionId: result.session_id, validUntil: result.access.valid_until });
        throw error;
      }
      if (previous?.sessionId && previous.sessionId !== result.session_id) await revokeRetired(retiredKey(previous.sessionId), previous);
      return { connected: true };
    },
    async status(token, profileId) {
      await authorize(token, profileId);
      let result;
      try { result = publicStatus(await current()); }
      catch (error) { if (['reauthorization-required', 'EXPIRED_SESSION', 'EXPIREDSESSION'].includes(error.code)) result = { ...publicStatus(null), reauthorize: true }; else throw error; }
      const active = await store.get('connection');
      result.revocationPending = !!(active?.disabled && active.sessionId) || (await store.listRetired(1)).length > 0;
      return result;
    },
    async sync(token, { accountProfileId, fromDate, toDate }, psuHeaders = {}) {
      await authorize(token, accountProfileId);
      if (!date(fromDate) || !date(toDate) || fromDate > toDate || toDate > new Date(now()).toISOString().slice(0, 10) ||
          Date.parse(toDate) - Date.parse(fromDate) > 90 * 86400000) throw failure('invalid-period');
      const lockId = randomUUID();
      await store.update('sync-lock', old => {
        if (old?.until > now()) throw failure('synchronization-busy', 409);
        return { id: lockId, until: now() + 180000, expiresAt: now() + 180000 };
      });
      try {
        const session = await current();
        const prefix = '/accounts/' + encodeURIComponent(session.accountUid);
        const required = session.requiredPsuHeaders || [];
        const headers = required.length && required.every(key => typeof psuHeaders[key] === 'string' && psuHeaders[key])
          ? Object.fromEntries(required.map(key => [key, psuHeaders[key]])) : {};
        // ASPSPs require either their complete online-header set, or no PSU headers.
        const transactions = [], seen = new Set();
        let continuation = null, complete = true, issue = null;
        try {
          do {
            const query = new URLSearchParams({ date_from: fromDate, date_to: toDate, transaction_status: 'BOOK', strategy: 'default' });
            if (continuation) query.set('continuation_key', continuation);
            const page = await provider('GET', prefix + '/transactions?' + query, undefined, headers);
            if (!Array.isArray(page.transactions)) throw failure('invalid-provider-page', 502);
            transactions.push(...page.transactions);
            continuation = page.continuation_key || null;
            if (continuation && (seen.has(continuation) || seen.size >= 99)) throw failure('pagination-incomplete', 502);
            if (continuation) seen.add(continuation);
          } while (continuation);
        } catch (error) {
          if (['EXPIRED_SESSION', 'EXPIREDSESSION', 'INVALID_SESSION', 'INVALIDSESSION'].includes(error.code)) throw failure('reauthorization-required', 409);
          complete = false; issue = 'transactions-incomplete';
        }
        const balances = await provider('GET', prefix + '/balances', undefined, headers);
        // Recheck membership and connection before exposing financial information.
        await authorize(token, accountProfileId);
        const active = await store.get('connection');
        if (active?.disabled || active?.sessionId !== session.sessionId) throw failure('connection-changed', 409);
        return { version: 1, runId: lockId, householdId: config.householdId, accountProfileId,
          account: { iban: iban(config.iban), identificationHash: session.accountHash }, fetchedAt: new Date(now()).toISOString(),
          fromDate, toDate, complete, issue, balances: balances.balances || [], transactions };
      } finally {
        await store.update('sync-lock', old => old?.id === lockId ? { ...old, until: 0 } : old);
      }
    },
    async disconnect(token, profileId) {
      await authorize(token, profileId);
      const old = await store.transaction(async tx => {
        const existing = await tx.get('connection'), binding = await tx.get('account-binding'), control = await tx.get('connection-control');
        const version = generation(control);
        if (version >= Number.MAX_SAFE_INTEGER) throw failure('storage-unavailable', 503);
        if (existing) {
          const accountHash = bindingIdentity(binding, existing);
          if (!binding) tx.set('account-binding', bindingRecord(accountHash));
        }
        tx.set('connection-control', { uid: config.uid, householdId: config.householdId, accountProfileId: config.accountProfileId, generation: version + 1 });
        tx.set('connection', existing ? { ...existing, retentionVersion: 1, disabled: true } : null);
        if (existing?.sessionId) tx.set(retiredKey(existing.sessionId), retirement(existing));
        return existing;
      });
      const pending = await store.listRetired(6);
      let failed = pending.length > 5;
      for (const { key, value } of pending.slice(0, 5)) if (!await revokeRetired(key, value)) failed = true;
      // Keep a failed active reference for retry; do not erase a concurrent new consent.
      await store.update('connection', value => value?.sessionId === old?.sessionId && value?.disabled && !failed ? null : value);
      if (failed || (await store.listRetired(1)).length) throw failure('revocation-pending', 503);
      const active = await store.get('connection');
      if (active && !active.disabled) throw failure('connection-changed', 409);
      return { connected: false };
    }
  };
  async function authorizeAfterCallback(pending) {
    const assignment = await readAssignment(config.email);
    const profile = await readProfile(config.householdId, config.accountProfileId);
    if (!await verifyIdentity(pending.uid) || pending.uid !== config.uid || assignment?.householdId !== config.householdId ||
        !profile || profile.status === 'archived' || iban(profile.identifier || profile.iban) !== iban(config.iban)) throw failure('authorization-changed', 403);
  }
}

export function createProviderClient({ applicationId, privateKey, fetchImpl = fetch, now = () => Date.now() }) {
  return async (method, path, body, headers = {}) => {
    if (!/^(?:\/application$|\/aspsps(?:\?|$)|\/auth$|\/sessions(?:\/[^/?]+)?$|\/accounts\/[^/?]+\/(?:balances|transactions)(?:\?|$))/.test(path) ||
        path === '/application' && method !== 'GET' ||
        !['GET', 'POST', 'DELETE'].includes(method)) throw failure('unsupported-provider-operation', 403);
    const allowed = Object.fromEntries(Object.entries(headers).filter(([key]) => ['Psu-Ip-Address','Psu-User-Agent','Psu-Referer','Psu-Accept','Psu-Accept-Charset','Psu-Accept-Encoding','Psu-Accept-Language','Psu-Accept-language'].includes(key)));
    const response = await fetchImpl('https://api.enablebanking.com' + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { ...allowed, Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + providerJwt(applicationId, privateKey(), now()) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      if (['EXPIRED_SESSION','EXPIREDSESSION','INVALID_SESSION','INVALIDSESSION','SESSION_EXPIRED','SESSION_NOT_FOUND'].includes(result.error)) throw failure('reauthorization-required',409);
      throw failure(/^[A-Z_]{1,80}$/.test(result.error || '') ? result.error : 'provider-unavailable', response.status === 429 ? 429 : 502);
    }
    return result;
  };
}
