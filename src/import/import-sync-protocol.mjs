const copy=value=>JSON.parse(JSON.stringify(value));
export const importVersion=record=>Number.isSafeInteger(Number(record?.version))?Number(record.version):0;
export function sameImportOperation(left,right){return !!left?.operationId&&left.operationId===right?.operationId&&importVersion(left)===importVersion(right);}
export function assertImportBase(remote,record){
 if(sameImportOperation(remote,record))return 'echo';
 if(remote?.lifecycle==='deleted')throw Object.assign(new Error('Deze import is permanent verwijderd op een ander apparaat.'),{code:'import-deleted'});
 if(importVersion(remote)!==Number(record.baseVersion||0))throw Object.assign(new Error('De cloudimport is intussen gewijzigd. De lokale keuze is veilig bewaard; kies expliciet welke verwerking behouden blijft.'),{code:'import-conflict'});
 return 'write';
}
export function pendingQueueReceipt(record){return {id:record.id,importId:record.id,version:importVersion(record),operationId:record.operationId||'',baseVersion:Number(record.baseVersion||0)};}
export function acknowledgeMatches(queued,uploaded){return queued?.operationId===uploaded?.operationId&&queued?.version===uploaded?.version;}
const sourceKey=tx=>tx.importBatchId&&tx.importTransactionId?tx.importBatchId+':'+tx.importTransactionId:null;
const signature=value=>JSON.stringify(value??null);
export function findImportConflicts(base,local,remote){
 const conflicts=[];
 const groups=state=>{const result=new Map();for(const tx of state?.transactions||[]){const key=sourceKey(tx);if(key){if(!result.has(key))result.set(key,[]);result.get(key).push(tx);}}return result;};
 const a=groups(base),b=groups(local),c=groups(remote);
 for(const key of new Set([...a.keys(),...b.keys(),...c.keys()])){if(signature(a.get(key))!==signature(b.get(key))&&signature(a.get(key))!==signature(c.get(key))&&signature(b.get(key))!==signature(c.get(key)))conflicts.push({kind:'source',sourceKey:key});}
 for(const field of ['importSummaries','importDeletionProofs','manualTransactionReplacements','internalTransferPairs','savingsCoverageAllocations']){
 const maps=[base,local,remote].map(state=>new Map((state?.[field]||[]).map(row=>[row.id,row])));
 for(const id of new Set(maps.flatMap(map=>[...map.keys()]))){const [x,y,z]=maps.map(map=>map.get(id));if(signature(x)!==signature(y)&&signature(x)!==signature(z)&&signature(y)!==signature(z))conflicts.push({kind:field,id});}
 }
 return conflicts;
}
export function mergeImportDetails(base,local,remote){
 if(remote.lifecycle==='deleted')return {record:copy(remote),conflicts:[{kind:'deleted',id:remote.id}]};
 const result=copy(remote),conflicts=[];
 const old=new Map((base?.rows||[]).map(row=>[row.id,row])),rows=new Map((remote.rows||[]).map(row=>[row.id,row]));
 if((local.lifecycle||'active')!==(base?.lifecycle||'active')&&(remote.lifecycle||'active')!==(base?.lifecycle||'active')&&local.lifecycle!==remote.lifecycle)conflicts.push({kind:'lifecycle',id:local.id});
 for(const row of local.rows||[]){if(signature(row)===signature(old.get(row.id)))continue;const cloud=rows.get(row.id);if(signature(cloud)!==signature(old.get(row.id))&&signature(row)!==signature(cloud))conflicts.push({kind:'source',id:row.id});else rows.set(row.id,copy(row));}
 result.rows=[...rows.values()];return {record:result,conflicts};
}
