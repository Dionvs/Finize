// Canonical transaction contracts, shared by processing and financial projection.
export const CURRENT_SCHEMA_VERSION = 11;
export const ACCOUNT_CONTEXTS = Object.freeze(['gezamenlijk', 'dion', 'dara']);
export const INCOME_TRANSACTION_TYPES = Object.freeze(['salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten']);
export const PROCESSING_STATUSES = Object.freeze(['onbekend', 'nakijken', 'goedgekeurd', 'niet-meetellen']);
const copy = value => JSON.parse(JSON.stringify(value));
const validAccount = value => ACCOUNT_CONTEXTS.includes(value);
const iban = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function resolveTransactionAccountContext(tx, { accountProfiles = [] } = {}) {
  if(tx?.accountContextResolution==='ambiguous')return {value:null,evidence:'',ambiguous:true,reason:'unresolved-account-context'};
  const candidates = ['accountContext', 'accountOwner', 'account']
    .filter(key => validAccount(tx?.[key])).map(key => ({ value: tx[key], evidence: key }));
  const profileMatches = accountProfiles.filter(profile =>
    (tx?.accountProfileId && profile.id === tx.accountProfileId) ||
    (tx?.bankOriginal?.accountIdentifier && iban(profile.identifier || profile.iban) === iban(tx.bankOriginal.accountIdentifier)));
  profileMatches.forEach(profile => {
    if (validAccount(profile.accountOwner)) candidates.push({ value: profile.accountOwner, evidence: 'account-profile' });
  });
  const values = [...new Set(candidates.map(item => item.value))];
  return values.length === 1
    ? { value: values[0], evidence: candidates[0].evidence, ambiguous: false }
    : { value: null, evidence: '', ambiguous: true, reason: values.length ? 'conflicting-account-context' : 'missing-account-context' };
}

export function getTransactionAccountContext(tx, options) {
  return resolveTransactionAccountContext(tx, options).value;
}

export function getTransactionSource(tx) {
  // Import evidence takes precedence over a contradictory manual marker.
  if (tx?.bankOriginal || tx?.importBatchId || tx?.sourceFile || tx?.rawData || tx?.importedAt) return 'csv';
  return ['manual', 'csv'].includes(tx?.source) ? tx.source : null;
}

export function getTransactionProcessingStatus(tx) {
  const manual = getTransactionSource(tx) === 'manual';
  const explicit = tx?.approvalSource === 'manual' &&
    (tx?.certainty === 'goedgekeurd' || tx?.processingStatus === 'goedgekeurd' || tx?.processingStatus === 'niet-meetellen');
  const legacy = tx?.approvalSource === 'legacy-confirmed' || tx?.reviewStatus === 'bevestigd';
  const excluded = tx?.reviewStatus === 'genegeerd' || tx?.kind === 'niet-meetellen' ||
    tx?.processing?.include === false || tx?.processing?.transactionType === 'niet-meetellen' || tx?.transactionType === 'niet-meetellen';
  // A deliberate reopen wins over the old confirmed copy and recognition certainty.
  if (!manual && ['nakijken','onbekend'].includes(tx?.processingStatus)) return tx.processingStatus;
  if (!manual && ['nakijken','onbekend'].includes(tx?.reviewStatus)) return tx.reviewStatus;
  if (tx?.reviewStatus === 'genegeerd' || ((manual || explicit || legacy) && excluded)) return 'niet-meetellen';
  if (manual || explicit || legacy) return 'goedgekeurd';
  if (tx?.recognitionState === 'unknown' || tx?.certainty === 'onbekend' || tx?.processingStatus === 'onbekend') return 'onbekend';
  // Recognition confidence is never approval evidence.
  const category=tx?.processing?.category||tx?.category;
  const type=tx?.processing?.transactionType||tx?.transactionType;
  const proposal=tx?.certainty||tx?.processingStatus||tx?.recognitionState||type||
    (category&&!['onbekend','ongecategoriseerd'].includes(String(category).toLowerCase()));
  return proposal?'nakijken':'onbekend';
}

export function isTransactionFinanciallyActive(tx) {
  if(tx?.recordRole==='bank-source')return false;
  return !['withdrawn','deleted'].includes(tx?.batchLifecycle) && getTransactionProcessingStatus(tx) === 'goedgekeurd';
}

export function getTransactionFinancialDestination(tx) {
  return [tx?.budgetOwner,tx?.processing?.budgetOwner,tx?.financialFor,tx?.owner].find(validAccount) || null;
}
export function getTransactionDate(tx) {
  return tx?.transactionDate || tx?.bankOriginal?.bankDate || tx?.rawData?.transactionDate || tx?.date || '';
}
export function getTransactionClassification(tx) {
  const normalize=value=>String(value||'').trim().toLowerCase().replace(/[ _]+/g,'-');
  const explicit=normalize(tx?.transactionType||tx?.processing?.transactionType||tx?.type);
  const text=explicit||[tx?.kind,tx?.category].map(normalize).join('|');
  for(const [pattern,type] of [[/naar-?spaar-?rekening|storten-?naar-?spaar/,'naar-spaarrekening'],[/van-?spaar-?rekening|opnemen-?van-?spaar/,'van-spaarrekening'],[/sparen|spaardoel/,'sparen'],[/interne-?overboeking|eigen-?rekening/,'interne-overboeking'],[/maandelijkse-?bijdrage/,'maandelijkse-bijdrage'],[/extra-?bijdrage/,'extra-bijdrage'],[/vaste-?last|fixed-?expense/,'vaste-last']])if(pattern.test(text))return type;
  return explicit||normalize(tx?.kind)||'uitgave';
}

function freezeTree(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value); }
  return value;
}
export function getTransactionOriginalBankData(tx) {
  return tx?.bankOriginal ? freezeTree(copy(tx.bankOriginal)) : null;
}

export function normalizeDataTransaction(tx, { accountProfiles = [], legacyMain = false, diagnostics = [] } = {}) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('Ongeldige transactieregel; oorspronkelijke data behouden.');
  const next = copy(tx);
  const context = resolveTransactionAccountContext(tx, { accountProfiles });
  if (context.value) {
    next.accountContext = context.value;
    next.accountContextEvidence = next.accountContextEvidence || context.evidence;
    next.accountOwner = next.accountOwner || context.value;
    next.account = next.account || context.value;
    next.accountContextResolution='resolved';
  } else {
    next.accountContextResolution='ambiguous';
    diagnostics.push({ code: context.reason, id: tx.id || '', path: 'transactions.accountContext' });
  }
  const budget = tx.budgetOwner || tx.processing?.budgetOwner || tx.financialFor || tx.owner;
  if (validAccount(budget)) {
    next.budgetOwner = next.budgetOwner || budget;
    next.financialFor = next.financialFor || budget;
    next.owner = next.owner || budget;
  }
  const source = getTransactionSource(next);
  if (source) next.source = source;
  // Grandfather existing main-state activity; never apply this to a draft/queue.
  if (legacyMain && source !== 'manual' && !next.approvalSource && (!tx.reviewStatus || tx.reviewStatus === 'bevestigd')) {
    next.approvalSource = 'legacy-confirmed';
    diagnostics.push({ code: 'legacy-approval-evidence-missing', id: tx.id || '', path: 'transactions.approvalSource' });
  }
  next.processingStatus = getTransactionProcessingStatus(next);
  return next;
}

export function markManualTransaction(tx, accountContext) {
  if (!validAccount(accountContext)) throw new Error('Fysieke rekeningcontext ontbreekt.');
  Object.assign(tx, { source: 'manual', accountContext, accountContextResolution:'resolved', accountContextEvidence: 'manual-entry', processingStatus: 'goedgekeurd' });
  return tx;
}

export function assertOriginalBankDataUnchanged(previousRows, nextRows) {
  // Firestore may return object keys in a different order; source values and array order are immutable.
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])) : value;
  const signature=value=>JSON.stringify(ordered(value));
  const nextById=new Map((nextRows||[]).map(row=>[row.id,row]));
  (previousRows||[]).forEach(row=>{
    const next=nextById.get(row.id);
    // Intentional deletion/undo remains allowed. An existing row cannot lose/change its source.
    if(row.bankOriginal && next && signature(row.bankOriginal)!==signature(next.bankOriginal))
      throw new Error(`Originele bankgegevens van ${row.id} mogen niet worden gewijzigd.`);
  });
}
