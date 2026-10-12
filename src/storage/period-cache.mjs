import { backupDigest } from './migration-backups.mjs';
import { workspaceState } from './period-workspace.mjs';
import { contributionAmount } from '../core/data-normalization.mjs';
import { protectedStorageUsage } from './storage-inventory.mjs';
import { PAYLOAD_STORE, PAYLOAD_PROTECTION, REPRESENTATION_META, REPRESENTATION_BACKUP, REPRESENTATION_STAGE, decodePayloadRow, createPayloadDecoder, payloadReferences } from './payload-parts.mjs';

export const PERIOD_CACHE_TARGET = 64 * 1024 * 1024;
export const storageBytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const clone = value => structuredClone(value);
const error = (code,message) => Object.assign(new Error(message),{code,storageFailure:true});

export function defaultPeriodWindow(month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw error('invalid-period','Ongeldige cachemaand.');
  const [year,n]=month.split('-').map(Number);
  return Array.from({length:4},(_,i)=>{const date=new Date(Date.UTC(year,n-1-i,1));return date.toISOString().slice(0,7);});
}

const calendarMonth = () => {const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;};

// The active window follows the calendar, never the selected historical month.
// Offline pins remain durable cache copies; they are not additional workspaces.
export function requestedPeriodWindow(month=calendarMonth(),currentMonth=calendarMonth()) {
  defaultPeriodWindow(month); // Validate before making any database request.
  const active=defaultPeriodWindow(currentMonth);
  return active.includes(month)?active:[month];
}

// These are verified, disposable copies. They never accept financial mutations.
export async function cacheEntries(state,scope,now=Date.now()) {
  if(!state.__finizePartialHistory||state.__finizePeriodContext.localCumulative)return [];
  const proof=state.__finizePeriodContext,entries=[];
  for(const period of proof.periods){
    const selected=clone(proof),ids=new Set([...proof.settings.dependencies,...period.dependencies].map(row=>row.id));
    selected.records=proof.records.filter(row=>ids.has(row.id));selected.periods=[clone(period)];
    selected.explicitFullHistory=false;selected.emptyPeriods=(proof.emptyPeriods||[]).filter(month=>month===period.month);
    const cached=await workspaceState(selected,period.month),global=JSON.parse(proof.global.payload);
    selected.ledgerBaseline=Object.fromEntries(Object.values(global.goals||{}).flatMap(goals=>goals.map(goal=>[goal.id,Number(goal.algespaard||0)-(cached.savingsGoalLedger||[]).filter(row=>row.goalId===goal.id).reduce((sum,row)=>sum+contributionAmount(row),0)])));
    cached.__finizePeriodContext=selected;
    entries.push({id:period.month,scope,epoch:proof.epoch,cloudRevision:proof.revision,state:cached,sha256:await backupDigest(JSON.stringify(cached)),lastUsed:now});
  }
  return entries;
}

export function planCacheEviction(entries,{selectedMonth,currentMonth=calendarMonth(),pinned=[],targetBytes=PERIOD_CACHE_TARGET}={}) {
  if(!Number.isFinite(targetBytes)||targetBytes<0)throw error('cache-target','Ongeldige cachegrens.');
  const protectedMonths=new Set([...defaultPeriodWindow(currentMonth),selectedMonth,...pinned]);
  let bytes=entries.filter(row=>!row.pinned).reduce((sum,row)=>sum+storageBytes(row),0);
  const remove=[];
  for(const row of [...entries].sort((a,b)=>a.lastUsed-b.lastUsed||a.id.localeCompare(b.id))){
    if(bytes<=targetBytes)break;
    if(row.pinned||protectedMonths.has(row.id))continue;
    remove.push({id:row.id,sha256:row.sha256});bytes-=storageBytes(row);
  }
  return {remove,remainingBytes:bytes,targetBytes,overTarget:bytes>targetBytes};
}

const request = value => new Promise((resolve,reject)=>{value.onsuccess=()=>resolve(value.result);value.onerror=()=>reject(value.error);});
const complete = tx => {
  const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||error('cache-aborted','Cachebewerking afgebroken.'));});
  // A synchronous store exception may arrive before the later abort event.
  // Observe that notification immediately; awaiting done still rejects normally.
  done.catch(()=>{});return done;
};

export function createPeriodCache({scope,openDatabase}) {
  async function inventory(){
    const opened=await openDatabase(),db=opened.rawDatabase||opened,names=Array.from(db.objectStoreNames),tx=db.transaction(names,'readonly'),done=complete(tx);
    const rows=await Promise.all(names.map(name=>request(tx.objectStore(name).getAll())));await done;
    return Object.fromEntries(names.map((name,i)=>[name,rows[i]]));
  }
  async function usage(){
    const physical=await inventory(),parts=new Map((physical[PAYLOAD_STORE]||[]).map(row=>[row.id,row])),all={};
    const internal=new Set([PAYLOAD_STORE,PAYLOAD_PROTECTION,REPRESENTATION_META,REPRESENTATION_BACKUP,REPRESENTATION_STAGE]);
    for(const [name,rows]of Object.entries(physical))if(!internal.has(name))all[name]=await Promise.all(rows.map(row=>decodePayloadRow(row,id=>parts.get(id))));
    const head=all.financialHead?.find(row=>row.id==='current'),active=new Set(Object.entries(head?.layout||{}).flatMap(([key,layout])=>(layout.kind==='list'?layout.ids:['']).map(id=>JSON.stringify([key,id]))));
    const size=rows=>(rows||[]).reduce((sum,row)=>sum+storageBytes(row),0),cache=all.periodCache||[];
    const categories=Object.fromEntries(['activeFinancialRecords','offlinePeriods','openCsvImports','historicalCsvImports','syncOutbox','operationReceipts','conflictsAndRecovery','protectedMigrationCopies','replaceablePeriodCache','storageMetadata'].map(name=>[name,0]));
    const roots=Object.fromEntries(Object.keys(categories).map(name=>[name,[]]));
    function category(name,row){
      if(name==='financialRecords')return active.has(row.id)?'activeFinancialRecords':'protectedMigrationCopies';
      if(name==='periodCache')return row.pinned?'offlinePeriods':'replaceablePeriodCache';
      if(name==='imports')return ['completed','processed','verwerkt'].includes(row.status)?'historicalCsvImports':'openCsvImports';
      if(['financialOutbox','syncQueue'].includes(name))return 'syncOutbox';
      if(name==='operationReceipts')return 'operationReceipts';
      if(name==='journal')return row.operation==='preserved-full-history-head'?'protectedMigrationCopies':'conflictsAndRecovery';
      if([REPRESENTATION_BACKUP,REPRESENTATION_STAGE].includes(name))return 'protectedMigrationCopies';
      return 'storageMetadata';
    }
    for(const [name,rows]of Object.entries(physical))if(name!==PAYLOAD_STORE)for(const row of rows)roots[category(name,row)].push(row);
    const used=new Set(),reachableBytes={},ownershipOrder=['activeFinancialRecords','offlinePeriods','openCsvImports','syncOutbox','operationReceipts','conflictsAndRecovery','protectedMigrationCopies','historicalCsvImports','replaceablePeriodCache','storageMetadata'];
    for(const name of ownershipOrder){
      const references=new Set();
      const visit=hash=>{if(references.has(hash))return;references.add(hash);const part=parts.get(hash);if(!part)throw error('storage-payload-integrity','Een opslagafhankelijkheid ontbreekt.');for(const child of payloadReferences(JSON.parse(part.payload)))visit(child);};
      for(const row of roots[name])for(const hash of payloadReferences(row))visit(hash);
      categories[name]=size(roots[name]);reachableBytes[name]=categories[name]+[...references].reduce((sum,hash)=>sum+storageBytes(parts.get(hash)),0);
      for(const hash of references)if(!used.has(hash)){used.add(hash);categories[name]+=storageBytes(parts.get(hash));}
    }
    const retainedUnreferencedParts=[...parts.values()].filter(row=>!used.has(row.id)),retainedUnreferencedBytes=size(retainedUnreferencedParts);
    categories.conflictsAndRecovery+=retainedUnreferencedBytes;
    const indexedDbPayloadBytes=Object.values(physical).reduce((sum,rows)=>sum+size(rows),0),logicalHydratedBytes=Object.values(all).reduce((sum,rows)=>sum+size(rows),0);
    const external=await protectedStorageUsage(scope);
    const legacyMigrationBytes=external.localStorage.financialState+external.localStorage.migrationBackups;
    categories.protectedMigrationCopies+=legacyMigrationBytes+external.migrationBackups;
    categories.conflictsAndRecovery+=external.emergencyBackups+external.localStorage.emergencyBackups;
    categories.planningAssets=external.goalImages;
    const externalIndexedDbBytes=external.migrationBackups+external.emergencyBackups+external.goalImages;
    const totalBytes=indexedDbPayloadBytes+externalIndexedDbBytes+Object.values(external.localStorage).reduce((a,b)=>a+b,0);
    return {scope,measurement:'UTF-8 JSON of stored roots and immutable parts, counted once; excludes IndexedDB index/page overhead',categories,totalBytes,indexedDbPayloadBytes:indexedDbPayloadBytes+externalIndexedDbBytes,householdDatabaseBytes:indexedDbPayloadBytes,logicalHydratedBytes,reachableBytes,retainedUnreferencedBytes,sharedPayloadOverlapBytes:Object.values(reachableBytes).reduce((sum,bytes)=>sum+bytes,0)+retainedUnreferencedBytes-indexedDbPayloadBytes,externalStorage:external,legacyMigrationBytes,categoryBytes:Object.values(categories).reduce((a,b)=>a+b,0),overlapBytes:0,periods:cache.map(({id,pinned,lastUsed,cloudRevision,epoch})=>({id,pinned:Boolean(pinned),lastUsed,cloudRevision,epoch})),browserEstimate:globalThis.navigator?.storage?.estimate?await navigator.storage.estimate():null};
  }
  async function remember(state,expectedHash){
    const entries=await cacheEntries(state,scope);if(!entries.length)return;
    const db=await openDatabase(),tx=db.transaction(['financialHead','financialOutbox','periodCache'],'readwrite',{durability:'strict'}),done=complete(tx);
    const [head,outbox]=await Promise.all([request(tx.objectStore('financialHead').get('current')),request(tx.objectStore('financialOutbox').getAll())]);
    if(head?.sha256!==expectedHash||outbox.some(row=>['pending','conflict'].includes(row.status))){await done;return;}
    const store=tx.objectStore('periodCache');
    for(const entry of entries){const old=await request(store.get(entry.id));store.put({...entry,pinned:Boolean(old?.pinned),offline:old?.pinned?1:0});}
    await done;
  }
  async function read(month,{epoch,revision}){
    const db=await openDatabase(),tx=db.transaction('periodCache','readonly'),done=complete(tx),row=await request(tx.objectStore('periodCache').get(month));await done;
    if(!row||row.scope!==scope||row.epoch!==epoch||row.cloudRevision!==revision)return null;
    if(await backupDigest(JSON.stringify(row.state))!==row.sha256)throw error('cache-integrity','De offline maand wijkt af van het gecontroleerde bewijs.');
    return clone(row.state);
  }
  async function pin(month,pinned){
    const db=await openDatabase(),tx=db.transaction('periodCache','readwrite',{durability:'strict'}),done=complete(tx),store=tx.objectStore('periodCache'),row=await request(store.get(month));
    if(!row){tx.abort();await done;return;}
    store.put({...row,pinned:Boolean(pinned),offline:pinned?1:0});await done;
  }
  async function pinnedPeriods(){
    const db=await openDatabase(),tx=db.transaction('periodCache','readonly'),done=complete(tx);
    const ids=await request(tx.objectStore('periodCache').index('offline').getAllKeys(1));await done;return ids;
  }
  async function evict({selectedMonth,targetBytes=PERIOD_CACHE_TARGET}={}){
    const opened=await openDatabase(),db=opened.rawDatabase||opened,names=Array.from(db.objectStoreNames),tx=db.transaction(names,'readwrite',{durability:'strict'}),done=complete(tx);
    try{
    // Every non-cache payload root is protected by the central writer, including
    // migrated originals. GC follows those immutable roots; loading financial
    // history and hydrating recovery candidates adds no protection evidence.
    const selected=names.filter(name=>!['financialRecords',REPRESENTATION_BACKUP,REPRESENTATION_STAGE].includes(name));
    const values=await Promise.all(selected.map(name=>request(tx.objectStore(name).getAll()))),raw=Object.fromEntries(selected.map((name,i)=>[name,values[i]])),parts=new Map((raw[PAYLOAD_STORE]||[]).map(row=>[row.id,row]));
    const decodeRow=createPayloadDecoder(id=>parts.get(id));
    const decode=rows=>Promise.all((rows||[]).map(decodeRow));
    const [heads,entries]=await Promise.all(['financialHead','periodCache'].map(name=>decode(raw[name]))),head=heads.find(row=>row.id==='current');
    const [outbox,journal,queue,imports]=['financialOutbox','journal','syncQueue','imports'].map(name=>raw[name]||[]);
    for(const row of [...outbox,...journal,...imports])if(row.status!==undefined&&typeof row.status!=='string')throw error('cache-integrity','De beschermingsstatus is niet betrouwbaar leesbaar.');
    const openImports=imports.filter(row=>!['completed','processed','verwerkt'].includes(row.status)).length;
    if(!head?.verified||outbox.some(row=>['pending','conflict'].includes(row.status))||queue.length||openImports||journal.some(row=>['conflict','pending','prepared','processing','uncertain'].includes(row.status))){await done;return {removed:[],blocked:true};}
    const meta=await decodeRow(await request(tx.objectStore('financialRecords').get(JSON.stringify(['meta','']))));
    const plan=planCacheEviction(entries,{selectedMonth:meta?.value?.selectedMonth||selectedMonth,targetBytes});
    for(const row of plan.remove)tx.objectStore('periodCache').delete(row.id);
    // Remove only cache-created parts with no remaining reference and no
    // financial protection. The root checks and removals share this transaction.
    const removed=new Set(plan.remove.map(row=>row.id)),reachable=new Set(),protectedParts=new Set((raw[PAYLOAD_PROTECTION]||[]).map(row=>row.id));
    const visit=hash=>{if(reachable.has(hash))return;reachable.add(hash);const part=parts.get(hash);if(!part)throw error('storage-payload-integrity','Een cacheafhankelijkheid ontbreekt.');for(const child of payloadReferences(JSON.parse(part.payload)))visit(child);};
    for(const hash of protectedParts)visit(hash);
    for(const [name,rows]of Object.entries(raw))if(name!==PAYLOAD_STORE)for(const row of rows)if(name!=='periodCache'||!removed.has(row.id))for(const hash of payloadReferences(row))visit(hash);
    let removedPayloadBytes=0;
    for(const [hash,part]of parts)if(!reachable.has(hash)&&!protectedParts.has(hash)){tx.objectStore(PAYLOAD_STORE).delete(hash);removedPayloadBytes+=storageBytes(part);}
    await done;return {...plan,removed:plan.remove.map(row=>row.id),removedPayloadBytes,blocked:false};
    }catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
  }
  return {usage,remember,read,pin,pinnedPeriods,evict};
}
