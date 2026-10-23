import { providerBalanceAnchor } from './provider-balances.mjs';
import { normalizeBankInput, decimalAmountToCents } from '../import/bank-input-contract.mjs';
import { validCalendarDate } from '../import/import-identity.mjs';
import { selectBankTransactions, sourceRecordKey } from './bank-sources.mjs';
import { getTransactionProcessingStatus, getTransactionAccountContext } from './transaction-model.mjs';

const copy = value => structuredClone(value);
const fail = (code, message) => Object.assign(new Error(message), { code });
const canonical = value => JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const same = (a, b) => canonical(a) === canonical(b);
const nextDay = date => new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7))-1, Number(date.slice(8,10))+1)).toISOString().slice(0,10);
export function balanceRequiredMonths(fromDate, toDate) {
  if (!validCalendarDate(fromDate) || !validCalendarDate(toDate) || fromDate > toDate) return [];
  const result = []; let month = fromDate.slice(0,7);
  while (month <= toDate.slice(0,7)) {
    result.push(month);
    if(month===toDate.slice(0,7))break;
    const [year, value] = month.split('-').map(Number);
    month = value === 12 ? String(year+1).padStart(4,'0')+'-01' : String(year).padStart(4,'0')+'-'+String(value+1).padStart(2,'0');
  }
  return result;
}
function observation(record) {
  return { version: 1, recordType: 'balance-observation', householdId: record.householdId,
    accountProfileId: record.accountProfileId, channel: 'manual', authority: 'finize:manual',
    identity: { kind: 'observation-id', id: record.id }, facts: {
      amountCents: record.amountCents, currency: record.currency, asOfDate: record.asOfDate,
      balanceType: 'booked', boundary: record.boundary
    }, provenance: { payload: { createdAt: record.createdAt, actor: record.actor, note: record.note } } };
}
function validCheckpoint(record, scope) {
  return record?.version === 1 && typeof record.id === 'string' && !!record.id &&
    typeof record.operationId === 'string' && !!record.operationId && record.source === 'manual-observation' &&
    Number.isSafeInteger(record.revision) && record.revision > 0 &&
    typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt)) &&
    typeof record.note === 'string' && (record.actor === null || typeof record.actor === 'string') &&
    normalizeBankInput(observation(record), scope).ok;
}
export function checkpointHistory(state, accountProfileId, scope) {
  const all = state.balanceCheckpoints ?? [];
  if (!Array.isArray(all)) return { rows: [], active: [], issues: ['invalid-checkpoint-history'] };
  const rows = all.filter(row => row?.accountProfileId === accountProfileId), issues = [];
  if(all.some(row=>!row||typeof row.id!=='string'))issues.push('invalid-checkpoint-history');
  if (rows.some(row => !validCheckpoint(row, scope))) issues.push('invalid-checkpoint-history');
  if (new Set(all.map(row => row?.id)).size !== all.length) issues.push('duplicate-checkpoint-id');
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const row of rows) {
    const previous = byId.get(row.supersedesId);
    if (row.supersedesId ? !previous || previous.revision+1 !== row.revision : row.revision !== 1)
      issues.push('invalid-checkpoint-revision');
  }
  const replaced = new Set(rows.map(row => row.supersedesId).filter(Boolean));
  const active = rows.filter(row => !replaced.has(row.id) && validCheckpoint(row, scope));
  if (new Set(active.map(row => row.asOfDate)).size !== active.length) issues.push('conflicting-checkpoint-revisions');
  const order = (a,b) => String(b.asOfDate).localeCompare(String(a.asOfDate)) || b.revision-a.revision || String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id);
  return { rows: copy(rows.sort(order)), active: copy(active.sort(order)), issues: [...new Set(issues)] };
}
function coverageFor(coverage, checkpoint, toDate, scope) {
  if (checkpoint.asOfDate === toDate) return { status: 'complete', basis: 'checkpoint-only' };
  const from = nextDay(checkpoint.asOfDate);
  const valid = coverage.map(row => normalizeBankInput(row, scope)).filter(result => result.ok && result.record.recordType === 'coverage' && result.record.accountProfileId === checkpoint.accountProfileId).map(result => result.record.facts);
  let cursor = from;
  for (const range of valid.filter(row => row.completeness === 'complete').sort((a,b) => a.fromDate.localeCompare(b.fromDate))) {
    if (range.fromDate > cursor) break;
    if (range.toDate >= cursor) cursor = nextDay(range.toDate);
  }
  return { status: cursor > toDate ? 'complete' : valid.some(row => row.toDate >= from && row.fromDate <= toDate) ? 'partial' : 'unknown', basis: 'bank-evidence' };
}

/** End-of-day bank balance, independent of budget effects and future planning. Never writes. */
export function selectAccountBalance(state, { accountProfileId, toDate, scope, imports = [], importsAvailable = true, coverage = [], checkpointId = null } = {}) {
  const reasons = [], add = (code, sourceId = '') => { if (!reasons.some(row => row.code === code && row.sourceId === sourceId)) reasons.push({ code, sourceId }); };
  const history = checkpointHistory(state, accountProfileId, scope);
  history.issues.forEach(code => add(code));
  const manualCheckpoint = history.active.find(row => row.asOfDate <= toDate && (!checkpointId || row.id === checkpointId)) || null;
  const providerCheckpoint = providerBalanceAnchor(state, accountProfileId, toDate, scope, checkpointId);
  const checkpoint = providerCheckpoint && (!manualCheckpoint || providerCheckpoint.asOfDate >= manualCheckpoint.asOfDate) ? providerCheckpoint : manualCheckpoint;
  const result = { accountProfileId, toDate, boundary: 'end-of-bank-day', checkpoint, openingCents: checkpoint?.amountCents ?? null,
    mutations: [], confirmedCents: 0, provisionalCents: 0, balanceCents: null, status: 'unknown',
    quality: { bankSources: 'confirmed', coverage: 'unknown', storage: 'verified' }, reasons };
  if (!validCalendarDate(toDate)) { add('invalid-balance-date'); return result; }
  const profiles = (state.accountProfiles || []).filter(row => row.id === accountProfileId);
  if (profiles.length !== 1 || !Array.isArray(scope?.accountProfiles) || scope.accountProfiles.filter(row => row?.id === accountProfileId).length !== 1) { add('unresolved-account-profile'); return result; }
  if (!checkpoint) { add('missing-checkpoint'); if(history.issues.length){result.quality.storage='incomplete';result.status='incomplete';} return result; }
  const months = checkpoint.asOfDate === toDate ? [] : balanceRequiredMonths(nextDay(checkpoint.asOfDate), toDate);
  const missing = state.__finizePartialHistory ? months.filter(month => !state.verifiedPeriods?.includes(month)) : [];
  if (missing.length) { result.quality.storage = 'incomplete'; missing.forEach(month => add('missing-period', month)); }
  if (!importsAvailable) { result.quality.storage = 'incomplete'; add('imports-unavailable'); }
  if (history.issues.length) result.quality.storage = 'incomplete';
  if (checkpoint.source === 'provider-observation') {
    result.boundary = checkpoint.boundary; result.observedAt = checkpoint.observedAt;
    if (checkpoint.boundary === 'timestamp') add('intraday-provider-balance');
  }
  const cov = coverageFor([...coverage, ...(state.bankCoverage || [])], checkpoint, toDate, scope);
  result.quality.coverage = cov.status;
  if (cov.status !== 'complete') add(cov.status === 'partial' ? 'partial-bank-coverage' : 'unknown-bank-coverage');
  const profile = profiles[0];
  if(state.bankSyncStatus?.[accountProfileId]?.complete===false)add('provider-sync-incomplete');
  const relevant = row => row.accountProfileId ? row.accountProfileId === accountProfileId :
    !getTransactionAccountContext(row, { accountProfiles: state.accountProfiles }) || getTransactionAccountContext(row, { accountProfiles: state.accountProfiles }) === profile.accountOwner;
  const within = row => {
    const date = row.bankOriginal?.bankDate || row.date || '';
    return !validCalendarDate(date) || date > checkpoint.asOfDate && date <= toDate;
  };
  const activeImports = imports.filter(batch => !['withdrawn','deleted'].includes(batch.lifecycle) && batch.status !== 'teruggedraaid' &&
    !(state.importDeletionProofs || []).some(proof => proof.id === batch.id) && (state.importSummaries || []).some(summary => summary.id === batch.id));
  const unusable = new Set(), references = new Map();
  for (const batch of activeImports) for (const row of batch.rows || []) {
    const candidate = { ...row, accountProfileId: row.accountProfileId || batch.accountProfileId, accountOwner: row.accountOwner || batch.accountOwner };
    references.set(batch.id+':'+row.id, candidate);
    if (!relevant(candidate) || !within(candidate) || row.duplicate) continue;
    if (row.possibleDuplicate && !row.identityDecision) {
      unusable.add(batch.id+':'+row.id); if (row.bankSourceId) unusable.add(row.bankSourceId);
      add('possible-duplicate', batch.id+':'+row.id);
    }
    if (!candidate.accountProfileId || row.importError || !row.bankOriginal?.valid)
      add(!candidate.accountProfileId ? 'unresolved-account-profile' : 'invalid-bank-source', batch.id+':'+row.id);
  }
  // Existing source selection deduplicates bankSourceId, import aliases and manual replacements.
  const selected = new Map();
  try {
    if (state.__finizePartialHistory) {
      for (const month of months.filter(month => !missing.includes(month)))
        for (const row of selectBankTransactions(state, { month, imports })) selected.set(sourceRecordKey(row), row);
    } else for (const row of selectBankTransactions(state, { imports })) selected.set(sourceRecordKey(row), row);
  } catch { result.quality.storage = 'incomplete'; add('bank-sources-unavailable'); }
  // Check source facts before the existing selector chooses the canonical header.
  const signatures = new Map(), conflicts = new Set(), proofSources = new Map();
  const registerProof = (row,key) => {
    const proof=row.sourceIdentityProof;
    const identity=proof?.kind==='bank-id'&&proof.authority&&proof.id ? ['bank-id',proof.authority,proof.id] :
      proof?.kind==='file-row'&&/^[a-f0-9]{64}$/.test(proof.fileDigest||'')&&Number.isSafeInteger(proof.rowOrdinal)&&proof.rowOrdinal>0 ? ['file-row',proof.fileDigest,proof.rowOrdinal] : null;
    if(!identity||!row.accountProfileId)return;
    const signature=JSON.stringify([row.accountProfileId,...identity]),previous=proofSources.get(signature);
    if(previous&&previous!==key){conflicts.add(previous);conflicts.add(key);}else proofSources.set(signature,key);
  };
  for (const row of state.transactions || []) {
    if (!row.bankOriginal || !within(row) || !selected.has(sourceRecordKey(row))) continue;
    const key = sourceRecordKey(row), b = row.bankOriginal;
    const signature = JSON.stringify([row.accountProfileId || null, b.bankDate, b.amount, b.currency || null, b.accountIdentifier || null]);
    if (signatures.has(key) && signatures.get(key) !== signature) conflicts.add(key);
    signatures.set(key, signature);
    registerProof(row,key);
  }
  for(const [key,row] of selected)for(const ref of row.importReferences||[{batchId:row.importBatchId,rowId:row.importTransactionId}]) {
    const original=references.get(ref.batchId+':'+ref.rowId);if(original)registerProof(original,key);
  }
  for (const row of state.transactions || []) if(relevant(row)&&within(row)&&conflicts.has(sourceRecordKey(row))) add('conflicting-bank-source',sourceRecordKey(row));
  for (const [key, row] of selected) {
    if (!relevant(row) || !within(row)) continue;
    const ref = row.importBatchId && row.importTransactionId ? row.importBatchId+':'+row.importTransactionId : '';
    if (!row.bankOriginal) { add('manual-without-bank-evidence', key); continue; }
    if (!row.accountProfileId || getTransactionAccountContext(row, { accountProfiles: state.accountProfiles }) !== profile.accountOwner) { add('unresolved-account-profile', key); continue; }
    if (conflicts.has(key)) { add('conflicting-bank-source', key); continue; }
    if (unusable.has(key) || unusable.has(ref)) { add('possible-duplicate', key); continue; }
    const original = row.bankOriginal, status = original.bankStatus ?? 'booked';
    if (!validCalendarDate(original.bankDate) || !original.valid || original.currency !== 'EUR' || !ref) { add('invalid-bank-source', key); continue; }
    if (status !== 'booked') { add(status === 'pending' ? 'pending-bank-source' : 'unknown-bank-status', key); continue; }
    // Import reference and physical account identify a retained source. Review confidence does not.
    if (row.possibleDuplicate && !row.identityDecision) { add('possible-duplicate', key); continue; }
    const evidenceRows = (row.importReferences || [{ batchId: row.importBatchId, rowId: row.importTransactionId }]).map(item => references.get(item.batchId+':'+item.rowId)).filter(Boolean);
    if (evidenceRows.some(item => item.accountProfileId !== row.accountProfileId || item.bankOriginal?.bankDate !== original.bankDate || item.bankOriginal?.amount !== original.amount)) { add('conflicting-bank-source', key); continue; }
    let amountCents;
    try { amountCents = decimalAmountToCents(original.amount); } catch { add('invalid-bank-amount', key); continue; }
    const confirmed = row.approvalSource === 'manual' && ['goedgekeurd','niet-meetellen'].includes(getTransactionProcessingStatus(row));
    const field = confirmed ? 'confirmedCents' : 'provisionalCents';
    if (!Number.isSafeInteger(result[field]+amountCents)) { result.quality.storage = 'incomplete'; add('unsafe-balance-amount'); continue; }
    result[field] += amountCents;
    result.mutations.push({ sourceId: key, date: original.bankDate, amountCents, status: confirmed ? 'confirmed' : 'provisional', description: original.description || '' });
  }
  result.mutations.sort((a,b) => a.date.localeCompare(b.date) || a.sourceId.localeCompare(b.sourceId));
  const bankKeys=new Set([...selected.values()].filter(row=>row.bankOriginal).map(sourceRecordKey));
  const bankIds=new Set((state.transactions||[]).filter(row=>bankKeys.has(sourceRecordKey(row))).map(row=>row.id));
  for(const transfer of state.internalTransfers||[]) {
    if(transfer.status!=='uitgevoerd'||!within(transfer))continue;
    if(![transfer.sourceAccount,transfer.targetAccount].some(account=>account===accountProfileId||account===profile.accountOwner))continue;
    if([transfer.actualTransactionId,...(transfer.transactionIds||[])].some(id=>bankIds.has(id)))continue;
    add('manual-transfer-unresolved',transfer.id||'');
  }
  if (result.mutations.some(row => row.status === 'provisional')) add('awaiting-review');
  const sourceIssues = reasons.some(row => !['unknown-bank-coverage','partial-bank-coverage','awaiting-review','missing-period','imports-unavailable','intraday-provider-balance'].includes(row.code));
  result.quality.bankSources = sourceIssues ? 'uncertain' : result.mutations.some(row => row.status === 'provisional') ? 'provisional' : 'confirmed';
  const amount = checkpoint.amountCents+result.confirmedCents+result.provisionalCents;
  if (!Number.isSafeInteger(amount)) { result.quality.storage = 'incomplete'; add('unsafe-balance-amount'); }
  if (result.quality.storage === 'verified') result.balanceCents = amount;
  result.status = result.quality.storage === 'incomplete' || sourceIssues ? 'incomplete' :
    result.quality.bankSources === 'provisional' || cov.status !== 'complete' || checkpoint.boundary === 'timestamp' ? 'provisional' : 'confirmed';
  return result;
}

export function prepareBalanceCheckpoint(state, command, options) {
  const { scope, today } = options;
  if((state.accountProfiles||[]).filter(row=>row.id===command.accountProfileId).length!==1)throw fail('unresolved-account-profile','Kies een bestaande fysieke rekening.');
  if(state.accountProfiles.find(row=>row.id===command.accountProfileId).status==='archived' && !command.supersedesId && !(state.balanceCheckpoints||[]).some(row=>row.operationId===command.operationId))throw fail('account-archived','Heractiveer de rekening voordat je een nieuw banksaldo invoert.');
  if (!validCalendarDate(today) || !validCalendarDate(command.asOfDate) || command.asOfDate > today)
    throw fail('invalid-checkpoint-date', 'Kies een geldige peildatum tot en met vandaag.');
  if (!command.operationId || typeof command.operationId !== 'string') throw fail('missing-operation-id', 'De opslagactie mist een vaste identiteit.');
  const history = checkpointHistory(state, command.accountProfileId, scope);
  if (history.issues.length) throw fail('checkpoint-history-conflict', 'De ijkpunthistorie bevat een conflict. Bewaar de bestaande waarnemingen en controleer de synchronisatie.');
  const previous = command.supersedesId ? history.rows.find(row => row.id === command.supersedesId) : null;
  const record = { version: 1, id: 'balance-'+command.operationId, operationId: command.operationId,
    householdId: scope.householdId, accountProfileId: command.accountProfileId, amountCents: command.amountCents,
    currency: 'EUR', asOfDate: command.asOfDate, boundary: 'end-of-bank-day', source: 'manual-observation',
    createdAt: command.createdAt, actor: command.actor ?? null, note: String(command.note || '').trim(),
    revision: previous ? previous.revision+1 : 1, supersedesId: previous?.id || null };
  if (!validCheckpoint(record, scope)) throw fail('invalid-checkpoint', 'Vul een geldig banksaldo in hele eurocenten in en kies een bestaande rekening.');
  const existing = (state.balanceCheckpoints || []).find(row => row.operationId === command.operationId);
  if (existing) {
    if (!same(existing, record)) throw fail('operation-conflict', 'Deze opslagactie is al gebruikt voor een andere waarneming.');
    return { record: copy(existing), noop: true };
  }
  const sameDate = history.active.find(row => row.asOfDate === command.asOfDate);
  if (command.supersedesId && (!previous || !history.active.some(row=>row.id===previous.id)))
    throw fail('stale-checkpoint-revision', 'Dit ijkpunt is intussen gewijzigd. Open de actuele waarneming opnieuw.');
  if (sameDate && sameDate.id !== previous?.id) throw fail('checkpoint-date-exists', 'Voor deze dag bestaat al een ander ijkpunt. Gebruik Corrigeren bij de juiste waarneming.');
  const projected = selectAccountBalance(state, { ...options, accountProfileId: command.accountProfileId, toDate: command.asOfDate });
  const reconciliation = { expectedCents: projected.balanceCents, observedCents: record.amountCents,
    differenceCents: projected.balanceCents === null ? null : record.amountCents-projected.balanceCents,
    quality: projected.quality, reasons: projected.reasons, previousCheckpointId: projected.checkpoint?.id || null };
  if (reconciliation.differenceCents !== null && !Number.isSafeInteger(reconciliation.differenceCents)) throw fail('unsafe-difference', 'Het controleverschil is te groot om exact te bewaren.');
  return { record, reconciliation, previewSignature: JSON.stringify([history.rows, projected, record]), noop: false };
}
export function applyBalanceCheckpoint(state, command, options) {
  const prepared = prepareBalanceCheckpoint(state, command, options);
  if (prepared.noop) return prepared;
  if (!command.confirmed || command.previewSignature !== prepared.previewSignature)
    throw fail('balance-confirmation-required', 'Controleer de actuele vergelijking en bevestig de waarneming opnieuw.');
  state.balanceCheckpoints = [...(state.balanceCheckpoints || []), prepared.record];
  return prepared;
}
