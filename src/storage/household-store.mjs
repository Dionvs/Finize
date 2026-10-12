import { profileSync, profileStart, profileCount } from './performance.mjs';
import { backupDigest } from './migration-backups.mjs';
import { assertOriginalBankDataUnchanged } from '../core/transaction-model.mjs';
import { getTransactionFinancialMonth } from '../core/transaction-engine.mjs';
import { createPeriodCache } from './period-cache.mjs';
import { PAYLOAD_STORE, PAYLOAD_PROTECTION, REPRESENTATION_META, REPRESENTATION_BACKUP, REPRESENTATION_STAGE, migratePayloadRepresentation, payloadDatabase, preparationSignature } from './payload-parts.mjs';

export const HOUSEHOLD_DATABASE_VERSION = 4;
export const LOCAL_STORAGE_VERSION = 1;
const connections = new Map();
const clone = value => structuredClone(value);
const fail = (code,message) => Object.assign(new Error(message),{code,storageFailure:true});
const stores = ['imports','journal','syncQueue','financialRecords','financialHead','operationReceipts','financialOutbox','periodCache'];

export function openHouseholdDatabase(scope='legacy') {
  if(connections.has(scope))return connections.get(scope);
  const opening=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(fail('storage-unavailable','IndexedDB is niet beschikbaar.'));return;}
    const request=indexedDB.open(scope==='legacy'?'finize-imports-v1':`finize-imports-v1-${scope}`,HOUSEHOLD_DATABASE_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of stores)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      for(const name of [PAYLOAD_STORE,PAYLOAD_PROTECTION,REPRESENTATION_META,REPRESENTATION_BACKUP,REPRESENTATION_STAGE])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      const records=request.transaction.objectStore('financialRecords');
      if(!records.indexNames.contains('periods'))records.createIndex('periods','periods',{multiEntry:true});
      if(!records.indexNames.contains('collection'))records.createIndex('collection','collection');
      const imports=request.transaction.objectStore('imports');
      if(!imports.indexNames.contains('status'))imports.createIndex('status','status');
      const periods=request.transaction.objectStore('periodCache');
      if(!periods.indexNames.contains('offline'))periods.createIndex('offline','offline');
    };
    request.onerror=()=>reject(request.error||fail('storage-unavailable','Huishoudopslag openen mislukt.'));
    let blocked=false;
    request.onblocked=()=>{blocked=true;reject(fail('storage-blocked','Sluit de andere Finize-tabbladen om de lokale opslag veilig te openen.'));};
    request.onsuccess=async()=>{
      const db=request.result;
      if(blocked){db.close();return;}
      db.onversionchange=()=>{db.close();connections.delete(scope);};
      try{await migratePayloadRepresentation(db,stores,scope,{decodeState:decodeHouseholdState});resolve(payloadDatabase(db,stores));}
      catch(error){db.close();reject(error);}
    };
  }).catch(error=>{connections.delete(scope);throw error;});
  connections.set(scope,opening);return opening;
}

// This is a lossless storage codec for schema-v11, not another financial engine.
export function encodeHouseholdState(state,{basis=null}={}) {
  const finish=profileStart('commit.encodeHouseholdState');
  const records=[],layout={},reused=new Set(),entries=new Map();
  function add(collection,recordId,value,periods){
    const id=JSON.stringify([collection,recordId]),previous=basis?.get(id);
    const signature=basis?preparationSignature(value):null;
    profileCount('commit.recordsCompared');
    if(previous&&signature!==null&&previous.signature===signature){
      records.push({id,collection,recordId,value,periods:previous.periods});
      entries.set(id,previous);reused.add(id);profileCount('commit.recordsReused');return;
    }
    const record={id,collection,recordId,value:clone(value),periods:periods()};
    records.push(record);if(basis)entries.set(id,{signature,periods:record.periods});profileCount('commit.recordsEncoded');
  }
  for(const [collection,value]of Object.entries(state)){
    const ids=Array.isArray(value)?value.map(row=>row?.id):[];
    const list=Array.isArray(value)&&ids.every(id=>typeof id==='string'&&id)&&new Set(ids).size===ids.length;
    if(list){
      layout[collection]={kind:'list',ids};
      for(const row of value){
        add(collection,row.id,row,()=>{
        const lines=[row,...(row.processing?.splits||row.splits||[]).map(split=>({...row,...split,processing:{...row.processing,...split}}))];
        const periods=collection==='transactions'?[...new Set([String(row.bankOriginal?.bankDate||row.date||'').slice(0,7),...lines.flatMap(line=>[getTransactionFinancialMonth(line),getTransactionFinancialMonth(line,{dimension:'fixed'}),line.refundMonth||line.processing?.refundMonth])].filter(month=>/^\d{4}-\d{2}$/.test(month)))]:collection==='savingsGoalLedger'&&/^\d{4}-\d{2}$/.test(row.month)?[row.month]:[];
        return periods;});
      }
    }else{
      layout[collection]={kind:'value'};
      add(collection,'',value,()=>[]);
    }
  }
  finish();return {layout,records,reused,entries};
}

export function decodeHouseholdState(head,records) {
  if(head?.storageVersion!==LOCAL_STORAGE_VERSION||head.schemaVersion!==11)throw fail('storage-version','Onbekende lokale opslagversie.');
  const values=new Map(records.map(record=>[record.id,record.value])),state={};
  for(const [collection,layout]of Object.entries(head.layout)){
    const read=id=>{const key=JSON.stringify([collection,id]);if(!values.has(key))throw fail('storage-integrity','Een vereist financieel record ontbreekt: '+collection);return clone(values.get(key));};
    state[collection]=layout.kind==='list'?layout.ids.map(read):read('');
  }
  return state;
}

function requestResult(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function completed(transaction){return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error||fail('storage-aborted','De lokale opslagtransactie is afgebroken.'));});}
async function financialSnapshot(transaction){
  const head=await requestResult(transaction.objectStore('financialHead').get('current'));
  if(!head)return {head:null,records:[]};
  const records=transaction.objectStore('financialRecords');
  if(!head.partialHistory)return {head,records:await requestResult(records.getAll())};
  const keys=Object.entries(head.layout).flatMap(([collection,layout])=>(layout.kind==='list'?layout.ids:['']).map(id=>JSON.stringify([collection,id])));
  const selected=await Promise.all(keys.map(id=>requestResult(records.get(id))));
  if(selected.some(row=>!row))throw fail('storage-integrity','Een vereiste lokale periodeafhankelijkheid ontbreekt.');
  return {head,records:selected};
}

export function createHouseholdStore(scope='legacy',{verifySource=async()=>{}}={}) {
  let cachedHead=null,cachedRecords=new Map(),encodingBasis=new Map();
  // Metadata only: exact content signatures and period references of the last
  // verified durable base. No second financial state or cross-household cache.
  function adoptBasis(head,records){
    cachedHead=clone(head);cachedRecords=new Map(records.map(record=>[record.id,JSON.stringify(record)]));
    encodingBasis=new Map(records.map(record=>[record.id,{signature:preparationSignature(record.value),periods:record.periods}]));
  }
  async function retainedInventory(){
    const names=['imports','journal','syncQueue'],db=await openHouseholdDatabase(scope),tx=db.transaction(names,'readonly'),done=completed(tx);
    const values=await Promise.all([...names.map(name=>requestResult(tx.objectStore(name).getAll())),done]);
    return Object.fromEntries(await Promise.all(names.map(async(name,index)=>[name,{count:values[index].length,sha256:await backupDigest(JSON.stringify(values[index]))}])));
  }
  async function load({allowUnverified=false}={}){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(['financialHead','financialRecords'],'readonly'),done=completed(tx);
    const [{head,records}]=await Promise.all([financialSnapshot(tx),done]);
    if(!head)return null;
    if(!allowUnverified&&!head.verified)throw fail('storage-migration','De opslagmigratie moet eerst worden gecontroleerd.');
    const state=decodeHouseholdState(head,records);
    if(await backupDigest(JSON.stringify(state))!==head.sha256)throw fail('storage-integrity','De teruggelezen financiële opslag wijkt af. De oude opslag blijft behouden.');
    adoptBasis(head,records);
    return state;
  }
  async function commit(state,{expectedHash=cachedHead?.sha256??null,operationId=crypto.randomUUID(),importMutation=null,migration=null,queueCloud=true,cloudAcceptance=null,periodAcceptance=null,resolutionAcceptance=null,payloadPreparation=null}={}){
    await verifySource(migration||cachedHead?.migration);
    if(cloudAcceptance&&(importMutation||queueCloud))throw fail('storage-contract','Een cloudontvangst accepteert geen parallelle lokale importbewerking.');
    if(periodAcceptance&&(!state.__finizePartialHistory||queueCloud||importMutation||cloudAcceptance))throw fail('storage-contract','Periodeontvangst gebruikt één gecontroleerde lokale commit zonder financiële heruitvoering.');
    if(resolutionAcceptance&&(!state.__finizePartialHistory||!queueCloud||periodAcceptance||cloudAcceptance||importMutation))throw fail('storage-contract','Conflictoplossing vereist één atomaire periodecommit met outbox.');
    const durableBasis=cachedHead&&clone(cachedHead);
    if(payloadPreparation?.binding){
      const binding=payloadPreparation.binding;
      if(binding.scope!==scope)throw fail('household-scope','De commitvoorbereiding hoort bij een ander huishouden.');
      if(binding.sha256!==durableBasis?.sha256||binding.storageRevision!==durableBasis?.storageRevision||binding.migration!==JSON.stringify(durableBasis?.migration??null))payloadPreparation=null; // full codec fallback
    }
    const canReuse=expectedHash===(durableBasis?.sha256??null);
    const encoded=encodeHouseholdState(state,{basis:canReuse?encodingBasis:new Map()}),finishHash=profileStart('commit.canonicalHash');
    const sha256=await backupDigest(JSON.stringify(state));finishHash();
    const next={id:'current',storageVersion:LOCAL_STORAGE_VERSION,schemaVersion:11,storageRevision:(cachedHead?.storageRevision||0)+1,revision:Number(state.meta?.revision)||0,layout:encoded.layout,sha256,verified:!migration,migration:migration||cachedHead?.migration||null,operationId};
    if(state.__finizePartialHistory)next.partialHistory=true;
    const finishDiff=profileStart('commit.recordDiff');
    const desired=new Set(encoded.records.map(record=>record.id));
    const changes=encoded.records.filter(record=>!encoded.reused.has(record.id)&&cachedRecords.get(record.id)!==JSON.stringify(record)).map(record=>({record,before:cachedRecords.has(record.id)?JSON.parse(cachedRecords.get(record.id)):null}));
    profileCount('commit.recordsChanged',changes.length);profileCount('commit.recordsUnchanged',encoded.records.length-changes.length);
    const removed=[...cachedRecords].filter(([id])=>!desired.has(id)).map(([,value])=>JSON.parse(value));
    finishDiff();
    const db=await openHouseholdDatabase(scope);
    const receipt={id:operationId,outcome:'committed',storageRevision:next.storageRevision,revision:next.revision,sha256,importId:importMutation?.batch?.id||'',importVersion:importMutation?.batch?.version??null,committedAt:new Date().toISOString()};
    let confirmedReceipt=receipt,confirmedHead=next;
    const finishNative=profileStart('commit.native.wall');
    await new Promise((resolve,reject)=>{
      let failure;
      const tx=db.transaction(stores,'readwrite',{durability:'strict',finizePreparation:payloadPreparation});
      const abort=error=>{failure=failure||error;try{tx.abort();}catch{/* An already aborted transaction still reports the original failure. */}};
      tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(failure||tx.error||fail('storage-aborted','De lokale financiële commit is afgebroken.'));
      const heads=tx.objectStore('financialHead'),get=heads.get('current'),operation=tx.objectStore('operationReceipts').get(operationId);
      operation.onsuccess=()=>{
        if(get.result?.partialHistory&&!state.__finizePartialHistory){abort(fail('storage-contract','Een periodeadministratie kan niet via het oude volledige-statecontract worden overschreven.'));return;}
        if(get.result&&!get.result.verified){abort(fail('storage-migration','Een ongecontroleerde migratiestand accepteert geen financiële wijzigingen.'));return;}
        const existing=operation.result;
        if(existing){
          if(existing.sha256!==sha256){abort(fail('storage-operation-reused','Dit operatie-ID is al gebruikt voor een andere financiële wijziging.'));return;}
          if(get.result?.sha256!==sha256){abort(fail('storage-operation-committed','Deze operatie is al bevestigd; lees eerst de nieuwere duurzame stand.'));return;}
          confirmedReceipt=existing;confirmedHead=get.result;return;
        }
        if(!canReuse||(get.result?.sha256??null)!==expectedHash){abort(fail('storage-conflict','De duurzame financiële stand is intussen gewijzigd. Herlaad de actuele stand; je invoer blijft behouden.'));return;}
        if((get.result?.storageRevision??null)!==(durableBasis?.storageRevision??null)||JSON.stringify(get.result?.migration??null)!==JSON.stringify(durableBasis?.migration??null)){abort(fail('storage-conflict','De revisie of migratiebasis van de commitvoorbereiding is gewijzigd.'));return;}
        const publish=()=>{
          try{
            const records=tx.objectStore('financialRecords');
            if(!state.__finizePartialHistory)for(const record of removed)records.delete(record.id);
            for(const change of changes)records.put(change.record);
            // Pre-share the exact committed state graph with later journals.
            // This hash is physical proof metadata; reads still use the single
            // canonical financial layout and its existing SHA-256 contract.
            next.payloadStateHash=tx.seedStatePayload(state);
            heads.put(next);tx.objectStore('operationReceipts').put(receipt);
            if(state.__finizePartialHistory&&!get.result?.partialHistory)tx.objectStore('journal').put({id:'pre-period-head-'+next.storageRevision,operation:'preserved-full-history-head',head:clone(get.result),scope});
            if(periodAcceptance)tx.objectStore('financialOutbox').put({...clone(periodAcceptance),id:'cloud-base',localSha256:sha256});
            if(resolutionAcceptance){
              const journal=tx.objectStore('journal'),read=journal.get(resolutionAcceptance.id),outbox=tx.objectStore('financialOutbox'),all=outbox.getAll();
              read.onsuccess=()=>{if(!read.result||read.result.status!=='conflict'||read.result.localHash!==expectedHash){abort(fail('storage-conflict','De beoordeelde conflictstand is gewijzigd.'));return;}journal.put({...read.result,resolution:{...clone(resolutionAcceptance.resolution),outcome:'pending'}});};
              all.onsuccess=()=>{for(const row of all.result)if(row.conflictId===resolutionAcceptance.id)outbox.put({...row,status:'pending'});};
              outbox.put({...clone(resolutionAcceptance.base),id:'cloud-base'});
            }
            if(queueCloud){
              const outbox=tx.objectStore('financialOutbox');
              const finishOutbox=profileStart('commit.outboxPreparation');
              outbox.put({id:operationId,operationId,status:'pending',storageRevision:next.storageRevision,revision:next.revision,sha256,previousHash:expectedHash,layout:encoded.layout,changes,removed,queuedAt:receipt.committedAt,...(resolutionAcceptance?{conflictId:resolutionAcceptance.id}:{})});
              outbox.put({id:'current',operationId,status:'pending',storageRevision:next.storageRevision,sha256});finishOutbox();
            }
            if(importMutation){
              tx.objectStore('imports').put(clone(importMutation.batch));
              tx.objectStore('syncQueue').put(clone(importMutation.queue));
              tx.objectStore('journal').put({...clone(importMutation.journal),status:'completed',candidate:undefined,previousBatch:undefined,baseSignature:undefined,durableBaseSignature:undefined});
            }
            if(cloudAcceptance){
              for(const batch of cloudAcceptance.imports)tx.objectStore('imports').put(clone(batch));
              tx.objectStore('financialOutbox').put({...clone(cloudAcceptance.base),id:'cloud-base',localSha256:sha256});
            }
          }catch(error){abort(error);}
        };
        if(cloudAcceptance){
          const imports=tx.objectStore('imports').getAll(),queue=tx.objectStore('syncQueue').getAll();
          queue.onsuccess=()=>{
            try{
              if(JSON.stringify(imports.result)!==cloudAcceptance.expectedImportsSignature||queue.result.length)throw fail('import-conflict','Lokale importkeuzes wijzigden tijdens cloudontvangst.');
              for(const old of imports.result){const incoming=cloudAcceptance.imports.find(row=>row.id===old.id);if(!incoming){if(cloudAcceptance.partial===true)continue;throw fail('import-conflict','Een lokale import ontbreekt in de externe stand.');}assertOriginalBankDataUnchanged(old.rows,incoming.rows);}
              publish();
            }catch(error){abort(error);}
          };return;
        }
        if(!importMutation){publish();return;}
        const imports=tx.objectStore('imports'),read=imports.get(importMutation.batch.id);
        read.onsuccess=()=>{
          try{
            const old=read.result,expected=importMutation.previousBatch;
            if((Number(old?.version)||0)!==(Number(expected?.version)||0)||String(old?.operationId||'')!==String(expected?.operationId||''))throw fail('import-conflict','De importrevisie is intussen gewijzigd.');
            if(old?.lifecycle==='deleted'&&importMutation.batch.lifecycle!=='deleted')throw fail('import-conflict','De import is al verwijderd.');
            assertOriginalBankDataUnchanged(old?.rows,importMutation.batch.rows);publish();
          }catch(error){abort(error);}
        };
      };
    });
    finishNative();
    const finishCache=profileStart('commit.basisPreparation');
    cachedHead=clone(confirmedHead);
    for(const record of removed)cachedRecords.delete(record.id);
    for(const {record}of changes)cachedRecords.set(record.id,JSON.stringify(record));
    encodingBasis=encoded.entries;
    finishCache();return confirmedReceipt;
  }
  async function verifyAndActivate({verifySource}={}){
    const state=await load({allowUnverified:true});
    if(!state)return null;
    await verifySource?.(cachedHead.migration);
    if(cachedHead.verified)return state;
    if(cachedHead.migration?.retainedStores&&JSON.stringify(await retainedInventory())!==JSON.stringify(cachedHead.migration.retainedStores))throw fail('storage-migration-conflict','De bestaande import- of herstelopslag wijzigde tijdens migratie; beide kopieën blijven behouden.');
    const hash=cachedHead.sha256,db=await openHouseholdDatabase(scope);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('financialHead','readwrite',{durability:'strict'}),store=tx.objectStore('financialHead'),read=store.get('current');
      let failure;
      read.onsuccess=()=>{if(read.result?.sha256!==hash){failure=fail('storage-conflict','De migratiestand wijzigde tijdens controle.');tx.abort();return;}store.put({...read.result,verified:true,migration:{...read.result.migration,phase:'active'},verifiedAt:new Date().toISOString()});};
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error);
    });
    cachedHead.verified=true;cachedHead.migration.phase='active';return state;
  }
  async function migrate(state,metadata,options={}){
    const present=await load({allowUnverified:true});
    if(present)return verifyAndActivate(options);
    const migration={...metadata,retainedStores:await retainedInventory(),scope,phase:'prepared'};
    await commit(state,{expectedHash:null,migration,queueCloud:Boolean(metadata?.sourceSha256),operationId:'migration-'+crypto.randomUUID()});
    return verifyAndActivate(options);
  }
  async function acknowledgeCloud(hash){
    const db=await openHouseholdDatabase(scope),tx=db.transaction('financialOutbox','readwrite'),store=tx.objectStore('financialOutbox'),done=completed(tx),read=store.get('current');
    read.onsuccess=()=>{const current=read.result;if(current?.sha256!==hash)return;const all=store.getAll();all.onsuccess=()=>{for(const row of all.result)if(row.status==='pending'&&row.storageRevision<=current.storageRevision)store.delete(row.id);};};await done;
  }
  async function pendingCloud(){const db=await openHouseholdDatabase(scope),tx=db.transaction('financialOutbox','readonly'),done=completed(tx),[value]=await Promise.all([requestResult(tx.objectStore('financialOutbox').get('current')),done]);return value?.status==='pending'?value:null;}
  async function markCloudConflict(){const db=await openHouseholdDatabase(scope),tx=db.transaction('financialOutbox','readwrite'),store=tx.objectStore('financialOutbox'),done=completed(tx),read=store.getAll();read.onsuccess=()=>{for(const row of read.result)if(row.status==='pending')store.put({...row,status:'conflict'});};await done;}
  async function inspectOperation(id){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(['financialHead','financialRecords','operationReceipts'],'readonly'),done=completed(tx);
    const [{head,records},receipt]=await Promise.all([financialSnapshot(tx),requestResult(tx.objectStore('operationReceipts').get(id)),done]);
    const state=head?decodeHouseholdState(head,records):null;
    if(head&&await backupDigest(JSON.stringify(state))!==head.sha256)throw fail('storage-integrity','Het operatiebewijs heeft geen betrouwbare financiële stand.');
    adoptBasis(head,records);
    return {state,receipt:receipt||null};
  }
  async function readCloudSnapshot(){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(stores,'readonly'),done=completed(tx);
    const financial=financialSnapshot(tx),pending=requestResult(tx.objectStore('financialOutbox').getAll()),queued=requestResult(tx.objectStore('syncQueue').getAll());
    const importsRead=(async()=>{const {head}=await financial;if(!head?.partialHistory)return requestResult(tx.objectStore('imports').getAll());const queue=await queued;return (await Promise.all([...new Set(queue.map(row=>row.importId||row.id))].map(id=>requestResult(tx.objectStore('imports').get(id))))).filter(Boolean);})();
    const receiptsRead=(async()=>{const rows=await pending;return (await Promise.all(rows.filter(row=>row.id!=='current'&&['pending','conflict'].includes(row.status)).map(row=>requestResult(tx.objectStore('operationReceipts').get(row.id))))).filter(Boolean);})();
    const journalsRead=(async()=>{const {head}=await financial;if(!head?.partialHistory)return requestResult(tx.objectStore('journal').getAll());const rows=await pending;return (await Promise.all([...new Set(rows.map(row=>row.conflictId).filter(Boolean))].map(id=>requestResult(tx.objectStore('journal').get(id))))).filter(Boolean);})();
    const [{head,records},imports,outbox,receipts,journals,importQueue]=await Promise.all([financial,importsRead,pending,receiptsRead,journalsRead,queued,done]);
    if(!head?.verified)throw fail('storage-migration','Synchronisatie vereist geverifieerde lokale opslag.');
    const state=decodeHouseholdState(head,records);
    if(await backupDigest(JSON.stringify(state))!==head.sha256)throw fail('storage-integrity','De lokale synchronisatiebasis heeft een afwijkende hash.');
    const operations=outbox.filter(row=>['pending','conflict'].includes(row.status)&&row.id!=='current').sort((a,b)=>a.storageRevision-b.storageRevision);
    const pointer=outbox.find(row=>row.id==='current');if(pointer&&!operations.some(row=>row.id===pointer.operationId))throw fail('storage-integrity','De synchronisatiewijzer mist een duurzaam operatiebewijs.');
    for(const row of operations){row.receipt=receipts.find(receipt=>receipt.id===row.id);if(!row.receipt||row.receipt.sha256!==row.sha256)throw fail('storage-integrity','Een lokaal operatiebewijs ontbreekt.');}
    return {state,imports,operations,head,importQueue,conflicts:journals.filter(row=>row.operation==='record-cloud-conflict'&&row.status==='conflict'),cloudBase:outbox.find(row=>row.id==='cloud-base')||null};
  }
  async function acknowledgeRecordCloud(ids,base,confirmedImports=[],resolution=null){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(['financialOutbox','syncQueue','journal'],'readwrite',{durability:'strict'}),store=tx.objectStore('financialOutbox'),done=completed(tx),all=store.getAll();
    all.onsuccess=()=>{const selected=new Set(ids);for(const row of all.result)if(selected.has(row.id)&&row.id!=='current')store.delete(row.id);const pointer=all.result.find(row=>row.id==='current');if(pointer&&selected.has(pointer.operationId))store.delete('current');store.put({...clone(base),id:'cloud-base'});};
    for(const batch of confirmedImports){const queue=tx.objectStore('syncQueue'),read=queue.get(batch.id);read.onsuccess=()=>{const row=read.result;if(row&&row.operationId===batch.operationId&&Number(row.version)===Number(batch.version))queue.delete(batch.id);};}
    for(const resolved of resolution?(Array.isArray(resolution)?resolution:[resolution]):[]){const journal=tx.objectStore('journal'),read=journal.get(resolved.id);read.onsuccess=()=>{if(read.result)journal.put({...read.result,status:'resolved',resolution:clone(resolved)});};}
    await done;
  }
  async function preserveRecordConflict(conflict){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(['journal','financialOutbox'],'readwrite',{durability:'strict'}),done=completed(tx),outbox=tx.objectStore('financialOutbox');
    tx.objectStore('journal').put({...clone(conflict),id:conflict.id,operation:'record-cloud-conflict',status:'conflict',scope});
    const all=outbox.getAll();all.onsuccess=()=>{for(const row of all.result)if(conflict.operationIds.includes(row.id))outbox.put({...row,status:'conflict',conflictId:conflict.id});};await done;
  }
  async function markRecordResolution(id,resolution){
    const db=await openHouseholdDatabase(scope),tx=db.transaction('journal','readwrite',{durability:'strict'}),done=completed(tx),journal=tx.objectStore('journal'),read=journal.get(id);
    read.onsuccess=()=>{if(!read.result||read.result.status!=='conflict'){tx.abort();return;}journal.put({...read.result,resolution:{...clone(resolution),outcome:'pending'}});};await done;
  }
  const cache=createPeriodCache({scope,openDatabase:()=>openHouseholdDatabase(scope)});
  return {scope,cache,load,commit,migrate,verifyAndActivate,acknowledgeCloud,pendingCloud,markCloudConflict,inspectOperation,readCloudSnapshot,acknowledgeRecordCloud,preserveRecordConflict,markRecordResolution,get head(){return cachedHead&&clone(cachedHead);}};
}
