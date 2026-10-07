import { expenseCategoriesForMonth } from './planning-timeline.mjs';
import { plannedOccurrences } from './recurring-occurrences.mjs';
import { markManualTransaction, getTransactionClassification, getTransactionProcessingStatus, getTransactionSource, getTransactionAccountContext, getTransactionFinancialDestination, getTransactionDate, ACCOUNT_CONTEXTS } from './transaction-model.mjs';
import { transactionSourceKey, projectTransaction, selectTransactionProjections, validateTransactionProcessing, refundCategoryIsRecognizable, validateSavingsCoverageAllocation, coverageAllocationStatus, coverageMessage, confirmInternalTransferPair } from './transaction-engine.mjs';
import { calculateGoalSavedAmount, allGoals, reconcileGoalSavedAmounts } from './data-normalization.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
// Adopt a validated clone while retaining objects held by existing editor callbacks.
export function applyFinancialCandidate(target,candidate){
  if(Array.isArray(target)&&Array.isArray(candidate)){
    const ids=new Map(target.filter(row=>row&&typeof row==='object'&&row.id).map(row=>[row.id,row]));
    const rows=candidate.map((row,index)=>{const old=row?.id?ids.get(row.id):target[index];if(old&&row&&typeof old==='object'&&typeof row==='object'&&Array.isArray(old)===Array.isArray(row)){applyFinancialCandidate(old,row);return old;}return row;});target.splice(0,target.length,...rows);return target;
  }
  for(const key of Object.keys(target))if(!(key in candidate))delete target[key];
  for(const [key,value] of Object.entries(candidate)){const old=target[key];if(old&&value&&typeof old==='object'&&typeof value==='object'&&Array.isArray(old)===Array.isArray(value))applyFinancialCandidate(old,value);else target[key]=value;}
  return target;
}
// Explicit source commands only: never called by a render, normalize or migration.
function reopenSourceInPlace(state,importId,rowId,{dryRun=false}={}) {
  const rows=(state.transactions||[]).filter(tx=>tx.importBatchId===importId&&tx.importTransactionId===rowId),ids=new Set(rows.map(tx=>tx.id));
  if(!rows.length)return {transactionIds:[],goalIds:[]};
  const advances=(state.advanceLedger||[]).filter(entry=>ids.has(entry.transactionId)&&entry.active!==false);
  if(advances.some(advance=>(state.advanceRepayments||[]).some(entry=>entry.advanceId===advance.id&&entry.active!==false&&!ids.has(entry.transactionId))))throw new Error('Dit voorschot heeft latere aflossingen. Heropening is geblokkeerd om die administratie te behouden.');
  if(advances.some(advance=>(advance.settlementTransferIds||[]).length))throw new Error('Dit voorschot heeft uitgevoerde verrekeningen. Heropening vereist eerst een expliciete correctie daarvan.');
  const goalIds=[...new Set((state.savingsGoalLedger||[]).filter(entry=>ids.has(entry.transactionId)&&entry.source!=='planned').map(entry=>entry.goalId))];
  if(dryRun)return {transactionIds:[...ids],goalIds};
  rows.forEach(tx=>{
    if(tx.processingStatus==='nakijken')return;
    tx.approvalHistory=tx.approvalHistory||[];
    tx.approvalHistory.push({approvalSource:tx.approvalSource||'',approvedAt:tx.approvedAt||'',certainty:tx.certainty||'',processing:copy(tx.processing||{})});
    tx.processingStatus='nakijken';tx.reviewStatus='nakijken';tx.certainty='nakijken';tx.approvalSource='';tx.approvedAt='';
  });
  (state.savingsGoalLedger||[]).filter(entry=>ids.has(entry.transactionId)&&entry.source!=='planned').forEach(entry=>{entry.active=false;entry.status='heropend';});
  (state.savingsGoalLedger||[]).filter(entry=>entry.source==='planned'&&ids.has(entry.transactionId)).forEach(entry=>{
    entry.processingHistory=[...(entry.processingHistory||[]),{transactionId:entry.transactionId,actualAmount:entry.actualAmount,status:entry.status}];
    entry.transactionId='';entry.actualAmount=null;entry.status='gepland';
  });
  advances.forEach(entry=>{entry.active=false;});
  (state.advanceRepayments||[]).filter(entry=>ids.has(entry.transactionId)&&entry.active!==false).forEach(entry=>{
    const advance=(state.advanceLedger||[]).find(item=>item.id===entry.advanceId);
    if(advance){advance.outstandingAmount=money(Number(advance.outstandingAmount)+Number(entry.amount));advance.status='open';advance.repaymentAllocationIds=(advance.repaymentAllocationIds||[]).filter(id=>id!==entry.id);}
    entry.active=false;entry.status='heropend';
  });
  (state.internalTransferPairs||[]).filter(pair=>(pair.transactionIds||[]).some(id=>ids.has(id))).forEach(pair=>{if(['bevestigd','confirmed','uitgevoerd'].includes(pair.status))pair.confirmationHistory=[...(pair.confirmationHistory||[]),{status:pair.status,transactionIds:copy(pair.transactionIds)}];pair.status='voorgesteld';});
  reconcileGoalSavedAmounts(state,goalIds);
  return {transactionIds:[...ids],goalIds};
}
function replaceSourceInPlace(state,importId,rowId,newRows) {
  const old=(state.transactions||[]).filter(tx=>tx.importBatchId===importId&&tx.importTransactionId===rowId);
  const indices=old.map(tx=>state.transactions.indexOf(tx)),insert=indices.length?Math.min(...indices):state.transactions.length;
  const oldById=new Map(old.map(tx=>[tx.id,tx]));
  const sourceHistory=[...new Map(old.flatMap(tx=>[...(tx.sourceApprovalHistory||[]),...(tx.approvalHistory||[])]).map(entry=>[JSON.stringify(entry),entry])).values()];
  state.transactions=(state.transactions||[]).filter(tx=>!(tx.importBatchId===importId&&tx.importTransactionId===rowId));
  const next=newRows.map(tx=>({...tx,...(oldById.get(tx.id)?.approvalHistory?{approvalHistory:copy(oldById.get(tx.id).approvalHistory)}:{})}));
  if(next.length&&sourceHistory.length)next[0].sourceApprovalHistory=copy(sourceHistory);
  state.transactions.splice(insert,0,...copy(next));
  const replacementId=next.find(tx=>tx.processingStatus==='goedgekeurd')?.id||next[0]?.id;
  if(replacementId)(state.internalTransferPairs||[]).filter(pair=>(pair.transactionIds||[]).some(id=>oldById.has(id))).forEach(pair=>{pair.transactionIds=[...new Set(pair.transactionIds.map(id=>oldById.has(id)?replacementId:id))];pair.status='voorgesteld';});
  return next;
}


export function assertFinancialMutationSafe(previous,next){
  const previousBalances=new Map(allGoals(previous).map(({goal})=>[goal.id,calculateGoalSavedAmount(previous,goal.id)]));
  allGoals(next).forEach(({goal})=>{const balance=calculateGoalSavedAmount(next,goal.id);if(balance<0&&balance!==previousBalances.get(goal.id))throw new Error(`De wijziging maakt spaardoel “${goal.naam||goal.id}” negatief (${money(balance)}). Corrigeer eerst de afhankelijke spaarbewegingen.`);});
  const codes=new Set(['coverage-exceeds-withdrawal','coverage-exceeds-expense','coverage-cents']);
  const errors=coverageAllocationStatus(next).filter(row=>codes.has(row.reason));
  if(errors.length)throw new Error(coverageMessage(errors[0].reason));
  const refund=selectTransactionProjections(next).find(p=>p.diagnostics.some(d=>d.code==='refund-exceeds-category'));
  if(refund)throw new Error(`Refunds zijn hoger dan de resterende categoriebelasting voor ${refund.refundCategory} in ${refund.refundMonth}. Pas eerst de refund of spaardekking aan.`);
}
export function reopenTransactionSource(state,importId,rowId,options={}){
  if(!importId||!rowId)throw new Error('Een betrouwbare import- en bronverwijzing is vereist.');
  const candidate=copy(state),result=reopenSourceInPlace(candidate,importId,rowId,{dryRun:false});
  assertFinancialMutationSafe(state,candidate);
  if(!options.dryRun){const oldById=new Map((state.transactions||[]).map(tx=>[tx.id,tx]));candidate.transactions=(candidate.transactions||[]).map(tx=>{const old=oldById.get(tx.id);if(old){Object.assign(old,tx);return old;}return tx;});applyFinancialCandidate(state,candidate);}return result;
}
export function replaceProcessedSourceRows(state,importId,rowId,rows){
  const candidate=copy(state),result=replaceSourceInPlace(candidate,importId,rowId,rows);
  assertFinancialMutationSafe(state,candidate);applyFinancialCandidate(state,candidate);return result;
}
// Compose explicit source changes on one clone; validate the complete result, never partial UI states.
export function commitProcessedSourceGroup(state,importId,{reopenIds=[],replacements=[]}={},applyEffects=()=>{}){
  if(!importId)throw new Error('Een betrouwbare importverwijzing is vereist.');
  const candidate=copy(state);
  for(const id of reopenIds)reopenSourceInPlace(candidate,importId,id);
  for(const replacement of replacements)replaceSourceInPlace(candidate,importId,replacement.rowId,replacement.rows);
  applyEffects(candidate);
  synchronizeChangedSavings(candidate,state);
  assertFinancialMutationSafe(state,candidate);
  applyFinancialCandidate(state,candidate);
  return state;
}
export function createTransactionSavingsEntry(tx,state){
  const type=getTransactionClassification(tx),goalId=tx.savingsGoalId||tx.processing?.savingsGoalId;
  if(!['sparen','naar-spaarrekening','van-spaarrekening'].includes(type)||!goalId||getTransactionProcessingStatus(tx)!=='goedgekeurd')return null;
  if(!allGoals(state).some(({goal})=>goal.id===goalId))return null;
  const month=String(tx.transactionDate||tx.bankOriginal?.bankDate||tx.date||'').slice(0,7),amount=money(Math.abs(Number(tx.amount??tx.processing?.processedAmount)||0))*(type==='van-spaarrekening'?-1:1);
  const candidates=(state.savingsGoalLedger||[]).filter(entry=>entry.goalId===goalId&&entry.month===month&&entry.active!==false&&!entry.transactionId&&entry.source==='planned');
  const planned=amount>0?(candidates.find(entry=>Math.abs(Number(entry.plannedAmount||entry.effectiveAmount)-amount)<=.01)||(candidates.length===1?candidates[0]:null)):null;
  return {id:`saving-${tx.id}`,transactionId:tx.id,sourceTransactionId:tx.sourceTransactionId||'',importBatchId:tx.importBatchId||'',goalId,month,plannedAmount:0,actualAmount:amount,effectiveAmount:amount,matchedContributionId:planned?.id||'',status:planned&&Math.abs(amount-Number(planned.plannedAmount||0))>.004?'afwijkend':'uitgevoerd',source:getTransactionSource(tx)==='manual'?'manual-transaction':planned?'bank-match':'bank-import',active:true,createdAt:tx.createdAt||tx.approvedAt||new Date(0).toISOString(),updatedAt:tx.approvedAt||tx.createdAt||new Date(0).toISOString()};
}
// Only explicit transaction changes enter this service. Unchanged historical rows are untouched.
export function synchronizeChangedSavings(state,previous){
  const oldRows=new Map((previous.transactions||[]).map(tx=>[tx.id,tx])),newRows=new Map((state.transactions||[]).map(tx=>[tx.id,tx]));
  const changed=new Set([...oldRows.keys(),...newRows.keys()].filter(id=>JSON.stringify(oldRows.get(id))!==JSON.stringify(newRows.get(id))));
  if(JSON.stringify(state.manualTransactionReplacements)!==JSON.stringify(previous.manualTransactionReplacements))(state.manualTransactionReplacements||[]).forEach(row=>changed.add(row.manualTransactionId||row.manualTransaction?.id));
  const changedSources=new Set([...changed].flatMap(id=>[oldRows.get(id),newRows.get(id)].filter(Boolean).map(transactionSourceKey)));
  [...oldRows.values(),...newRows.values()].forEach(tx=>{if(changedSources.has(transactionSourceKey(tx)))changed.add(tx.id);});
  if(!changed.size)return [];
  const goals=new Set(),projection=selectTransactionProjections(state,{includeInactive:true});
  (state.savingsGoalLedger||[]).filter(entry=>(changed.has(entry.transactionId)||changed.has(entry.sourceTransactionId))&&entry.source!=='planned').forEach(entry=>{
    goals.add(entry.goalId);const p=projection.find(row=>row.id===entry.transactionId),tx=newRows.get(entry.transactionId)||p?.transaction;
    if(!tx||!p?.active||!p.savingsGoalId||!['sparen','naar-spaarrekening','van-spaarrekening'].includes(p.transactionType)){entry.active=false;entry.status=tx?'inactief':'teruggedraaid';}
  });
  projection.filter(p=>p.active&&(changed.has(p.id)||changed.has(p.transaction.sourceTransactionId))).forEach(p=>{
    const tx=p.transaction,id=p.id,next=createTransactionSavingsEntry(tx,state);if(!next)return;
    state.savingsGoalLedger=state.savingsGoalLedger||[];const old=state.savingsGoalLedger.find(entry=>entry.id===next.id||entry.transactionId===id&&entry.source!=='planned');
    if(old){
      goals.add(old.goalId);
      if(old.active!==false&&old.goalId===next.goalId&&old.month===next.month&&Number(old.actualAmount??old.effectiveAmount)===next.actualAmount)return;
      const matched=state.savingsGoalLedger.find(entry=>entry.id===old.matchedContributionId&&entry.transactionId===old.transactionId);
      if(matched){matched.transactionId='';matched.actualAmount=null;matched.status='gepland';}
      const history=[...(old.processingHistory||[]),copy({...old,processingHistory:undefined})];Object.assign(old,next,{id:old.id,createdAt:old.createdAt||next.createdAt,processingHistory:history});
    }else state.savingsGoalLedger.push(next);
    const planned=state.savingsGoalLedger.find(entry=>entry.id===next.matchedContributionId);if(planned){planned.transactionId=id;planned.actualAmount=next.actualAmount;planned.status=next.status;}
    goals.add(next.goalId);
  });
  reconcileGoalSavedAmounts(state,[...goals]);return [...goals];
}
export function setSavingsCoverageAllocation(state,allocation,{createdAt='',updatedBy=''}={}){
  if(!allocation.id)throw new Error('Een stabiel allocation-ID is vereist.');
  const candidate=copy(state);candidate.savingsCoverageAllocations=candidate.savingsCoverageAllocations||[];
  const existing=candidate.savingsCoverageAllocations.find(row=>row.id===allocation.id);
  const next={...(existing||{}),...copy(allocation),active:true,createdAt:existing?.createdAt||createdAt,updatedAt:createdAt,updatedBy};
  validateSavingsCoverageAllocation(candidate,next);
  if(existing){next.history=[...(existing.history||[]),copy({...existing,history:undefined})];Object.assign(existing,next);}else candidate.savingsCoverageAllocations.push(next);
  assertFinancialMutationSafe(state,candidate);applyFinancialCandidate(state,candidate);return next;
}
export function removeSavingsCoverageAllocation(state,id,{updatedAt='',updatedBy=''}={}){
  const candidate=copy(state),allocation=(candidate.savingsCoverageAllocations||[]).find(row=>row.id===id);if(!allocation)return;
  allocation.history=[...(allocation.history||[]),copy({...allocation,history:undefined})];allocation.active=false;allocation.updatedAt=updatedAt;allocation.updatedBy=updatedBy;
  assertFinancialMutationSafe(state,candidate);applyFinancialCandidate(state,candidate);
}
export function correctGoalBalance(state,goalId,amount,{id,createdAt='',updatedBy='',note='',month=''}={}){
  if(!id||!Number.isSafeInteger(Math.round(Number(amount)*100))||!Number.isFinite(Number(amount))||Number(amount)<0||Math.abs(Number(amount)*100-Math.round(Number(amount)*100))>1e-6)throw new Error('Vul een geldig niet-negatief saldo in gehele eurocenten in.');
  if(!allGoals(state).some(({goal})=>goal.id===goalId))throw new Error('Spaardoel ontbreekt.');
  if((state.savingsGoalLedger||[]).some(entry=>entry.id===id))return;
  const candidate=copy(state),before=calculateGoalSavedAmount(state,goalId),difference=money(Number(amount)-before);if(!difference)return;
  candidate.savingsGoalLedger=candidate.savingsGoalLedger||[];
  candidate.savingsGoalLedger.push({id,goalId,month,plannedAmount:0,actualAmount:null,effectiveAmount:difference,source:'manual-correction',transactionId:'',status:'uitgevoerd',active:true,balanceBefore:before,balanceAfter:money(amount),note,createdAt,updatedAt:createdAt,updatedBy});
  reconcileGoalSavedAmounts(candidate,[goalId]);assertFinancialMutationSafe(state,candidate);applyFinancialCandidate(state,candidate);
}
// Shared manual contract. The caller supplies the local calendar day in UI/tests.
export function localTransactionToday() {
  const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validTransactionDate(value) {
  if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(String(value)))return false;
  const [y,m,d]=value.split('-').map(Number),date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(12,0,0,0);
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function validateManualTransactionInput(state,tx,accountContext,{today=localTransactionToday(),existing=null}={}) {
  if(!tx.id)throw new Error('Een stabiel transactie-ID is vereist.');
  if(getTransactionSource(tx)==='csv'||existing&&getTransactionSource(existing)==='csv')throw new Error('CSV moet via de bronverwerking worden bewerkt.');
  if(!ACCOUNT_CONTEXTS.includes(accountContext))throw new Error('Een betrouwbare fysieke rekeningcontext ontbreekt.');
  if(existing&&getTransactionAccountContext(existing,{accountProfiles:state.accountProfiles||[]})!==accountContext)throw new Error('De fysieke rekening van een bestaande transactie mag niet worden gewijzigd of gegokt.');
  const date=getTransactionDate(tx);
  if(!validTransactionDate(date)||!validTransactionDate(today)||date>today)throw new Error('Vul een geldige transactiedatum van vandaag of in het verleden in.');
  if(!(Number(tx.amount)>0)||!Number.isFinite(Number(tx.amount))||!Number.isSafeInteger(Math.round(Number(tx.amount)*100))||Math.abs(Number(tx.amount)*100-Math.round(Number(tx.amount)*100))>1e-6)throw new Error('Vul een geldig positief bedrag in eurocenten in.');
  if(tx.splitId||(tx.splits?.length)||(tx.processing?.splits?.length))throw new Error('Handmatige transacties kunnen niet worden gesplitst.');
  const owner=getTransactionFinancialDestination(tx)||accountContext,type=getTransactionClassification(tx);
  const types=['uitgave','vaste-last','inkomen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten','sparen','naar-spaarrekening','van-spaarrekening','terugbetaling','refund','interne-overboeking','maandelijkse-bijdrage','extra-bijdrage','terugbetaling-voorschot'];
  if(!types.includes(type)&&!(existing&&getTransactionClassification(existing)===type))throw new Error('Kies een ondersteund transactietype.');
  if(!ACCOUNT_CONTEXTS.includes(owner))throw new Error('Een geldige financiële bestemming is vereist.');
  if(type==='uitgave'&&!tx.fixedExpenseId&&!tx.fixedOccurrenceId){
    const known=expenseCategoriesForMonth(state,date.slice(0,7),owner).includes(tx.category);
    const unchanged=existing&&existing.category===tx.category&&getTransactionDate(existing)===date&&getTransactionFinancialDestination(existing)===owner;
    if(!known&&!unchanged)throw new Error('Kies een actieve budgetcategorie voor de transactiemaand of Overig.');
  }
  const closed=month=>['afgesloten','correctie-nodig'].includes(state.monthRecords?.[month]?.status);
  if(closed(date.slice(0,7))||existing&&closed(getTransactionDate(existing).slice(0,7)))throw new Error('Deze maand is afgesloten. Heropen de maand of maak een correctie om financiële gegevens te wijzigen.');
  if((state.manualTransactionReplacements||[]).some(row=>row.active!==false&&(row.manualTransactionId||row.manualTransaction?.id)===tx.id))throw new Error('Deze handmatige transactie is vervangen door CSV. Bewerk de officiële importbron.');
  const p=tx.processing||tx,fixed=p.fixedExpenseId||tx.fixedExpenseId,month=p.fixedOccurrenceMonth||tx.fixedOccurrenceMonth||date.slice(0,7);
  const occurrences=fixed?plannedOccurrences(state.recurringFixedExpenses||[],month):null;
  const result=validateTransactionProcessing(tx,{fixedOccurrences:occurrences,goalExists:id=>allGoals(state).some(({goal})=>goal.id===id),refundCategoryExists:(category,refundMonth,destination)=>refundCategoryIsRecognizable(state,category,refundMonth,destination)});
  if(!result.ok)throw new Error(result.errors.map(error=>error.message).join(' '));
  const incomeId=p.incomeSourceId||tx.incomeSourceId;
  if(incomeId&&!(state.recurringIncomeSources||[]).some(row=>row.id===incomeId)&&incomeId!==(existing?.incomeSourceId||existing?.processing?.incomeSourceId))throw new Error('De gekoppelde inkomstenbron bestaat niet.');
  if(existing){
    const important=row=>JSON.stringify([getTransactionDate(row),Number(row.amount),getTransactionClassification(row),getTransactionFinancialDestination(row),row.fixedExpenseId||'',row.fixedOccurrenceId||'']);
    if(important(existing)!==important(tx)&&((state.advanceLedger||[]).some(row=>row.active!==false&&row.transactionId===tx.id)||(state.advanceRepayments||[]).some(row=>row.active!==false&&row.transactionId===tx.id)))throw new Error('Deze transactie heeft voorschot- of aflossingsadministratie. Corrigeer die afhankelijkheid eerst expliciet.');
  }
  return true;
}
export function assertManualCandidateSafe(previous,candidate,id){
  if(!(candidate.transactions||[]).some(row=>row.id===id)&&((previous.advanceLedger||[]).some(row=>row.active!==false&&row.transactionId===id)||(previous.advanceRepayments||[]).some(row=>row.active!==false&&row.transactionId===id)||(previous.manualTransactionReplacements||[]).some(row=>row.active!==false&&(row.manualTransactionId||row.manualTransaction?.id)===id)))throw new Error('Verwijderen is geblokkeerd door voorschot-, aflossings- of vervangingsadministratie. Corrigeer die afhankelijkheid eerst expliciet.');
  assertFinancialMutationSafe(previous,candidate);
  const old=coverageAllocationStatus(previous),invalid=coverageAllocationStatus(candidate).find(row=>row.reason&&row.reason!=='coverage-inactive-reference'&&!old.some(was=>was.id===row.id&&was.reason===row.reason));
  if(invalid)throw new Error(coverageMessage(invalid.reason));
  for(const pair of candidate.internalTransferPairs||[])if(pair.active!==false&&['bevestigd','confirmed','uitgevoerd'].includes(pair.status)&&(pair.transactionIds||[]).includes(id))confirmInternalTransferPair(copy(candidate),pair.id);
}
export function upsertManualFinancialTransaction(state,tx,accountContext,options={}){
  const previous=copy(state),existing=(state.transactions||[]).find(row=>row.id===tx.id),next={...copy(existing||{}),...copy(tx)};
  if(Object.hasOwn(tx,'date')&&Object.hasOwn(tx,'transactionDate')&&tx.date!==tx.transactionDate)throw new Error('De handmatige transactiedatums spreken elkaar tegen.');
  if(Object.hasOwn(tx,'date'))next.transactionDate=tx.date;
  else if(Object.hasOwn(tx,'transactionDate'))next.date=tx.transactionDate;
  if(next.processing){
    if(Object.hasOwn(tx,'amount')){
      if(existing?.processing?.processedAmount!==undefined&&Number(existing.processing.processedAmount)!==Number(existing.amount))throw new Error('Deze legacy handmatige transactie heeft een afwijkend verwerkt bedrag. Een expliciete correctie is vereist.');
      next.processing.processedAmount=next.amount;
    }
    const fields=['transactionType','category','budgetOwner','fixedExpenseId','fixedOccurrenceId','fixedOccurrenceMonth','incomeSourceId','savingsGoalId','refundCategory','refundMonth'];
    for(const field of fields)if(Object.hasOwn(tx,field))next.processing[field]=tx[field];
    if(Object.hasOwn(tx,'date')||Object.hasOwn(tx,'transactionDate'))next.processing.processingDate=next.transactionDate;
  }
  next.budgetOwner=next.budgetOwner||next.financialFor||next.owner||accountContext;next.financialFor=next.budgetOwner;next.owner=next.budgetOwner;
  validateManualTransactionInput(state,next,accountContext,{...options,existing});
  // Legacy manual cash/impact fields may be redundant, but never silently reinterpret
  // a non-equivalent legacy value when editing the amount/classification.
  if(existing&&(Number(existing.amount)!==Number(next.amount)||getTransactionClassification(existing)!==getTransactionClassification(next))){
    if(existing.accountDelta!==undefined){
      if(Math.abs(Number(existing.accountDelta))!==Math.abs(Number(existing.amount)))throw new Error('Deze legacy transactie heeft een afwijkende cashflowwaarde. Een expliciete correctie is vereist.');
      const incoming=['inkomen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten','van-spaarrekening','terugbetaling','refund'].includes(getTransactionClassification(next))||next.kind==='inkomen';
      next.accountDelta=Number(next.amount)*(incoming?1:-1);
    }
    if(existing.expenseImpact!==undefined){
      if(Number(existing.expenseImpact)!==Number(existing.amount))throw new Error('Deze legacy transactie heeft een afwijkende budgetimpact. Een expliciete correctie is vereist.');
      next.expenseImpact=Number(next.amount);
    }
  }
  markManualTransaction(next,accountContext);
  next.account=accountContext;next.accountOwner=accountContext;
  const candidate=copy(state);candidate.transactions=candidate.transactions||[];const index=candidate.transactions.findIndex(row=>row.id===next.id);
  if(index>=0)candidate.transactions[index]=next;else candidate.transactions.push(next);
  synchronizeChangedSavings(candidate,previous);assertManualCandidateSafe(previous,candidate,next.id);applyFinancialCandidate(state,candidate);return next;
}
