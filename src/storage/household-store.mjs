import { backupDigest } from './migration-backups.mjs';
import { assertOriginalBankDataUnchanged } from '../core/transaction-model.mjs';
import { getTransactionFinancialMonth } from '../core/transaction-engine.mjs';

export const HOUSEHOLD_DATABASE_VERSION = 2;
export const LOCAL_STORAGE_VERSION = 1;
const connections = new Map();
const clone = value => structuredClone(value);
const fail = (code,message) => Object.assign(new Error(message),{code,storageFailure:true});
const stores = ['imports','journal','syncQueue','financialRecords','financialHead','operationReceipts','financialOutbox'];

export function openHouseholdDatabase(scope='legacy') {
  if(connections.has(scope))return connections.get(scope);
  const opening=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(fail('storage-unavailable','IndexedDB is niet beschikbaar.'));return;}
    const request=indexedDB.open(scope==='legacy'?'finize-imports-v1':`finize-imports-v1-${scope}`,HOUSEHOLD_DATABASE_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of stores)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      const records=request.transaction.objectStore('financialRecords');
      if(!records.indexNames.contains('periods'))records.createIndex('periods','periods',{multiEntry:true});
      if(!records.indexNames.contains('collection'))records.createIndex('collection','collection');
    };
    request.onerror=()=>reject(request.error||fail('storage-unavailable','Huishoudopslag openen mislukt.'));
    let blocked=false;
    request.onblocked=()=>{blocked=true;reject(fail('storage-blocked','Sluit de andere Finize-tabbladen om de lokale opslag veilig te openen.'));};
    request.onsuccess=()=>{
      const db=request.result;
      if(blocked){db.close();return;}
      db.onversionchange=()=>{db.close();connections.delete(scope);};
      resolve(db);
    };
  }).catch(error=>{connections.delete(scope);throw error;});
  connections.set(scope,opening);return opening;
}

// This is a lossless storage codec for schema-v11, not another financial engine.
export function encodeHouseholdState(state) {
  const records=[],layout={};
  for(const [collection,value]of Object.entries(state)){
    const ids=Array.isArray(value)?value.map(row=>row?.id):[];
    const list=Array.isArray(value)&&ids.every(id=>typeof id==='string'&&id)&&new Set(ids).size===ids.length;
    if(list){
      layout[collection]={kind:'list',ids};
      for(const row of value){
        const lines=[row,...(row.processing?.splits||row.splits||[]).map(split=>({...row,...split,processing:{...row.processing,...split}}))];
        const periods=collection==='transactions'?[...new Set([String(row.bankOriginal?.bankDate||row.date||'').slice(0,7),...lines.flatMap(line=>[getTransactionFinancialMonth(line),getTransactionFinancialMonth(line,{dimension:'fixed'}),line.refundMonth||line.processing?.refundMonth])].filter(month=>/^\d{4}-\d{2}$/.test(month)))]:[];
        records.push({id:JSON.stringify([collection,row.id]),collection,recordId:row.id,value:clone(row),periods});
      }
    }else{
      layout[collection]={kind:'value'};
      records.push({id:JSON.stringify([collection,'']),collection,recordId:'',value:clone(value),periods:[]});
    }
  }
  return {layout,records};
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

export function createHouseholdStore(scope='legacy') {
  let cachedHead=null,cachedRecords=new Map();
  async function retainedInventory(){
    const names=['imports','journal','syncQueue'],db=await openHouseholdDatabase(scope),tx=db.transaction(names,'readonly'),done=completed(tx);
    const values=await Promise.all([...names.map(name=>requestResult(tx.objectStore(name).getAll())),done]);
    return Object.fromEntries(await Promise.all(names.map(async(name,index)=>[name,{count:values[index].length,sha256:await backupDigest(JSON.stringify(values[index]))}])));
  }
  async function load({allowUnverified=false}={}){
    const db=await openHouseholdDatabase(scope),tx=db.transaction(['financialHead','financialRecords'],'readonly'),done=completed(tx);
    const [head,records]=await Promise.all([requestResult(tx.objectStore('financialHead').get('current')),requestResult(tx.objectStore('financialRecords').getAll()),done]);
    if(!head)return null;
    if(!allowUnverified&&!head.verified)throw fail('storage-migration','De opslagmigratie moet eerst worden gecontroleerd.');
    const state=decodeHouseholdState(head,records);
    if(await backupDigest(JSON.stringify(state))!==head.sha256)throw fail('storage-integrity','De teruggelezen financiële opslag wijkt af. De oude opslag blijft behouden.');
    cachedHead=clone(head);cachedRecords=new Map(records.map(record=>[record.id,JSON.stringify(record)]));
    return state;
  }
  async function commit(state,{expectedHash=cachedHead?.sha256??null,operationId=crypto.randomUUID(),importMutation=null,migration=null,queueCloud=true}={}){
    const encoded=encodeHouseholdState(state),sha256=await backupDigest(JSON.stringify(state));
    const next={id:'current',storageVersion:LOCAL_STORAGE_VERSION,schemaVersion:11,storageRevision:(cachedHead?.storageRevision||0)+1,revision:Number(state.meta?.revision)||0,layout:encoded.layout,sha256,verified:!migration,migration:migration||cachedHead?.migration||null,operationId};
    const desired=new Set(encoded.records.map(record=>record.id));
    const changes=encoded.records.filter(record=>cachedRecords.get(record.id)!==JSON.stringify(record)).map(record=>({record,before:cachedRecords.has(record.id)?JSON.parse(cachedRecords.get(record.id)):null}));
    const removed=[...cachedRecords].filter(([id])=>!desired.has(id)).map(([,value])=>JSON.parse(value));
    const db=await openHouseholdDatabase(scope);
    const receipt={id:operationId,outcome:'committed',storageRevision:next.storageRevision,revision:next.revision,sha256,importId:importMutation?.batch?.id||'',importVersion:importMutation?.batch?.version??null,committedAt:new Date().toISOString()};
    let confirmedReceipt=receipt,confirmedHead=next;
    await new Promise((resolve,reject)=>{
      let failure;
      const tx=db.transaction(stores,'readwrite',{durability:'strict'});
      const abort=error=>{failure=failure||error;try{tx.abort();}catch{/* An already aborted transaction still reports the original failure. */}};
      tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(failure||tx.error||fail('storage-aborted','De lokale financiële commit is afgebroken.'));
      const heads=tx.objectStore('financialHead'),get=heads.get('current'),operation=tx.objectStore('operationReceipts').get(operationId);
      operation.onsuccess=()=>{
        if(get.result&&!get.result.verified){abort(fail('storage-migration','Een ongecontroleerde migratiestand accepteert geen financiële wijzigingen.'));return;}
        const existing=operation.result;
        if(existing){
          if(existing.sha256!==sha256){abort(fail('storage-operation-reused','Dit operatie-ID is al gebruikt voor een andere financiële wijziging.'));return;}
          if(get.result?.sha256!==sha256){abort(fail('storage-operation-committed','Deze operatie is al bevestigd; lees eerst de nieuwere duurzame stand.'));return;}
          confirmedReceipt=existing;confirmedHead=get.result;return;
        }
        if((get.result?.sha256??null)!==expectedHash){abort(fail('storage-conflict','De duurzame financiële stand is intussen gewijzigd. Herlaad de actuele stand; je invoer blijft behouden.'));return;}
        const publish=()=>{
          try{
            const records=tx.objectStore('financialRecords');
            for(const record of removed)records.delete(record.id);
            for(const change of changes)records.put(change.record);
            heads.put(next);tx.objectStore('operationReceipts').put(receipt);
            if(queueCloud){
              const outbox=tx.objectStore('financialOutbox');
              outbox.put({id:operationId,operationId,status:'pending',storageRevision:next.storageRevision,revision:next.revision,sha256,previousHash:expectedHash,layout:encoded.layout,changes,removed,queuedAt:receipt.committedAt});
              outbox.put({id:'current',operationId,status:'pending',storageRevision:next.storageRevision,sha256});
            }
            if(importMutation){
              tx.objectStore('imports').put(clone(importMutation.batch));
              tx.objectStore('syncQueue').put(clone(importMutation.queue));
              tx.objectStore('journal').put({...clone(importMutation.journal),status:'completed',candidate:undefined,previousBatch:undefined,baseSignature:undefined,durableBaseSignature:undefined});
            }
          }catch(error){abort(error);}
        };
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
    cachedHead=clone(confirmedHead);cachedRecords=new Map(encoded.records.map(record=>[record.id,JSON.stringify(record)]));
    return confirmedReceipt;
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
    const [head,records,receipt]=await Promise.all([requestResult(tx.objectStore('financialHead').get('current')),requestResult(tx.objectStore('financialRecords').getAll()),requestResult(tx.objectStore('operationReceipts').get(id)),done]);
    const state=head?decodeHouseholdState(head,records):null;
    if(head&&await backupDigest(JSON.stringify(state))!==head.sha256)throw fail('storage-integrity','Het operatiebewijs heeft geen betrouwbare financiële stand.');
    cachedHead=head;cachedRecords=new Map(records.map(record=>[record.id,JSON.stringify(record)]));
    return {state,receipt:receipt||null};
  }
  return {scope,load,commit,migrate,verifyAndActivate,acknowledgeCloud,pendingCloud,markCloudConflict,inspectOperation,get head(){return cachedHead&&clone(cachedHead);}};
}
