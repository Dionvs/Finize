import { csvFileDigest, validCalendarDate } from './import-identity.mjs';

// A staging envelope, never a transaction-model row or an approval command.
export const BANK_INPUT_VERSION = 1;
const TYPES = ['bank-transaction', 'balance-observation', 'coverage'];
const CHANNELS = ['csv', 'bank-api', 'manual'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const optional = value => value === undefined || value === null || value === '' ? null : value;
const accountNumber = value => String(value || '').replace(/\s/g, '').toUpperCase();
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function jsonCopy(value) {
  // Reject lossy JSON (NaN, undefined, class instances, cycles); never change evidence silently.
  const ancestors = new Set();
  function check(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object' || ancestors.has(item)) throw new Error('invalid-json');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) throw new Error('invalid-json');
    ancestors.add(item);
    for (const child of Array.isArray(item) ? item : Object.values(item)) check(child);
    ancestors.delete(item);
  }
  check(value);
  return JSON.parse(JSON.stringify(value));
}
function blocked(code, field) {
  return freeze({ ok: false, disposition: 'blocked', record: null, errors: [{ code, field }], warnings: [] });
}

export function decimalAmountToCents(amount) {
  // The legacy parser already rounds to cents. No new rounding or locale guessing here.
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('invalid-amount');
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) throw new Error('invalid-amount-precision');
  const cents = Number(match[1] + match[2] + (match[3] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('unsafe-amount');
  return cents === 0 ? 0 : cents;
}

/** Pure validation. scope is supplied by the caller's already authenticated household. */
export function normalizeBankInput(input, scope) {
  let source;
  try { source = jsonCopy(input); } catch { return blocked('invalid-json', 'input'); }
  if (!source || Array.isArray(source) || typeof source !== 'object') return blocked('invalid-record', 'input');
  const errors = [], warnings = [];
  const error = (code, field) => errors.push({ code, field });
  const warn = (code, field) => warnings.push({ code, field });
  if (source.version !== BANK_INPUT_VERSION) error('unsupported-version', 'version');
  if (!TYPES.includes(source.recordType)) error('unsupported-record-type', 'recordType');
  if (!CHANNELS.includes(source.channel)) error('unsupported-channel', 'channel');
  if (!text(scope?.householdId) || source.householdId !== scope.householdId) error('household-scope-mismatch', 'householdId');
  const profiles = Array.isArray(scope?.accountProfiles) ? scope.accountProfiles.filter(profile => profile?.id === source.accountProfileId) : [];
  if (!text(source.accountProfileId) || profiles.length !== 1) error('unresolved-account-profile', 'accountProfileId');
  if (!text(source.authority)) error('missing-authority', 'authority');
  const provenance = source.provenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance) ||
      !(provenance.payload != null || text(provenance.payloadRef))) error('missing-original-evidence', 'provenance');

  let identity = source.identity ?? null;
  if (identity === null) warn('unproven-identity', 'identity');
  else if (identity.kind === 'bank-id') {
    if (!text(identity.id) || !text(identity.authority) || identity.authority !== source.authority)
      error('invalid-bank-identity', 'identity');
  } else if (identity.kind === 'file-row') {
    if (source.channel !== 'csv' || source.recordType !== 'bank-transaction' ||
        !/^[a-f0-9]{64}$/.test(identity.fileDigest || '') || !Number.isSafeInteger(identity.rowOrdinal) || identity.rowOrdinal < 1)
      error('invalid-file-identity', 'identity');
  } else if (identity.kind === 'observation-id') {
    if (source.recordType === 'bank-transaction' || !text(identity.id)) error('invalid-observation-identity', 'identity');
  } else error('unsupported-identity', 'identity');

  const facts = source.facts || {};
  const date = field => { if (!validCalendarDate(facts[field])) error('invalid-date', 'facts.' + field); };
  const money = () => {
    if (!Number.isSafeInteger(facts.amountCents)) error('invalid-cent-amount', 'facts.amountCents');
    if (facts.currency !== 'EUR') error('unsupported-currency', 'facts.currency');
  };
  let normalizedFacts = null, deferred = false;
  if (source.recordType === 'bank-transaction') {
    if (source.channel === 'manual') error('unsupported-transaction-channel', 'channel');
    money(); date('transactionDate');
    for (const field of ['bookingDate', 'valueDate']) if (optional(facts[field]) !== null) date(field);
    if (!['booked', 'pending'].includes(facts.bankStatus)) error('unsupported-bank-status', 'facts.bankStatus');
    if (facts.bankStatus === 'pending') { deferred = true; warn('pending-not-booked', 'facts.bankStatus'); }
    if (!text(facts.description)) error('missing-description', 'facts.description');
    for (const field of ['counterpartyAccount', 'reference', 'transactionTime'])
      if (optional(facts[field]) !== null && typeof facts[field] !== 'string') error('invalid-text', 'facts.' + field);
    normalizedFacts = {
      amountCents: facts.amountCents, currency: facts.currency, bankStatus: facts.bankStatus,
      transactionDate: facts.transactionDate, bookingDate: optional(facts.bookingDate), valueDate: optional(facts.valueDate),
      transactionTime: optional(facts.transactionTime), description: facts.description,
      counterpartyAccount: optional(facts.counterpartyAccount) === null ? null : accountNumber(facts.counterpartyAccount),
      reference: optional(facts.reference)
    };
  } else if (source.recordType === 'balance-observation') {
    money(); date('asOfDate');
    if (!['booked', 'available'].includes(facts.balanceType)) error('unsupported-balance-type', 'facts.balanceType');
    if (!['end-of-bank-day', 'timestamp'].includes(facts.boundary)) error('unsupported-balance-boundary', 'facts.boundary');
    const observedAt = optional(facts.observedAt);
    if (observedAt !== null && (typeof observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(observedAt) ||
        !validCalendarDate(observedAt.slice(0, 10)) || !Number.isFinite(Date.parse(observedAt)))) error('invalid-observation-time', 'facts.observedAt');
    if (facts.boundary === 'timestamp' && observedAt === null) error('missing-observation-time', 'facts.observedAt');
    if (facts.boundary === 'timestamp' || facts.balanceType === 'available') {
      deferred = true; warn('balance-inclusion-unresolved', 'facts.boundary');
    }
    normalizedFacts = { amountCents: facts.amountCents, currency: facts.currency, asOfDate: facts.asOfDate,
      balanceType: facts.balanceType, boundary: facts.boundary, observedAt };
  } else if (source.recordType === 'coverage') {
    date('fromDate'); date('toDate');
    if (facts.fromDate > facts.toDate) error('reversed-coverage-range', 'facts.toDate');
    if (!['unknown', 'partial', 'complete'].includes(facts.completeness)) error('invalid-completeness', 'facts.completeness');
    if (!['unknown', 'file-range', 'bank-statement', 'provider-assertion'].includes(facts.basis)) error('invalid-coverage-basis', 'facts.basis');
    if (facts.completeness === 'complete' && !['bank-statement', 'provider-assertion'].includes(facts.basis))
      error('unproven-complete-coverage', 'facts.basis');
    if (facts.completeness !== 'complete') warn('incomplete-bank-coverage', 'facts.completeness');
    normalizedFacts = { fromDate: facts.fromDate, toDate: facts.toDate, completeness: facts.completeness, basis: facts.basis };
  }
  if (errors.length) return freeze({ ok: false, disposition: 'blocked', record: null, errors, warnings });
  // Explicit projection prevents source/approval fields from becoming processing instructions.
  return freeze({ ok: true, disposition: deferred ? 'deferred' : 'ready', errors, warnings,
    record: { version: BANK_INPUT_VERSION, recordType: source.recordType, householdId: source.householdId,
      accountProfileId: source.accountProfileId, channel: source.channel, authority: source.authority,
      identity, facts: normalizedFacts, provenance } });
}

/** Read-only view of a parsed CSV row. Never writes to the batch, source or processing. */
export function normalizeCsvBankInput(row, batch, scope) {
  if (row?.source && row.source !== 'csv') return blocked('unsupported-transaction-channel', 'source');
  if (!row?.bankOriginal?.valid || row.importError) return blocked('invalid-csv-row', 'bankOriginal');
  const original = row.bankOriginal;
  const accountProfileId = row.accountProfileId || batch?.accountProfileId;
  if (row.accountProfileId && batch?.accountProfileId && row.accountProfileId !== batch.accountProfileId)
    return blocked('account-profile-conflict', 'accountProfileId');
  if (batch?.householdId && batch.householdId !== scope?.householdId) return blocked('household-scope-mismatch', 'householdId');
  const profile = Array.isArray(scope?.accountProfiles) ? scope.accountProfiles.find(item => item?.id === accountProfileId) : null;
  if (original.accountIdentifier && (!profile || accountNumber(original.accountIdentifier) !== accountNumber(profile.identifier || profile.iban)))
    return blocked('account-identifier-conflict', 'bankOriginal.accountIdentifier');
  if ([row.accountOwner, batch?.accountOwner].some(owner => owner && profile?.accountOwner && owner !== profile.accountOwner))
    return blocked('account-owner-conflict', 'accountOwner');
  let amountCents;
  try { amountCents = decimalAmountToCents(original.amount); } catch (error) { return blocked(error.message, 'bankOriginal.amount'); }
  const originalProof = row.sourceIdentityProof ?? null;
  const proof = originalProof?.kind === 'file-row' && !originalProof.fileDigest && typeof batch?.originalCsv === 'string'
    ? { ...originalProof, fileDigest: csvFileDigest(batch.originalCsv) } : originalProof;
  // Verify existing file proof against original text when available; never synthesize a bank ID.
  if (proof?.kind === 'file-row' && typeof batch?.originalCsv === 'string' && csvFileDigest(batch.originalCsv) !== proof.fileDigest)
    return blocked('file-evidence-conflict', 'sourceIdentityProof');
  if (!text(batch?.id) || !text(row.id)) return blocked('missing-import-reference', 'importReference');
  return normalizeBankInput({
    version: BANK_INPUT_VERSION, recordType: 'bank-transaction', householdId: scope?.householdId,
    accountProfileId, channel: 'csv', authority: proof?.kind === 'bank-id' ? proof.authority : 'finize:csv', identity: proof,
    facts: { amountCents, currency: original.currency, bankStatus: original.bankStatus ?? 'booked', transactionDate: original.bankDate,
      bookingDate: optional(original.bookingDate), valueDate: optional(original.valueDate), transactionTime: optional(original.transactionTime),
      description: original.rawDescription || original.description, counterpartyAccount: optional(original.counterpartyAccount), reference: optional(original.reference) },
    provenance: { payload: { bankOriginal: original, sourceIdentityProof: originalProof },
      importReference: { batchId: batch.id, rowId: row.id, bankSourceId: row.bankSourceId || null } }
  }, scope);
}

const identityKey = record => {
  const id = record.identity;
  if (id?.kind === 'bank-id') return JSON.stringify([id.kind, id.authority, id.id]);
  if (id?.kind === 'file-row') return JSON.stringify([id.kind, id.fileDigest, id.rowOrdinal]);
  return null;
};

/** Comparison only: returns both proofs, never merges records or loosens legacy CSV rules. */
export function compareBankInputs(left, right, scope) {
  const a = normalizeBankInput(left, scope), b = normalizeBankInput(right, scope);
  if (!a.ok || !b.ok || left.recordType !== 'bank-transaction' || right.recordType !== 'bank-transaction')
    return freeze({ status: 'incomparable', reason: 'invalid-input-or-type' });
  const result = (status, reason) => freeze({ status, reason, evidence: [a.record.provenance, b.record.provenance] });
  if (left.accountProfileId !== right.accountProfileId) return result('distinct', 'different-account-profile');
  if (a.disposition !== 'ready' || b.disposition !== 'ready') return result('incomparable', 'not-booked');
  const x = a.record.facts, y = b.record.facts, keyA = identityKey(a.record), keyB = identityKey(b.record);
  const sameIdentity = keyA !== null && keyA === keyB;
  const fields = Object.keys(x);
  const conflict = fields.some(field => x[field] !== null && y[field] !== null && x[field] !== y[field]);
  const incomplete = fields.some(field => (x[field] === null) !== (y[field] === null));
  if (sameIdentity && conflict) return result('identity-conflict', 'different-canonical-facts');
  if (sameIdentity && incomplete) return result('incomparable', 'incomplete-canonical-facts');
  // Raw representations are allowed to differ across channels only. Existing CSV logic is untouched.
  if (sameIdentity && left.channel === 'csv' && right.channel === 'csv')
    return result('incomparable', 'use-existing-csv-duplicate-contract');
  if (sameIdentity) return result('same-source', 'proven-identity-and-equal-facts');
  if (keyA && keyB && left.identity.kind === 'bank-id' && right.identity.kind === 'bank-id' && left.identity.authority === right.identity.authority)
    return result('distinct', 'different-bank-ids');
  if (keyA && keyB && left.identity.kind === 'file-row' && right.identity.kind === 'file-row' && left.identity.fileDigest === right.identity.fileDigest)
    return result('distinct', 'different-file-rows');
  return !conflict && x.amountCents === y.amountCents && x.transactionDate === y.transactionDate
    ? result('possible-duplicate', 'matching-facts-without-shared-identity') : result('distinct', 'different-facts');
}
