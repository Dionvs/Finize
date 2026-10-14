const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeBankInput, normalizeCsvBankInput, compareBankInputs, decimalAmountToCents } = require('../src/import/bank-input-contract.mjs');
const { classifyCsvDuplicate, immutableBankFields } = require('../src/import/import-identity.mjs');
const model = require('../src/core/transaction-model.mjs');
const bank = require('../src/core/bank-sources.mjs');
const engine = require('../src/core/transaction-engine.mjs');
const u = require('../src/import/update4-runtime.cjs');
const { state, row, materialize, copy } = require('./helpers/package5-fixture.cjs');
const scope = { householdId: 'household-a', accountProfiles: [
  { id: 'dion-ing', accountOwner: 'dion', identifier: 'NL01INGB0000000001' },
  { id: 'dion-second', accountOwner: 'dion', identifier: 'NL99INGB0000000001' }
] };
const transaction = (changes = {}) => ({
  version: 1, recordType: 'bank-transaction', householdId: 'household-a', accountProfileId: 'dion-ing',
  channel: 'bank-api', authority: 'test-bank:transactions', identity: { kind: 'bank-id', authority: 'test-bank:transactions', id: 'bank-123' },
  facts: { amountCents: -4218, currency: 'EUR', bankStatus: 'booked', transactionDate: '2026-07-02',
    description: 'Albert Heijn 1234', counterpartyAccount: 'NL22BANK0000000022' },
  provenance: { payload: { id: 'bank-123', signedAmount: '-42.18' } }, ...changes
});
const normalize = input => normalizeBankInput(input, scope);
const assertError = (result, code) => {
  assert.equal(result.ok, false);
  assert.equal(result.record, null);
  assert.equal(result.disposition, 'blocked');
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result));
};
function draft(id = 'csv-a') {
  return u.createImportDraft({ text: fs.readFileSync(path.join(__dirname, 'fixtures/ing-dion.csv'), 'utf8'),
    profiles: scope.accountProfiles, today: '2026-10-13', id });
}

test('P5a exact signed cents: debit, credit, zero; no coercion or new rounding', () => {
  for (const [amount, cents] of [[-42.18, -4218], [2450, 245000], [0, 0], [0.29, 29], [-0.01, -1]])
    assert.equal(decimalAmountToCents(amount), cents);
  for (const invalid of [1.005, NaN, Infinity, '42.18', null, 1e14]) assert.throws(() => decimalAmountToCents(invalid));
});
test('P5a envelope keeps original evidence immutable without freezing or editing caller data', () => {
  const input = transaction(), before = copy(input), result = normalize(input);
  assert.equal(result.ok, true);
  assert.equal(result.disposition, 'ready');
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(result.record.provenance.payload), true);
  input.provenance.payload.signedAmount = 'changed';
  assert.equal(result.record.provenance.payload.signedAmount, '-42.18');
  assert.deepEqual(normalize(copy(result.record)), result);
});
test('P5a normalization never approves or creates an existing processing row', () => {
  const result = normalize(transaction({ source: 'manual', approvalSource: 'manual', processingStatus: 'goedgekeurd', bankOriginal: { amount: 9 } }));
  assert.equal(result.ok, true);
  assert.equal(model.getTransactionSource(result.record), null);
  assert.equal(model.isTransactionFinanciallyActive(result.record), false);
  for (const key of ['source', 'approvalSource', 'processingStatus', 'bankOriginal']) assert.equal(Object.hasOwn(result.record, key), false);
});
test('P5a unknown identity stays uncertain and operation IDs never prove identity', () => {
  const a = normalize(transaction({ identity: null, provenance: { payload: {}, operationId: 'same-op' } }));
  assert.equal(a.ok, true);
  assert.ok(a.warnings.some(x => x.code === 'unproven-identity'));
  assert.equal(compareBankInputs(a.record, a.record, scope).status, 'possible-duplicate');
});
for (const [label, changes, code] of [
  ['future version', { version: 2 }, 'unsupported-version'],
  ['unknown type', { recordType: 'transaction' }, 'unsupported-record-type'],
  ['unknown channel', { channel: 'other' }, 'unsupported-channel'],
  ['manual is no bank feed', { channel: 'manual' }, 'unsupported-transaction-channel'],
  ['other household', { householdId: 'household-b' }, 'household-scope-mismatch'],
  ['missing profile', { accountProfileId: '' }, 'unresolved-account-profile'],
  ['unknown profile', { accountProfileId: 'unknown' }, 'unresolved-account-profile'],
  ['missing authority', { authority: '' }, 'missing-authority'],
  ['missing original', { provenance: {} }, 'missing-original-evidence'],
  ['wrong authority', { identity: { kind: 'bank-id', authority: 'different', id: 'bank-123' } }, 'invalid-bank-identity'],
  ['observation ID is no transaction ID', { identity: { kind: 'observation-id', id: 'op-1' } }, 'invalid-observation-identity']
]) test('P5a blocks ' + label, () => assertError(normalize(transaction(changes)), code));

for (const [label, facts, code] of [
  ['fractional cents', { amountCents: 42.18 }, 'invalid-cent-amount'],
  ['string cents', { amountCents: '4218' }, 'invalid-cent-amount'],
  ['unsafe cents', { amountCents: Number.MAX_SAFE_INTEGER + 1 }, 'invalid-cent-amount'],
  ['USD', { currency: 'USD' }, 'unsupported-currency'],
  ['missing currency', { currency: null }, 'unsupported-currency'],
  ['unknown status', { bankStatus: 'unknown' }, 'unsupported-bank-status'],
  ['invalid date', { transactionDate: '2026-02-29' }, 'invalid-date'],
  ['invalid booking date', { bookingDate: '2026-04-31' }, 'invalid-date'],
  ['invalid value date', { valueDate: 'yesterday' }, 'invalid-date'],
  ['missing description', { description: '' }, 'missing-description']
]) test('P5a blocks ' + label, () => { const input = transaction(); Object.assign(input.facts, facts); assertError(normalize(input), code); });

test('P5a malformed JSON or scope yields a validation result', () => {
  const cyclic = transaction(); cyclic.provenance.payload.self = cyclic;
  for (const input of [cyclic, transaction({ facts: { amountCents: NaN } }), undefined]) assertError(normalize(input), 'invalid-json');
  assertError(normalizeBankInput(transaction(), { householdId: scope.householdId, accountProfiles: {} }), 'unresolved-account-profile');
  assertError(normalizeBankInput(transaction(), null), 'household-scope-mismatch');
});
test('P5a pending stays deferred, never silently booked or merged with booked', () => {
  const input = transaction(); input.facts.bankStatus = 'pending';
  const result = normalize(input);
  assert.equal(result.ok, true); assert.equal(result.disposition, 'deferred');
  assert.equal(compareBankInputs(input, transaction(), scope).status, 'incomparable');
});
test('P5a same bank identity and facts compare equal and preserve both originals', () => {
  const a = transaction(), b = transaction({ provenance: { payload: { providerRepresentation: 'other', id: 'bank-123' } } });
  const result = compareBankInputs(a, b, scope);
  assert.equal(result.status, 'same-source');
  assert.deepEqual(result.evidence, [a.provenance, b.provenance]);
});
test('P5a different bank IDs with identical facts retain multiplicity', () => {
  const a = transaction(), b = transaction(); b.identity.id = 'bank-124';
  assert.equal(compareBankInputs(a, b, scope).status, 'distinct');
});
test('P5a same ID in different namespaces is not shared proof', () => {
  const a = transaction(), b = transaction(); b.authority = b.identity.authority = 'another-bank';
  assert.equal(compareBankInputs(a, b, scope).status, 'possible-duplicate');
});
test('P5a same identity with changed amount or observed dates conflicts', () => {
  for (const facts of [{ amountCents: -4300 }, { transactionDate: '2026-07-03' }, { description: 'Changed' }]) {
    const b = transaction(); Object.assign(b.facts, facts);
    assert.equal(compareBankInputs(transaction(), b, scope).status, 'identity-conflict');
  }
});
test('P5a missing optional facts are not silently equal to known facts', () => {
  const b = transaction(); b.facts.bookingDate = '2026-07-02';
  assert.equal(compareBankInputs(transaction(), b, scope).status, 'incomparable');
});
test('P5a two physical accounts of one owner remain distinct', () => {
  assert.equal(compareBankInputs(transaction(), transaction({ accountProfileId: 'dion-second' }), scope).status, 'distinct');
  assert.equal(compareBankInputs(transaction(), transaction({ householdId: 'household-b' }), scope).status, 'incomparable');
});
test('P5a parsed CSV preserves original cells, IDs, status and existing duplicate decision', () => {
  const batch = draft(), before = copy(batch), r = batch.rows[1], signature = immutableBankFields(r);
  const result = normalizeCsvBankInput(r, batch, scope);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.record.facts.amountCents, -4218);
  assert.deepEqual(result.record.provenance.payload.bankOriginal, r.bankOriginal);
  assert.deepEqual(result.record.identity, r.sourceIdentityProof);
  assert.deepEqual(batch, before);
  assert.equal(immutableBankFields(r), signature);
  const again = draft('csv-b');
  assert.equal(classifyCsvDuplicate(again.rows[1], again, [batch]).duplicate, true);
  assert.equal(normalizeCsvBankInput(again.rows[1], again, scope).record.identity.fileDigest, result.record.identity.fileDigest);
  assert.equal(compareBankInputs(result.record, normalizeCsvBankInput(again.rows[1], again, scope).record, scope).reason, 'use-existing-csv-duplicate-contract');
});
test('P5a legacy CSV file proof can derive digest without replacing original proof', () => {
  const batch = draft(); delete batch.rows[0].sourceIdentityProof.fileDigest;
  const before = copy(batch), result = normalizeCsvBankInput(batch.rows[0], batch, scope);
  assert.equal(result.ok, true);
  assert.match(result.record.identity.fileDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.record.provenance.payload.sourceIdentityProof, before.rows[0].sourceIdentityProof);
  assert.deepEqual(batch, before);
});
test('P5a absent CSV source proof remains unproven', () => {
  const batch = draft(); delete batch.rows[0].sourceIdentityProof;
  const result = normalizeCsvBankInput(batch.rows[0], batch, scope);
  assert.equal(result.ok, true); assert.equal(result.record.identity, null);
  assert.ok(result.warnings.some(x => x.code === 'unproven-identity'));
});
test('P5a CSV raw-cell equality contract is not relaxed', () => {
  const a = draft(), b = copy(a); b.id = 'other'; b.rows[1].bankOriginal.rawCells[1] = 'Different representation';
  const left = normalizeCsvBankInput(a.rows[1], a, scope).record;
  const right = normalizeCsvBankInput(b.rows[1], b, scope).record;
  assert.equal(classifyCsvDuplicate(b.rows[1], b, [a]).duplicate, false);
  assert.equal(compareBankInputs(left, right, scope).status, 'incomparable');
});
test('P5a CSV/API overlap without hard shared evidence is only a possible duplicate', () => {
  const batch = draft(), csv = normalizeCsvBankInput(batch.rows[1], batch, scope).record;
  assert.equal(compareBankInputs(csv, transaction(), scope).status, 'possible-duplicate');
});
test('P5a CSV/API can share bank authority and ID while retaining different originals', () => {
  const batch = draft(); batch.rows[1].sourceIdentityProof = copy(transaction().identity);
  const csv = normalizeCsvBankInput(batch.rows[1], batch, scope).record;
  const result = compareBankInputs(csv, transaction(), scope);
  assert.equal(result.status, 'same-source');
  assert.deepEqual(result.evidence[0].payload.bankOriginal.rawCells, batch.rows[1].bankOriginal.rawCells);
  assert.equal(result.evidence[1].payload.signedAmount, '-42.18');
});
test('P5a conflicting CSV profile, account number, owner or file evidence blocks', () => {
  for (const [mutate, code] of [
    [b => b.rows[0].accountProfileId = 'dion-second', 'account-profile-conflict'],
    [b => b.rows[0].bankOriginal.accountIdentifier = 'NL99WRONG', 'account-identifier-conflict'],
    [b => b.accountOwner = 'dara', 'account-owner-conflict'],
    [b => b.householdId = 'other', 'household-scope-mismatch'],
    [b => b.originalCsv += '\n', 'file-evidence-conflict'],
    [b => b.rows[0].bankOriginal.bankStatus = 'unknown', 'unsupported-bank-status']
  ]) { const batch = draft(); mutate(batch); assertError(normalizeCsvBankInput(batch.rows[0], batch, scope), code); }
});
test('P5a observation is not a transaction or income, including negative and zero balances', () => {
  for (const amountCents of [-500, 0, 100000]) {
    const input = transaction({ recordType: 'balance-observation', channel: 'manual', authority: 'finize:manual',
      identity: { kind: 'observation-id', id: 'checkpoint-1' },
      facts: { amountCents, currency: 'EUR', asOfDate: '2026-10-12', balanceType: 'booked', boundary: 'end-of-bank-day' } });
    const result = normalize(input);
    assert.equal(result.ok, true); assert.equal(result.disposition, 'ready');
    assert.equal(model.getTransactionSource(result.record), null);
    assert.equal(model.isTransactionFinanciallyActive(result.record), false);
    assert.equal(compareBankInputs(input, transaction(), scope).status, 'incomparable');
  }
});
test('P5a available or timestamp balances wait for inclusion semantics', () => {
  const input = transaction({ recordType: 'balance-observation', facts: { amountCents: 10000, currency: 'EUR',
    asOfDate: '2026-10-12', balanceType: 'available', boundary: 'timestamp', observedAt: '2026-10-12T12:30:00+02:00' } });
  assert.equal(normalize(input).disposition, 'deferred');
  delete input.facts.observedAt;
  assertError(normalize(input), 'missing-observation-time');
  input.facts.observedAt = '2026-02-30T12:30:00Z'; assertError(normalize(input), 'invalid-observation-time');
});
test('P5a CSV min/max dates or storage verification do not prove bank coverage', () => {
  const input = transaction({ recordType: 'coverage', facts: { fromDate: '2026-10-01', toDate: '2026-10-12', completeness: 'partial', basis: 'file-range' } });
  assert.equal(normalize(input).ok, true);
  input.facts.completeness = 'complete'; assertError(normalize(input), 'unproven-complete-coverage');
  input.facts.basis = 'storage-verified'; assertError(normalize(input), 'invalid-coverage-basis');
  input.facts.basis = 'provider-assertion'; assert.equal(normalize(input).ok, true);
  input.facts.toDate = '2026-09-30'; assertError(normalize(input), 'reversed-coverage-range');
});
test('P5a CSV approval, split cashflow and financial projections remain exactly unchanged', () => {
  const s = state(), r = row('split'); r.bankOriginal.currency = 'EUR';
  r.bankSourceId = 'existing-bank-source';
  r.processing.splits = [
    { id: 'part-a', amount: 100, category: 'Kleding', budgetOwner: 'gezamenlijk', transactionType: 'uitgave', include: true },
    { id: 'part-b', amount: 200, category: 'Overig', budgetOwner: 'gezamenlijk', transactionType: 'uitgave', include: true }
  ];
  const batch = materialize(s, [r]), before = copy(s), batchBefore = copy(batch);
  const cashBefore = bank.selectBankTransactions(s), projectionBefore = engine.selectTransactionProjections(s, { month: '2026-10' });
  const result = normalizeCsvBankInput(batch.rows[0], batch, { householdId: 'household-a', accountProfiles: s.accountProfiles });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.record.facts.amountCents, -30000);
  assert.equal(result.record.provenance.importReference.bankSourceId, batch.rows[0].bankSourceId);
  assert.equal(model.isTransactionFinanciallyActive(result.record), false);
  assert.deepEqual(s, before); assert.deepEqual(batch, batchBefore);
  assert.deepEqual(bank.selectBankTransactions(s), cashBefore);
  assert.deepEqual(engine.selectTransactionProjections(s, { month: '2026-10' }), projectionBefore);
  assert.equal(cashBefore.length, 1); assert.equal(cashBefore[0].bankAmount, -300);
});
test('P5a equal rows within one file remain two separate source identities', () => {
  const batch = draft(), first = normalizeCsvBankInput(batch.rows[1], batch, scope).record;
  const other = copy(first); other.identity.rowOrdinal += 1;
  assert.equal(compareBankInputs(first, other, scope).status, 'distinct');
});
test('P5a empty bank IDs or invalid row ordinals cannot prove identity', () => {
  const input = transaction(); input.identity.id = ' ';
  assertError(normalize(input), 'invalid-bank-identity');
  const batch = draft(); batch.rows[0].sourceIdentityProof.rowOrdinal = 0;
  assertError(normalizeCsvBankInput(batch.rows[0], batch, scope), 'invalid-file-identity');
});
test('P5a balance with 24:00 or missing timezone is not a valid observation time', () => {
  const input = transaction({ recordType: 'balance-observation', facts: { amountCents: 10000, currency: 'EUR',
    asOfDate: '2026-10-12', balanceType: 'booked', boundary: 'timestamp' } });
  for (const observedAt of ['2026-10-12T24:00:00Z', '2026-10-12T12:00:00']) {
    input.facts.observedAt = observedAt;
    assertError(normalize(input), 'invalid-observation-time');
  }
});
