import { buildRecordSnapshot, decodeRecordSnapshot, decodeRecordValues, recordChanges, RECORD_STORAGE_VERSION, clone } from './cloud-record-model.mjs';
import { decodeCloudState } from './cloud-chunks.mjs';
import { canonical,digest,storageError,verifiedPeriodResult } from './period-projections.mjs';
import { verifyRecordManifests } from './record-manifest.mjs';
import { createPeriodWorkspace } from './period-workspace.mjs';
const same=(a,b)=>canonical(a)===canonical(b);
const batches=values=>Array.from({length:Math.ceil(values.length/8)},(_,index)=>values.slice(index*8,index*8+8));

export function createRecordCloudStore({transport,householdId,applicationProjection,readLegacyImports}={}){
  const testTransport=transport?.emulator&&/^demo-/.test(transport.emulator.projectId)&&/^127\.0\.0\.1:\d+$/.test(transport.emulator.host);
  const gate=transport?.releaseGate;
  if(!testTransport&&!(gate?.enabled===true&&gate.householdId===householdId&&gate.storageVersion===2&&gate.minClientVersion===117&&gate.phase==='active'&&gate.epoch))throw storageError('emulator-only','Nieuwe cloudopslag is nog niet voor productie vrijgegeven.');
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(householdId||''))throw storageError('household-scope','Een geldig huishouden is verplicht.');
  const household=`households/${householdId}`,controlPath=household+'/financialStorage/current',legacyPath=household+'/budgetState/current';
  const epochPath=epoch=>household+'/financialEpochs/'+epoch;
  async function context({allowMigration=false,allowPending=false}={}){
    const control=await transport.get(controlPath),c=control?.data;
    if(gate&&(c?.epoch!==gate.epoch||c?.minClientVersion!==gate.minClientVersion))throw storageError('storage-version','Het vrijgegeven productie-epoch wijkt af.');
    if(c?.storageVersion!==RECORD_STORAGE_VERSION||!['active',...(allowMigration?['preparing','verified']:[])].includes(c.phase))throw storageError('storage-version','Het recordmodel is nog niet geverifieerd en geactiveerd.');
    const root=epochPath(c.epoch),head=await transport.get(root+'/meta/head');
    if(!head||head.data.epoch!==c.epoch||head.data.storageVersion!==RECORD_STORAGE_VERSION)throw storageError('storage-version','Het cloudversiecontract is inconsistent.');
    if(!allowPending&&head.data.phase!=='ready')throw storageError('cloud-pending','Een onderbroken cloudpublicatie moet eerst worden gecontroleerd en hervat.');
    return {control,head,root};
  }
  async function components(root){
    const [records,periods,global,manifests,settings]=await Promise.all([transport.query(root+'/records'),transport.query(root+'/periods'),transport.get(root+'/globals/financial'),transport.query(root+'/manifests'),transport.get(root+'/globals/settings')]);
    return {records:records.map(row=>row.data),periods:periods.map(row=>row.data),global:global?.data||null,manifests:manifests.map(row=>row.data),settings:settings?.data||null};
  }
  async function verifyAt(root,head){
    const values=await components(root),decoded=await decodeRecordSnapshot(head,values.records);
    if(head.manifestHashes)await verifyRecordManifests(head,values.records,values.manifests);
    if(head.settingsHash&&head.settingsHash!==await digest(values.settings))throw storageError('cloud-integrity','De globale instellingen wijken af.');
    if(head.globalHash!==await digest(values.global))throw storageError('cloud-integrity','De cumulatieve cloudprojectie wijkt af.');
    for(const [month,hash]of Object.entries(head.periodHashes)){
      const period=values.periods.find(row=>row.month===month);
      if(!period||await digest(period)!==hash)throw storageError('cloud-integrity','Financiële maandprojectie ontbreekt of is corrupt: '+month);
      const dependencies=values.records.filter(row=>row.periods.includes(month)).map(row=>({id:row.id,hash:row.hash})).sort((a,b)=>a.id.localeCompare(b.id));
      if(!same(dependencies,period.dependencies))throw storageError('cloud-integrity','Financiële maandafhankelijkheden zijn niet compleet: '+month);
    }
    return {...decoded,...values,head};
  }
  async function verifyIntegrity(options={}){
    const c=await context(options),result=await verifyAt(c.root,c.head.data),after=await transport.get(c.root+'/meta/head');
    if(!same(after.data,c.head.data))throw storageError('cloud-conflict','De cloudstand wijzigde tijdens integriteitscontrole.');
    return result;
  }
  async function assertLegacySource(control){
    const legacy=await transport.get(legacyPath);
    if((legacy?.data?.syncVersion||0)!==control.sourceVersion||await digest(legacy?.data||null)!==control.sourcePointerHash)throw storageError('migration-source-conflict','De beschermde oude cloudbron wijzigde tijdens migratie.');
    const headers=(await transport.query(household+'/imports')).map(row=>({path:row.path,data:row.data})).sort((a,b)=>a.path.localeCompare(b.path));
    if(await digest(headers)!==control.sourceImportHeadersHash)throw storageError('migration-source-conflict','De oude importheaders wijzigden tijdens de migratiecontrole.');
  }
  async function migrate({state,imports=[],epoch,legacyPointer,checkpoint=()=>{},initialization=false}){
    if(!testTransport)throw storageError('production-disabled','Migratie is uitsluitend beschikbaar in de testomgeving.');
    if(!/^[A-Za-z0-9_-]{1,120}$/.test(epoch||''))throw storageError('migration-epoch','Ongeldig migratie-epoch.');
    let existing=await transport.get(controlPath);
    if(!existing){
      const legacy=await transport.get(legacyPath);
      if(!same(legacy?.data||null,legacyPointer||null))throw storageError('migration-source-conflict','De gelezen oude cloudstand is intussen gewijzigd.');
      let sourceState=legacy?.data?.state;
      if(legacy?.data?.stateFormat){
        const pointer=legacy.data,path=legacyPath+'/generations/'+pointer.activeGeneration,descriptor=(await transport.get(path))?.data;
        if(!descriptor)throw storageError('migration-incomplete','De oude generatie ontbreekt.');
        const chunks=[];for(let i=0;i<descriptor.chunkCount;i++)chunks.push((await transport.get(path+'/chunks/'+i))?.data||null);
        sourceState=await decodeCloudState(pointer,descriptor,chunks);
      }
      if(sourceState&&!same(sourceState,state))throw storageError('migration-source-conflict','De migratiekandidaat wijkt af van de teruggelezen oude financiële bron.');
      const oldHeaders=await transport.query(household+'/imports');
      if(initialization&&(legacy||oldHeaders.length))throw storageError('migration-source-conflict','Een nieuwe administratie mag geen bestaande cloudhistorie vervangen.');
      const sourceImports=readLegacyImports?await readLegacyImports(oldHeaders,transport):oldHeaders.map(row=>{if(!Array.isArray(row.data.rows))throw storageError('migration-incomplete','De bestaande importdelen vereisen een volledige legacy-readback.');return row.data;});
      if(!initialization&&!same(sourceImports,imports))throw storageError('migration-source-conflict','Niet alle bestaande cloudimports en CSV-bronnen zijn verliesloos meegenomen.');
      const control={storageVersion:2,minClientVersion:117,epoch,phase:'preparing',sourceVersion:legacy?.data?.syncVersion||0,sourcePointerHash:await digest(legacy?.data||null),sourceImportHeadersHash:await digest(oldHeaders.map(row=>({path:row.path,data:row.data})).sort((a,b)=>a.path.localeCompare(b.path))),sourceStateHash:await digest(state),sourceImportsHash:await digest(imports)};
      const head={storageVersion:2,epoch,phase:'ready',revision:0,lastOperation:'',pendingOperation:'',stateHash:'',importsHash:'',layout:{},recordCount:0,importCount:0,periodHashes:{},globalHash:''};
      await transport.commit([{path:controlPath,data:control},{path:epochPath(epoch)+'/meta/head',data:head}],new Map([[controlPath,null],[epochPath(epoch)+'/meta/head',null]]));
      existing={data:control};
    }
    if(existing.data.epoch!==epoch||existing.data.sourceStateHash!==await digest(state)||existing.data.sourceImportsHash!==await digest(imports))throw storageError('migration-source-conflict','Een ander migratie-epoch of andere bron is al beschermd.');
    await checkpoint('protected');
    if(existing.data.phase==='active')return verifyIntegrity();
    await assertLegacySource(existing.data);
    await commit({state,imports,operationId:'migration-'+epoch,expectedRevision:0,allowMigration:true,checkpoint});
    const result=await verifyIntegrity({allowMigration:true});await checkpoint('verified-readback');
    const latest=await transport.get(controlPath);await assertLegacySource(latest.data);
    await transport.commit([{path:controlPath,data:{...latest.data,phase:'verified',verifiedStateHash:result.head.stateHash,verifiedRecordCount:result.head.recordCount,verifiedPeriodCount:Object.keys(result.head.periodHashes).length}}],new Map([[controlPath,latest.version]]));
    return result;
  }
  async function activate({approveTestCutover=false}={}){
    if(!testTransport)throw storageError('production-disabled','Productiemigratie en activering vereisen de afzonderlijke releaseprocedure.');
    if(approveTestCutover!==true)throw storageError('cutover-approval','Omschakeling vereist een afzonderlijke expliciete testgoedkeuring.');
    const c=await context({allowMigration:true});
    if(c.control.data.phase==='active')return c.head.data;
    if(c.control.data.phase!=='verified')throw storageError('migration-incomplete','De migratie is nog niet volledig teruggelezen.');
    await assertLegacySource(c.control.data);await verifyAt(c.root,c.head.data);
    await transport.commit([{path:controlPath,data:{...c.control.data,phase:'active'}}],new Map([[controlPath,c.control.version]]));
    return c.head.data;
  }
  async function stageOperation(c,next,operationId,members,checkpoint){
    const path=c.root+'/operations/'+operationId,old=await transport.get(path);
    if(old&&old.data.phase!=='prepared'){if(old.data.stateHash!==next.stateHash||old.data.importsHash!==next.importsHash||old.data.memberHash!==await digest(members))throw storageError('operation-reused','Dit operatie-ID hoort al bij een andere wijziging.');return old.data;}
    const previous=next.preparedChanges?null:c.head.data.revision?await components(c.root):null,changes=(next.preparedChanges||recordChanges(previous,next)).sort((a,b)=>a.path.localeCompare(b.path));
    const targetHead={storageVersion:2,epoch:c.control.data.epoch,phase:'ready',revision:c.head.data.revision+1,lastOperation:operationId,pendingOperation:'',stateHash:next.stateHash,importsHash:next.importsHash,layout:next.layout,recordCount:next.recordCount,importCount:next.importCount,periodHashes:next.periodHashes,globalHash:next.globalHash,manifestHashes:next.manifestHashes,settingsHash:next.settingsHash,...(next.targeted?{integrityMode:'manifest'}:{})};
    const operation={storageVersion:2,epoch:c.control.data.epoch,id:operationId,phase:'prepared',baseRevision:c.head.data.revision,stateHash:next.stateHash,importsHash:next.importsHash,changeCount:changes.length,changeHash:await digest(changes),targetHead,memberCount:members.length,memberHash:await digest(members),...(next.targeted?{verificationMode:'patch',requestHash:next.requestHash}: {})};
    if(old&&!same(old.data,operation))throw storageError('operation-reused','Het voorbereide operatiebewijs wijkt af.');
    if(!old)await transport.commit([{path,data:operation}],new Map([[path,null]]));await checkpoint('operation-prepared');
    for(const batch of batches(changes))await transport.commit(batch.map(change=>({path:path+'/changes/'+change.id,data:change})));
    for(const batch of batches(members))await transport.commit(batch.map(member=>({path:path+'/members/'+member.id,data:member})));
    await checkpoint('changes-staged');return operation;
  }
  async function recover(operationId,{allowMigration=false,checkpoint=()=>{}}={}){
    const c=await context({allowMigration,allowPending:true}),operationPath=c.root+'/operations/'+operationId,stored=await transport.get(operationPath),operation=stored?.data;
    if(!operation)throw storageError('operation-missing','Het voorbereide cloudoperatiebewijs ontbreekt.');
    if(operation.phase==='committed')return {outcome:'committed',operationId,revision:operation.targetHead.revision,replayed:true};
    const changes=(await transport.query(operationPath+'/changes')).map(row=>row.data).sort((a,b)=>a.id.localeCompare(b.id));
    if(changes.length!==operation.changeCount||await digest([...changes].sort((a,b)=>a.path.localeCompare(b.path)))!==operation.changeHash)throw storageError('operation-incomplete','De voorbereide cloudwijziging is niet volledig; financiële publicatie is geblokkeerd.');
    const memberProofs=(await transport.query(operationPath+'/members')).map(row=>row.data).sort((a,b)=>a.id.localeCompare(b.id));
    if(memberProofs.length!==operation.memberCount||await digest(memberProofs)!==operation.memberHash)throw storageError('operation-incomplete','De lokale operatiebewijzen zijn niet compleet.');
    if(c.head.data.phase==='ready'){
      if(c.head.data.revision!==operation.baseRevision)throw storageError('cloud-conflict','De cloudbasis wijzigde; de lokale en externe versies blijven bewaard.');
      await transport.commit([{path:c.root+'/meta/head',data:{...c.head.data,phase:'applying',pendingOperation:operationId}},{path:operationPath,data:{...operation,phase:'applying'}}],new Map([[c.root+'/meta/head',c.head.version],[operationPath,stored.version]]));
    }else if(c.head.data.pendingOperation!==operationId)throw storageError('cloud-pending','Een andere cloudoperatie moet eerst worden hervat.');
    await checkpoint('locked');
    for(const batch of batches(changes)){
      await transport.commit(batch.map(change=>({path:c.root+'/'+change.path,data:change.after})));
      await checkpoint('records-applied');
    }
    if(operation.verificationMode==='patch'){
      for(const change of changes){const actual=(await transport.get(c.root+'/'+change.path))?.data;if(!same(actual,change.after))throw storageError('cloud-integrity','Een gerichte wijziging is niet duurzaam teruggelezen.');}
      for(const change of changes.filter(row=>row.path.startsWith('periods/'))){
        const rows=await transport.query(c.root+'/records',{field:'periods',op:'ARRAY_CONTAINS',value:change.after.month});
        await verifiedPeriodResult(operation.targetHead,change.after,rows.map(row=>row.data),(await transport.get(c.root+'/globals/financial'))?.data);
      }
    }else await verifyAt(c.root,operation.targetHead);await checkpoint('target-verified');
    const [head,op]=await Promise.all([transport.get(c.root+'/meta/head'),transport.get(operationPath)]);
    if(head.data.pendingOperation!==operationId||head.data.revision!==operation.baseRevision)throw storageError('cloud-conflict','Het publicatiebewijs is intussen gewijzigd.');
    const members=memberProofs.map(member=>({path:c.root+'/receipts/'+member.id,data:{...member,epoch:operation.epoch,storageVersion:2,cloudOperation:operationId,cloudRevision:operation.targetHead.revision,outcome:'prepared'}}));
    for(const batch of batches(members))await transport.commit(batch);
    await checkpoint('members-staged');
    await transport.commit([{path:c.root+'/meta/head',data:operation.targetHead},{path:operationPath,data:{...operation,phase:'committed'}}],new Map([[c.root+'/meta/head',head.version],[operationPath,op.version]]));
    await checkpoint('committed');return {outcome:'committed',operationId,revision:operation.targetHead.revision,replayed:false};
  }
  async function commit({state,imports=[],operationId,expectedRevision,members=[],allowMigration=false,checkpoint=()=>{}}){
    members=[...members].sort((a,b)=>a.id.localeCompare(b.id));
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(operationId||'')||members.some(member=>!/^[A-Za-z0-9_-]{1,160}$/.test(member.id||'')))throw storageError('operation-id','Een stabiel geldig operatie-ID is verplicht.');
    const c=await context({allowMigration,allowPending:true}),existing=await transport.get(c.root+'/operations/'+operationId);
    if(c.head.data.integrityMode==='manifest')throw storageError('period-workspace-required','Gebruik het gerichte periodecontract voor deze administratie; een volledige oude snapshot mag dit contract niet overschrijven.');
    if(existing){
      if(existing.data.stateHash!==await digest(state)||existing.data.importsHash!==await digest(imports)||existing.data.memberHash!==await digest(members))throw storageError('operation-reused','Een operatie-ID kan niet opnieuw voor andere gegevens worden gebruikt.');
      if(existing.data.phase==='committed')return {outcome:'committed',operationId,revision:existing.data.targetHead.revision,replayed:true};
      if(existing.data.phase==='prepared'&&c.head.data.phase==='ready'){
        const next=await buildRecordSnapshot(state,imports,{periods:Object.keys(c.head.data.periodHashes),applicationProjection});
        await stageOperation(c,next,operationId,members,checkpoint);
      }
      return recover(operationId,{allowMigration,checkpoint});
    }
    if(c.head.data.phase!=='ready')throw storageError('cloud-pending','De vorige cloudpublicatie is nog niet compleet.');
    if(c.head.data.revision!==expectedRevision)throw storageError('cloud-conflict','Een ander apparaat heeft de cloud gewijzigd. Geen lokale goedkeuring wordt overschreven.');
    const next=await buildRecordSnapshot(state,imports,{periods:Object.keys(c.head.data.periodHashes),applicationProjection});
    // Stable order makes the prepared change digest independent of query response order.
    await stageOperation(c,next,operationId,members,checkpoint);return recover(operationId,{allowMigration,checkpoint});
  }
  async function loadPeriod(month){
    const c=await context(),[period,global,rows]=await Promise.all([transport.get(c.root+'/periods/'+month),transport.get(c.root+'/globals/financial'),transport.query(c.root+'/records',{field:'periods',op:'ARRAY_CONTAINS',value:month})]);
    const result=await verifiedPeriodResult(c.head.data,period?.data,rows.map(row=>row.data),global?.data),after=await transport.get(c.root+'/meta/head');
    if(!same(c.head.data,after?.data))throw storageError('cloud-conflict','De financiële periode wijzigde tijdens het laden. Probeer opnieuw.');
    result.transactions=(await decodeRecordValues(result.records)).filter(row=>row.collection==='transactions').map(row=>row.value);
    result.state={__finizePartialHistory:true,verifiedPeriods:[month],transactions:clone(result.transactions)};
    return result;
  }
  async function loadImport(id){
    const c=await context(),logicalId=await digest(JSON.stringify(['@imports',id]));
    const [headers,rows]=await Promise.all([transport.query(c.root+'/records',{field:'logicalId',value:logicalId}),transport.query(c.root+'/records',{field:'collection',value:'@rows:'+id})]);
    const values=await decodeRecordValues([...headers,...rows].map(row=>row.data)),header=values.find(row=>row.collection==='@imports')?.value;
    if(!header)throw storageError('cloud-missing','De cloudimport ontbreekt.');
    const result={...header,rows:values.filter(row=>row.collection==='@rows:'+id).sort((a,b)=>a.ordinal-b.ordinal).map(row=>row.value)};
    if(!same(c.head.data,(await transport.get(c.root+'/meta/head'))?.data))throw storageError('cloud-conflict','De import wijzigde tijdens laden.');
    return result;
  }
  async function operationReceipt(id){
    const c=await context({allowPending:true}),receipt=(await transport.get(c.root+'/receipts/'+id))?.data;
    if(!receipt)return null;
    const operation=(await transport.get(c.root+'/operations/'+receipt.cloudOperation))?.data;
    return operation?.phase==='committed'&&operation.targetHead.revision===receipt.cloudRevision?{...receipt,outcome:'committed'}:null;
  }
  async function exportRollback(){
    const result=await verifyIntegrity(),root=epochPath(result.head.epoch),ops=await transport.query(root+'/operations');
    const operations=await Promise.all(ops.map(async row=>({...row.data,members:(await transport.query(row.path+'/members')).map(member=>member.data),changes:(await transport.query(row.path+'/changes')).map(change=>change.data)})));
    if(!same(result.head,(await transport.get(root+'/meta/head'))?.data))throw storageError('cloud-conflict','De cloudstand wijzigde tijdens het maken van het herstelpakket.');
    return {storageVersion:2,epoch:result.head.epoch,revision:result.head.revision,stateHash:result.head.stateHash,importsHash:result.head.importsHash,state:result.state,imports:result.imports,operations,receipts:(await transport.query(root+'/receipts')).map(row=>row.data),warning:'Exporteer deze actuele stand; zet nooit uitsluitend een oud generatiepointer terug.'};
  }
  async function operationStatus(id){const c=await context({allowPending:true});return (await transport.get(c.root+'/operations/'+id))?.data||null;}
  async function preparePeriodStorage(){
    const c=await context();if(c.head.data.manifestHashes&&c.head.data.settingsHash)return {outcome:'ready'};
    // One explicit, verified upgrade of the earlier P3 storage contract, without new bookings.
    const full=await verifyIntegrity();
    return commit({state:full.state,imports:full.imports,expectedRevision:full.head.revision,operationId:'period-manifests-'+full.head.epoch+'-'+full.head.revision});
  }
  const workspace=createPeriodWorkspace({transport,context,loadPeriod,loadImport,stageOperation,recover,applicationProjection});
  async function initializeNew({state,imports=[],epoch,approveTestCutover=false}){
    if(!testTransport||approveTestCutover!==true)throw storageError('production-disabled','Nieuwe recordadministratie wordt uitsluitend expliciet in de emulator gestart.');
    if(await transport.get(legacyPath))throw storageError('migration-source-conflict','Dit huishouden heeft legacyhistorie; gebruik de gecontroleerde migratie.');
    await migrate({state,imports,epoch,legacyPointer:null,initialization:true});await activate({approveTestCutover:true});return verifyIntegrity();
  }
  return {householdId,initializeNew,migrate,activate,commit,recover,loadPeriod,loadImport,verifyIntegrity,operationReceipt,operationStatus,exportRollback,preparePeriodStorage,context,transport,...workspace};
}
