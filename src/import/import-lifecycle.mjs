import { assertNoDuplicateSources } from './import-identity.mjs';
import { isTransactionFinanciallyActive, getTransactionProcessingStatus } from '../core/transaction-model.mjs';
import { validateTransactionProcessing, coverageAllocationStatus, selectTransactionProjections, confirmInternalTransferPair } from '../core/transaction-engine.mjs';
import { synchronizeChangedSavings, assertFinancialMutationSafe } from '../core/transaction-processing.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const batchRows=(state,id)=>(state.transactions||[]).filter(tx=>tx.importBatchId===id);
const belongs=(row,id,ids)=>row.importBatchId===id||ids.has(row.transactionId)||ids.has(row.sourceTransactionId);
export function batchLifecycle(batch){return batch.lifecycle|| (batch.status==='teruggedraaid'?'withdrawn':'active');}
export function deriveBatchReviewStatus(batch){
  const counts={onbekend:0,nakijken:0,goedgekeurd:0,'niet-meetellen':0,errors:0,duplicates:0};
  for(const row of batch.rows||[]){if(row.duplicate){counts.duplicates++;continue;}if(row.importError||!row.bankOriginal?.valid){counts.errors++;continue;}counts[getTransactionProcessingStatus({...row,source:'csv'})]++;}
  return {counts,status:counts.onbekend||counts.nakijken?counts.goedgekeurd||counts['niet-meetellen']?'gedeeltelijk':'concept':'verwerkt'};
}
function fail(message,code='import-dependency'){const error=new Error(message);error.code=code;throw error;}
export function validateBatchCandidate(previous,next,batch,{validateRow=()=>({ok:true,errors:[]})}={}){
  assertNoDuplicateSources(previous,next);
  assertFinancialMutationSafe(previous,next);
  const rows=batchRows(next,batch.id),active=rows.filter(isTransactionFinanciallyActive),ids=new Set(active.map(tx=>tx.id));
  const sourceIds=new Set(active.map(tx=>tx.importTransactionId));
  for(const id of sourceIds){const source=batch.rows.find(row=>row.id===id);if(!source)fail(`Importbron ${id} ontbreekt; herstel is geblokkeerd.`);const check=validateRow(source,next);if(!check.ok)fail(check.errors.map(e=>e.message).join(' '));}
  for(const tx of active){if(!tx.importTransactionId||!tx.bankOriginal)fail(`Betrouwbare bronidentiteit ontbreekt voor ${tx.id}.`);if(!Number.isFinite(Number(tx.amount)))fail(`Verwerkt bedrag ontbreekt voor ${tx.id}.`);}
  const missing=coverageAllocationStatus(next).find(row=>row.reason==='coverage-missing-reference'&&(ids.has(row.withdrawalTransactionId)||ids.has(row.expenseTransactionId)));if(missing)fail('Spaardekking verwijst naar een verwijderd endpoint. Herstel is geblokkeerd.');
  for(const pair of next.internalTransferPairs||[]){if(pair.active===false||!['bevestigd','confirmed','uitgevoerd'].includes(pair.status))continue;const old=(previous.internalTransferPairs||[]).find(row=>row.id===pair.id);if(JSON.stringify(old)!==JSON.stringify(pair))confirmInternalTransferPair(copy(next),pair.id);}
  const coverage=coverageAllocationStatus(next).find(row=>row.reason&& !['coverage-inactive-reference'].includes(row.reason));
  // Existing inactive allocations are history. Activation cannot create a newly invalid allocation.
  if(coverage&&!coverageAllocationStatus(previous).some(old=>old.id===coverage.id&&old.reason===coverage.reason))fail(`Spaardekking is ongeldig: ${coverage.reason}.`);
  for(const relation of next.manualTransactionReplacements||[]){if(relation.active===false)continue;const manualId=relation.manualTransactionId||relation.manualTransaction?.id;if((next.manualTransactionReplacements||[]).filter(r=>r.active!==false&&(r.manualTransactionId||r.manualTransaction?.id)===manualId).length>1)fail(`De handmatige transactie ${manualId} heeft twee actieve vervangingen.`);}
  for(const repayment of next.advanceRepayments||[]){if(repayment.active===false||!ids.has(repayment.transactionId))continue;const advance=(next.advanceLedger||[]).find(row=>row.id===repayment.advanceId&&row.active!==false);if(!advance)fail(`Voorschot ${repayment.advanceId} ontbreekt of is inactief.`);}
  return true;
}
// Pure command planner. The caller supplies operation identity/time; reads never create metadata.
export function planImportCommand(state,batch,intent,options={}){
  if(!batch?.id||!intent?.operationId)fail('Batch-ID en operation-ID zijn vereist.');
  const previous=copy(state),candidate=copy(state),nextBatch=copy(batch),id=batch.id;
  const deletion=(candidate.importDeletionProofs||[]).find(row=>row.id===id);
  if(deletion){if(intent.type==='delete')return {state:candidate,batch:copy(deletion),noop:true};fail('Deze batch is permanent verwijderd.','import-deleted');}
  const current=batchLifecycle(batch);
  if(intent.type==='withdraw'&&current==='withdrawn'||intent.type==='restore'&&current==='active')return {state:candidate,batch:nextBatch,noop:true};
  if(!['withdraw','restore','delete'].includes(intent.type))fail('Onbekende batchactie.');
  const rows=batchRows(candidate,id),ids=new Set(rows.map(tx=>tx.id));
  // Refuse unverifiable legacy ownership; no guessing by date, amount or description.
  if(rows.some(tx=>!tx.importTransactionId||!tx.bankOriginal)|| rows.some(tx=>!batch.rows?.some(row=>row.id===tx.importTransactionId)))fail('Betrouwbare bronidentiteit ontbreekt; batchactie is geblokkeerd.');
  const ownAdvances=(candidate.advanceLedger||[]).filter(row=>belongs(row,id,ids));
  for(const advance of ownAdvances){if((candidate.advanceRepayments||[]).some(row=>row.active!==false&&row.advanceId===advance.id&&!ids.has(row.transactionId))||(advance.settlementTransferIds||[]).length)fail(`Voorschot ${advance.id} heeft onafhankelijke aflossingen/verrekeningen.`);}
  const restoring=intent.type==='restore';
  nextBatch.lifecycle=restoring?'active':'withdrawn';
  rows.forEach(tx=>{tx.batchLifecycle=nextBatch.lifecycle;});
  for(const relation of candidate.manualTransactionReplacements||[]){if(relation.importBatchId===id||relation.id?.startsWith(`replacement-${id}-`)||ids.has(relation.replacementTransactionId)){
    if(!restoring){relation.lifecycleWasActive=relation.active!==false;relation.active=false;}
    else if(relation.lifecycleWasActive!==false)relation.active=true;
  }}
  for(const pair of candidate.internalTransferPairs||[]){if(!(pair.transactionIds||[]).some(txId=>ids.has(txId)))continue;
    if(!restoring){if(pair.lifecycleWasActive===undefined)pair.lifecycleWasActive=pair.active!==false;pair.active=false;}
    else if(pair.lifecycleWasActive!==false&&(pair.transactionIds||[]).every(txId=>(candidate.transactions||[]).some(tx=>tx.id===txId&&isTransactionFinanciallyActive(tx))))pair.active=true;
  }
  if(restoring)for(const advance of ownAdvances)if(advance.lifecycleWasActive!==false)advance.active=true;
  for(const repayment of candidate.advanceRepayments||[]){if(!belongs(repayment,id,ids))continue;const advance=(candidate.advanceLedger||[]).find(row=>row.id===repayment.advanceId);
    if(!restoring&&repayment.active!==false){repayment.lifecycleWasActive=true;repayment.active=false;if(advance){advance.outstandingAmount=Math.round((Number(advance.outstandingAmount)+Number(repayment.amount))*100)/100;advance.status='open';}}
    else if(restoring&&repayment.lifecycleWasActive){if(!advance||advance.active===false||Number(advance.outstandingAmount)<Number(repayment.amount))fail(`Aflossing ${repayment.id} kan niet volledig worden hersteld.`);advance.outstandingAmount=Math.round((Number(advance.outstandingAmount)-Number(repayment.amount))*100)/100;advance.status=advance.outstandingAmount===0?'voldaan':'open';repayment.active=true;}
  }
  for(const advance of ownAdvances){if(!restoring){advance.lifecycleWasActive=advance.active!==false;advance.active=false;}else if(advance.lifecycleWasActive!==false)advance.active=true;}
  synchronizeChangedSavings(candidate,previous);
  if(intent.type==='delete'){
    candidate.transactions=(candidate.transactions||[]).filter(tx=>!ids.has(tx.id));
    candidate.savingsGoalLedger=(candidate.savingsGoalLedger||[]).filter(row=>row.source==='planned'||!belongs(row,id,ids));
    for(const row of candidate.savingsGoalLedger){if(row.source==='planned'&&ids.has(row.transactionId)){row.transactionId='';row.actualAmount=null;row.status='gepland';row.processingHistory=(row.processingHistory||[]).filter(entry=>!ids.has(entry.transactionId));}}
    candidate.advanceLedger=(candidate.advanceLedger||[]).filter(row=>!belongs(row,id,ids));candidate.advanceRepayments=(candidate.advanceRepayments||[]).filter(row=>!belongs(row,id,ids));
    candidate.manualTransactionReplacements=(candidate.manualTransactionReplacements||[]).filter(row=>!(row.importBatchId===id||row.id?.startsWith(`replacement-${id}-`)||ids.has(row.replacementTransactionId)));
    candidate.internalTransferPairs=(candidate.internalTransferPairs||[]).filter(row=>!(row.transactionIds||[]).some(txId=>ids.has(txId)));
    candidate.savingsCoverageAllocations=(candidate.savingsCoverageAllocations||[]).filter(row=>!ids.has(row.withdrawalTransactionId)&&!ids.has(row.expenseTransactionId));
    candidate.importSummaries=(candidate.importSummaries||[]).filter(row=>row.id!==id);
    const proof={id,version:Number(batch.version||0)+1,deletedAt:intent.timestamp,deletedBy:intent.deviceId||'',operationId:intent.operationId,lifecycle:'deleted'};
    candidate.importDeletionProofs=[...(candidate.importDeletionProofs||[]).filter(row=>row.id!==id),proof];
    if(candidate.activeImportId===id)candidate.activeImportId='';
    assertFinancialMutationSafe(previous,candidate);return {state:candidate,batch:proof,deleted:true};
  }
  if(restoring)validateBatchCandidate(previous,candidate,nextBatch,options);else assertFinancialMutationSafe(previous,candidate);
  nextBatch.version=Number(batch.version||0)+1;nextBatch.operationId=intent.operationId;nextBatch.updatedAt=intent.timestamp;
  nextBatch.status=restoring?deriveBatchReviewStatus(nextBatch).status:'teruggedraaid';
  const summary=(candidate.importSummaries||[]).find(row=>row.id===id);if(summary)Object.assign(summary,{lifecycle:nextBatch.lifecycle,status:nextBatch.status,version:nextBatch.version,operationId:intent.operationId});
  if(candidate.activeImportId===id&&!restoring)candidate.activeImportId='';
  return {state:candidate,batch:nextBatch,noop:false};
}
