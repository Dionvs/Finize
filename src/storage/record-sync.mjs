import { digest,storageError,canonical } from './period-projections.mjs';
import { backupDigest } from './migration-backups.mjs';
import { getTransactionProcessingStatus } from '../core/transaction-model.mjs';
const same=(a,b)=>canonical(a)===canonical(b);

export function conflictApprovalReview(value){
  const local=new Map((value.local.transactions||[]).map(row=>[row.id,row]));
  return (value.remote.transactions||[]).filter(row=>getTransactionProcessingStatus(row)==='goedgekeurd'&&!same(row,local.get(row.id))).map(row=>({id:row.id,bankSourceId:row.bankSourceId||'',remote:row,local:local.get(row.id)||null}));
}

// Sync acknowledges local operation proofs only after the cloud publication proof exists.
export function createRecordSync({localStore,cloudStore,onStatus=()=>{},prepareState=async state=>state,onAdopt=()=>{},validateIncoming=()=>{}}){
  if(localStore.scope!==cloudStore.householdId)throw storageError('household-scope','De lokale en cloudadministratie horen niet bij hetzelfde huishouden.');
  let running=null;
  async function readLocal(){const snapshot=await localStore.readCloudSnapshot();return {...snapshot,localState:snapshot.state,state:await prepareState(structuredClone(snapshot.state))};}
  async function conflict(snapshot,remote,reason){
    const id='record-conflict-'+await digest({local:snapshot.head.sha256,remote:remote.head.stateHash,revision:remote.head.revision});
    const value={id,reason,epoch:remote.head.epoch,remoteRevision:remote.head.revision,local:snapshot.state,localImports:snapshot.imports,remote:remote.state,remoteImports:remote.imports,operationIds:snapshot.operations.map(row=>row.id),localHash:snapshot.head.sha256,remoteHash:remote.head.stateHash};
    await localStore.preserveRecordConflict(value);onStatus('Synchronisatieconflict — beide financiële standen bewaard');
    return {outcome:'conflict',conflict:value};
  }
  async function establishBase(){
    const local=await readLocal(),remote=await cloudStore.verifyIntegrity();
    if(!same(local.state,remote.state)||!same(local.imports,remote.imports))return conflict(local,remote,'initial-offline-difference');
    await localStore.acknowledgeRecordCloud([],{epoch:remote.head.epoch,revision:remote.head.revision,localSha256:local.head.sha256,stateHash:remote.head.stateHash,importsHash:remote.head.importsHash});
    return {outcome:'matched',revision:remote.head.revision};
  }
  async function performSync(){
    const active=await cloudStore.context({allowPending:true});
    if(active.head.data.phase==='applying')await cloudStore.recover(active.head.data.pendingOperation);
    const snapshot=await readLocal();
    if(!snapshot.operations.length){
      for(const value of snapshot.conflicts||[]){
        const resolution=value.resolution;if(!resolution?.operationId)continue;
        const op=await cloudStore.operationStatus(resolution.operationId);
        if(op?.phase==='committed'&&op.stateHash===await digest(snapshot.state)&&op.importsHash===await digest(snapshot.imports)){
          await localStore.acknowledgeRecordCloud([],{epoch:op.epoch,revision:op.targetHead.revision,localSha256:snapshot.head.sha256,stateHash:op.stateHash,importsHash:op.importsHash},snapshot.imports,{...resolution,id:value.id,outcome:'committed'});
          return {outcome:'committed',replayed:true,revision:op.targetHead.revision};
        }
      }
      return snapshot.conflicts?.length?{outcome:'conflict',conflictIds:snapshot.conflicts.map(row=>row.id)}:{outcome:'idle'};
    }
    const members=snapshot.operations.map(row=>({id:row.id,sha256:row.sha256,storageRevision:row.storageRevision}));
    const receipts=[];for(const member of members){const proof=await cloudStore.operationReceipt(member.id);if(proof){if(proof.sha256!==member.sha256)throw storageError('operation-reused','Cloudbewijs en lokale operatie verschillen.');receipts.push(proof);}}
    const c=await cloudStore.context();
    if(receipts.length===members.length){
      const last=receipts.reduce((a,b)=>a.cloudRevision>b.cloudRevision?a:b);
      const resolutions=[...new Set(snapshot.operations.map(row=>row.conflictId).filter(Boolean))].map(id=>({id,choice:'confirmed-cloud-proof',operationId:last.cloudOperation}));
      await localStore.acknowledgeRecordCloud(members.map(member=>member.id),{epoch:last.epoch,revision:last.cloudRevision,localSha256:snapshot.head.sha256,stateHash:await digest(snapshot.state),importsHash:await digest(snapshot.imports)},snapshot.imports,resolutions);
      onStatus('Cloud opgeslagen');return {outcome:'committed',replayed:true,revision:last.cloudRevision};
    }
    if(receipts.length){
      const receiptIds=new Set(receipts.map(row=>row.id)),latest=receipts.reduce((a,b)=>a.cloudRevision>b.cloudRevision?a:b),confirmed=members.filter(row=>receiptIds.has(row.id)).sort((a,b)=>a.storageRevision-b.storageRevision).at(-1);
      await localStore.acknowledgeRecordCloud([...receiptIds],{epoch:latest.epoch,revision:latest.cloudRevision,localSha256:confirmed.sha256,stateHash:c.head.data.stateHash,importsHash:c.head.data.importsHash});
      return performSync();
    }
    if(snapshot.operations.some(row=>row.status==='conflict'))return {outcome:'conflict',conflictIds:[...new Set(snapshot.operations.filter(row=>row.status==='conflict').map(row=>row.conflictId))]};
    const equalCurrent=c.head.data.stateHash===await digest(snapshot.state)&&c.head.data.importsHash===await digest(snapshot.imports);
    if(!equalCurrent&&(!snapshot.cloudBase||snapshot.cloudBase.epoch!==c.head.data.epoch||snapshot.cloudBase.revision!==c.head.data.revision||snapshot.operations[0].previousHash!==snapshot.cloudBase.localSha256))return conflict(snapshot,await cloudStore.verifyIntegrity(),'cloud-revision-changed');
    const operationId='outbox-'+await digest(members.map(member=>member.id));
    onStatus('Cloud synchroniseren…');
    let result;
    try{result=await cloudStore.commit({state:snapshot.state,imports:snapshot.imports,operationId,expectedRevision:c.head.data.revision,members});}
    catch(error){
      if(error.code==='cloud-conflict')return conflict(snapshot,await cloudStore.verifyIntegrity(),'concurrent-device');
      error.commitOutcome='uncertain';error.operationId=operationId;
      onStatus('Offline wijzigingen blijven in de duurzame wachtrij');throw error;
    }
    for(const member of members){const proof=await cloudStore.operationReceipt(member.id);if(proof?.outcome!=='committed'||proof.sha256!==member.sha256)throw storageError('cloud-uncertain','De cloudbevestiging moet eerst worden gecontroleerd.');}
    await localStore.acknowledgeRecordCloud(members.map(member=>member.id),{epoch:c.head.data.epoch,revision:result.revision,localSha256:snapshot.head.sha256,stateHash:await digest(snapshot.state),importsHash:await digest(snapshot.imports)},snapshot.imports);
    onStatus('Cloud opgeslagen');return result;
  }
  function sync(){if(running)return running;running=performSync().finally(()=>{running=null;});return running;}
  async function pull(){
    const snapshot=await readLocal();
    if(snapshot.operations.length||snapshot.importQueue?.length)return {outcome:'pending-local'};
    if(snapshot.conflicts?.length)return {outcome:'conflict',conflictIds:snapshot.conflicts.map(row=>row.id)};
    const remote=await cloudStore.verifyIntegrity(),base=snapshot.cloudBase;
    const pristine=snapshot.head.storageRevision===1&&!snapshot.head.migration?.sourceSha256&&!snapshot.imports.length;
    if(!pristine&&(!base||base.epoch!==remote.head.epoch||base.localSha256!==snapshot.head.sha256||base.importsHash!==await digest(snapshot.imports)))return conflict(snapshot,remote,'unconfirmed-local-base');
    if(base&&remote.head.revision<base.revision)throw storageError('cloud-conflict','Een oudere cloudrevisie mag de lokale administratie niet vervangen.');
    if(!pristine){
      const incoming=new Map(remote.state.transactions.map(row=>[row.id,row]));
      const lost=(snapshot.state.transactions||[]).filter(row=>row.recordRole==='bank-source'||row.source==='manual').some(row=>!incoming.has(row.id)||getTransactionProcessingStatus(row)==='goedgekeurd'&&getTransactionProcessingStatus(incoming.get(row.id))!=='goedgekeurd');
      if(lost)return conflict(snapshot,remote,'existing-approval-missing');
    }
    if(same(snapshot.state,remote.state)&&same(snapshot.imports,remote.imports)){
      await localStore.acknowledgeRecordCloud([],{epoch:remote.head.epoch,revision:remote.head.revision,localSha256:snapshot.head.sha256,stateHash:remote.head.stateHash,importsHash:remote.head.importsHash});return {outcome:'matched',revision:remote.head.revision};
    }
    validateIncoming(remote.state);
    const operationId='cloud-pull-'+remote.head.epoch+'-'+remote.head.revision,sha256=await backupDigest(JSON.stringify(remote.state));
    try{
      await localStore.load();
      await localStore.commit(remote.state,{expectedHash:snapshot.head.sha256,operationId,queueCloud:false,cloudAcceptance:{imports:remote.imports,expectedImportsSignature:JSON.stringify(snapshot.imports),base:{epoch:remote.head.epoch,revision:remote.head.revision,stateHash:remote.head.stateHash,importsHash:remote.head.importsHash}}});
    }catch(error){
      let proof;
      try{proof=await localStore.inspectOperation(operationId);}
      catch{error.commitOutcome='uncertain';error.operationId=operationId;throw error;}
      if(proof.receipt?.sha256!==sha256||await backupDigest(JSON.stringify(proof.state))!==sha256){error.commitOutcome=!proof.receipt&&await backupDigest(JSON.stringify(proof.state))===snapshot.head.sha256?'rejected':'uncertain';error.operationId=operationId;throw error;}
    }
    await onAdopt(remote.state,{previousState:snapshot.localState});onStatus('Cloud ontvangen — lokaal duurzaam bevestigd');return {outcome:'committed',revision:remote.head.revision};
  }
  async function resolveConflict(value,{choice,expectedRemoteRevision,operationId,reviewedRemoteChanges=[]}={}){
    if(choice!=='local')throw storageError('approval-review-required','De externe stand toepassen vereist eerst een expliciete beoordeling van afwijkende lokale goedkeuringen. Beide versies blijven bewaard.');
    const local=await readLocal(),c=await cloudStore.context();
    if(value.scope&&value.scope!==localStore.scope||value.epoch!==c.head.data.epoch||c.head.data.revision!==expectedRemoteRevision||value.remoteRevision!==expectedRemoteRevision||value.localHash!==local.head.sha256)throw storageError('cloud-conflict','De beoordeelde conflictversies zijn intussen gewijzigd.');
    if(value.remoteHash!==c.head.data.stateHash||await digest(value.remote)!==value.remoteHash||await digest(value.remoteImports)!==c.head.data.importsHash||!same(value.local,local.state)||!same(value.localImports,local.imports))throw storageError('cloud-conflict','De conflictinhoud hoort niet bij de bewezen lokale en externe standen.');
    const reviewed=conflictApprovalReview(value).map(row=>row.id).sort();
    if(!same([...new Set(reviewedRemoteChanges)].sort(),reviewed))throw storageError('approval-review-required','Beoordeel en bevestig eerst iedere afwijkende externe financiële goedkeuring. Beide versies blijven bewaard.');
    const members=local.operations.map(row=>({id:row.id,sha256:row.sha256,storageRevision:row.storageRevision}));
    await localStore.markRecordResolution(value.id,{choice,operationId,reviewedRemoteChanges:reviewed});
    const result=await cloudStore.commit({state:local.state,imports:local.imports,operationId,expectedRevision:expectedRemoteRevision,members});
    for(const member of members)if((await cloudStore.operationReceipt(member.id))?.sha256!==member.sha256)throw storageError('cloud-uncertain','Conflictbevestiging moet worden gecontroleerd.');
    // The conflict journal remains an immutable recovery source for both versions.
    await localStore.acknowledgeRecordCloud(members.map(row=>row.id),{epoch:c.head.data.epoch,revision:result.revision,localSha256:local.head.sha256,stateHash:await digest(local.state),importsHash:await digest(local.imports)},local.imports,{id:value.id,choice,operationId,reviewedRemoteChanges:reviewed});
    onStatus('Cloud opgeslagen — conflictkeuze en beide versies bewaard');return result;
  }
  return {sync,pull,establishBase,resolveConflict,conflictApprovalReview,readLocal,loadPeriod:month=>cloudStore.loadPeriod(month),loadImport:id=>cloudStore.loadImport(id),cloudStore,localStore};
}
