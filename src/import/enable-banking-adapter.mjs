import { normalizeBankInput, compareBankInputs, normalizeCsvBankInput } from './bank-input-contract.mjs';
import { csvFileDigest, validCalendarDate } from './import-identity.mjs';

const copy = value => structuredClone(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const authority = 'enablebanking:ING:NL';
const iban = value => String(value || '').replace(/\s/g, '').toUpperCase();
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function providerAmountCents(value) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) fail('invalid-provider-amount');
  const negative = value.startsWith('-'), [integer, fraction = ''] = value.replace(/^-/, '').split('.');
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) fail('unsafe-provider-amount');
  return negative ? -cents : cents;
}
export const providerBatchId = (profileId, accountHash) => 'bank-api-' + csvFileDigest(JSON.stringify([profileId, accountHash])).slice(0, 32);

export function normalizeProviderTransaction(raw, snapshot, scope) {
  const cents = providerAmountCents(raw.transaction_amount?.amount);
  if (!['CRDT', 'DBIT'].includes(raw.credit_debit_indicator) || cents < 0) fail('invalid-credit-debit-indicator');
  const amountCents = raw.credit_debit_indicator === 'DBIT' ? -cents : cents;
  const booked = raw.status === 'BOOK';
  const description = (raw.remittance_information || []).filter(value => typeof value === 'string').join(' ').trim() ||
    raw.creditor?.name || raw.debtor?.name || 'Banktransactie';
  return normalizeBankInput({
    version: 1, recordType: 'bank-transaction', householdId: snapshot.householdId, accountProfileId: snapshot.accountProfileId,
    channel: 'bank-api', authority,
    identity: typeof raw.entry_reference === 'string' && raw.entry_reference.trim()
      ? { kind: 'bank-id', authority, id: JSON.stringify([snapshot.account.identificationHash, raw.entry_reference]) } : null,
    facts: { amountCents, currency: raw.transaction_amount?.currency, transactionDate: raw.booking_date || raw.value_date,
      bookingDate: raw.booking_date || null, valueDate: raw.value_date || null, bankStatus: booked ? 'booked' : raw.status === 'PDNG' ? 'pending' : null,
      description, counterpartyAccount: raw.credit_debit_indicator === 'DBIT' ? raw.creditor_account?.iban || null : raw.debtor_account?.iban || null,
      reference: raw.reference_number || raw.end_to_end_id || null },
    provenance: { payload: copy(raw), fetchedAt: snapshot.fetchedAt, accountHash: snapshot.account.identificationHash }
  }, scope);
}

export function normalizeProviderBalances(snapshot, scope) {
  return (snapshot.balances || []).map((raw, index) => {
    // CLBD is closing booked; ITBD interim booked. Available balances never seed P1.
    const type = ['CLBD', 'ITBD', 'OPBD'].includes(raw.balance_type) ? 'booked' :
      ['CLAV', 'ITAV', 'OPAV', 'PRAV', 'FWAV'].includes(raw.balance_type) ? 'available' : null;
    const timestamp = raw.last_change_date_time;
    const boundary = raw.balance_type === 'CLBD' && validCalendarDate(raw.reference_date) ? 'end-of-bank-day' : 'timestamp';
    const asOfDate = boundary === 'end-of-bank-day' ? raw.reference_date : typeof timestamp === 'string' ? timestamp.slice(0, 10) : raw.reference_date;
    const input = { version: 1, recordType: 'balance-observation', householdId: snapshot.householdId, accountProfileId: snapshot.accountProfileId,
      channel: 'bank-api', authority, identity: { kind: 'observation-id', id: 'provider-balance-' + csvFileDigest(canonical([snapshot.account.identificationHash, raw, snapshot.fetchedAt])) },
      facts: { amountCents: providerAmountCents(raw.balance_amount?.amount), currency: raw.balance_amount?.currency,
        balanceType: type, boundary, asOfDate, observedAt: timestamp || null },
      provenance: { payload: copy(raw), fetchedAt: snapshot.fetchedAt, providerType: raw.balance_type, accountHash: snapshot.account.identificationHash } };
    const normalized = normalizeBankInput(input, scope);
    return normalized.ok ? { id: input.identity.id, ...normalized.record } :
      { id: 'unusable-balance-' + index, unusable: true, raw: copy(raw), errors: normalized.errors };
  });
}

/** Stages original provider records for the existing editor; never approves or posts. */
export function stageProviderSnapshot(snapshot, state, previous, imports, classify) {
  const scope = { householdId: snapshot.householdId, accountProfiles: state.accountProfiles || [] };
  const profiles = scope.accountProfiles.filter(row => row.id === snapshot.accountProfileId);
  if (snapshot.version !== 1 || profiles.length !== 1 || profiles[0].status === 'archived' ||
      !snapshot.account?.identificationHash || iban(profiles[0].identifier || profiles[0].iban) !== iban(snapshot.account.iban) ||
      !Array.isArray(snapshot.transactions) || !validCalendarDate(snapshot.fromDate) || !validCalendarDate(snapshot.toDate) ||
      !Number.isFinite(Date.parse(snapshot.fetchedAt))) fail('invalid-provider-snapshot');
  const profile = profiles[0], id = providerBatchId(profile.id, snapshot.account.identificationHash);
  if (previous && (previous.id !== id || previous.channel !== 'bank-api' || ['deleted', 'withdrawn'].includes(previous.lifecycle))) fail('provider-batch-conflict');
  const batch = previous ? copy(previous) : {
    id, channel: 'bank-api', provider: 'enablebanking', fileName: 'ING-bankkoppeling', format: 'bank-api', bank: 'ING',
    householdId: scope.householdId, accountProfileId: profile.id, accountOwner: profile.accountOwner,
    lifecycle: 'active', version: 0, status: 'concept', rows: [], createdAt: snapshot.fetchedAt
  };
  const seen = new Map(), rows = new Map(batch.rows.map(row => [row.id, row]));
  for (const raw of snapshot.transactions) {
    const normalized = normalizeProviderTransaction(raw, snapshot, scope);
    if (!normalized.ok) fail('invalid-provider-transaction');
    const input = normalized.record;
    // Provider BOOK results must contain actual booking dates, never invent one from fetch time.
    if (normalized.disposition !== 'ready') continue;
    if (!input.facts.bookingDate) fail('missing-provider-booking-date');
    const key = input.identity?.id || canonical(raw);
    const occurrence = (seen.get(key) || 0) + 1; seen.set(key, occurrence);
    const rowId = 'api-row-' + csvFileDigest(key + (input.identity ? '' : ':' + occurrence));
    const old = rows.get(rowId);
    if (old) {
      if (canonical(old.providerInput.facts) !== canonical(input.facts)) fail('provider-identity-conflict');
      continue; // Preserve editor choices, explicit approvals, and duplicate decisions.
    }
    const f = input.facts;
    const original = { valid: true, provider: 'enablebanking', bankDate: f.bookingDate, bookingDate: f.bookingDate, valueDate: f.valueDate,
      amount: f.amountCents / 100, currency: f.currency, bankStatus: f.bankStatus, description: f.description, rawDescription: f.description,
      accountIdentifier: snapshot.account.iban, counterpartyAccount: f.counterpartyAccount, reference: f.reference,
      importBatchId: id, importTransactionId: rowId };
    const proposal = classify(original, profile, state.recognitionRules || [], scope.accountProfiles, state.recurringFixedExpenses || [], state.transactions || [], state);
    const row = { ...proposal, id: rowId, source: 'bank-api', accountProfileId: profile.id, accountOwner: profile.accountOwner,
      bankOriginal: original, providerInput: input, sourceIdentityProof: input.identity, processingStatus: 'nakijken',
      certainty: 'nakijken', approvalSource: '', approvedAt: '', duplicate: false };
    if (!input.identity) row.importError = { code: 'unproven-provider-identity', message: 'Bankidentiteit ontbreekt; niet verwerken.' };
    for (const existing of imports.filter(item => item.id !== id && !['deleted', 'withdrawn'].includes(item.lifecycle))) {
      for (const other of existing.rows || []) {
        if (other.importError || other.duplicate || (other.accountProfileId || existing.accountProfileId) !== profile.id) continue;
        const result = other.providerInput ? { ok: true, record: other.providerInput } : normalizeCsvBankInput(other, existing, scope);
        const sameBasicFacts = other.bankOriginal?.bankDate === original.bankDate && other.bankOriginal?.amount === original.amount;
        const comparison = result.ok ? compareBankInputs(input, result.record, scope) : null;
        if (comparison?.status === 'identity-conflict') fail('provider-identity-conflict');
        if (comparison?.status === 'same-source') {
          row.duplicate = true; row.duplicateSource = { batchId: existing.id, rowId: other.id }; break;
        }
        // An exact date/amount only raises a question; it never establishes identity.
        if (sameBasicFacts && comparison?.reason !== 'different-bank-ids') row.possibleDuplicate = { batchId: existing.id, rowId: other.id };
      }
      if (row.duplicate) break;
    }
    rows.set(row.id, row);
  }
  batch.rows = [...rows.values()];
  const dates = batch.rows.map(row => row.bankOriginal.bankDate).sort();
  batch.periodFrom = dates[0] || snapshot.fromDate; batch.periodTo = dates.at(-1) || snapshot.toDate;
  batch.status = 'concept'; batch.updatedAt = snapshot.fetchedAt;
  batch.balanceObservations = normalizeProviderBalances(snapshot, scope);
  const coverage = normalizeBankInput({
    version: 1, recordType: 'coverage', channel: 'bank-api', authority, householdId: scope.householdId, accountProfileId: profile.id,
    identity: { kind: 'observation-id', id: 'provider-coverage-' + snapshot.runId },
    facts: { fromDate: snapshot.fromDate, toDate: snapshot.toDate, completeness: 'partial', basis: 'provider-assertion' },
    provenance: { payload: { allPagesFetched: snapshot.complete === true, issue: snapshot.issue || null }, fetchedAt: snapshot.fetchedAt }
  }, scope);
  if (!coverage.ok) fail('invalid-provider-coverage');
  // Exhausting pagination alone is not proof of the bank's full historical coverage.
  batch.providerCoverage = { id: coverage.record.identity.id, ...coverage.record };
  batch.providerSync = { fetchedAt: snapshot.fetchedAt, complete: snapshot.complete === true, issue: snapshot.issue || null };
  return batch;
}

export function applyProviderObservations(state, batch) {
  if (batch.channel !== 'bank-api') return;
  const observations = new Map((state.bankBalanceObservations || []).map(row => [row.id, row]));
  for (const row of batch.balanceObservations || []) if (!row.unusable) observations.set(row.id, copy(row));
  state.bankBalanceObservations = [...observations.values()];
  if (batch.providerCoverage) {
    const previous = state.bankCoverage || [];
    state.bankCoverage = [...previous.filter(row => row.id !== batch.providerCoverage.id), copy(batch.providerCoverage)];
  }
  state.bankSyncStatus = { ...(state.bankSyncStatus || {}), [batch.accountProfileId]: copy(batch.providerSync) };
}
