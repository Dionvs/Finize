import { csvFileDigest, validCalendarDate } from './import-identity.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
export function bankImportDeletionProof(value){
  if(value?.lifecycle!=='deleted'||typeof value.id!=='string'||!Number.isSafeInteger(value.version)||value.version<1||typeof value.operationId!=='string'||!value.operationId)fail('bank-import-restart-blocked');
  return {id:value.id,version:value.version,operationId:value.operationId,lifecycle:'deleted'};
}
export function nextProviderBatchId(rootId,deletion){
  const proof=bankImportDeletionProof(deletion);
  if(!/^bank-api-[a-f0-9]{32}$/.test(rootId)||proof.id!==rootId&&!new RegExp('^'+rootId+'-g[a-f0-9]{32}$').test(proof.id))fail('bank-import-restart-blocked');
  return rootId+'-g'+csvFileDigest(JSON.stringify([proof.id,proof.version,proof.operationId])).slice(0,32);
}
export function providerImportIdentity(rootId,previous,restartFrom=null){
  const parent=restartFrom||previous?.providerRestartFrom;
  const id=parent?nextProviderBatchId(rootId,parent):rootId;
  if(previous&&(previous.id!==id||parent&&previous.providerRootId!==rootId))fail('provider-batch-conflict');
  if(restartFrom&&previous)fail('provider-batch-conflict');
  return {id,...(parent?{providerRootId:rootId,providerRestartFrom:bankImportDeletionProof(parent)}:{})};
}
export function assertProviderRestartParent(expected,actual){
  if(actual?.lifecycle!=='deleted'||actual.id!==expected.id||actual.version!==expected.version||actual.operationId!==expected.operationId)fail('import-conflict');
}
function references(value,id){
  if(typeof value==='string'){
    // Parse the full bank batch token; a child generation is a different import.
    const replacement=value.match(/^replacement-(bank-api-[a-f0-9]{32}(?:-g[a-f0-9]{32})?)-/);
    return value===id||value.includes(id+':')||replacement?.[1]===id;
  }
  if(!value||typeof value!=='object')return false;
  return Object.values(value).some(child=>references(child,id));
}
function ruleReferences(rule,id){
  const origin=rule?.provenance;
  const timestamp=origin?.approvedAt;
  const validTime=typeof timestamp==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)&&validCalendarDate(timestamp.slice(0,10))&&Number.isFinite(Date.parse(timestamp));
  const historical=origin?.kind==='manual-approval'&&typeof origin.sourceRowId==='string'&&origin.sourceRowId.trim()&&origin.sourceRowId===origin.sourceRowId.trim()&&validTime&&Object.keys(origin).every(key=>['kind','sourceRowId','importBatchId','approvedAt'].includes(key));
  if(!historical)return references(rule,id);
  // This one field records the learned rule's origin. It grants no approval or source link.
  return Object.entries(rule).some(([key,value])=>key==='provenance'
    ?Object.entries(value).some(([field,child])=>!(field==='importBatchId'&&child===id)&&references(child,id))
    :references(value,id));
}
function financialReferences(state,id,{ruleOrigins=false}={}){
  if(!state||typeof state!=='object')return references(state,id);
  return Object.entries(state).some(([key,value])=>key==='importDeletionProofs'?false:
    ruleOrigins&&key==='recognitionRules'&&Array.isArray(value)?value.some(rule=>ruleReferences(rule,id)):references(value,id));
}
/** Pure guard: a deletion receipt is retained; no financial history is reconstructed. */
export function assertProviderRestartState(state,deletion,{journals=[],queue=[]}={}){
  const proof=bankImportDeletionProof(deletion),stored=(state.importDeletionProofs||[]).filter(row=>row.id===proof.id);
  if(stored.length!==1)fail('bank-import-restart-blocked');
  assertProviderRestartParent(proof,stored[0]);
  if(financialReferences(state,proof.id,{ruleOrigins:true}))fail('bank-import-restart-blocked');
  if(journals.some(entry=>['pending','conflict','uncertain'].includes(entry.status)&&(entry.importId===proof.id||financialReferences(entry.candidate,proof.id)||financialReferences(entry.localChoice?.state,proof.id))))fail('bank-import-restart-blocked');
  if(queue.some(entry=>(entry.importId||entry.id)===proof.id&&(entry.version!==proof.version||entry.operationId!==proof.operationId)))fail('bank-import-restart-blocked');
  return proof;
}
