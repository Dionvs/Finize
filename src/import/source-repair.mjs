import { isBankSource, bankSourceForImport, selectBankTransactions, ensureImportBankSources } from '../core/bank-sources.mjs';
import { getTransactionSource, getTransactionProcessingStatus, getTransactionAccountContext } from '../core/transaction-model.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const iban=value=>String(value||'').replace(/\s/g,'').toUpperCase();
export function inspectSourceAvailability(state,tx,batch){
  const issues=[];
  if(!tx||getTransactionSource(tx)!=='csv')return {ok:false,issues:['Deze registratie is geen CSV-banktransactie.']};
  if(!tx.bankOriginal?.bankDate||tx.bankOriginal.amount===null||tx.bankOriginal.amount===undefined||!Number.isFinite(Number(tx.bankOriginal.amount)))issues.push('De oorspronkelijke bankdatum of het oorspronkelijke bedrag ontbreekt.');
  if(!tx.importBatchId||!tx.importTransactionId||!batch?.rows?.some(row=>row.id===tx.importTransactionId))issues.push('De oorspronkelijke importregel of bronkoppeling ontbreekt.');
  if(!getTransactionAccountContext(tx,{accountProfiles:state.accountProfiles||[]}))issues.push('De rekening waarop de bankbeweging plaatsvond is onbekend.');
  return {ok:issues.length===0,issues};
}
export function sourceRepairCandidates(state,tx,rows){
  const profile=(state.accountProfiles||[]).find(profile=>profile.id===tx.accountProfileId);
  const identifier=iban(tx.bankOriginal?.accountIdentifier||profile?.identifier);
  if(!identifier)throw new Error('Het oorspronkelijke rekeningkenmerk ontbreekt. Herstel dit eerst vanuit een betrouwbare rekeningregistratie.');
  const related=(state.transactions||[]).filter(row=>!isBankSource(row)&&(tx.bankSourceId?row.bankSourceId===tx.bankSourceId:tx.importBatchId&&tx.importTransactionId?row.importBatchId===tx.importBatchId&&row.importTransactionId===tx.importTransactionId:row.id===tx.id));
  const amount=tx.bankOriginal?.amount??related.reduce((sum,row)=>sum+Math.abs(Number(row.amount)||0),0)*(tx.kind==='inkomen'||['van-spaarrekening','terugbetaling','refund'].includes(tx.transactionType)?1:-1);
  const date=tx.bankOriginal?.bankDate||tx.transactionDate||tx.date;
  return rows.filter(bank=>bank.valid&&iban(bank.accountIdentifier)===identifier&&bank.bankDate===date&&Math.round(Number(bank.amount)*100)===Math.round(amount*100)&&(!tx.bankOriginal?.reference||bank.reference===tx.bankOriginal.reference)&&(!tx.bankOriginal?.counterpartyAccount||iban(bank.counterpartyAccount)===iban(tx.bankOriginal.counterpartyAccount)));
}
export function planSourceRepair(state,txId,batch,bank,{confirmed=false,operationId,timestamp,sourceIdentityProof}={}){
  const tx=(state.transactions||[]).find(row=>row.id===txId);if(!tx)throw new Error('De oorspronkelijke transactie bestaat niet meer.');
  if(inspectSourceAvailability(state,tx,batch).ok)throw new Error('Deze transactie heeft al een geldige bron. Herstel is niet nodig.');
  if(!confirmed||!sourceRepairCandidates(state,tx,[bank]).length)throw new Error('Bevestig een overeenkomst met dezelfde rekening, bankdatum en hetzelfde bedrag.');
  const candidate=copy(state),nextBatch=batch?copy(batch):{id:tx.importBatchId||`recovery-${tx.id}`,rows:[],accountProfileId:tx.accountProfileId,accountOwner:getTransactionAccountContext(tx,{accountProfiles:state.accountProfiles||[]}),lifecycle:tx.batchLifecycle||'active',status:'verwerkt',version:0,summary:{},fileName:'Herstelde oorspronkelijke CSV-bron'};
  const rowId=tx.importTransactionId||`recovery-row-${tx.id}`;
  const existing=bankSourceForImport(candidate,nextBatch.id,rowId);
  if(existing&&existing.bankSourceId!==tx.bankSourceId)throw new Error('Deze importregel is al aan een andere bankbeweging gekoppeld.');
  const related=candidate.transactions.filter(row=>!isBankSource(row)&&(tx.bankSourceId?row.bankSourceId===tx.bankSourceId:tx.importBatchId&&tx.importTransactionId?row.importBatchId===tx.importBatchId&&row.importTransactionId===tx.importTransactionId:row.id===tx.id));
  const p=copy(tx.approvedProcessing||tx.processing||{});p.processedAmount=Math.round(related.reduce((sum,row)=>sum+Math.abs(Number(row.amount)||0),0)*100)/100;p.processingDate=p.processingDate||bank.bankDate;p.transactionType=p.transactionType||tx.transactionType||'uitgave';p.budgetOwner=p.budgetOwner||tx.budgetOwner||tx.financialFor;p.category=p.category||tx.category;p.include=p.include!==false;
  if(related.length>1&&!p.splits?.length)p.splits=related.map(row=>({...copy(row.processing||{}),id:row.splitId||row.id,amount:Math.abs(Number(row.amount)),amountMode:'manual',transactionType:row.transactionType,category:row.category,budgetOwner:row.budgetOwner||row.financialFor}));
  const original=copy(tx.bankOriginal||bank);
  for(const field of ['bankDate','amount','accountIdentifier'])if(original[field]===undefined||original[field]===null||original[field]==='')original[field]=bank[field];
  original.valid=true;
  // Damaged evidence remains in the original effect rows and the verified pre-repair backup.
  // A replacement source header retains bankSourceId, without rewriting that old evidence.
  const oldHeader=candidate.transactions.find(row=>isBankSource(row)&&row.bankSourceId===tx.bankSourceId);
  if(oldHeader&&(!oldHeader.bankOriginal?.bankDate||oldHeader.bankOriginal.amount===undefined||oldHeader.bankOriginal.amount===null)){
    nextBatch.sourceRepairHistory=[...(nextBatch.sourceRepairHistory||[]),{operationId,timestamp,bankSourceId:oldHeader.bankSourceId,bankOriginal:copy(oldHeader.bankOriginal)}];
    candidate.transactions=candidate.transactions.filter(row=>row.id!==oldHeader.id);
  }

  related.forEach(row=>{row.importBatchId=nextBatch.id;row.importTransactionId=rowId;if(!row.bankOriginal)row.bankOriginal=copy(original);});
  const recovered={id:rowId,bankOriginal:original,sourceIdentityProof:copy(sourceIdentityProof||null),accountProfileId:tx.accountProfileId||nextBatch.accountProfileId,accountOwner:nextBatch.accountOwner,processing:p,processingStatus:getTransactionProcessingStatus(tx),certainty:'goedgekeurd',approvalSource:tx.approvalSource||'legacy-confirmed',approvedAt:tx.approvedAt||'',repairedAt:timestamp};
  nextBatch.rows=nextBatch.rows.filter(row=>row.id!==rowId).concat(recovered);nextBatch.version=Number(nextBatch.version||0)+1;nextBatch.operationId=operationId;nextBatch.updatedAt=timestamp;
  candidate.importSummaries=candidate.importSummaries||[];
  if(!candidate.importSummaries.some(row=>row.id===nextBatch.id))candidate.importSummaries.push({id:nextBatch.id,lifecycle:nextBatch.lifecycle,status:nextBatch.status,version:nextBatch.version,operationId});
  ensureImportBankSources(candidate,nextBatch);
  const repairedHeader=bankSourceForImport(candidate,nextBatch.id,rowId);
  if(oldHeader&&repairedHeader&&JSON.stringify(oldHeader.bankOriginal)!==JSON.stringify(repairedHeader.bankOriginal)){
    repairedHeader.id=`${repairedHeader.id}-repair-${operationId}`;repairedHeader.processingRevision=(oldHeader.processingRevision||0)+1;
    repairedHeader.importReferences=[...new Map([...(oldHeader.importReferences||[]),...repairedHeader.importReferences].map(ref=>[`${ref.batchId}:${ref.rowId}`,ref])).values()];
    if(oldHeader.approvedProcessing)repairedHeader.approvedProcessing=copy(oldHeader.approvedProcessing);
  }
  const before=selectBankTransactions(state).reduce((sum,row)=>sum+Math.round(row.bankAmount*100),0),after=selectBankTransactions(candidate).reduce((sum,row)=>sum+Math.round(row.bankAmount*100),0);
  if(before!==after)throw new Error('Deze herstelkoppeling zou het rekeningtotaal veranderen. Laat de bron eerst handmatig controleren.');
  return {state:candidate,batch:nextBatch,rowId};
}
