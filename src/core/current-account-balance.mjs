import { normalizeBankInput } from '../import/bank-input-contract.mjs';
import { normalizeProviderBalances } from '../import/enable-banking-adapter.mjs';
import { selectAccountBalance } from './balance-checkpoints.mjs';

// Latest external current balance; never reclassify an expected balance as booked.
export function selectCurrentAccountBalance(state, options) {
  const {accountProfileId,scope,toDate,imports=[]}=options;
  const profile=(state.accountProfiles||[]).find(p=>p.id===accountProfileId);
  const values=[...(state.bankBalanceObservations||[])];
  for(const batch of imports){
    if(batch.channel!=='bank-api'||batch.accountProfileId!==accountProfileId||batch.householdId!==scope.householdId||['deleted','withdrawn'].includes(batch.lifecycle)||!(state.importSummaries||[]).some(s=>s.id===batch.id&&!['deleted','withdrawn'].includes(s.lifecycle)))continue;
    const input=batch.rows?.find(r=>r.providerInput?.accountProfileId===accountProfileId)?.providerInput;
    if(!input?.provenance?.accountHash)continue;
    for(const value of batch.balanceObservations||[]){
      if(!value.unusable){values.push(value);continue;}
      // Recover the retained original response in memory; never migrate the import.
      try{values.push(...normalizeProviderBalances({householdId:scope.householdId,accountProfileId,account:{identificationHash:input.provenance.accountHash},fetchedAt:batch.providerSync?.fetchedAt,balances:[value.raw]},scope));}catch{}
    }
  }
  const candidates=[];
  if(profile?.status!=='archived')for(const value of values){
    const result=normalizeBankInput(value,scope);if(!result.ok)continue;
    const r=result.record,{facts:f,provenance:p}=r;
    if(r.accountProfileId!==accountProfileId||r.channel!=='bank-api'||r.authority!=='enablebanking:ING:NL'||!p.accountHash||f.currency!=='EUR'||!['XPCD','ITAV','ITBD','CLBD'].includes(p.providerType))continue;
    if(({XPCD:'expected',ITAV:'available',ITBD:'booked',CLBD:'booked'})[p.providerType]!==f.balanceType)continue;
    const observed=f.observedAt||f.asOfDate+'T23:59:59Z';
    if(!Number.isFinite(Date.parse(p.fetchedAt))||!Number.isFinite(Date.parse(observed))||Date.parse(observed)>Date.parse(p.fetchedAt)||f.asOfDate>toDate||p.fetchedAt.slice(0,10)>toDate)continue;
    candidates.push({source:'external',accountProfileId,accountHash:p.accountHash,balanceCents:f.amountCents,balanceType:f.balanceType,boundary:f.boundary,providerType:p.providerType,observedAt:f.observedAt,asOfDate:f.asOfDate,fetchedAt:p.fetchedAt,authority:r.authority,observationId:r.identity.id,sortAt:observed});
  }
  candidates.sort((a,b)=>Date.parse(b.sortAt)-Date.parse(a.sortAt)||Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt)||(['XPCD','ITAV','ITBD','CLBD'].indexOf(a.providerType)-['XPCD','ITAV','ITBD','CLBD'].indexOf(b.providerType)));
  const selected=candidates[0];
  const conflict=selected&&candidates.some(c=>c.sortAt===selected.sortAt&&c.fetchedAt===selected.fetchedAt&&c.providerType===selected.providerType&&c.balanceCents!==selected.balanceCents);
  if(selected&&!conflict)return selected;
  return {...selectAccountBalance(state,options),source:'reconstruction',externalConflict:!!conflict};
}

export function attachCurrentBalance(state, options, projection){
  if(projection.horizon?.endDate<options.asOfDate)return projection;
  const current=selectCurrentAccountBalance(state,{...options,toDate:options.asOfDate});
  return {...projection,externalCurrentBalance:current,
    forecastNotice:current.source==='external'&&['expected','available'].includes(current.balanceType)
      ? 'De prognose begint bij de laatst ontvangen ING-stand. Een betaling kan hierin al verwerkt zijn terwijl de vaste last nog gepland staat. Totdat de transactie verwerkt en gekoppeld is, kan de prognose tijdelijk te voorzichtig zijn.' : null};
}
