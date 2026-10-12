import { digest,storageError,canonical } from './period-projections.mjs';
import { backupDigest } from './migration-backups.mjs';
import { getTransactionProcessingStatus,assertOriginalBankDataUnchanged } from '../core/transaction-model.mjs';
import { workspaceState,refreshWorkspaceTotals,mergeWorkspaceIntent } from './period-workspace.mjs';
import { synchronizeChangedSavings,assertFinancialMutationSafe } from '../core/transaction-processing.mjs';
import { reconcileGoalSavedAmounts } from '../core/data-normalization.mjs';
import { requestedPeriodWindow } from './period-cache.mjs';
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
  async function pendingImportBaseMatches(local){
    // Record sync uses the household epoch/revision, not the legacy per-import
    // baseVersion. Prove that this pending choice descends from that cloud base.
    const snapshot=await localStore.readCloudSnapshot(),c=await cloudStore.context();
    const queued=snapshot.importQueue.find(row=>(row.importId||row.id)===local.id);
    const stored=snapshot.imports.find(row=>row.id===local.id),operations=snapshot.operations;
    return Boolean(queued&&stored&&queued.operationId===local.operationId&&queued.version===local.version&&stored.operationId===local.operationId&&stored.version===local.version&&operations.length&&operations.every(row=>row.status==='pending')&&snapshot.cloudBase?.epoch===c.head.data.epoch&&snapshot.cloudBase?.revision===c.head.data.revision&&operations[0].previousHash===snapshot.cloudBase.localSha256&&operations.at(-1).sha256===snapshot.head.sha256);
  }
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
    if(snapshot.state.__finizePartialHistory)return syncWorkspace(snapshot);
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
  async function releaseFullWindow(snapshot){
    const current=await readLocal();
    if(!current.state.__finizePeriodContext?.explicitFullHistory&&current.state.__finizePeriodContext?.revision===current.cloudBase?.revision)return true;
    if(!current.operations.length){
      try{return (await openMonth(current.state.meta.selectedMonth,{resetWindow:true})).outcome==='committed';}
      catch(error){
        onStatus('Cloud opgeslagen; offline perioden moeten bij verbinding opnieuw worden gecontroleerd');
        if(error.code&&!['cloud-offline','firestore-error','cloud-pending'].includes(error.code)){error.commitOutcome='committed';throw error;}
        return false;
      }
    }
    return false;
  }
  async function syncWorkspace(snapshot){
    if(!snapshot.operations.length){await releaseFullWindow(snapshot);return {outcome:'idle'};}
    if(snapshot.operations.some(row=>row.status==='conflict'))return {outcome:'conflict'};
    const proof=snapshot.cloudBase?.workspace||snapshot.state.__finizePeriodContext;
    const before=await workspaceState(proof,snapshot.state.meta.selectedMonth),members=snapshot.operations.map(row=>({id:row.id,sha256:row.sha256,storageRevision:row.storageRevision}));
    const resolutions=(snapshot.conflicts||[]).filter(row=>row.resolution?.outcome==='pending').map(row=>({id:row.id,...row.resolution,outcome:'committed'}));
    const receipts=[];
    for(const member of members){const receipt=await cloudStore.operationReceipt(member.id);if(receipt){if(receipt.sha256!==member.sha256)throw storageError('operation-reused','Het lokale en externe periodebewijs verschillen.');receipts.push(receipt);}}
    if(receipts.length){
      const latest=receipts.reduce((a,b)=>a.cloudRevision>b.cloudRevision?a:b),confirmed=await cloudStore.openWorkspace(snapshot.state.verifiedPeriods);
      if(confirmed.__finizePeriodContext.revision!==latest.cloudRevision)return conflict(snapshot,{state:confirmed,imports:[],head:confirmed.__finizePeriodContext.head},'newer-period-after-ack-loss');
      const ids=new Set(receipts.map(row=>row.id)),last=members.filter(row=>ids.has(row.id)).sort((a,b)=>a.storageRevision-b.storageRevision).at(-1);
      await localStore.acknowledgeRecordCloud([...ids],{epoch:latest.epoch,revision:latest.cloudRevision,localSha256:last.sha256,stateHash:confirmed.__finizePeriodContext.head.stateHash,importsHash:confirmed.__finizePeriodContext.head.importsHash,workspace:confirmed.__finizePeriodContext},snapshot.imports,receipts.length===members.length?resolutions:null);
      if(receipts.length===members.length){const refreshed=await releaseFullWindow(snapshot);if(refreshed)onStatus('Cloud opgeslagen');return {outcome:'committed',replayed:true,revision:latest.cloudRevision,offlineRefreshPending:!refreshed};}
      return syncWorkspace(await readLocal());
    }
    const operationId='period-outbox-'+await digest(members.map(row=>row.id));let result;
    try{result=await cloudStore.commitWorkspace({before,state:snapshot.state,imports:snapshot.imports,operationId,members});}
    catch(error){
      if(error.code==='cloud-conflict'){
        const remote=await cloudStore.openWorkspace(snapshot.state.verifiedPeriods);
        return conflict(snapshot,{state:remote,imports:[],head:remote.__finizePeriodContext.head},'period-revision-changed');
      }
      error.commitOutcome='uncertain';error.operationId=operationId;throw error;
    }
    for(const member of members)if((await cloudStore.operationReceipt(member.id))?.sha256!==member.sha256)throw storageError('cloud-uncertain','Een gericht cloudbewijs moet eerst worden gecontroleerd.');
    const confirmed=await cloudStore.openWorkspace(snapshot.state.verifiedPeriods);
    if(confirmed.__finizePeriodContext.revision!==result.revision)throw storageError('cloud-conflict','Een nieuwere cloudstand vereist aparte ontvangst. De lokale outbox blijft behouden.');
    await localStore.acknowledgeRecordCloud(members.map(row=>row.id),{epoch:proof.epoch,revision:result.revision,localSha256:snapshot.head.sha256,stateHash:confirmed.__finizePeriodContext.head.stateHash,importsHash:confirmed.__finizePeriodContext.head.importsHash,workspace:confirmed.__finizePeriodContext},snapshot.imports,resolutions);
    const refreshed=await releaseFullWindow(snapshot);if(refreshed)onStatus('Cloud opgeslagen');return {...result,offlineRefreshPending:!refreshed};
  }
  async function openMonth(month,{explicitFullHistory=false,additionalMonths=[],resetWindow=false}={}){
    const snapshot=await readLocal(),partial=snapshot.state.__finizePartialHistory;
    if(snapshot.conflicts?.length)return {outcome:'conflict'};
    if(!partial&&snapshot.operations.length)return {outcome:'pending-local'};
    if(resetWindow&&snapshot.operations.length)return {outcome:'pending-local'};
    const pristine=snapshot.head.storageRevision===1&&!snapshot.head.migration?.sourceSha256;
    if(!partial&&!pristine&&(!snapshot.cloudBase||snapshot.cloudBase.localSha256!==snapshot.head.sha256))throw storageError('unconfirmed-local-base','Bevestig eerst de bestaande lokale administratie; de oude historie blijft beschermd.');
    let incoming,fromCache=false;
    try{
      const c=await cloudStore.context(),months=explicitFullHistory?Object.keys(c.head.data.periodHashes):[...requestedPeriodWindow(month),...additionalMonths,...(partial&&!resetWindow&&snapshot.operations.length?snapshot.state.verifiedPeriods:[])].filter((value,index,all)=>all.indexOf(value)===index);
      if(!months.includes(month))months.unshift(month);
      incoming=await cloudStore.openWorkspace(months,{explicitFullHistory});
    }
    catch(error){
      if(explicitFullHistory||!partial||error.code&&!['cloud-offline','firestore-error','cloud-pending'].includes(error.code))throw error;
      if(snapshot.state.verifiedPeriods.includes(month)){incoming=copyState(snapshot.localState);incoming.meta.selectedMonth=month;}
      else if(!snapshot.operations.length)incoming=await localStore.cache.read(month,{epoch:snapshot.cloudBase?.epoch,revision:snapshot.cloudBase?.revision});
      if(!incoming)throw error;
      fromCache=true;onStatus('Offline — eerder geverifieerde financiële maand');
    }
    if(partial&&snapshot.operations.length&&!fromCache){
      const base=await workspaceState(snapshot.cloudBase?.workspace||snapshot.state.__finizePeriodContext,snapshot.state.meta.selectedMonth);
      if(base.__finizePeriodContext.revision!==incoming.__finizePeriodContext.revision)return conflict(snapshot,{state:incoming,imports:[],head:incoming.__finizePeriodContext.head},'open-period-revision-changed');
      const next=copyState(incoming),oldRows=new Map(base.transactions.map(row=>[row.id,row])),localRows=new Map(snapshot.state.transactions.map(row=>[row.id,row]));
      next.transactions=next.transactions.filter(row=>!oldRows.has(row.id)||localRows.has(row.id));
      for(const[id,row]of localRows)if(!same(oldRows.get(id),row)){const at=next.transactions.findIndex(value=>value.id===id);if(at<0)next.transactions.push(copyState(row));else next.transactions[at]=copyState(row);}
      for(const key of Object.keys(snapshot.state))if(!['transactions','meta','__finizePartialHistory','verifiedPeriods','__finizePeriodContext'].includes(key)&&!same(base[key],snapshot.state[key]))next[key]=copyState(snapshot.state[key]);
      next.meta={...snapshot.state.meta,selectedMonth:month};
      refreshWorkspaceTotals(incoming,next);incoming=next;
    }
    if(partial&&!snapshot.operations.length&&!fromCache){
      const rows=new Map(incoming.transactions.map(row=>[row.id,row]));
      const relevant=row=>snapshot.state.__finizePeriodContext.records.some(record=>record.collection==='transactions'&&record.recordId===row.id&&record.periods.some(value=>incoming.verifiedPeriods.includes(value)));
      const lost=snapshot.state.transactions.some(row=>relevant(row)&&getTransactionProcessingStatus(row)==='goedgekeurd'&&(!rows.has(row.id)||getTransactionProcessingStatus(rows.get(row.id))!=='goedgekeurd'));
      if(lost)return conflict(snapshot,{state:incoming,imports:[],head:incoming.__finizePeriodContext.head},'period-approval-missing');
    }
    incoming.meta.selectedMonth=month;validateIncoming(incoming);
    const id='period-view-'+crypto.randomUUID(),expected=await backupDigest(JSON.stringify(incoming));
    const workspace=copyState(incoming.__finizePeriodContext);delete workspace.localCumulative;
    const periodAcceptance=fromCache&&snapshot.cloudBase?snapshot.cloudBase:{epoch:workspace.epoch,revision:workspace.revision,stateHash:workspace.head.stateHash,importsHash:workspace.head.importsHash,workspace};
    try{await localStore.commit(incoming,{expectedHash:snapshot.head.sha256,operationId:id,queueCloud:false,periodAcceptance});}
    catch(error){const proof=await localStore.inspectOperation(id);if(proof.receipt?.sha256!==expected){error.commitOutcome=proof.state&&await backupDigest(JSON.stringify(proof.state))===snapshot.head.sha256?'rejected':'uncertain';throw error;}}
    await onAdopt(incoming,{previousState:snapshot.localState});
      if(!fromCache&&!snapshot.operations.length&&localStore.cache){
        try{
          await localStore.cache.remember(incoming,expected);
          // Keep the calendar window and explicitly pinned offline copies at the
          // confirmed revision, outside the selected financial workspace. A
          // historical edit must not silently leave the active offline cache stale.
          const offlinePeriods=new Set([...requestedPeriodWindow(),...await localStore.cache.pinnedPeriods()]);
          for(const pin of offlinePeriods)if(!incoming.verifiedPeriods.includes(pin)&&!await localStore.cache.read(pin,{epoch:workspace.epoch,revision:workspace.revision})){
            const offline=await cloudStore.openWorkspace([pin]);
            if(offline.__finizePeriodContext.epoch!==workspace.epoch||offline.__finizePeriodContext.revision!==workspace.revision)throw storageError('cloud-conflict','De offline cache vereist een nieuwe gecontroleerde revisie.');
            await localStore.cache.remember(offline,expected);
          }
          await localStore.cache.evict({selectedMonth:month});
        }
      catch(error){onStatus('Maand duurzaam geladen — cache niet bijgewerkt: '+error.message);}
    }
    return {outcome:'committed',month,loadedTransactions:incoming.transactions.length,fullHistoryLoaded:false};
  }
  async function pull(){
    const localState=await localStore.load();if(localState?.__finizePartialHistory)return openMonth(localState.meta.selectedMonth);
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
    if(local.state.__finizePartialHistory){
      const saved=local.conflicts.find(row=>row.id===value.id);
      if(!saved||saved.remoteHash!==c.head.data.stateHash||!same(saved.local,value.local)||!same(saved.remote,value.remote)||!same(saved.localImports,value.localImports)||!same(value.local,local.state))throw storageError('cloud-conflict','De conflictinhoud wijkt af van het duurzame beoordelingsbewijs.');
      const reviewed=conflictApprovalReview(value).map(row=>row.id).sort();
      if(!same([...new Set(reviewedRemoteChanges)].sort(),reviewed))throw storageError('approval-review-required','Bevestig iedere afwijkende externe goedkeuring; beide versies blijven bewaard.');
      const base=await workspaceState(local.cloudBase?.workspace||local.state.__finizePeriodContext,local.state.meta.selectedMonth),remote=await cloudStore.openWorkspace(local.state.verifiedPeriods,{explicitFullHistory:local.state.__finizePeriodContext.explicitFullHistory});
      if(remote.__finizePeriodContext.revision!==expectedRemoteRevision)throw storageError('cloud-conflict','De externe stand is intussen gewijzigd.');
      const old=new Map(base.transactions.map(row=>[row.id,row])),incoming=new Map(remote.transactions.map(row=>[row.id,row]));
      const chosen=new Map(local.state.transactions.map(row=>[row.id,row]));
      for(const id of new Set([...old.keys(),...chosen.keys()])){const row=chosen.get(id),external=incoming.get(id);if(!same(row,old.get(id))&&!same(external,old.get(id))&&!same(row,external))throw storageError('financial-reapproval-required','Dezelfde bankverwerking is op beide apparaten gewijzigd. Een nieuwe financiële beoordeling is vereist; beide goedkeuringen blijven beschermd.');}
      const merged=mergeWorkspaceIntent(base,local.state,remote,{strict:false});
      synchronizeChangedSavings(merged,remote);reconcileGoalSavedAmounts(merged);refreshWorkspaceTotals(remote,merged);
      assertFinancialMutationSafe(remote,merged);assertOriginalBankDataUnchanged(remote.transactions,merged.transactions);validateIncoming(merged);
      merged.meta={...merged.meta,revision:Math.max(Number(local.state.meta.revision)||0,Number(remote.meta.revision)||0)+1};
      const resolution={choice,operationId,reviewedRemoteChanges:reviewed};
      // The choice, new local state, cloud base and retryable outbox become durable together.
      await localStore.commit(merged,{expectedHash:local.head.sha256,operationId,queueCloud:true,resolutionAcceptance:{id:value.id,resolution,base:{epoch:value.epoch,revision:expectedRemoteRevision,workspace:remote.__finizePeriodContext,stateHash:c.head.data.stateHash,importsHash:c.head.data.importsHash}}});
      await onAdopt(merged,{previousState:local.localState});return sync();
    }
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
  return {sync,pull,openMonth,openFullHistory:(month,reason)=>{if(!reason)throw storageError('history-reason','Geef de noodzakelijke historische afhankelijkheid op.');return openMonth(month,{explicitFullHistory:true});},establishBase,resolveConflict,conflictApprovalReview,readLocal,pendingImportBaseMatches,loadPeriod:month=>cloudStore.loadPeriod(month),loadImport:id=>cloudStore.loadImport(id),cloudStore,localStore};
}
const copyState=value=>structuredClone(value);
