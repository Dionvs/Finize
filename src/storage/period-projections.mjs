import { encodeHouseholdState } from './household-store.mjs';
import { backupDigest } from './migration-backups.mjs';
import { transactionSourceKey, selectTransactionProjections, categoryFinancialActuals, financialForecastForMonth, sumTransactionEffects, sumProjectionEffects } from '../core/transaction-engine.mjs';
import { profileCount } from './performance.mjs';
import { selectBankTransactions } from '../core/bank-sources.mjs';

export const PERIOD_PROJECTION_VERSION=1;
export const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const digest=value=>backupDigest(typeof value==='string'?value:canonical(value));
export const storageError=(code,message)=>Object.assign(new Error(message),{code,storageFailure:true});
const validMonth=month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const dimensions=['accountCashflow','externalHouseholdCashflow','incomeImpact','realExpense','budgetImpact','fixedRealization','savingsDeposit','savingsWithdrawal','goalDelta','savingsFunded','unusedSavings','refundCashflow','advanceRepaymentEffect'];
const cents=value=>Math.round(Number(value)*100);

// Projections are disposable results of the existing engine. Records remain authoritative.
export function periodFinancials(state,month,{applicationProjection}={}){
  if(!validMonth(month))throw storageError('invalid-period','Ongeldige financiële periode.');
  const totalsCents=Object.fromEntries(dimensions.map(dimension=>[dimension,cents(sumTransactionEffects(state,dimension,{month}))]));
  const categories=Object.fromEntries(['gezamenlijk','dion','dara'].map(owner=>[owner,categoryFinancialActuals(state,month,owner)]));
  const forecast=financialForecastForMonth(state,month);
  return {version:PERIOD_PROJECTION_VERSION,month,totalsCents,categories,forecast,
    bankSourceCount:selectBankTransactions(state,{month}).length,
    approvedEffectCount:selectTransactionProjections(state,{month}).length,
    monthRecord:structuredClone(state.monthRecords?.[month]||null),
    application:applicationProjection?applicationProjection(state,month):null};
}

export function transactionPeriodDependencies(state,months){
  const records=encodeHouseholdState(state).records.filter(row=>row.collection==='transactions');
  const byId=new Map(records.map(row=>[row.recordId,row])),groups=new Map();
  for(const row of records){const key=transactionSourceKey(row.value);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row.recordId);}
  // Preserve every matching expense as an explicit refund dependency, including
  // variable expenses. Unrelated movements and other refunds cannot extend this
  // graph into the complete history.
  const projections=selectTransactionProjections(state),fixedContexts=new Map(),refundEdges=new Map();
  const contextKey=(owner,month,category)=>JSON.stringify([owner,month,String(category||'').trim().toLocaleLowerCase('nl-NL')]);
  for(const p of projections)if(p.effects.realExpense>0){const key=contextKey(p.financialFor,p.fixedMonth||p.calendarMonth,p.budgetCategory);if(!fixedContexts.has(key))fixedContexts.set(key,new Set());fixedContexts.get(key).add(p.sourceKey);}
  for(const p of projections)if(p.effects.refundCashflow&&p.refundMonth){if(!refundEdges.has(p.sourceKey))refundEdges.set(p.sourceKey,new Set());for(const key of fixedContexts.get(contextKey(p.financialFor,p.refundMonth,p.refundCategory))||[])refundEdges.get(p.sourceKey).add(key);}
  const links=[...(state.internalTransferPairs||[]).map(row=>row.transactionIds||[]),...(state.savingsCoverageAllocations||[]).map(row=>[row.withdrawalTransactionId,row.expenseTransactionId]),...(state.manualTransactionReplacements||[]).map(row=>[row.manualTransactionId||row.manualTransaction?.id,row.importedTransactionId||row.importTransactionId])];
  return new Map(months.map(month=>{
    const selected=new Set(records.filter(row=>row.periods.includes(month)).map(row=>row.recordId));let previous=-1;
    while(previous!==selected.size){previous=selected.size;
      for(const id of [...selected]){
        const row=byId.get(id);if(!row)continue;
        for(const sibling of groups.get(transactionSourceKey(row.value))||[])selected.add(sibling);
        for(const key of refundEdges.get(transactionSourceKey(row.value))||[])for(const other of groups.get(key)||[])selected.add(other);
      }
      for(const ids of links)if(ids.some(id=>selected.has(id)))for(const id of ids)if(byId.has(id))selected.add(id);
    }
    return [month,selected];
  }));
}

export function financialPeriods(state,extra=[]){
  return [...new Set([...extra,state.meta?.selectedMonth,...encodeHouseholdState(state).records.flatMap(row=>row.periods),...Object.keys(state.monthRecords||{}),...(state.savingsGoalLedger||[]).map(row=>row.month),...(state.monthCorrections||[]).map(row=>row.month)].filter(month=>validMonth(String(month))))].sort();
}

export function cumulativeFinancials(state){
  profileCount('financial.cumulativeCalls');
  // All dimensions read the same complete, synchronous engine result. This is
  // local preparation only; partial-history totals retain their proof route.
  const projections=state.__finizePartialHistory?null:selectTransactionProjections(state);
  const goals=structuredClone(state.spaardoelen||{});
  // Asset bytes live in multipart canonical records, not the financial summary document.
  for(const values of Object.values(goals))if(Array.isArray(values))for(const goal of values)if(goal&&typeof goal==='object')delete goal.afbeelding;
  return {version:PERIOD_PROJECTION_VERSION,
    totalsCents:Object.fromEntries(dimensions.map(dimension=>[dimension,cents(projections?sumProjectionEffects(projections,dimension):sumTransactionEffects(state,dimension))])),
    goals,
    bankSourceCount:selectBankTransactions(state).length,
    approvedEffectCount:(projections||selectTransactionProjections(state)).length};
}

export async function verifiedPeriodResult(head,document,records,globalDocument){
  if(!head||head.phase!=='ready')throw storageError('cloud-pending','De cloudpublicatie is nog niet volledig bevestigd.');
  if(!document||document.projectionVersion!==PERIOD_PROJECTION_VERSION||head.periodHashes?.[document.month]!==await digest(document))throw storageError('period-incomplete','De financiële periode ontbreekt of is niet geverifieerd. Ontbrekende historie is geen nul.');
  if(!globalDocument||head.globalHash!==await digest(globalDocument))throw storageError('period-incomplete','De cumulatieve financiële projectie ontbreekt.');
  const actual=records.map(row=>({id:row.id,hash:row.hash})).sort((a,b)=>a.id.localeCompare(b.id));
  if(canonical(actual)!==canonical(document.dependencies))throw storageError('period-incomplete','Een vereiste bankbron, effectregel of historische afhankelijkheid ontbreekt.');
  for(const record of records)if(await digest(record.payload)!==record.hash)throw storageError('record-integrity','Een financieel record heeft een afwijkende hash.');
  return {month:document.month,epoch:head.epoch,revision:head.revision,verified:true,financials:JSON.parse(document.payload),cumulative:JSON.parse(globalDocument.payload),records:structuredClone(records),recordCount:records.length,fullHistoryLoaded:false};
}
