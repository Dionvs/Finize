import {savingsContributionCapacity,isSavingsIncomeSource} from './savings-contributions.mjs';

/** Amount is a search criterion, never identity proof. Only the existing eligible
 * incoming sources are considered, and the user still approves the chosen link. */
export function savingsLinkProposals(projections,{transactionType,month,owner,goalId,amountCents,excludeTransactionId}={}){
  if(!['sparen','naar-spaarrekening'].includes(transactionType)||!goalId||!Number.isSafeInteger(amountCents)||amountCents<=0)return [];
  const claims=new Map();
  for(const p of projections)if(p.active&&p.id!==excludeTransactionId&&p.savingsContribution){const c=p.savingsContribution;claims.set(c.sourceId,(claims.get(c.sourceId)||0)+c.amountCents);}
  return projections.filter(p=>p.active&&p.calendarMonth===month&&p.financialFor===owner&&p.effects.accountCashflow>0&&
    (isSavingsIncomeSource(p)||['interne-overboeking','extra-bijdrage'].includes(p.transactionType)&&p.transaction.processing?.contributionGoalId===goalId))
    .map(p=>({source:p,remainingCents:savingsContributionCapacity(p)-(claims.get(p.id)||0)}))
    .filter(p=>Number.isSafeInteger(p.remainingCents)&&p.remainingCents===amountCents)
    .sort((a,b)=>String(a.source.transaction.date||'').localeCompare(String(b.source.transaction.date||''))||a.source.id.localeCompare(b.source.id));
}
