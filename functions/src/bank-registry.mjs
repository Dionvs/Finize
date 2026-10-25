import { createHash } from 'node:crypto';

const fail = code => { throw Object.assign(new Error(code), { code, status: 503 }); };
export const digest = value => createHash('sha256').update(value).digest('hex');
const recordDigest = value => digest(JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
export const normalizeIban = value => String(value || '').replace(/\s/g, '').toUpperCase();
export function validIngIban(value) {
  const normalized = normalizeIban(value);
  if (!/^NL\d{2}INGB\d{10}$/.test(normalized)) return false;
  let remainder = 0;
  for (const char of normalized.slice(4) + normalized.slice(0, 4)) {
    for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

// Operator-owned configuration only. None of these identities come from a request.
export function parseBankRegistry(config) {
  if (!config.registry) return null; // Existing single-account deployment remains compatible.
  let registry;
  try { registry = typeof config.registry === 'string' ? JSON.parse(config.registry) : structuredClone(config.registry); }
  catch { fail('invalid-bank-registry'); }
  if (registry.version !== 1 || !['restricted', 'contracted'].includes(registry.providerMode) ||
      !Array.isArray(registry.accounts) || registry.accounts.length < 1 || registry.accounts.length > 3 ||
      registry.controlPanelUid !== config.uid || registry.providerMode === 'contracted' && (typeof registry.agreementRef !== 'string' || !registry.agreementRef.trim())) fail('invalid-bank-registry');
  const seen = { profile: new Set(), owner: new Set(), iban: new Set(), hash: new Set() };
  const subjects = new Map(), emails = new Map();
  for (const entry of registry.accounts) {
    if (!['gezamenlijk', 'dion', 'dara'].includes(entry.owner) || !['dion', 'dara'].includes(entry.actorRole) ||
        entry.owner !== 'gezamenlijk' && entry.actorRole !== entry.owner ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(entry.accountProfileId || '') || typeof entry.uid !== 'string' || !entry.uid || entry.uid.length > 128 ||
        typeof entry.email !== 'string' || !/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(entry.email) ||
        entry.householdId !== config.householdId || !/^[A-Za-z0-9_-]{1,128}$/.test(entry.householdId) || !validIngIban(entry.iban) ||
        typeof entry.enabled !== 'boolean' || typeof entry.providerLinked !== 'boolean' ||
        entry.accountHash !== undefined && typeof entry.accountHash !== 'string') fail('invalid-bank-registry');
    entry.iban = normalizeIban(entry.iban); entry.email = entry.email.toLowerCase();
    const subject = subjects.get(entry.uid);
    if (entry.owner === 'dara' && entry.uid === config.uid ||
        subject && (subject.email !== entry.email || subject.actorRole !== entry.actorRole) ||
        emails.has(entry.email) && emails.get(entry.email) !== entry.uid) fail('invalid-bank-registry-subject');
    subjects.set(entry.uid, entry); emails.set(entry.email, entry.uid);
    if (entry.enabled && entry.accountProfileId !== config.accountProfileId && !entry.accountHash?.trim()) fail('bank-account-hash-required');
    for (const [kind, value] of [['profile', entry.accountProfileId], ['owner', entry.owner], ['iban', entry.iban], ['hash', entry.accountHash]]) {
      if (!value) continue;
      if (seen[kind].has(value)) fail('duplicate-bank-registry-identity');
      seen[kind].add(value);
    }
    if (entry.enabled && !entry.providerLinked) fail('provider-link-not-confirmed');
  }
  const legacy = registry.accounts.find(entry => entry.accountProfileId === config.accountProfileId);
  if (!legacy || legacy.owner !== 'dion' || legacy.actorRole !== 'dion' || legacy.uid !== config.uid ||
      legacy.email !== config.email?.toLowerCase() || legacy.iban !== normalizeIban(config.iban) ||
      (legacy.accountHash || '') !== (config.accountHash || '') || !legacy.enabled || !legacy.providerLinked) fail('legacy-bank-registry-mismatch');
  return registry;
}

export const metadataKey = (profileId, key, legacyProfileId) => profileId === legacyProfileId || key.startsWith('state-') ? key : 'account-' + digest(profileId) + '-' + key;
const sameScope = (a, b) => a?.uid === b?.uid && a?.householdId === b?.householdId && a?.accountProfileId === b?.accountProfileId;
const sameIdentity = (a, b) => sameScope(a, b) && a?.ibanHash === b?.ibanHash && a?.accountHash === b?.accountHash;
const scopeOf = entry => ({ uid: entry.uid, householdId: entry.householdId, accountProfileId: entry.accountProfileId });
const ownerKey = sessionId => 'session-owner-' + digest(sessionId);

export function createAccountMetadataStore(store, entry, legacyProfileId) {
  const key = value => metadataKey(entry.accountProfileId, value, legacyProfileId);
  const scoped = {
    get: name => store.get(key(name)), set: (name, value) => store.set(key(name), value),
    update: (name, updater) => store.update(key(name), updater),
    transaction: action => store.transaction(tx => action({
      get: name => tx.get(key(name)), set: (name, value) => tx.set(key(name), value),
      getSessionOwner: sessionId => tx.get(ownerKey(sessionId)),
      setSessionOwner: session => tx.set(ownerKey(session.sessionId), { ...scopeOf(entry), validUntil: session.validUntil, version: 1 })
    })),
    listRetired: async limit => (await store.listRetired(limit, key('retired-'))).map(row => ({ ...row, key: row.key.slice(key('retired-').length - 'retired-'.length) })),
    async claimSession(session) {
      if (!session.sessionId) return;
      await store.transaction(async tx => {
        const name = ownerKey(session.sessionId), owner = await tx.get(name);
        if (owner && !sameScope(owner, entry)) throw Object.assign(new Error('session-account-conflict'), { code: 'session-account-conflict', status: 403 });
        if (!owner) tx.set(name, { ...scopeOf(entry), validUntil: session.validUntil || null, version: 1 });
      });
    },
    async assertSession(session) {
      if (!sameScope(await store.get(ownerKey(session.sessionId)), entry)) fail('session-owner-missing');
    }
  };
  return scoped;
}

function validateLegacy(config, session, binding, control, lock, now) {
  if (!session || !binding || !sameScope(session, config) || !sameScope(binding, config) ||
      !session.sessionId || !session.accountUid || !session.accountHash || binding.accountHash !== session.accountHash ||
      binding.ibanHash !== digest(normalizeIban(config.iban)) || session.retentionVersion !== 1 ||
      session.disabled || !Number.isFinite(Date.parse(session.validUntil)) || Date.parse(session.validUntil) <= now ||
      config.accountHash && config.accountHash !== binding.accountHash ||
      control && (!sameScope(control, config) || !Number.isSafeInteger(control.generation) || control.generation < 0) ||
      (session.revocationVersion || 0) !== (control?.generation || 0)) fail('legacy-bank-migration-uncertain');
  if (lock?.until > now) fail('legacy-bank-migration-busy');
}

// Explicit adoption in place: no copying/deleting sessions, no provider requests.
// The old backend can still read the exact same Dion session and permanent binding.
export async function adoptLegacyBankMetadata({ config, store, apply = false, now = Date.now() }) {
  const registry = parseBankRegistry(config);
  if (!registry) fail('bank-registry-required');
  return store.transaction(async tx => {
    const session = await tx.get('connection'), binding = await tx.get('account-binding');
    const control = await tx.get('connection-control'), lock = await tx.get('sync-lock');
    const existing = await tx.get('registry-control');
    validateLegacy(config, session, binding, control, lock, now);
    const sessionOwner = await tx.get(ownerKey(session.sessionId));
    const identity = { ...scopeOf(config), ibanHash: binding.ibanHash, accountHash: binding.accountHash };
    if (existing && (existing.version !== 1 || !sameIdentity(existing.identity, identity)) ||
        sessionOwner && !sameScope(sessionOwner, config)) fail('legacy-bank-migration-conflict');
    const needsAdoption = !existing || !sessionOwner || sessionOwner.validUntil !== session.validUntil;
    if (apply && needsAdoption) {
      tx.set(ownerKey(session.sessionId), { ...scopeOf(config), validUntil: session.validUntil, version: 1 });
      tx.set('registry-control', { ...(existing || {}), version: 1, identity, adoptedAt: existing?.adoptedAt || now,
        lastAdoptedAt: now, legacySessionDigest: existing?.legacySessionDigest || recordDigest(session),
        lastSessionDigest: recordDigest(session), legacyStorage: 'in-place' });
    }
    return { version: 1, outcome: needsAdoption ? apply ? 'adopted' : 'plan' : 'already-adopted', accountProfileId: config.accountProfileId,
      sessionPreserved: true, bindingPreserved: true, validUntil: session.validUntil, financialWrites: 0, metadataWrites: apply && needsAdoption ? 2 : 0 };
  });
}

export async function assertRegistryAdopted(store, config) {
  const marker = await store.get('registry-control'), binding = await store.get('account-binding');
  const expected = { ...scopeOf(config), ibanHash: digest(normalizeIban(config.iban)), accountHash: binding?.accountHash };
  if (!marker || marker.version !== 1 || !sameIdentity(marker.identity, expected)) fail('bank-registry-migration-required');
  return marker.identity;
}
