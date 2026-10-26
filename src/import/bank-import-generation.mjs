import { csvFileDigest } from './import-identity.mjs';

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
  if(typeof value==='string')return value===id||value.includes(id+':');
  if(!value||typeof value!=='object')return false;
  return Object.entries(value).some(([key,child])=>key!=='importDeletionProofs'&&references(child,id));
}
/** Pure guard: a deletion receipt is retained; no financial history is reconstructed. */
export function assertProviderRestartState(state,deletion,{journals=[],queue=[]}={}){
  const proof=bankImportDeletionProof(deletion),stored=(state.importDeletionProofs||[]).filter(row=>row.id===proof.id);
  if(stored.length!==1)fail('bank-import-restart-blocked');
  assertProviderRestartParent(proof,stored[0]);
  if(references(state,proof.id))fail('bank-import-restart-blocked');
  if(journals.some(entry=>['pending','conflict','uncertain'].includes(entry.status)&&(entry.importId===proof.id||references(entry.candidate,proof.id)||references(entry.localChoice?.state,proof.id))))fail('bank-import-restart-blocked');
  if(queue.some(entry=>(entry.importId||entry.id)===proof.id&&(entry.version!==proof.version||entry.operationId!==proof.operationId)))fail('bank-import-restart-blocked');
  return proof;
}
