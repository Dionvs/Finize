import { getTransactionAccountContext, getTransactionSource, getTransactionProcessingStatus } from './transaction-model.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
export const isBankSource=tx=>tx?.recordRole==='bank-source';
export const sourceRecordKey=tx=>tx.bankSourceId||(tx.importBatchId&&tx.importTransactionId?`${tx.importBatchId}:${tx.importTransactionId}`:tx.id);
export function bankSourceForImport(state,batchId,rowId){
  return (state.transactions||[]).find(tx=>isBankSource(tx)&&(tx.importReferences||[]).some(ref=>ref.batchId===batchId&&ref.rowId===rowId));
}
export function bankSourceForTransaction(state,tx){
  return (state.transactions||[]).find(source=>isBankSource(source)&&source.bankSourceId===tx.bankSourceId);
}
export function bankSourceActive(state,source,override=null){
  return (source.importReferences||[]).some(ref=>{
    const batch=override?.id===ref.batchId?override:(state.importSummaries||[]).find(batch=>batch.id===ref.batchId);
    if((state.importDeletionProofs||[]).some(proof=>proof.id===ref.batchId))return false;
    return batch?!['withdrawn','deleted'].includes(batch.lifecycle)&&batch.status!=='teruggedraaid':source.batchLifecycle!=='withdrawn';
  });
}
export function ensureImportBankSources(state,batch){
  state.transactions=state.transactions||[];
  for(const row of batch.rows||[]){
    if(!row.bankOriginal?.valid||row.importError)continue;
    let source=bankSourceForImport(state,batch.id,row.id)||state.transactions.find(tx=>isBankSource(tx)&&row.bankSourceId&&tx.bankSourceId===row.bankSourceId);
    const ref=row.duplicateSource;
    let legacy=state.transactions.filter(tx=>!isBankSource(tx)&&tx.importBatchId===(ref?.batchId||batch.id)&&tx.importTransactionId===(ref?.rowId||row.id));
    if(!source&&ref)source=bankSourceForImport(state,ref.batchId,ref.rowId);
    if(!source&&row.duplicate&&!legacy.length)throw new Error('De eerdere bankbron ontbreekt. Open de oorspronkelijke import of herstel de bronkoppeling.');
    if(row.possibleDuplicate&&!row.identityDecision&&!row.duplicate)continue;
    if(!source){
      const first=legacy[0],bankSourceId=first?.bankSourceId||row.bankSourceId||`bank-${ref?.batchId||batch.id}:${ref?.rowId||row.id}`;
      const original=copy(first?.bankOriginal?.bankDate&&first.bankOriginal.amount!==undefined?first.bankOriginal:row.bankOriginal),accountProfileId=first?.accountProfileId||row.accountProfileId||batch.accountProfileId;
      const accountContext=getTransactionAccountContext(first||{...row,accountProfileId,accountOwner:row.accountOwner||batch.accountOwner},{accountProfiles:state.accountProfiles||[]});
      if(!accountContext)continue;
      source={id:`source-${bankSourceId}`,recordRole:'bank-source',bankSourceId,source:'csv',bankOriginal:original,transactionDate:original.bankDate,date:original.bankDate,amount:Math.abs(original.amount),description:original.description,accountContext,accountOwner:accountContext,account:accountContext,accountProfileId,importBatchId:ref?.batchId||batch.id,importTransactionId:ref?.rowId||row.id,processingRowId:first?.importTransactionId||ref?.rowId||row.id,importReferences:[],processingRevision:0,processingStatus:'nakijken',batchLifecycle:'active'};
      if(first){source.importReferences.push({batchId:first.importBatchId,rowId:first.importTransactionId});source.approvedProcessing=copy(first.processing||{});source.approvedProcessing.processedAmount=Math.round(legacy.reduce((sum,tx)=>sum+Math.abs(Number(tx.amount)||0),0)*100)/100;source.processingStatus=getTransactionProcessingStatus(first);source.approvalSource=first.approvalSource||'';source.approvedAt=first.approvedAt||'';}
      state.transactions.push(source);
      legacy.forEach(tx=>{tx.bankSourceId=bankSourceId;});
    }
    if(!(source.importReferences||[]).some(ref=>ref.batchId===batch.id&&ref.rowId===row.id))source.importReferences.push({batchId:batch.id,rowId:row.id});
    const bank=row.bankOriginal,original=source.bankOriginal;
    if(bank.bankDate!==original.bankDate||Math.round(Number(bank.amount)*100)!==Math.round(Number(original.amount)*100)||(bank.accountIdentifier&&original.accountIdentifier&&bank.accountIdentifier.replace(/\s/g,'').toUpperCase()!==original.accountIdentifier.replace(/\s/g,'').toUpperCase()))throw new Error('De bronverwijzing hoort bij een andere rekening, bankdatum of ander bankbedrag.');
    row.bankSourceId=source.bankSourceId;
    for(const relation of state.manualTransactionReplacements||[])if(source.importReferences.some(ref=>ref.batchId===relation.importBatchId&&ref.rowId===relation.importTransactionId))relation.bankSourceId=source.bankSourceId;
    // The first imported original remains canonical. Alias files keep their own raw evidence.
    state.transactions.filter(tx=>!isBankSource(tx)&&tx.bankSourceId===source.bankSourceId).forEach(tx=>{tx.batchLifecycle=bankSourceActive(state,source,batch)?'active':'withdrawn';});
  }
  return state;
}
export function selectBankTransactions(state,{month=null,account=null,accountId=null,includeInactive=false,imports=[]}={}){
  // Read-only compatibility for old pending rows that exist only in ImportStore.
  // Adapt on a clone; opening/reloading never migrates or approves stored data.
  const missing=imports.filter(batch=>(state.importSummaries||[]).some(summary=>summary.id===batch.id)&&!(state.importDeletionProofs||[]).some(proof=>proof.id===batch.id)&&(batch.rows||[]).some(row=>row.bankOriginal?.valid&&!row.importError&&!bankSourceForImport(state,batch.id,row.id)));
  if(missing.length){
    const projected={...state,transactions:copy(state.transactions||[]),manualTransactionReplacements:copy(state.manualTransactionReplacements||[])};
    for(const duplicates of [false,true])for(const batch of missing){
      const rows=(batch.rows||[]).filter(row=>Boolean(row.duplicate)===duplicates&&!bankSourceForImport(projected,batch.id,row.id));
      if(!rows.length)continue;
      const previous=copy(projected.transactions),relations=copy(projected.manualTransactionReplacements);
      try{ensureImportBankSources(projected,{...batch,rows:copy(rows)});}
      catch{projected.transactions=previous;projected.manualTransactionReplacements=relations;}
    }
    return selectBankTransactions(projected,{month,account,accountId,includeInactive});
  }
  const headers=(state.transactions||[]).filter(isBankSource),seen=new Set(),result=[];
  for(const tx of [...headers,...(state.transactions||[]).filter(tx=>!isBankSource(tx))]){
    const source=bankSourceForTransaction(state,tx)||tx,key=sourceRecordKey(source);
    if(seen.has(key))continue;seen.add(key);
    const csv=getTransactionSource(source)==='csv',active=isBankSource(source)?bankSourceActive(state,source):!['withdrawn','deleted'].includes(source.batchLifecycle);
    if(!includeInactive&&!active)continue;
    if(!csv&&(state.manualTransactionReplacements||[]).some(ref=>ref.active!==false&&(ref.manualTransactionId||ref.manualTransaction?.id)===source.id))continue;
    const date=source.bankOriginal?.bankDate||source.transactionDate||source.date||'',context=getTransactionAccountContext(source,{accountProfiles:state.accountProfiles||[]});
    if(month&&date.slice(0,7)!==month||account&&context!==account||accountId&&source.accountProfileId!==accountId)continue;
    const incoming=['inkomen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten','van-spaarrekening','terugbetaling','refund'].includes(source.transactionType||source.approvedProcessing?.transactionType)||source.kind==='inkomen';
    const amount=source.bankOriginal?.amount??source.accountDelta??Math.abs(Number(source.amount)||0)*(incoming?1:-1);
    const liveRef=source.importReferences?.find(ref=>bankSourceActive(state,{...source,importReferences:[ref]}));
    result.push({...source,...(liveRef?{importBatchId:liveRef.batchId,importTransactionId:liveRef.rowId}:{}),date,transactionDate:date,amount:Math.abs(amount),bankAmount:amount,accountContext:context,active,category:source.approvedProcessing?.category||source.category||'Nog te beoordelen',processing:copy(source.approvedProcessing||source.processing||{})});
  }
  return result;
}
export function updateSourceApproval(state,batch,row){
  const source=bankSourceForImport(state,batch.id,row.id);if(!source)return;
  if(JSON.stringify(source.approvedProcessing)!==JSON.stringify(row.processing))source.processingRevision=(source.processingRevision||0)+1;
  source.approvedProcessing=copy(row.processing);source.processingStatus=getTransactionProcessingStatus({...row,source:'csv'});source.approvalSource=row.approvalSource||'';source.approvedAt=row.approvedAt||'';
}
