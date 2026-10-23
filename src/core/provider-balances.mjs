import { normalizeBankInput } from '../import/bank-input-contract.mjs';

/** A projection anchor, never a fabricated manual end-of-day checkpoint. */
export function providerBalanceAnchor(state, accountProfileId, toDate, scope, checkpointId = null) {
  const candidates = [];
  for (const value of state.bankBalanceObservations || []) {
    const result = normalizeBankInput(value, scope);
    if (!result.ok) continue;
    const { facts, provenance, identity } = result.record;
    if (result.record.accountProfileId !== accountProfileId || facts.balanceType !== 'booked' || facts.asOfDate > toDate ||
        !Number.isFinite(Date.parse(provenance.fetchedAt)) || facts.asOfDate > provenance.fetchedAt.slice(0,10) ||
        checkpointId && identity.id !== checkpointId) continue;
    if (facts.boundary === 'timestamp' && (provenance.providerType !== 'ITBD' || !facts.observedAt ||
        Date.parse(facts.observedAt) > Date.parse(provenance.fetchedAt) ||
        facts.asOfDate !== provenance.fetchedAt?.slice(0, 10))) continue;
    if (facts.boundary === 'end-of-bank-day' && provenance.providerType !== 'CLBD') continue;
    candidates.push({ id: identity.id, accountProfileId, amountCents: facts.amountCents, currency: facts.currency,
      asOfDate: facts.asOfDate, boundary: facts.boundary, observedAt: facts.observedAt, source: 'provider-observation', fetchedAt: provenance.fetchedAt });
  }
  candidates.sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || (b.boundary === 'end-of-bank-day') - (a.boundary === 'end-of-bank-day') ||
    String(b.observedAt || b.fetchedAt).localeCompare(String(a.observedAt || a.fetchedAt)));
  const selected = candidates[0];
  if (selected && candidates.some(row => row.asOfDate === selected.asOfDate && row.boundary === selected.boundary &&
      row.observedAt === selected.observedAt && row.amountCents !== selected.amountCents)) return null;
  return selected || null;
}

export function providerBalanceHistory(state, accountProfileId, toDate, scope) {
  const dates = [...new Set((state.bankBalanceObservations || []).map(row => row.facts?.asOfDate).filter(date => date && date <= toDate))];
  return dates.flatMap(date => { const row=providerBalanceAnchor(state,accountProfileId,date,scope);return row?.asOfDate===date?[row]:[]; });
}
