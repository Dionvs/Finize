import { inspectSourceAvailability, sourceRepairCandidates, planSourceRepair } from './source-repair.mjs';
import { createStateBackupStore } from '../storage/state-backups.mjs';
import { isBankSource, bankSourceForImport, ensureImportBankSources, updateSourceApproval } from '../core/bank-sources.mjs';
import { addProcessingSplit, removeProcessingSplit, redistributeProcessing, splitDifference, processingFamily } from '../core/processing-lines.mjs';
import { expenseCategoriesForMonth } from '../core/planning-timeline.mjs';
import { INCOME_TRANSACTION_TYPES } from '../core/transaction-model.mjs';
import { importVersion, sameImportOperation, assertImportBase, pendingQueueReceipt, acknowledgeMatches, findImportConflicts, mergeImportDetails } from './import-sync-protocol.mjs';
import { planImportCommand, deriveBatchReviewStatus, batchLifecycle } from './import-lifecycle.mjs';
import { classifyCsvDuplicate, importDateError, validCalendarDate, csvFileDigest, assertNoDuplicateSources } from './import-identity.mjs';
import { plannedOccurrences } from '../core/recurring-occurrences.mjs';
import { projectTransaction, validateTransactionProcessing, getTransactionFinancialMonth, confirmInternalTransferPair, confirmManualReplacement, refundCategoryIsRecognizable } from '../core/transaction-engine.mjs';
import { reopenTransactionSource, commitProcessedSourceGroup, replaceProcessedSourceRows, createTransactionSavingsEntry, synchronizeChangedSavings, assertFinancialMutationSafe, applyFinancialCandidate } from '../core/transaction-processing.mjs';
import { resolveRecurringAmount, resolveRecurringConfig, resolveFixedExpensesForMonth, applyFixedPlanningAdjustment, undoFixedPlanningAdjustment } from '../core/planning-timeline.mjs';
import { cloneState as clone } from "../core/state.js";
import { CURRENT_SCHEMA_VERSION, normalizeImportCore, calculateGoalSavedAmount, reconcileGoalSavedAmounts } from '../core/data-normalization.mjs';
import { normalizeDataTransaction, getTransactionAccountContext, getTransactionSource, getTransactionProcessingStatus, isTransactionFinanciallyActive, getTransactionOriginalBankData, assertOriginalBankDataUnchanged } from '../core/transaction-model.mjs';

(function(root,factory){
  const api=factory();
  root.FinizeUpdate4Runtime=api;
  api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=CURRENT_SCHEMA_VERSION;
  const DB_NAME='finize-imports-v1';
  const DB_VERSION=1;
  const IMPORT_STORE='imports';
  const JOURNAL_STORE='journal';
  const SYNC_STORE='syncQueue';
  const CLOUD_STORAGE_VERSION=2;
  const CLOUD_READ_CONCURRENCY=4;
  const OWNERS=['gezamenlijk','dion','dara'];
  const IMPORT_STATUSES=['concept','verwerkt','teruggedraaid','correctie-nodig'];

  function cloudImportRef(cloud,firestore,importId){
    if(typeof cloud?.importRef==='function'){
      const reference=cloud.importRef(importId);
      if(!reference)throw new Error('De cloudlocatie voor deze import ontbreekt.');
      return reference;
    }
    return firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(importId));
  }

  function cloudImportChunkRef(cloud,firestore,importId,chunkId){
    if(typeof cloud?.importChunkRef==='function'){
      const reference=cloud.importChunkRef(importId,chunkId);
      if(!reference)throw new Error('De cloudlocatie voor dit importdeel ontbreekt.');
      return reference;
    }
    return firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(importId),'chunks',String(chunkId));
  }

  function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
  function round2(value){return Math.round((Number(value)+Number.EPSILON)*100)/100;}
  function normalizeIban(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function validOwner(value){return OWNERS.includes(value)?value:'gezamenlijk';}
  function uid(prefix='u4'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;}

  function normalizeRule(rule,index=0){
    const next={
      ...rule,
      id:String(rule?.id||`u4-rule-${index}`),
      enabled:rule?.enabled!==false,
      level:['counterparty','description','organization','keyword','prediction'].includes(rule?.level)?rule.level:(rule?.counterparty?'counterparty':'description'),
      value:String(rule?.value||rule?.counterparty||rule?.text||rule?.match||'').trim(),
      category:String(rule?.category||'Ongecategoriseerd'),
      transactionType:String(rule?.transactionType||rule?.kind||'uitgave'),
      budgetItemId:String(rule?.budgetItemId||''),
      fixedExpenseId:String(rule?.fixedExpenseId||''),
      savingsGoalId:String(rule?.savingsGoalId||''),
      displayName:String(rule?.displayName||'').trim(),
      alwaysReview:rule?.alwaysReview===true,
      updatedAt:String(rule?.updatedAt||new Date(0).toISOString())
    };
    return next;
  }

  function normalizeTransaction(tx){
    return Object.assign(tx,normalizeDataTransaction(tx));
  }
  function normalizeCore(candidate){
    return normalizeImportCore(candidate);
  }

  function validateCore(target){
    const errors=[];
    if(!plain(target))errors.push('State ontbreekt.');
    if(!Array.isArray(target?.accountProfiles))errors.push('accountProfiles moet een lijst zijn.');
    if(!Array.isArray(target?.importSummaries))errors.push('importSummaries moet een lijst zijn.');
    if(!Array.isArray(target?.savingsGoalLedger))errors.push('savingsGoalLedger moet een lijst zijn.');
    if(!Array.isArray(target?.manualTransactionReplacements))errors.push('manualTransactionReplacements moet een lijst zijn.');
    const profileIds=new Set();
    (target?.accountProfiles||[]).forEach(profile=>{
      if(!profile.id||profileIds.has(profile.id))errors.push('Rekeningprofielen bevatten een ontbrekend of dubbel ID.');
      profileIds.add(profile.id);
      if(!OWNERS.includes(profile.accountOwner))errors.push(`Ongeldige rekeninghouder in ${profile.id}.`);
    });
    return {ok:errors.length===0,errors};
  }

  const ImportStore={
    dbPromise:null,scope:'legacy',legacyReferences:new Set(),bankReadCache:new Map(),
    setScope(scope){if(this.scope===scope)return;this.dbPromise?.then(db=>db.close()).catch(()=>{});this.scope=scope;this.dbPromise=null;this.bankReadCache.clear();},
    open(){
      if(this.dbPromise)return this.dbPromise;
      this.dbPromise=new Promise((resolve,reject)=>{
        if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is niet beschikbaar.'));return;}
        const request=indexedDB.open(this.scope==='legacy'?DB_NAME:`${DB_NAME}-${this.scope}`,DB_VERSION);
        request.onupgradeneeded=()=>{
          const db=request.result;
          if(!db.objectStoreNames.contains(IMPORT_STORE))db.createObjectStore(IMPORT_STORE,{keyPath:'id'});
          if(!db.objectStoreNames.contains(JOURNAL_STORE))db.createObjectStore(JOURNAL_STORE,{keyPath:'id'});
          if(!db.objectStoreNames.contains(SYNC_STORE))db.createObjectStore(SYNC_STORE,{keyPath:'id'});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error('Importopslag openen mislukt.'));
      });
      this.dbPromise=this.dbPromise.catch(error=>{this.dbPromise=null;throw error;});
      return this.dbPromise;
    },
    async request(storeName,mode,action){
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,mode);
        const store=tx.objectStore(storeName);
        let request,result;
        tx.oncomplete=()=>resolve(result);
        try{request=action(store);}
        catch(error){reject(error);return;}
        if(request){
          request.onsuccess=()=>{result=request.result;};
          request.onerror=()=>reject(request.error||new Error('Importopslagactie mislukt.'));
        }else tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Importopslagtransactie mislukt.'));
        tx.onabort=()=>reject(tx.error||new Error('Importopslagtransactie afgebroken.'));
      });
    },
    putImport(record){
      const next=clone(record),scope=this.scope;
      // Compare versions and immutable originals within the IndexedDB write transaction.
      return this.open().then(db=>new Promise((resolve,reject)=>{
        const transaction=db.transaction(IMPORT_STORE,'readwrite'),store=transaction.objectStore(IMPORT_STORE);
        let failure;
        const existing=store.get(String(next.id));
        existing.onsuccess=()=>{
          try{const old=existing.result;if(old?.lifecycle==='deleted'&&next.lifecycle!=='deleted')throw cloudImportError('import-deleted','Deze import is permanent verwijderd.');if(old&&importVersion(next)<importVersion(old))throw cloudImportError('import-conflict','Nieuwere lokale importdetails blijven behouden.');if(old&&importVersion(next)===importVersion(old)&&old.operationId&&next.operationId&&old.operationId!==next.operationId)throw cloudImportError('import-conflict','Een andere lokale keuze bestaat voor deze importversie.');assertOriginalBankDataUnchanged(old?.rows,next.rows);store.put(next);}
          catch(error){failure=error;transaction.abort();}
        };
        transaction.oncomplete=()=>{if(this.scope===scope)this.bankReadCache.set(String(next.id),clone(next));resolve(next.id);};
        transaction.onerror=()=>reject(failure||transaction.error||new Error('Importopslag mislukt.'));
        transaction.onabort=()=>reject(failure||transaction.error||new Error('Importopslag afgebroken.'));
      }));
    },
    async getImport(id){const scope=this.scope,local=await this.request(IMPORT_STORE,'readonly',store=>store.get(String(id)));if(local&&this.scope===scope)this.bankReadCache.set(String(id),clone(local));if(local||this.scope==='legacy'||!this.legacyReferences.has(String(id)))return local;const legacy=await new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{const record=await new Promise((resolve,reject)=>{const tx=legacy.transaction(IMPORT_STORE,'readonly'),request=tx.objectStore(IMPORT_STORE).get(String(id));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(record){await this.putImport(record);return record;}return undefined;}finally{legacy.close();}},
    async rollbackImport(expected,previous,previousQueue){
      const scope=this.scope,db=await this.open();return new Promise((resolve,reject)=>{
        const tx=db.transaction([IMPORT_STORE,SYNC_STORE],'readwrite'),imports=tx.objectStore(IMPORT_STORE),queue=tx.objectStore(SYNC_STORE);let failure;
        const request=imports.get(String(expected.id));request.onsuccess=()=>{
          if(!sameImportOperation(request.result,expected)){failure=cloudImportError('import-conflict','Nieuwere lokale importkeuze blijft behouden; rollback is geblokkeerd.');tx.abort();return;}
          if(previous)imports.put(clone(previous));else imports.delete(String(expected.id));
          const queued=queue.get(String(expected.id));queued.onsuccess=()=>{if(!acknowledgeMatches(queued.result,pendingQueueReceipt(expected)))return;if(previousQueue)queue.put(clone(previousQueue));else queue.delete(String(expected.id));};
        };tx.oncomplete=()=>{if(this.scope===scope){if(previous)this.bankReadCache.set(String(expected.id),clone(previous));else this.bankReadCache.delete(String(expected.id));}resolve();};tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Importrollback mislukt.'));
      });
    },
    deleteImport(id){const scope=this.scope;return this.request(IMPORT_STORE,'readwrite',store=>store.delete(String(id))).then(result=>{if(this.scope===scope)this.bankReadCache.delete(String(id));return result;});},
    async listImports(){const scope=this.scope,records=await this.request(IMPORT_STORE,'readonly',store=>store.getAll());if(this.scope===scope){this.bankReadCache.clear();for(const record of records)this.bankReadCache.set(String(record.id),clone(record));}return records;},
    putJournal(record){return this.request(JOURNAL_STORE,'readwrite',store=>store.put(clone(record)));},
    getJournal(id){return this.request(JOURNAL_STORE,'readonly',store=>store.get(String(id)));},
    listJournal(){return this.request(JOURNAL_STORE,'readonly',store=>store.getAll());},
    putSync(record){return this.request(SYNC_STORE,'readwrite',store=>store.put(clone(record)));},
    deleteSync(id){return this.request(SYNC_STORE,'readwrite',store=>store.delete(String(id)));},
    listSync(){return this.request(SYNC_STORE,'readonly',store=>store.getAll());},
    async acknowledgeSync(receipt){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(SYNC_STORE,'readwrite'),store=tx.objectStore(SYNC_STORE);let removed=false;const request=store.get(receipt.id);request.onsuccess=()=>{if(acknowledgeMatches(request.result,receipt)){store.delete(receipt.id);removed=true;}};tx.oncomplete=()=>resolve(removed);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Retry bevestigen mislukt.'));});},
    async confirmCloudReceipt(receipt,confirmed){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction([IMPORT_STORE,SYNC_STORE],'readwrite'),imports=tx.objectStore(IMPORT_STORE),queue=tx.objectStore(SYNC_STORE);const get=imports.get(receipt.id);get.onsuccess=()=>{const current=get.result;if(current&&importVersion(current)>=receipt.version&&Number(current.baseVersion||0)<=receipt.baseVersion){current.baseVersion=receipt.version;current.confirmedBatch=clone(confirmed);delete current.confirmedBatch.confirmedBatch;imports.put(current);const queued=queue.get(receipt.id);queued.onsuccess=()=>{if(acknowledgeMatches(queued.result,receipt))queue.delete(receipt.id);else if(queued.result&&queued.result.version===current.version)queue.put({...queued.result,baseVersion:receipt.version});};}};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Cloudbevestiging opslaan mislukt.'));});},
    deleteJournal(id){return this.request(JOURNAL_STORE,'readwrite',store=>store.delete(String(id)));}
  };

  function chunkRows(rows,maxBytes=700000){
    const chunks=[];let current=[];let bytes=2;
    (rows||[]).forEach(row=>{
      const size=new TextEncoder().encode(JSON.stringify(row)).length+1;
      if(current.length&&(bytes+size>maxBytes||current.length>=200)){chunks.push(current);current=[];bytes=2;}
      current.push(row);bytes+=size;
    });
    if(current.length)chunks.push(current);
    return chunks;
  }

  function canonicalValue(value){
    if(Array.isArray(value))return value.map(canonicalValue);
    if(plain(value))return Object.keys(value).sort().reduce((result,key)=>{result[key]=canonicalValue(value[key]);return result;},{});
    return value;
  }

  function rowsChecksum(rows){
    return hashText(JSON.stringify(canonicalValue(rows||[])));
  }

  function buildCloudImportEnvelope(record){
    if(!plain(record)||!record.id)throw new Error('Importrecord mist een ID.');
    const rows=Array.isArray(record.rows)?record.rows:[];
    const chunks=chunkRows(rows);
    const header=clone(record);
    delete header.rows;
    delete header.rawText;delete header.originalCsv;delete header.confirmedBatch;
    header.storageVersion=CLOUD_STORAGE_VERSION;
    header.rowCount=rows.length;
    header.chunkCount=chunks.length;
    header.rowsChecksum=rowsChecksum(rows);header.rowsSha256=csvFileDigest(JSON.stringify(canonicalValue(rows)));
    header.syncedAt=new Date().toISOString();
    header.generation=record.operationId||'';
    const sourceText=typeof record.originalCsv==='string'?record.originalCsv:'';const sourceChunks=[];let sourcePart='';for(const char of sourceText){if(sourcePart.length>=100000){sourceChunks.push(sourcePart);sourcePart='';}sourcePart+=char;}if(sourcePart)sourceChunks.push(sourcePart);header.sourceChunkCount=sourceChunks.length;
    return {header,chunks:chunks.map((chunk,index)=>({index,generation:header.generation,rows:clone(chunk)})),sourceChunks};
  }

  function cloudImportError(code,message){
    const error=new Error(message);error.code=code;return error;
  }

  function classifyCloudError(error,context='De import kon niet uit de cloud worden opgehaald.'){
    const code=String(error?.code||error?.name||'').toLocaleLowerCase();
    const message=String(error?.message||error||'').trim();
    if(code.includes('permission-denied')||code.includes('permission_denied')||message.toLocaleLowerCase().includes('missing or insufficient permissions')){
      return cloudImportError('cloud-permission','Firestore blokkeert de toegang tot bankimports. Controleer de gepubliceerde beveiligingsregels.');
    }
    if(code.includes('unavailable')||code.includes('network')||code.includes('offline')||code.includes('deadline-exceeded')){
      return cloudImportError('cloud-offline',`${context} De cloudverbinding is tijdelijk niet beschikbaar.`);
    }
    return cloudImportError('cloud-error',`${context}${message?` ${message}`:''}`);
  }

  function assembleCloudImport(header,chunks,expectedId=''){
    if(!plain(header)||!header.id)throw cloudImportError('cloud-invalid','De cloudkopie heeft geen geldig import-ID.');
    if(expectedId&&String(header.id)!==String(expectedId))throw cloudImportError('cloud-invalid','De cloudkopie hoort bij een andere import.');
    const chunkCount=Number(header.chunkCount);
    const rowCount=Number(header.rowCount);
    if(!Number.isInteger(chunkCount)||chunkCount<0||!Number.isInteger(rowCount)||rowCount<0){
      throw cloudImportError('cloud-invalid','De cloudkopie bevat ongeldige aantallen.');
    }
    if(!Array.isArray(chunks)||chunks.length!==chunkCount){
      throw cloudImportError('cloud-incomplete','Niet alle importdelen zijn in de cloud beschikbaar.');
    }
    const byIndex=new Map();
    chunks.forEach(chunk=>{
      if(header.generation&&chunk.generation!==header.generation)throw cloudImportError('cloud-incomplete','Importdelen horen bij verschillende versies.');
      if(!plain(chunk)||!Number.isInteger(Number(chunk.index))||!Array.isArray(chunk.rows)){
        throw cloudImportError('cloud-invalid','Een importdeel in de cloud is beschadigd.');
      }
      const index=Number(chunk.index);
      if(index<0||index>=chunkCount||byIndex.has(index)){
        throw cloudImportError('cloud-incomplete','De importdelen zijn dubbel of niet aaneengesloten.');
      }
      byIndex.set(index,chunk.rows);
    });
    const rows=[];
    for(let index=0;index<chunkCount;index++){
      if(!byIndex.has(index))throw cloudImportError('cloud-incomplete','Een importdeel ontbreekt in de cloud.');
      rows.push(...clone(byIndex.get(index)));
    }
    if(rows.length!==rowCount)throw cloudImportError('cloud-incomplete','Het aantal bankregels in de cloudkopie klopt niet.');
    if(Number(header.storageVersion)>=CLOUD_STORAGE_VERSION&&!header.rowsChecksum){
      throw cloudImportError('cloud-invalid','De cloudkopie mist de vereiste controlecode.');
    }
    if(header.rowsChecksum&&rowsChecksum(rows)!==String(header.rowsChecksum)){
      throw cloudImportError('cloud-checksum','De controlecode van de cloudkopie klopt niet.');
    }
    if(header.rowsSha256&&header.rowsSha256!==csvFileDigest(JSON.stringify(canonicalValue(rows))))throw cloudImportError('cloud-checksum','Importinhoud wijkt af van de SHA-256-controlecode.');
    const record=clone(header);
    delete record.rawText;delete record.rowCount;delete record.chunkCount;delete record.rowsChecksum;
    record.rows=rows;
    return record;
  }

  async function mapWithConcurrency(values,limit,mapper){
    const result=new Array(values.length);let cursor=0;
    async function worker(){
      while(cursor<values.length){
        const index=cursor++;
        result[index]=await mapper(values[index],index);
      }
    }
    await Promise.all(Array.from({length:Math.min(Math.max(1,limit),values.length||1)},worker));
    return result;
  }

  async function fetchImportFromCloud(root,id){
    const cloud=root?.CloudAdapter;
    if(!cloud?.isConnected?.()){
      if(cloud?.isConfigured?.()&&typeof cloud.connect==='function')await cloud.connect();
    }
    if(!cloud?.isConnected?.()||!cloud.modules?.firestore||!cloud.db){
      throw cloudImportError('cloud-offline','De import staat niet lokaal en de cloudverbinding is niet beschikbaar.');
    }
    const firestore=cloud.modules.firestore;
    const importRef=cloudImportRef(cloud,firestore,id);
    let headerSnapshot;
    try{headerSnapshot=await firestore.getDoc(importRef);}
    catch(error){throw classifyCloudError(error,'De importheader kon niet worden opgehaald.');}
    if(!headerSnapshot?.exists?.()){
      throw cloudImportError('cloud-missing','Deze import is nog niet vanaf het bronapparaat naar de cloud gesynchroniseerd.');
    }
    const header=headerSnapshot.data();
    if(header?.lifecycle==='deleted')return clone(header);
    const count=Number(header?.chunkCount);
    if(!Number.isInteger(count)||count<0)throw cloudImportError('cloud-invalid','De cloudkopie bevat geen geldige importindeling.');
    const indices=Array.from({length:count},(_,index)=>index);
    const chunks=await mapWithConcurrency(indices,CLOUD_READ_CONCURRENCY,async index=>{
      const chunkRef=cloudImportChunkRef(cloud,firestore,id,`${header.generation?header.generation+'-':''}${String(index).padStart(4,'0')}`);
      let snapshot;
      try{snapshot=await firestore.getDoc(chunkRef);}
      catch(error){throw classifyCloudError(error,`Importdeel ${index+1} van ${count} kon niet worden opgehaald.`);}
      if(!snapshot?.exists?.())throw cloudImportError('cloud-incomplete',`Importdeel ${index+1} van ${count} ontbreekt in de cloud.`);
      return snapshot.data();
    });
    const record=assembleCloudImport(header,chunks,id);
    if(header.sourceChunkCount){const textChunks=await mapWithConcurrency(Array.from({length:header.sourceChunkCount},(_,index)=>index),CLOUD_READ_CONCURRENCY,async index=>{const snap=await firestore.getDoc(cloudImportChunkRef(cloud,firestore,id,`${header.generation}-source-${index}`));if(!snap.exists()||snap.data().generation!==header.generation)throw cloudImportError('cloud-incomplete','Originele CSV ontbreekt in deze versie.');return snap.data().text;});record.originalCsv=textChunks.join('');if(header.fileDigest&&csvFileDigest(record.originalCsv)!==header.fileDigest)throw cloudImportError('cloud-checksum','Originele CSV-controlecode wijkt af.');}
    record.baseVersion=importVersion(header);return record;
  }

  async function resolveImportDetails(id,{localRead,cloudRead,localWrite,refresh=false,pendingRead=async()=>false,onConflict=async()=>{}}){
    const local=await localRead(String(id));
    if(local&&!refresh)return {record:local,source:'local'};
    let cloud;try{cloud=await cloudRead(String(id));}catch(error){if(local&&error.code==='cloud-offline')return {record:local,source:'local-offline'};throw error;}
    if(local){if(await pendingRead(id)){if(sameImportOperation(local,cloud))return {record:local,source:'echo'};if(importVersion(cloud)!==Number(local.baseVersion||0)){await onConflict(local,cloud);return {record:cloud,source:'conflict'};}return {record:local,source:'local-pending'};}if(importVersion(local)>importVersion(cloud))throw cloudImportError('import-conflict','De cloudkopie is ouder dan de lokale import; geen gegevens zijn overschreven.');if(importVersion(local)===importVersion(cloud)&&JSON.stringify(local.rows)===JSON.stringify(cloud.rows))return {record:local,source:'echo'};}
    await localWrite(cloud);
    return {record:cloud,source:'cloud'};
  }

  function normalizeText(value){
    return String(value||'').toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function detectDelimiter(text){
    const first=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'';
    const counts=[[';',0],[',',0],['\t',0]];
    let quoted=false;
    for(const char of first){
      if(char==='"')quoted=!quoted;
      else if(!quoted){const hit=counts.find(item=>item[0]===char);if(hit)hit[1]++;}
    }
    return counts.sort((a,b)=>b[1]-a[1])[0][0];
  }

  function parseDelimited(text,delimiter=detectDelimiter(text)){
    const rows=[];let row=[];let cell='';let quoted=false;
    const input=String(text||'').replace(/^\uFEFF/,'');
    for(let index=0;index<input.length;index++){
      const char=input[index];
      if(char==='"'){
        if(quoted&&input[index+1]==='"'){cell+='"';index++;}
        else quoted=!quoted;
      }else if(char===delimiter&&!quoted){row.push(cell.trim());cell='';}
      else if((char==='\n'||char==='\r')&&!quoted){
        if(char==='\r'&&input[index+1]==='\n')index++;
        row.push(cell.trim());cell='';
        if(row.some(value=>value!==''))rows.push(row);
        row=[];
      }else cell+=char;
    }
    row.push(cell.trim());
    if(row.some(value=>value!==''))rows.push(row);
    return rows;
  }

  function parseDate(value){
    const text=String(value||'').trim();
    let match=text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
    if(match){const date=`${match[1]}-${match[2]}-${match[3]}`;return validCalendarDate(date)?date:'';}
    match=text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if(!match)return '';
    const date=`${match[3].length===2?'20'+match[3]:match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;return validCalendarDate(date)?date:'';
  }
  function displayDate(value){
    const normalized=parseDate(value);
    if(!normalized)return String(value||'');
    const [year,month,day]=normalized.split('-');
    return `${day}-${month}-${year}`;
  }

  function parseAmount(value){
    let text=String(value??'').trim().replace(/\s/g,'').replace(/€|EUR/gi,'');
    if(!text)return NaN;
    let negative=/^\(.*\)$/.test(text)||text.endsWith('-');
    text=text.replace(/[()]/g,'').replace(/-$/,'');
    if(text.includes(',')&&text.includes('.'))text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
    else text=text.replace(',','.');
    const amount=Number(text);
    return negative?-Math.abs(amount):amount;
  }

  const HEADER_ALIASES={
    date:['transactiedatum','datum','date','boekdatum','rentedatum'],
    bookingDate:['boekdatum','booking date','bookingdate'],
    transactionTime:['transactietijd','tijd','time'],
    description:['naam omschrijving','omschrijving','description','naam tegenpartij','tegenpartij'],
    accountIdentifier:['rekening','rekeningnummer','iban','eigen rekening'],
    counterpartyAccount:['tegenrekening','tegenrekening iban','iban tegenpartij'],
    amount:['bedrag eur','bedrag','amount','mutatie'],
    direction:['af bij','credit debit','debet credit'],
    currency:['muntsoort','valuta','currency'],
    reference:['transactiereferentie','referentie','bankreferentie','kenmerk'],
    code:['code','mutatiesoort'],
    notes:['mededelingen','omschrijving 2','details']
  };

  function headerKey(value){return normalizeText(value).replace(/\s/g,'');}
  function findHeader(headers,aliases){
    const normalized=headers.map(value=>({text:normalizeText(value),key:headerKey(value)}));
    return normalized.findIndex(header=>aliases.some(alias=>header.text===normalizeText(alias)||header.key===headerKey(alias)));
  }
  function detectFormat(headers){
    const normalized=headers.map(normalizeText);
    const ing=normalized.includes('naam omschrijving')&&(normalized.includes('af bij')||normalized.some(value=>value.includes('bedrag eur')));
    return ing?'ing':'generic';
  }
  function inferMapping(headers){
    const mapping={};
    Object.entries(HEADER_ALIASES).forEach(([key,aliases])=>mapping[key]=findHeader(headers,aliases));
    const transactionIndex=findHeader(headers,['transactiedatum','transaction date']);if(transactionIndex>=0)mapping.date=transactionIndex;
    return mapping;
  }

  function hashText(value){
    let hash=2166136261;
    for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function fingerprint(original,profileId=''){
    const reference=normalizeText(original.reference);
    const basis=reference
      ? `${profileId}|ref|${reference}`
      : [profileId,original.bankDate,round2(original.amount),normalizeText(original.description),normalizeIban(original.counterpartyAccount),normalizeText(original.currency||'EUR')].join('|');
    return `u4-${hashText(basis)}`;
  }

  function organizationName(description){
    return normalizeText(description)
      .replace(/\b(pasvolgnr|betaalautomaat|incasso|ideal|sepa|europese|betaling|kenmerk|omschrijving)\b.*$/,'')
      .replace(/\b\d{3,}\b.*$/,'').trim();
  }

  function proposeType(original,profiles=[]){
    const text=normalizeText(`${original.description} ${original.notes||''}`);
    const counterpart=normalizeIban(original.counterpartyAccount);
    if(counterpart&&profiles.some(profile=>normalizeIban(profile.identifier)===counterpart))return 'interne-overboeking';
    if(/\bvakantiegeld\b/.test(text))return 'vakantiegeld';
    if(/\b(nabetaling|correctie loon)\b/.test(text))return 'nabetaling';
    if(/\b(salaris|loon|payroll)\b/.test(text))return 'salaris';
    if(/\b(belastingdienst|belastingteruggave)\b/.test(text)&&Number(original.amount)>0)return 'belastingteruggave';
    if(/\b(vergoeding|declaratie|onkosten|kilometer)\b/.test(text)&&Number(original.amount)>0)return 'vergoeding';
    if(/\b(spaar|sparen|deposito)\b/.test(text))return 'sparen';
    if(Number(original.amount)>0&&/\b(retour|refund|terugbetaling)\b/.test(text))return 'terugbetaling';
    return Number(original.amount)>0?'overige-inkomsten':'uitgave';
  }

  function recognitionProposal(original,rules=[]){
    const description=normalizeText(original.description);
    const organization=organizationName(original.rawDescription||original.description);
    const counterpart=normalizeIban(original.counterpartyAccount);
    const levels=[
      ['counterparty',rule=>counterpart&&normalizeIban(rule.value)===counterpart],
      ['description',rule=>description&&normalizeText(rule.value)===description],
      ['organization',rule=>organization&&normalizeText(rule.value)===organization],
      ['keyword',rule=>description&&description.includes(normalizeText(rule.value))],
      ['prediction',rule=>description&&description.includes(normalizeText(rule.value))]
    ];
    for(const [level,match] of levels){
      const hits=(rules||[]).filter(rule=>rule.enabled!==false&&rule.level===level&&rule.value&&match(rule));
      if(!hits.length)continue;
      const signatures=new Set(hits.map(rule=>[rule.category,rule.transactionType,rule.budgetItemId,rule.fixedExpenseId,rule.savingsGoalId].join('|')));
      return {level,rules:hits,rule:hits[0],conflict:signatures.size>1};
    }
    return null;
  }

  function fixedAmountAt(item,dateOrMonth){
    return resolveRecurringAmount(item,String(dateOrMonth).slice(0,7));
  }
  function fixedRecognition(original,profile,rule,fixedExpenses=[]){
    if(!rule?.fixedExpenseId)return {required:false,safe:true,item:null,expected:0,tolerance:0};
    const item=(fixedExpenses||[]).find(entry=>String(entry?.id)===String(rule.fixedExpenseId));
    if(!item)return {required:true,safe:false,item:null,reason:'gekoppelde vaste last bestaat niet meer'};
    const fixedOwner=validOwner(item.financialFor||item.rekening||'gezamenlijk');
    if(!profile||fixedOwner!==profile.accountOwner)return {required:true,safe:false,item,reason:'vaste last hoort bij een andere budgeteigenaar'};
    const expected=Math.abs(fixedAmountAt(item,original.bankDate));
    const actual=Math.abs(Number(original.amount)||0);
    const tolerance=Math.max(5,round2(expected*.15));
    const safe=expected>0&&Math.abs(actual-expected)<=tolerance+.004;
    return {required:true,safe,item,expected,tolerance,reason:safe?'':`bedrag wijkt meer dan ${tolerance.toFixed(2)} af`};
  }

  function isExplicitlyApproved(row){
    return row?.certainty==='goedgekeurd'&&row?.approvalSource==='manual';
  }
  function importReviewState(row){
    if(isExplicitlyApproved(row))return row.processing?.include===false?'niet-meetellen':'goedgekeurd';
    if(getTransactionProcessingStatus(row)==='onbekend')return 'onbekend';
    return 'nakijken';
  }
  function markExplicitlyApproved(row){
    row.processingStatus=row.processing?.include===false?'niet-meetellen':'goedgekeurd';
    row.certainty='goedgekeurd';
    row.approvalSource='manual';
    row.approvedAt=new Date().toISOString();
    row.reasons=[];
    return row;
  }
  function reopenForReview(row){
    row.processingStatus='nakijken';
    row.certainty='nakijken';
    row.approvalSource='';
    row.approvedAt='';
    return row;
  }
  function titleCaseMerchant(value){
    return String(value||'').trim().toLocaleLowerCase('nl-NL').replace(/(^|[\s-])\p{L}/gu,char=>char.toLocaleUpperCase('nl-NL'));
  }
  function recognizedDescription(original,proposal){
    const saved=String(proposal?.rule?.displayName||'').trim();
    if(saved)return saved;
    const ruleValue=String(proposal?.rule?.value||'').trim();
    if(proposal&&['organization','keyword','prediction'].includes(proposal.level)&&ruleValue.length<=60)return titleCaseMerchant(ruleValue);
    const organization=organizationName(original.rawDescription||original.description);
    return organization?titleCaseMerchant(organization):String(original.rawDescription||original.description||'').trim();
  }

  function classifyOriginal(original,profile,rules=[],profiles=[],fixedExpenses=[]){
    const proposal=recognitionProposal(original,rules);
    const proposedType=proposal?.rule?.transactionType||proposeType(original,profiles);
    const type=proposal?.rule?.fixedExpenseId?'vaste-last':proposedType;
    const fixedMatch=fixedRecognition(original,profile,proposal?.rule,fixedExpenses);
    const special=!['uitgave','vaste-last'].includes(type);
    const category=proposal?.rule?.category||'Ongecategoriseerd';
    const alwaysReview=proposal?.rules?.some(rule=>rule.alwaysReview)===true;
    const recognized=Boolean(proposal)||(type!=='uitgave'&&type!=='overige-inkomsten');
    return {
      certainty:recognized?'nakijken':'onbekend',
      recognitionState:recognized?'known':'unknown',
      approvalSource:'',
      approvedAt:'',
      reasons:[
        !profile?'rekeningprofiel ontbreekt':'',
        special?`bijzonder type: ${type}`:'',
        proposal?.conflict?'conflicterende herkenningsregels':'',
        !proposal?'geen herkenningsregel':'',
        category==='Ongecategoriseerd'?'categorie onbekend':'',
        alwaysReview?'regel staat op altijd nakijken':'',
        fixedMatch.required&&!fixedMatch.safe?fixedMatch.reason:''
      ].filter(Boolean),
      processing:{
        processingDate:original.bankDate,
        processedAmount:round2(Math.abs(Number(original.amount)||0)),
        description:recognizedDescription(original,proposal),
        category,
        transactionType:type,
        budgetOwner:profile?.accountOwner||'',
        budgetItemId:proposal?.rule?.budgetItemId||'',
        fixedExpenseId:proposal?.rule?.fixedExpenseId||'',
        fixedAmountMode:'none',
        savingsGoalId:proposal?.rule?.savingsGoalId||'',
        splits:[],
        advanceMode:'auto',
        include:true,
        recognitionRuleId:proposal?.rule?.id||'',
        note:''
      }
    };
  }

  function parseBankCsv(text,options={}){
    const table=parseDelimited(text);
    if(table.length<2)throw new Error('CSV bevat geen transactieregels.');
    const headers=table[0].map(value=>String(value||'').trim());
    const format=detectFormat(headers);
    const mapping={...inferMapping(headers),...(options.mapping||{})};
    const required=['date','description','amount'];
    if(required.some(key=>Number(mapping[key])<0))throw new Error('Datum, omschrijving of bedragkolom kon niet worden herkend.');
    const rows=table.slice(1).map((cells,index)=>{
      const direction=normalizeText(cells[mapping.direction]);
      let amount=parseAmount(cells[mapping.amount]);
      if(/^af\b|debit|debet/.test(direction))amount=-Math.abs(amount);
      if(/^bij\b|credit/.test(direction))amount=Math.abs(amount);
      const description=String(cells[mapping.description]||'').trim();
      const notes=String(cells[mapping.notes]||'').trim();
      return {
        bankDate:parseDate(cells[mapping.date]),bookingDate:parseDate(cells[mapping.bookingDate]),transactionTime:String(cells[mapping.transactionTime]||'').trim(),
        description:notes&&notes!==description?`${description} — ${notes}`:description,
        rawDescription:description,
        amount:round2(amount),
        accountIdentifier:normalizeIban(cells[mapping.accountIdentifier]),
        counterpartyAccount:normalizeIban(cells[mapping.counterpartyAccount]),
        currency:String(cells[mapping.currency]||'EUR').trim().toUpperCase()||'EUR',
        reference:String(cells[mapping.reference]||'').trim(),
        code:String(cells[mapping.code]||'').trim(),
        notes,
        lineNumber:index+2,
        rawCells:cells,
        valid:!!parseDate(cells[mapping.date])&&!!description&&Number.isFinite(amount)
      };
    });
    return {format,headers,mapping,rows};
  }

  function findProfile(parsed,profiles=[]){
    const identifiers=[...new Set(parsed.rows.map(row=>row.accountIdentifier).filter(Boolean))];
    if(identifiers.length!==1)return null;
    return profiles.find(profile=>normalizeIban(profile.identifier)===identifiers[0])||null;
  }

  function createImportDraft({text,fileName='import.csv',profiles=[],rules=[],transactions=[],existingImports=[],fixedExpenses=[],entryOwner='',today=new Date().toLocaleDateString('sv-SE'),id=uid('import')}){
    const parsed=parseBankCsv(text);
    const detectedProfile=findProfile(parsed,profiles);
    const ownerProfiles=OWNERS.includes(entryOwner)?profiles.filter(profile=>profile.accountOwner===entryOwner):[];
    const profile=detectedProfile||(ownerProfiles.length===1?ownerProfiles[0]:null);
    const fileDigest=csvFileDigest(text);
    const observed=new Map(existingImports.map(batch=>[batch.id,batch]));
    for(const tx of transactions||[]){if(!tx.importBatchId||!tx.bankOriginal||observed.has(tx.importBatchId))continue;const accountOwner=getTransactionAccountContext(tx,{accountProfiles:profiles});if(!accountOwner)continue;const siblings=transactions.filter(row=>row.importBatchId===tx.importBatchId);observed.set(tx.importBatchId,{id:tx.importBatchId,accountOwner,accountProfileId:tx.accountProfileId,lifecycle:tx.batchLifecycle||'active',rows:[...new Map(siblings.map(row=>[row.importTransactionId,{id:row.importTransactionId,bankOriginal:row.bankOriginal,accountOwner,sourceIdentityProof:row.sourceIdentityProof}])).values()]});}
    const rows=parsed.rows.map((original,index)=>{
      original.importBatchId=id;
      original.importTransactionId=`${id}-${String(index+1).padStart(5,'0')}`;
      original.fingerprint=fingerprint(original,profile?.id||original.accountIdentifier);
      const sourceIdentityProof={kind:'file-row',fileDigest,rowOrdinal:index+1};
      const duplicateResult=classifyCsvDuplicate({bankOriginal:original,accountOwner:profile?.accountOwner||entryOwner,sourceIdentityProof},{originalCsv:text,accountOwner:profile?.accountOwner||entryOwner,accountProfileId:profile?.id||''},[...observed.values()]);
      const importError=importDateError(original,today);
      const matchingFixed=original.valid&&/^\d{4}-\d{2}-\d{2}$/.test(original.bankDate)?fixedExpenses.map(item=>item.begindatum?resolveRecurringConfig(item,original.bankDate.slice(0,7)):item).filter(Boolean):[];
      const proposal=classifyOriginal(original,profile,rules,profiles,matchingFixed);
      return {id:original.importTransactionId,bankOriginal:original,accountProfileId:profile?.id||'',accountOwner:profile?.accountOwner||'',sourceIdentityProof,...duplicateResult,importError,...proposal};
    });
    const active=rows.filter(row=>row.bankOriginal.valid&&!row.importError&&!row.duplicate);
    const dates=active.map(row=>row.bankOriginal.bankDate).sort();
    const income=active.filter(row=>row.bankOriginal.amount>0).reduce((sum,row)=>sum+row.processing.processedAmount,0);
    const expenses=active.filter(row=>row.bankOriginal.amount<0).reduce((sum,row)=>sum+row.processing.processedAmount,0);
    return {
      id,fileName,fileDigest,originalCsv:String(text),lifecycle:'active',version:0,bank:parsed.format==='ing'?'ING':'Onbekend',format:parsed.format,headers:parsed.headers,mapping:parsed.mapping,entryOwner:OWNERS.includes(entryOwner)?entryOwner:'',
      accountProfileId:profile?.id||'',accountOwner:profile?.accountOwner||'',status:'concept',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      periodFrom:dates[0]||'',periodTo:dates[dates.length-1]||'',rows,
      summary:{newCount:active.length,duplicateCount:rows.filter(row=>row.duplicate).length,totalIncome:round2(income),totalExpenses:round2(expenses),sureCount:0,approvedCount:0,reviewCount:active.filter(row=>importReviewState(row)==='nakijken').length,unknownCount:active.filter(row=>importReviewState(row)==='onbekend').length}
    };
  }

  const UI={draft:null,visibleRows:60,root:null,conflicts:new Map()};
  const ImportPerformance={pending:new Map(),chains:new Map(),syncPromise:null,syncRequested:false,syncDiagnostics:[],diagnosticSignature:''};
  function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function escAttr(value){return esc(value).replace(/`/g,'&#96;').replace(/[\u0000-\u001f\u007f]/g,'');}
  function euro(value){return new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value)||0);}
  function ownerLabel(value){return value==='gezamenlijk'?'Gezamenlijk':value==='dara'?'Dara':'Dion';}
  function profileDisplayLabel(profile){
    const title=String(profile?.name||profile?.bank||'Rekening').trim();
    const identifier=String(profile?.identifier||'').trim();
    return identifier?`${title} · ${identifier}`:title;
  }
  function option(value,label,current){return `<option value="${escAttr(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;}
  function updateDraftSummary(draft,{touch=true}={}){
    const active=(draft.rows||[]).filter(row=>row.bankOriginal?.valid&&!row.importError&&!row.duplicate);
    draft.summary={
      newCount:active.length,
      duplicateCount:(draft.rows||[]).filter(row=>row.duplicate).length,
      totalIncome:round2(active.filter(row=>row.bankOriginal.amount>0&&row.processing.include).reduce((sum,row)=>sum+Number(row.processing.processedAmount||0),0)),
      totalExpenses:round2(active.filter(row=>row.bankOriginal.amount<0&&row.processing.include).reduce((sum,row)=>sum+Number(row.processing.processedAmount||0),0)),
      sureCount:active.filter(isExplicitlyApproved).length,
      approvedCount:active.filter(isExplicitlyApproved).length,
      reviewCount:active.filter(row=>importReviewState(row)==='nakijken').length,
      unknownCount:active.filter(row=>importReviewState(row)==='onbekend').length,
      uncategorizedCount:active.filter(row=>row.processing.category==='Ongecategoriseerd').length
    };
    if(touch)draft.updatedAt=new Date().toISOString();
    return draft.summary;
  }
  function compactSummary(draft){
    updateDraftSummary(draft,{touch:false});
    return clone({
      id:draft.id,fileName:draft.fileName,accountProfileId:draft.accountProfileId,accountOwner:draft.accountOwner,bank:draft.bank,status:draft.status,
      importDate:draft.createdAt,periodFrom:draft.periodFrom,periodTo:draft.periodTo,
      lifecycle:batchLifecycle(draft),version:Number(draft.version)||0,operationId:draft.operationId||'',newCount:draft.summary.newCount,duplicateCount:draft.summary.duplicateCount,uncategorizedCount:draft.summary.uncategorizedCount||0,
      totalIncome:draft.summary.totalIncome,totalExpenses:draft.summary.totalExpenses,updatedAt:draft.updatedAt
    });
  }
  function applyImportSummary(target,draft){
    const summary=compactSummary(draft);target.importSummaries=target.importSummaries||[];
    const index=target.importSummaries.findIndex(item=>item.id===summary.id);
    if(index>=0)target.importSummaries[index]={...target.importSummaries[index],...summary};else target.importSummaries.unshift(summary);
    target.activeImportId=draft.status==='concept'?draft.id:(target.activeImportId===draft.id?'':target.activeImportId);
    ensureImportBankSources(target,draft);
  }
  function commitSummary(root,draft){
    if(!root.commitChange(()=>applyImportSummary(root.state,draft),{render:false}))throw new Error('Importsamenvatting kon niet worden opgeslagen.');
  }
  function updateImportSaveStatus(text,error=false){
    if(typeof document==='undefined')return;
    const status=document.querySelector('#u4ImportModalRoot [data-u4-save-status]');
    if(!status)return;
    status.textContent=text;
    status.classList.toggle('u4-error',Boolean(error));
  }
  function sameEditorBase(left,right){
    if(importVersion(left)!==importVersion(right))return false;
    if(left?.operationId||right?.operationId)return sameImportOperation(left,right);
    // Compatibility for an explicitly stored, unversioned batch: compare its whole base,
    // never infer provenance from amount/date/description or generate an identity on read.
    const comparable=value=>{const copy=clone(value);delete copy.confirmedBatch;delete copy.syncConflict;delete copy.baseVersion;for(const row of copy.rows||[]){delete row.bankSourceRevision;if(row.processing)delete row.processing.editorVersion;}return JSON.stringify(copy);};
    return comparable(left)===comparable(right);
  }
  const ImportEditors=new Map();
  function editorSession(draft){
    let session=ImportEditors.get(String(draft.id));
    if(!session||session.draft!==draft){session={draft,base:clone(draft),scope:ImportStore.scope,revision:0,savedRevision:0,write:Promise.resolve()};delete session.base.confirmedBatch;ImportEditors.set(String(draft.id),session);}
    return session;
  }
  async function beginImportEditor(root,record){
    const scope=ImportStore.scope,saved=await ImportStore.getJournal(`editor-draft-${record.id}`);
    if(ImportStore.scope!==scope)throw new Error('Het huishouden is intussen gewijzigd. Heropen de import.');
    const draft=clone(record);delete draft.confirmedBatch;
    for(const row of draft.rows){const source=bankSourceForImport(root.state,record.id,row.id);if(source&&row.duplicate){row.duplicate=false;row.sharedBankSource=true;}if(source?.approvedProcessing){row.processing=clone(source.approvedProcessing);row.processingStatus=source.processingStatus;row.certainty=source.processingStatus==='goedgekeurd'||source.processingStatus==='niet-meetellen'?'goedgekeurd':'nakijken';row.approvalSource=source.approvalSource;row.approvedAt=source.approvedAt;}row.bankSourceRevision=source?.processingRevision||0;row.processing.editorVersion=113;}
    const session=editorSession(draft);
    if(saved?.status==='draft'){
      if(sameEditorBase(saved.base,record)){
        const canonicalBase=clone(draft);
        applyFinancialCandidate(draft,saved.draft);session.base=canonicalBase;delete session.base.confirmedBatch;
        session.revision=Number(saved.revision)||0;session.savedRevision=session.revision;
      }else{
        await preserveImportConflict(root,saved.draft,record,[{kind:'editor-base-changed'}]);draft.syncConflict=true;
      }
    }
    return draft;
  }
  function persistLocalImportEditor(root,draft){
    const session=editorSession(draft),snapshot=clone(draft);delete snapshot.confirmedBatch;
    session.revision++;
    const revision=session.revision,base=clone(session.base);
    session.write=session.write.catch(()=>{}).then(async()=>{
      if(ImportStore.scope!==session.scope)throw new Error('Het huishouden is intussen gewijzigd. Het concept blijft bij het oorspronkelijke huishouden.');
      const stored=await ImportStore.getImport(draft.id);if(stored?.lifecycle==='deleted')throw new Error('Deze import is permanent verwijderd; het concept wordt niet opnieuw opgeslagen.');
      if(ImportStore.scope!==session.scope)throw new Error('Het huishouden is intussen gewijzigd. Het concept blijft bij het oorspronkelijke huishouden.');
      await ImportStore.putJournal({id:`editor-draft-${draft.id}`,importId:draft.id,operation:'editor-draft',status:'draft',revision,base,draft:snapshot});
      session.savedRevision=revision;return draft;
    });
    return session.write;
  }
  function commitImportEditor(root,draft,{approveIds=[],reopenIds=[]}={}){
    if(!approveIds.length&&!reopenIds.length)return persistLocalImportEditor(root,draft).then(()=>({state:clone(root.state),batch:clone(draft),localConcept:true}));
    const session=editorSession(draft),revision=session.revision,rows=clone(draft.rows),requestedBase=clone(session.base),write=session.write;
    const profile={accountProfileId:draft.accountProfileId,accountOwner:draft.accountOwner};
    session.commitCount=(session.commitCount||0)+1;session.committing=true;
    const previous=session.commitTail||Promise.resolve();
    const operation=previous.catch(()=>{}).then(async()=>{
      await write;
      if(ImportStore.scope!==session.scope)throw new Error('Het huishouden is intussen gewijzigd. Heropen de import in het oorspronkelijke huishouden.');
      if((await ImportStore.getJournal(`conflict-${draft.id}`))?.status==='conflict')throw cloudImportError('import-conflict','Los eerst het synchronisatieconflict op. De cloudstand blijft behouden.');
      if(ImportStore.scope!==session.scope)throw new Error('Het huishouden is intussen gewijzigd. Heropen de import in het oorspronkelijke huishouden.');
      const base=clone(session.base);
      const requested=new Map(rows.map(row=>[row.id,row])),originals=new Map(requestedBase.rows.map(row=>[row.id,row]));
      const mergedRows=base.rows.map(current=>{const desired=requested.get(current.id),original=originals.get(current.id);return desired&&original&&(approveIds.includes(current.id)||reopenIds.includes(current.id))&&(JSON.stringify(desired.processing)!==JSON.stringify(original.processing)||desired.accountProfileId!==original.accountProfileId||desired.accountOwner!==original.accountOwner||getTransactionProcessingStatus({...desired,source:'csv'})!==getTransactionProcessingStatus({...original,source:'csv'})||approveIds.includes(current.id)||reopenIds.includes(current.id))?desired:clone(current);});
      const result=await commitImportCommand(root,base,{type:'editor-commit',rows:mergedRows,profile:JSON.stringify(profile)!==JSON.stringify({accountProfileId:requestedBase.accountProfileId,accountOwner:requestedBase.accountOwner})?profile:null,editorRevision:revision,editorBaseVersion:importVersion(base),editorBaseOperation:base.operationId||'',approveIds:[...new Set(approveIds)],reopenIds:[...new Set(reopenIds)]});
      // The durable core receipt is the commit boundary; later journal cleanup is recoverable.
      if(ImportStore.scope!==session.scope)return result;
      session.base=clone(result.batch);delete session.base.confirmedBatch;
      for(const row of session.base.rows)row.bankSourceRevision=bankSourceForImport(root.state,draft.id,row.id)?.processingRevision||0;
      const unsaved=rows.some(row=>!approveIds.includes(row.id)&&!reopenIds.includes(row.id)&&JSON.stringify(row.processing)!==JSON.stringify(requestedBase.rows.find(old=>old.id===row.id)?.processing));
      if(session.revision===revision&&!unsaved){
        applyFinancialCandidate(draft,clone(result.batch));
        session.write=session.write.then(async()=>{if(ImportStore.scope===session.scope&&session.revision===revision)await ImportStore.deleteJournal(`editor-draft-${draft.id}`);}).catch(error=>{console.warn('De verwerking is opgeslagen; het conceptjournal wordt later opgeruimd.',error);});await session.write;
      }else{
        // Reconcile our own receipt without discarding edits made while the commit awaited storage.
        const latest=new Map(draft.rows.map(row=>[row.id,row])),snapshot=new Map(rows.map(row=>[row.id,row]));
        draft.rows=result.batch.rows.map(current=>{const desired=latest.get(current.id),captured=snapshot.get(current.id);return desired&&captured&&(JSON.stringify(desired.processing)!==JSON.stringify(captured.processing)||!approveIds.includes(current.id)&&!reopenIds.includes(current.id)&&JSON.stringify(desired.processing)!==JSON.stringify(current.processing)||desired.accountProfileId!==captured.accountProfileId||desired.accountOwner!==captured.accountOwner||getTransactionProcessingStatus({...desired,source:'csv'})!==getTransactionProcessingStatus({...captured,source:'csv'}))?desired:clone(current);});
        for(const key of ['accountProfileId','accountOwner'])if(draft[key]===profile[key])draft[key]=result.batch[key];
        draft.version=result.batch.version;draft.baseVersion=result.batch.baseVersion;draft.operationId=result.batch.operationId;
        await persistLocalImportEditor(root,draft);
      }
      return result;
    }).finally(()=>{session.commitCount--;session.committing=session.commitCount>0;});
    session.commitTail=operation;return operation;
  }
  async function acknowledgeRecoveredEditor(entry){
    if(entry.intent?.type!=='editor-commit')return;
    const id=`editor-draft-${entry.importId}`,saved=await ImportStore.getJournal(id);
    if(saved?.status!=='draft'||importVersion(saved.base)!==entry.intent.editorBaseVersion||String(saved.base.operationId||'')!==entry.intent.editorBaseOperation)return;
    const expected=new Map(entry.intent.rows.map(row=>[row.id,row]));
    const unchanged=saved.draft.rows.every(row=>JSON.stringify(row.processing)===JSON.stringify(expected.get(row.id)?.processing));
    const session=ImportEditors.get(String(entry.importId));
    if(unchanged&&saved.revision===entry.intent.editorRevision){
      await ImportStore.deleteJournal(id);
      if(session&&session.revision===saved.revision){session.base=clone(entry.batch);applyFinancialCandidate(session.draft,clone(entry.batch));}
    }else{
      const local=new Map(saved.draft.rows.map(row=>[row.id,row]));
      saved.draft.rows=entry.batch.rows.map(row=>{const desired=local.get(row.id);return desired&&JSON.stringify(desired.processing)!==JSON.stringify(expected.get(row.id)?.processing)?desired:clone(row);});
      saved.base=clone(entry.batch);delete saved.base.confirmedBatch;
      for(const key of ['version','baseVersion','operationId'])saved.draft[key]=entry.batch[key];
      await ImportStore.putJournal(saved);
      if(session&&session.revision===saved.revision){session.base=clone(saved.base);applyFinancialCandidate(session.draft,clone(saved.draft));}
    }
  }
  async function sessionWrite(draft){await editorSession(draft).write;}
  function markEditorRowChanged(row){if(isExplicitlyApproved(row))reopenForReview(row);}
  function persistImportDraftImmediate(root,draft,{syncCloud=true,updateSummary=true}={}){
    if(!plain(draft)||!draft.id)return Promise.reject(new Error('Importconcept mist een geldig ID.'));
    const id=String(draft.id);
    const previous=ImportPerformance.chains.get(id)||Promise.resolve();
    const operation=previous.catch(()=>{}).then(async()=>{
      if(updateSummary)updateDraftSummary(draft,{touch:false});
      else draft.updatedAt=new Date().toISOString();
      const stored=await ImportStore.getImport(id);
      if(stored){const left=clone(stored),right=clone(draft);for(const value of [left,right]){delete value.confirmedBatch;delete value.syncConflict;delete value.updatedAt;delete value.baseVersion;}if(draft.operationId&&JSON.stringify(left)===JSON.stringify(right))return draft;}
      if(stored&&draft.version!==undefined&&importVersion(stored)!==importVersion(draft))throw cloudImportError('import-conflict','Deze import is intussen gewijzigd. Heropen de actuele importdetails.');
      draft.updatedAt=new Date().toISOString();draft.baseVersion=Number(stored?.baseVersion??draft.baseVersion??draft.version??0);draft.version=importVersion(stored||draft)+1;draft.operationId=uid('import-op');
      const baseSignature=JSON.stringify(root.state),candidate=clone(root.state);applyImportSummary(candidate,draft);
      const previousQueue=(await ImportStore.listSync()).find(item=>item.importId===id);
      const journal={id:draft.operationId,importId:id,operation:'import-command',status:'pending',intent:{type:'draft-save',operationId:draft.operationId},baseSignature,candidate,batch:clone(draft),previousBatch:stored?clone(stored):null};
      await ImportStore.putJournal(journal);
      if(JSON.stringify(root.state)!==baseSignature){journal.status='conflict';await ImportStore.putJournal(journal);await preserveImportConflict(root,draft,stored||{id,version:0},[{kind:'local-core-changed'}]);throw new Error('De state wijzigde tijdens opslaan. De importkeuze is veilig bewaard.');}
      await ImportStore.putImport(draft);
      if(syncCloud)await queueImportSync(draft);
      try{commitSummary(root,draft);}catch(error){journal.status='rolled-back';await ImportStore.putJournal(journal);await ImportStore.rollbackImport(draft,stored,previousQueue);throw error;}
      journal.status='completed';delete journal.candidate;delete journal.previousBatch;delete journal.baseSignature;await ImportStore.putJournal(journal);
      if(syncCloud)flushImportSync(root).catch(error=>console.warn('Importsynchronisatie wordt later opnieuw geprobeerd.',error));
      return draft;
    });
    ImportPerformance.chains.set(id,operation);
    operation.finally(()=>{if(ImportPerformance.chains.get(id)===operation)ImportPerformance.chains.delete(id);}).catch(()=>{});
    return operation;
  }
  function scheduleImportDraftPersist(root,draft,{delay=400,syncCloud=true,updateSummary=true}={}){
    const id=String(draft?.id||'');
    if(!id)return Promise.reject(new Error('Importconcept mist een geldig ID.'));
    let pending=ImportPerformance.pending.get(id);
    if(!pending)pending={root,draft,syncCloud:false,updateSummary:false,timer:null,resolvers:[]};
    pending.root=root;pending.draft=draft;
    pending.syncCloud=pending.syncCloud||syncCloud;
    pending.updateSummary=pending.updateSummary||updateSummary;
    if(pending.timer)clearTimeout(pending.timer);
    const promise=new Promise((resolve,reject)=>pending.resolvers.push({resolve,reject}));
    pending.timer=setTimeout(()=>{
      ImportPerformance.pending.delete(id);
      updateImportSaveStatus('Wijzigingen lokaal opslaan…');
      persistImportDraftImmediate(pending.root,pending.draft,{syncCloud:pending.syncCloud,updateSummary:pending.updateSummary}).then(value=>{
        updateImportSaveStatus('Wijzigingen lokaal opgeslagen; cloudsync loopt op de achtergrond.');
        pending.resolvers.forEach(item=>item.resolve(value));
      }).catch(error=>{
        updateImportSaveStatus(`Lokaal opslaan mislukt: ${error?.message||error}`,true);
        pending.resolvers.forEach(item=>item.reject(error));
      });
    },Math.max(0,delay));
    ImportPerformance.pending.set(id,pending);
    return promise;
  }
  async function flushScheduledImportDraft(root,draft,{syncCloud=true,updateSummary=true}={}){
    const id=String(draft?.id||'');
    const pending=ImportPerformance.pending.get(id);
    if(pending){
      if(pending.timer)clearTimeout(pending.timer);
      ImportPerformance.pending.delete(id);
      pending.syncCloud=pending.syncCloud||syncCloud;
      pending.updateSummary=pending.updateSummary||updateSummary;
      try{
        const value=await persistImportDraftImmediate(pending.root,pending.draft,{syncCloud:pending.syncCloud,updateSummary:pending.updateSummary});
        pending.resolvers.forEach(item=>item.resolve(value));
        return value;
      }catch(error){
        pending.resolvers.forEach(item=>item.reject(error));
        throw error;
      }
    }
    return persistImportDraftImmediate(root,draft,{syncCloud,updateSummary});
  }
  async function persistImportDraft(root,draft,options={}){
    return persistImportDraftImmediate(root,draft,options);
  }
  async function saveDraft(root,draft,{sync=false}={}){
    return persistImportDraftImmediate(root,draft,{syncCloud:sync,updateSummary:true});
  }
  async function reconcileActiveImportReference(root,{localRead=id=>ImportStore.getImport(id)}={}){
    const activeId=String(root?.state?.activeImportId||'');
    if(!activeId)return {action:'none',activeImportId:''};
    const summaries=root.state.importSummaries||[];
    const summary=summaries.find(item=>String(item.id)===activeId);
    let local=null;
    try{local=await localRead(activeId);}
    catch(error){return {action:'local-error',activeImportId:activeId,error};}
    if(local){
      if(local.status==='concept'){
        if(!summary)commitSummary(root,local);
        return {action:summary?'local':'summary-restored',activeImportId:activeId};
      }
      commitSummary(root,local);
      return {action:'cleared-finished',activeImportId:''};
    }
    if(!summary||summary.status!=='concept'){
      const ok=root.commitChange(()=>{if(root.state.activeImportId===activeId)root.state.activeImportId='';},{render:false});
      if(!ok)throw new Error('De verouderde importblokkade kon niet worden hersteld.');
      return {action:'cleared-stale',activeImportId:''};
    }
    return {action:'cloud-needed',activeImportId:activeId};
  }

  async function deleteCloudImportBestEffort(root,id,record=null){
    const cloud=root?.CloudAdapter;
    try{
      if(!cloud?.isConnected?.()||!cloud.modules?.firestore||!cloud.db)return false;
      const firestore=cloud.modules.firestore;
      if(typeof firestore.deleteDoc!=='function')return false;
      const importRef=cloudImportRef(cloud,firestore,id);
      let chunkCount=null;
      if(typeof firestore.getDoc==='function'){
        const snapshot=await firestore.getDoc(importRef);
        if(!snapshot?.exists?.())return true;
        chunkCount=Number(snapshot.data()?.chunkCount);
      }
      if(!Number.isInteger(chunkCount)&&Array.isArray(record?.rows))chunkCount=chunkRows(record.rows).length;
      if(Number.isInteger(chunkCount)&&chunkCount>=0){
        const indices=Array.from({length:chunkCount},(_,index)=>index);
        await mapWithConcurrency(indices,CLOUD_READ_CONCURRENCY,index=>firestore.deleteDoc(
          cloudImportChunkRef(cloud,firestore,id,String(index).padStart(4,'0'))
        ));
      }
      await firestore.deleteDoc(importRef);
      return true;
    }catch(error){
      console.warn('Cloudkopie van verwijderd importconcept kon niet worden opgeruimd.',classifyCloudError(error,'Cloudopschoning mislukt.'));
      return false;
    }
  }

  async function discardImportConcept(root,id){
    const summary=(root.state.importSummaries||[]).find(row=>row.id===id);if(!summary||summary.status!=='concept')throw new Error('Alleen een onverwerkt concept kan hier worden verwijderd.');
    let draft=await ImportStore.getImport(id);
    if(!draft){const dependencies=(root.state.transactions||[]).some(tx=>tx.importBatchId===id)||(root.state.savingsGoalLedger||[]).some(row=>row.importBatchId===id)||(root.state.manualTransactionReplacements||[]).some(row=>row.importBatchId===id||row.id?.startsWith(`replacement-${id}-`));if(dependencies)throw new Error('Betrouwbare importdetails ontbreken. Herstel eerst de bron voordat je deze batch verwijdert.');draft={...clone(summary),rows:[],lifecycle:'active',version:Number(summary.version)||0};}
    await commitImportCommand(root,draft,{type:'delete'});root.renderActiveTab?.();return {ok:true,localCleanup:true,cloudCleanup:false};
  }
  function goalExists(state,id){
    if(!id)return true;
    return OWNERS.some(owner=>(state.spaardoelen?.[owner]||[]).some(goal=>goal.id===id));
  }
  function activeFixedRows(state){
    return Array.isArray(state.recurringFixedExpenses)?state.recurringFixedExpenses:state.recurringFixedExpenses?.voor||[];
  }
  function fixedExists(state,id,month){
    if(!id)return true;
    const item=activeFixedRows(state).find(item=>item.id===id);
    return !!item&&(!month||!item.begindatum||!!resolveRecurringConfig(item,month));
  }
  function findFixedItem(state,id){
    const item=activeFixedRows(state).find(item=>item.id===id);
    return item?{item}:null;
  }
  function rowProcessingValidation(row,state){
    if(row.importError)return {ok:false,errors:[row.importError]};
    if(!row.bankOriginal?.valid)return {ok:false,errors:[{code:'original',message:'Originele bankregel is ongeldig.'}]};
    if(row.possibleDuplicate&&!row.identityDecision&&!row.duplicate)return {ok:false,errors:[{code:'identity-choice',field:'identityDecision',message:'Kies of deze bankregel dezelfde of een afzonderlijke betaling is.'}]};
    const p=row.processing||{},lines=p.splits?.length?p.splits:[p];
    const months=[...new Set(lines.map(line=>line.fixedOccurrenceMonth||p.fixedOccurrenceMonth||String(row.bankOriginal.bankDate).slice(0,7)))];
    const timelineState=Array.isArray(state.recurringFixedExpenses)?state:{...state,recurringFixedExpenses:activeFixedRows(state)};
    const occurrences=lines.some(line=>line.fixedExpenseId)?months.flatMap(month=>plannedOccurrences(resolveFixedExpensesForMonth(timelineState,month),month)):[];
    return validateTransactionProcessing(row,{fixedOccurrences:occurrences,validFixedId:id=>occurrences.some(item=>item.itemId===id),goalExists:id=>goalExists(state,id),refundCategoryExists:(category,month,owner)=>refundCategoryIsRecognizable(state,category,month,owner)});
  }
  function validateDraft(draft,state){
    const errors=[];
    const profile=(state.accountProfiles||[]).find(item=>item.id===draft.accountProfileId);
    if(!profile)errors.push({code:'profile',message:'Kies of maak eerst een rekeningprofiel.'});
    (draft.rows||[]).filter(row=>!row.duplicate).forEach(row=>{
      if(row.importError)errors.push({rowId:row.id,...row.importError});
      if(!row.bankOriginal?.valid)errors.push({rowId:row.id,code:'original',message:'Originele bankregel mist datum, omschrijving of bedrag.'});
      if(row.bankOriginal?.valid&&!isExplicitlyApproved(row))errors.push({rowId:row.id,code:'approval',message:'Keur deze transactie expliciet goed voordat je de import verwerkt.'});
      const p=row.processing||{};
      rowProcessingValidation(row,state).errors.forEach(error=>errors.push({...error,rowId:row.id}));
      if(!parseDate(p.processingDate))errors.push({rowId:row.id,code:'date',message:'Ongeldige verwerkingsdatum.'});
      if(!Number.isFinite(Number(p.processedAmount)))errors.push({rowId:row.id,code:'amount',message:'Verwerkt bedrag ontbreekt.'});
      if(!OWNERS.includes(p.budgetOwner))errors.push({rowId:row.id,code:'owner',message:'Budgeteigenaar ontbreekt.'});
      if(p.transactionType==='maandelijkse-bijdrage'&&!['dion','dara'].includes(p.budgetOwner))errors.push({rowId:row.id,code:'owner',message:'Kies Dion of Dara als ontvanger van het zakgeld.'});
      if(p.transactionType==='vaste-last'&&!p.splits?.length&&!p.fixedExpenseId)errors.push({rowId:row.id,code:'fixed-choice',message:'Kies welke vaste last bij deze banktransactie hoort.'});
      if(['sparen','naar-spaarrekening','van-spaarrekening'].includes(p.transactionType)&&!p.savingsGoalId)errors.push({rowId:row.id,code:'goal-choice',message:'Kies het spaardoel voor deze inleg.'});
      if(transferType(p.transactionType)&&(!p.sourceAccountProfileId||!p.destinationAccountProfileId||p.sourceAccountProfileId===p.destinationAccountProfileId))errors.push({rowId:row.id,code:'transfer',message:'Kies twee verschillende rekeningen voor de interne overboeking.'});
      if(p.savingsGoalId&&!goalExists(state,p.savingsGoalId))errors.push({rowId:row.id,code:'goal',message:'Het gekozen spaardoel bestaat niet meer.'});
      if(p.fixedExpenseId&&!fixedExists(state,p.fixedExpenseId,p.fixedOccurrenceMonth||String(row.bankOriginal.bankDate).slice(0,7)))errors.push({rowId:row.id,code:'fixed',message:'De gekozen vaste last bestaat niet meer.'});

    });
    return {ok:errors.length===0,errors};
  }
  function transactionKind(type,include=true){
    if(!include||type==='niet-meetellen')return 'niet-meetellen';
    if(['salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten'].includes(type))return 'inkomen';
    if(['interne-overboeking','naar-spaarrekening','van-spaarrekening','maandelijkse-bijdrage','extra-bijdrage','sparen','terugbetaling-voorschot'].includes(type))return 'interne-overboeking';
    if(type==='vaste-last')return 'vaste-last';
    return 'uitgave';
  }
  function expenseImpact(type,amount,include=true){
    // Legacy stored compatibility field, derived from the same projection as readers.
    return projectTransaction({source:'manual',transactionType:type,amount,processing:{include}}).effects.budgetImpact;
  }
  function financialRows(row){
    const p=row.processing,activeSplits=(p.splits||[]).filter(split=>Number(split.amount)!==0);
    const common=part=>({amount:round2(Math.abs(Number(part.amount??p.processedAmount))),budgetOwner:part.budgetOwner||p.budgetOwner,category:part.category||p.category,budgetItemId:part.budgetItemId||'',savingsGoalId:part.savingsGoalId||p.savingsGoalId||'',refundCategory:part.refundCategory||'',refundMonth:part.refundMonth||(p.editorVersion>=113?row.bankOriginal.bankDate.slice(0,7):''),advanceMode:part.advanceMode||p.advanceMode||'auto',include:p.include!==false&&part.include!==false,transactionType:part.transactionType||(part.fixedExpenseId?'vaste-last':activeSplits.length&&p.transactionType==='vaste-last'?'uitgave':p.transactionType),fixedExpenseId:part.fixedExpenseId||'',fixedOccurrenceId:part.fixedOccurrenceId||'',fixedOccurrenceMonth:part.fixedOccurrenceMonth||''});
    // A withdrawal is one goal mutation. Its lines allocate correction capacity only.
    if(processingFamily(p.transactionType)==='sparen'){
      const lines=activeSplits.length?activeSplits:[{...p,amount:p.singleLineAmount??p.processedAmount}];
      const directBudgetAllocations=lines.filter(line=>line.withdrawalBudgetCategory).map(line=>({id:line.id||p.singleLineId||row.id,amount:Number(line.amount),category:line.withdrawalBudgetCategory,budgetOwner:line.budgetOwner||p.budgetOwner}));
      return [{...common(p),id:`tx-${row.id}`,splitId:'',isFirst:true,directBudgetAllocations}];
    }
    if(activeSplits.length)return activeSplits.map((split,index)=>({...common(split),id:`${row.id}-split-${split.id||index+1}`,splitId:split.id||String(index+1),isFirst:index===0}));
    return [{...common({...p,amount:p.singleLineAmount??p.processedAmount}),id:p.singleLineId?`${row.id}-split-${p.singleLineId}`:`tx-${row.id}`,splitId:p.singleLineId||'',isFirst:true}];
  }
  function advanceForTransaction(tx){
    if(tx.kind==='niet-meetellen'||tx.kind==='interne-overboeking'||tx.processing?.advanceMode==='none'||tx.accountOwner===tx.budgetOwner)return null;
    const incoming=tx.kind==='inkomen';
    const debtor=incoming?tx.accountOwner:tx.budgetOwner;
    const creditor=incoming?tx.budgetOwner:tx.accountOwner;
    return {id:`advance-${tx.id}`,transactionId:tx.id,month:String(tx.date).slice(0,7),debtor,creditor,originalAmount:round2(tx.amount),outstandingAmount:round2(tx.amount),status:'open',createdAt:tx.createdAt,settlementTransferIds:[],repaymentAllocationIds:[]};
  }
  function savingsForTransaction(tx,state){return createTransactionSavingsEntry(tx,state);}
  function daysBetween(a,b){return Math.abs(new Date(`${a}T12:00:00`)-new Date(`${b}T12:00:00`))/86400000;}
  function detectInternalPairs(transactions,state){
    const candidates=[...(state.transactions||[]),...transactions].filter(tx=>tx.transactionType==='interne-overboeking'||tx.kind==='interne-overboeking');
    const used=new Set((state.internalTransferPairs||[]).flatMap(pair=>pair.transactionIds||[]));const pairs=[];
    for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
      const a=candidates[i],b=candidates[j];if(used.has(a.id)||used.has(b.id)||a.id===b.id)continue;
      if(Math.abs(Math.abs(Number(a.bankOriginal?.amount??a.accountDelta))-Math.abs(Number(b.bankOriginal?.amount??b.accountDelta)))>.004)continue;
      if(Math.sign(Number(a.bankOriginal?.amount??a.accountDelta))===Math.sign(Number(b.bankOriginal?.amount??b.accountDelta)))continue;
      if(daysBetween(a.bankOriginal?.bankDate||a.date,b.bankOriginal?.bankDate||b.date)>3)continue;
      const aProfile=state.accountProfiles.find(profile=>profile.id===a.accountProfileId);
      const bProfile=state.accountProfiles.find(profile=>profile.id===b.accountProfileId);
      if(aProfile&&bProfile){
        const linked=normalizeIban(a.bankOriginal?.counterpartyAccount)===normalizeIban(bProfile.identifier)&&normalizeIban(b.bankOriginal?.counterpartyAccount)===normalizeIban(aProfile.identifier);
        if(!linked)continue;
      }
      const ids=[a.id,b.id].sort();pairs.push({id:`internal-pair-${hashText(ids.join('|'))}`,transactionIds:ids,amount:round2(Math.abs(Number(a.amount)||0)),status:'voorgesteld',createdAt:new Date().toISOString()});used.add(a.id);used.add(b.id);
    }
    return pairs;
  }
  function directionalBalances(state,throughMonth='9999-12'){
    const map=new Map();
    (state.advanceLedger||[]).filter(row=>row.active!==false&&row.status!=='voldaan'&&Number(row.outstandingAmount)>0&&String(row.month||'')<=throughMonth).forEach(row=>{
      const key=`${row.debtor}|${row.creditor}`;map.set(key,round2((map.get(key)||0)+Number(row.outstandingAmount||0)));
    });
    return [...map.entries()].map(([key,amount])=>{const [debtor,creditor]=key.split('|');return {debtor,creditor,amount};}).filter(row=>row.amount>.004).sort((a,b)=>b.amount-a.amount);
  }
  function proposeRepaymentAllocations(state,debtor,creditor,amount){
    let remaining=round2(amount);const allocations=[];
    (state.advanceLedger||[]).filter(row=>row.active!==false&&row.debtor===debtor&&row.creditor===creditor&&row.status!=='voldaan'&&Number(row.outstandingAmount)>0).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).forEach(row=>{
      if(remaining<=.004)return;const applied=round2(Math.min(remaining,Number(row.outstandingAmount)||0));
      allocations.push({id:`allocation-${row.id}`,advanceId:row.id,amount:applied});remaining=round2(remaining-applied);
    });
    return allocations;
  }
  function planImportEffects(draft,state){
    draft=clone(draft);const sourceState=clone(state);ensureImportBankSources(sourceState,draft);
    const validation=validateDraft(draft,state);
    if(!validation.ok)return {ok:false,errors:validation.errors};
    const profile=state.accountProfiles.find(item=>item.id===draft.accountProfileId);
    const transactions=[];const replacements=[];const savingsEntries=[];const advances=[];const repayments=[];const fixedAdjustments=[];const affectedMonths=new Set();const counts={expenses:0,income:0,internal:0,savings:0,refunds:0,advances:0,uncategorized:0};
    for(const row of draft.rows.filter(item=>item.bankOriginal.valid&&!item.importError&&!item.duplicate)){
      const p=row.processing;const type=p.include===false?'niet-meetellen':p.transactionType;
      const bankSource=bankSourceForImport(sourceState,draft.id,row.id);
      const sourceAccount=bankSource?.accountContext||profile.accountOwner,sourceProfileId=bankSource?.accountProfileId||profile.id;
      financialRows({...row,id:bankSource?.processingRowId||row.id}).forEach(part=>{
        const lineType=part.transactionType||type;const kind=transactionKind(lineType,part.include);
        const tx={
          id:part.id,date:row.bankOriginal.bankDate,transactionDate:row.bankOriginal.bankDate,amount:round2(part.amount),description:row.bankOriginal.description,category:part.category||'Ongecategoriseerd',
          kind,transactionType:lineType,reviewStatus:'bevestigd',accountOwner:sourceAccount,budgetOwner:part.budgetOwner,
          account:sourceAccount,financialFor:part.budgetOwner,owner:part.budgetOwner,accountProfileId:sourceProfileId,
          source:'csv',accountContext:sourceAccount,accountContextEvidence:'account-profile',
          processingStatus:part.include===false||type==='niet-meetellen'?'niet-meetellen':'goedgekeurd',
          approvalSource:row.approvalSource,approvedAt:row.approvedAt,certainty:row.certainty,
          bankSourceId:bankSource?.bankSourceId,importBatchId:bankSource?.importBatchId||draft.id,importTransactionId:bankSource?.importTransactionId||row.id,splitId:part.splitId,bankOriginal:clone(bankSource?.bankOriginal||row.bankOriginal),sourceIdentityProof:clone(row.sourceIdentityProof||null),batchLifecycle:batchLifecycle(draft),
          processing:{...clone(p),directBudgetAllocations:part.directBudgetAllocations||[],processedAmount:part.amount,transactionType:lineType,fixedExpenseId:part.fixedExpenseId,fixedOccurrenceId:part.fixedOccurrenceId,fixedOccurrenceMonth:part.fixedOccurrenceMonth,budgetOwner:part.budgetOwner,category:part.category,budgetItemId:part.budgetItemId,savingsGoalId:part.savingsGoalId,refundCategory:part.refundCategory,refundMonth:part.refundMonth,include:part.include},
          expenseImpact:expenseImpact(lineType,part.amount,part.include),
          accountDelta:part.isFirst?round2(row.bankOriginal.amount):0,
          fixedExpenseId:part.fixedExpenseId,fixedOccurrenceId:part.fixedOccurrenceId,fixedOccurrenceMonth:part.fixedOccurrenceMonth,incomeSourceId:p.incomeSourceId||'',incomeOccurrenceId:'',
          savingsGoalId:part.savingsGoalId,refundCategory:part.refundCategory,refundMonth:part.refundMonth,note:p.note||'',createdAt:new Date().toISOString()
        };
        transactions.push(tx);affectedMonths.add(String(tx.date).slice(0,7));
        const saving=savingsForTransaction(tx,state);if(saving)savingsEntries.push(saving);
        const advance=advanceForTransaction(tx);if(advance){advances.push(advance);counts.advances++;}
        if(lineType==='terugbetaling-voorschot'){
          const allocations=p.repaymentAllocations||[];
          allocations.forEach(allocation=>repayments.push({id:`repayment-${tx.id}-${allocation.advanceId}`,transactionId:tx.id,advanceId:allocation.advanceId,amount:round2(allocation.amount),date:tx.date,status:'actief'}));
        }
        if(kind==='inkomen')counts.income++;else if(kind==='interne-overboeking')counts.internal++;else if(kind!=='niet-meetellen')counts.expenses++;
        if(['sparen','naar-spaarrekening','van-spaarrekening'].includes(lineType))counts.savings++;if(lineType==='terugbetaling')counts.refunds++;if(tx.category==='Ongecategoriseerd')counts.uncategorized++;
      });
      if(p.manualMatchId&&(state.manualTransactionReplacements||[]).some(item=>item.active!==false&&item.id===`replacement-${draft.id}-${p.manualMatchId}`)){
        const manual=state.transactions.find(tx=>tx.id===p.manualMatchId&&!tx.importBatchId);
        if(manual)replacements.push({id:`replacement-${draft.id}-${manual.id}`,manualTransaction:clone(manual),replacementTransactionId:transactions.find(tx=>tx.importTransactionId===row.id)?.id||''});
      }
      if(p.fixedExpenseId&&['month','from'].includes(p.fixedAmountMode)){
        const found=findFixedItem(state,p.fixedExpenseId);
        if(found&&!fixedAdjustments.some(item=>item.fixedExpenseId===p.fixedExpenseId&&item.month===String(p.processingDate).slice(0,7))){
          fixedAdjustments.push({
            id:`fixed-adjustment-${draft.id}-${p.fixedExpenseId}-${String(p.processingDate).slice(0,7)}`,
            fixedExpenseId:p.fixedExpenseId,month:String(p.processingDate).slice(0,7),
            mode:p.fixedAmountMode,amount:round2(p.processedAmount),
            before:{amountHistory:clone(found.item.amountHistory||[]),monthOverrides:clone(found.item.monthOverrides||{})}
          });
        }
      }
    }
    const internalPairs=detectInternalPairs(transactions,state);
    return {ok:true,sourceBatch:draft,importId:draft.id,transactions,replacements,savingsEntries,advances,repayments,internalPairs,fixedAdjustments,affectedMonths:[...affectedMonths],counts,duplicateCount:draft.summary.duplicateCount||0,totalIncome:draft.summary.totalIncome,totalExpenses:draft.summary.totalExpenses};
  }
  function findGoal(state,id){
    for(const owner of OWNERS){const goal=(state.spaardoelen?.[owner]||[]).find(item=>item.id===id);if(goal)return goal;}
    return null;
  }
  function applyImportPlanInPlace(state,plan){
    if(plan.sourceBatch)ensureImportBankSources(state,plan.sourceBatch);
    const transactionIds=new Set((state.transactions||[]).map(tx=>tx.id));
    plan.transactions.forEach(tx=>{if(!transactionIds.has(tx.id)){state.transactions.push(clone(tx));transactionIds.add(tx.id);}});
    if(plan.sourceBatch)for(const row of plan.sourceBatch.rows.filter(row=>!row.duplicate))updateSourceApproval(state,plan.sourceBatch,row);
    state.transactions.sort((a,b)=>Number(isBankSource(a))-Number(isBankSource(b)));
    state.manualTransactionReplacements=state.manualTransactionReplacements||[];
    plan.replacements.forEach(replacement=>{
      if(!state.manualTransactionReplacements.some(item=>item.id===replacement.id))state.manualTransactionReplacements.push(clone(replacement));
      // The duplicate remains recoverable; projection suppresses it via replacement metadata.
    });
    state.savingsGoalLedger=state.savingsGoalLedger||[];
    plan.savingsEntries.forEach(entry=>{
      const existing=state.savingsGoalLedger.find(item=>item.id===entry.id);
      if(existing?.active!==false&&existing)return;
      const goal=findGoal(state,entry.goalId);if(!goal)return;
      if(entry.matchedContributionId){
        const planned=state.savingsGoalLedger.find(item=>item.id===entry.matchedContributionId);
        if(planned){
          planned.transactionId=entry.transactionId;
          planned.actualAmount=entry.actualAmount;
          planned.status=entry.status;
          planned.updatedAt=entry.updatedAt;
        }
      }
      if(existing){const history=[...(existing.processingHistory||[]),clone({...existing,processingHistory:undefined})];Object.assign(existing,clone(entry),{active:true,processingHistory:history});}else state.savingsGoalLedger.push(clone(entry));
    });
    reconcileGoalSavedAmounts(state,plan.savingsEntries.map(entry=>entry.goalId));
    state.advanceLedger=state.advanceLedger||[];
    plan.advances.forEach(entry=>{const old=state.advanceLedger.find(item=>item.id===entry.id);if(old?.active===false)Object.assign(old,clone(entry),{active:true});else if(!old)state.advanceLedger.push(clone(entry));});
    state.advanceRepayments=state.advanceRepayments||[];
    plan.repayments.forEach(repayment=>{
      const previous=state.advanceRepayments.find(item=>item.id===repayment.id);if(previous&&previous.active!==false)return;
      const advance=state.advanceLedger.find(item=>item.id===repayment.advanceId);if(!advance)return;
      const applied=round2(Math.min(Number(repayment.amount)||0,Number(advance.outstandingAmount)||0));
      advance.outstandingAmount=round2(Number(advance.outstandingAmount||0)-applied);if(advance.outstandingAmount<=.004){advance.outstandingAmount=0;advance.status='voldaan';}
      advance.repaymentAllocationIds=[...new Set([...(advance.repaymentAllocationIds||[]),repayment.id])];
      if(previous)Object.assign(previous,clone(repayment),{amount:applied,active:true});else state.advanceRepayments.push({...clone(repayment),amount:applied});
    });
    state.internalTransferPairs=state.internalTransferPairs||[];
    plan.internalPairs.forEach(pair=>{if(!state.internalTransferPairs.some(item=>item.id===pair.id))state.internalTransferPairs.push(clone(pair));});
    (plan.fixedAdjustments||[]).forEach(adjustment=>{
      const found=findFixedItem(state,adjustment.fixedExpenseId);if(!found)return;
      applyFixedPlanningAdjustment(found.item,adjustment);
    });
    state.monthRecords=state.monthRecords||{};
    plan.affectedMonths.forEach(month=>{
      const record=state.monthRecords[month];
      if(['afgesloten','correctie-nodig'].includes(record?.status)){
        record.status='correctie-nodig';
        record.lateImportTransactionIds=[...new Set([...(record.lateImportTransactionIds||[]),...plan.transactions.filter(tx=>String(tx.date).slice(0,7)===month).map(tx=>tx.id)])];
      }
    });
    const summary=state.importSummaries.find(item=>item.id===plan.importId);
    if(summary){summary.status=plan.affectedMonths.some(month=>state.monthRecords?.[month]?.status==='correctie-nodig')?'correctie-nodig':'verwerkt';summary.processedAt=new Date().toISOString();if(!plan.sourceCorrection)summary.counts=clone(plan.counts);}
    if(state.activeImportId===plan.importId)state.activeImportId='';
    return plan;
  }
  function applyImportPlan(state,plan){
    const candidate=clone(state);applyImportPlanInPlace(candidate,plan);
    synchronizeChangedSavings(candidate,state);assertFinancialMutationSafe(state,candidate);
    applyFinancialCandidate(state,candidate);return plan;
  }
  function applySourceApproval(state,draft,row,plan){
    const candidate=clone(state);
    if(plan.sourceBatch)ensureImportBankSources(candidate,plan.sourceBatch);
    replaceProcessedSourceRows(candidate,draft.id,row.id,plan.transactions);
    applyImportPlanInPlace(candidate,{...plan,fixedAdjustments:[],sourceCorrection:true});
    synchronizeChangedSavings(candidate,state);assertFinancialMutationSafe(state,candidate);
    applyFinancialCandidate(state,candidate);
  }
  function effectManifest(plan){
    return {
      transactionIds:plan.transactions.map(tx=>tx.id),
      replacementIds:plan.replacements.map(item=>item.id),
      savingIds:plan.savingsEntries.map(item=>item.id),
      advanceIds:plan.advances.map(item=>item.id),
      repaymentIds:plan.repayments.map(item=>item.id),
      internalPairIds:plan.internalPairs.map(item=>item.id),
      fixedAdjustments:clone(plan.fixedAdjustments||[]),
      affectedMonths:plan.affectedMonths,
      counts:clone(plan.counts)
    };
  }
  function undoImportEffectsInPlace(state,draft){
    const manifest=draft.effectManifest||{};
    (manifest.fixedAdjustments||[]).forEach(adjustment=>undoFixedPlanningAdjustment(findFixedItem(state,adjustment.fixedExpenseId)?.item,adjustment,{dryRun:true}));
    const transactionIds=new Set(manifest.transactionIds||[]);
    const savingIds=new Set(manifest.savingIds||[]);
    const advanceIds=new Set(manifest.advanceIds||[]);
    const repaymentIds=new Set(manifest.repaymentIds||[]);
    const pairIds=new Set(manifest.internalPairIds||[]);
    const replacementIds=new Set(manifest.replacementIds||[]);

    state.advanceRepayments=state.advanceRepayments||[];
    state.advanceRepayments.filter(item=>repaymentIds.has(item.id)&&item.active!==false).forEach(repayment=>{
      const advance=(state.advanceLedger||[]).find(item=>item.id===repayment.advanceId);
      if(!advance)return;
      advance.outstandingAmount=round2((Number(advance.outstandingAmount)||0)+Number(repayment.amount||0));
      advance.status=advance.outstandingAmount>.004?'open':'voldaan';
      advance.repaymentAllocationIds=(advance.repaymentAllocationIds||[]).filter(id=>id!==repayment.id);
    });
    state.advanceRepayments=state.advanceRepayments.filter(item=>!repaymentIds.has(item.id));

    state.savingsGoalLedger=state.savingsGoalLedger||[];
    const affectedSavingGoals=state.savingsGoalLedger.filter(item=>savingIds.has(item.id)).map(entry=>entry.goalId);
    state.savingsGoalLedger.filter(item=>savingIds.has(item.id)).forEach(entry=>{
      if(!entry.matchedContributionId)return;
      const planned=state.savingsGoalLedger.find(item=>item.id===entry.matchedContributionId);
      if(planned&&planned.transactionId===entry.transactionId){planned.transactionId='';planned.actualAmount=null;planned.status='gepland';planned.updatedAt=new Date().toISOString();}
    });
    state.savingsGoalLedger.filter(item=>savingIds.has(item.id)&&item.active!==false).forEach(entry=>{entry.processingHistory=[...(entry.processingHistory||[]),clone({...entry,processingHistory:undefined})];entry.active=false;entry.status='teruggedraaid';});
    reconcileGoalSavedAmounts(state,affectedSavingGoals);
    state.advanceLedger=(state.advanceLedger||[]).filter(item=>!advanceIds.has(item.id));
    state.internalTransferPairs=(state.internalTransferPairs||[]).filter(item=>!pairIds.has(item.id));
    (manifest.fixedAdjustments||[]).forEach(adjustment=>{
      const found=findFixedItem(state,adjustment.fixedExpenseId);if(!found)return;
      undoFixedPlanningAdjustment(found.item,adjustment);
    });

    state.manualTransactionReplacements=state.manualTransactionReplacements||[];
    state.manualTransactionReplacements.filter(item=>replacementIds.has(item.id)).forEach(replacement=>{
      if(replacement.manualTransaction&&!state.transactions.some(tx=>tx.id===replacement.manualTransaction.id)){
        state.transactions.push(clone(replacement.manualTransaction));
      }
    });
    state.manualTransactionReplacements=state.manualTransactionReplacements.filter(item=>!replacementIds.has(item.id));
    state.transactions=(state.transactions||[]).filter(tx=>!transactionIds.has(tx.id));

    (manifest.affectedMonths||[]).forEach(month=>{
      const record=state.monthRecords?.[month];
      if(!record)return;
      record.lateImportTransactionIds=(record.lateImportTransactionIds||[]).filter(id=>!transactionIds.has(id));
      if(record.status==='correctie-nodig'&&!record.lateImportTransactionIds.length)record.status='afgesloten';
    });
    const summary=(state.importSummaries||[]).find(item=>item.id===draft.id);
    if(summary&&summary.status!=='teruggedraaid'){summary.status='teruggedraaid';summary.undoneAt=new Date().toISOString();summary.updatedAt=summary.undoneAt;}
    if(state.activeImportId===draft.id)state.activeImportId='';
    return state;
  }
  function undoImportEffects(state,draft){
    if((state.transactions||[]).some(source=>isBankSource(source)&&source.importReferences.some(ref=>ref.batchId===draft.id))){
      const summary=(state.importSummaries||[]).find(batch=>batch.id===draft.id);
      const planned=planImportCommand(state,{...draft,lifecycle:summary?.lifecycle||draft.lifecycle},{type:'withdraw',operationId:`withdraw-${draft.id}`,timestamp:summary?.undoneAt||new Date().toISOString()},{validateRow:rowProcessingValidation});
      applyFinancialCandidate(state,planned.state);return state;
    }
    const candidate=clone(state);undoImportEffectsInPlace(candidate,draft);
    synchronizeChangedSavings(candidate,state);assertFinancialMutationSafe(state,candidate);
    applyFinancialCandidate(state,candidate);return state;
  }
  function learnedRecognitionRules(draft){
    const groups=new Map();
    (draft.rows||[]).filter(row=>isExplicitlyApproved(row)&&row.bankOriginal?.valid&&!row.duplicate).forEach(row=>{
      const original=row.bankOriginal;const p=row.processing||{};
      const counterparty=normalizeIban(original.counterpartyAccount);
      const organization=organizationName(original.rawDescription||original.description||'');
      const merchantRule=!p.fixedExpenseId&&p.transactionType==='uitgave'&&organization;
      const level=merchantRule?'organization':counterparty?'counterparty':'description';
      const value=merchantRule?organization:(counterparty||String(original.rawDescription||original.description||'').trim());
      if(!value)return;
      const transactionType=p.fixedExpenseId?'vaste-last':(p.include===false?'niet-meetellen':p.transactionType||'uitgave');
      const category=p.fixedExpenseId?'Vaste lasten':String(p.category||'Ongecategoriseerd');
      const signature=[category,transactionType,p.budgetItemId||'',p.fixedExpenseId||'',p.savingsGoalId||''].join('|');
      const key=`${level}|${normalizeText(value)}`;
      if(!groups.has(key))groups.set(key,{level,value,rows:[],signatures:new Set()});
      const group=groups.get(key);group.rows.push({p,category,transactionType});group.signatures.add(signature);
    });
    return [...groups.entries()].filter(([,group])=>group.signatures.size===1).map(([key,group])=>{
      const {p,category,transactionType}=group.rows[0];
      return normalizeRule({id:`u4-rule-${hashText(key)}`,enabled:true,level:group.level,value:group.value,displayName:p.description||'',category,transactionType,budgetItemId:p.budgetItemId||'',fixedExpenseId:p.fixedExpenseId||'',savingsGoalId:p.savingsGoalId||'',alwaysReview:false,updatedAt:new Date().toISOString()});
    });
  }
  function rememberRecognitionRules(state,draft){
    state.recognitionRules=Array.isArray(state.recognitionRules)?state.recognitionRules:[];
    learnedRecognitionRules(draft).forEach(rule=>{
      const index=state.recognitionRules.findIndex(existing=>existing.id===rule.id||(existing.level===rule.level&&normalizeText(existing.value)===normalizeText(rule.value)));
      if(index>=0)state.recognitionRules[index]=rule;else state.recognitionRules.unshift(rule);
    });
    state.recognitionRules=state.recognitionRules.slice(0,300);
  }
  function sourceIsActive(root,draft,row){return (root.state.transactions||[]).some(tx=>tx.importBatchId===draft.id&&tx.importTransactionId===row.id&&isTransactionFinanciallyActive(tx));}
  async function reopenStoredSource(root,draft,row){
    if(ImportEditors.get(String(draft.id))?.draft===draft)return commitImportEditor(root,draft,{reopenIds:[row.id]});
    if(!(root.state.transactions||[]).some(tx=>tx.importBatchId===draft.id&&tx.importTransactionId===row.id)){reopenForReview(row);return true;}
    await commitImportCommand(root,draft,{type:'source-reopen',rowId:row.id});return true;
  }
  async function approveStoredSource(root,draft,row){if(ImportEditors.get(String(draft.id))?.draft===draft)return commitImportEditor(root,draft,{approveIds:[row.id]});return commitImportCommand(root,draft,{type:'source-approve',rowId:row.id});}
  async function replaceManualSource(root,draft,row,manualId){const session=ImportEditors.get(String(draft.id));if(session?.draft===draft)await commitImportEditor(root,draft);const result=await commitImportCommand(root,draft,{type:'source-replacement',rowId:row.id,manualId});if(session?.draft===draft)session.base=clone(result.batch);return result;}
  async function undoImport(root,draft){
    if((root.state.transactions||[]).some(source=>isBankSource(source)&&source.importReferences.some(ref=>ref.batchId===draft.id))){await commitImportCommand(root,draft,{type:'withdraw'});root.renderActiveTab();renderDraftModal(root,draft);return true;}
    if(draft.status==='teruggedraaid')return true;
    undoImportEffects(clone(root.state),draft);
    const journal={id:`undo-${draft.id}`,importId:draft.id,operation:'undo',status:'pending',createdAt:new Date().toISOString()};
    await ImportStore.putJournal(journal);
    const ok=root.commitChange(()=>undoImportEffects(root.state,draft),{render:false,mutationMode:'correction'});
    if(!ok){journal.status='rolled-back';journal.updatedAt=new Date().toISOString();await ImportStore.putJournal(journal);throw new Error('Ongedaan maken is afgebroken; er zijn geen halve wijzigingen bewaard.');}
    draft.status='teruggedraaid';draft.undoneAt=new Date().toISOString();
    await ImportStore.putImport(draft);await queueImportSync(draft);
    journal.status='completed';journal.completedAt=new Date().toISOString();await ImportStore.putJournal(journal);
    flushImportSync(root).catch(()=>{});
    root.renderActiveTab();renderDraftModal(root,draft);
    return true;
  }
  async function reconcileImport(root,draft){
    if((root.state.transactions||[]).some(source=>isBankSource(source)&&source.importReferences.some(ref=>ref.batchId===draft.id))){
      const editor=ImportEditors.get(String(draft.id))?.draft===draft?draft:await beginImportEditor(root,draft);
      for(const row of editor.rows){const desired=draft.rows.find(item=>item.id===row.id);if(desired)row.processing=clone(desired.processing);}
      await commitImportEditor(root,editor,{approveIds:draft.rows.filter(row=>isExplicitlyApproved(row)&&!row.duplicate&&!row.importError).map(row=>row.id)});
      root.renderActiveTab();renderDraftModal(root,editor);return true;
    }
    const working=clone(root.state);
    undoImportEffects(working,draft);
    const plan=planImportEffects(draft,working);
    if(!plan.ok){showValidationErrors(root,draft,plan.errors,'Correctie kan nog niet worden verwerkt');return false;}
    const journal={id:`reconcile-${draft.id}-${Date.now()}`,importId:draft.id,operation:'reconcile',status:'pending',createdAt:new Date().toISOString()};
    await ImportStore.putJournal(journal);
    const ok=root.commitChange(()=>{undoImportEffects(root.state,draft);applyImportPlan(root.state,plan);rememberRecognitionRules(root.state,draft);},{render:false,mutationMode:'correction'});
    if(!ok){journal.status='rolled-back';journal.updatedAt=new Date().toISOString();await ImportStore.putJournal(journal);throw new Error('De correctie is volledig afgebroken omdat opslaan mislukte.');}
    draft.status=root.state.importSummaries.find(item=>item.id===draft.id)?.status||'verwerkt';
    draft.correctedAt=new Date().toISOString();draft.effectManifest=effectManifest(plan);
    await ImportStore.putImport(draft);await queueImportSync(draft);
    journal.status='completed';journal.completedAt=new Date().toISOString();await ImportStore.putJournal(journal);
    flushImportSync(root).catch(()=>{});root.renderActiveTab();renderDraftModal(root,draft);
    return true;
  }
  function processedSummaryHtml(plan){
    return `<div class="u4-import-summary"><div><span>Uitgaven</span><strong>${plan.counts.expenses}</strong></div><div><span>Inkomsten</span><strong>${plan.counts.income}</strong></div><div><span>Interne overboekingen</span><strong>${plan.counts.internal}</strong></div><div><span>Sparen</span><strong>${plan.counts.savings}</strong></div><div><span>Terugbetalingen</span><strong>${plan.counts.refunds}</strong></div><div><span>Voorschotten</span><strong>${plan.counts.advances}</strong></div><div><span>Ongecategoriseerd</span><strong>${plan.counts.uncategorized}</strong></div><div><span>Duplicaten</span><strong>${plan.duplicateCount}</strong></div></div><p><strong>Inkomsten ${euro(plan.totalIncome)}</strong> · uitgaven ${euro(plan.totalExpenses)}</p>`;
  }
  function validationTargetLabel(draft,error){
    if(!error?.rowId)return error?.code==='profile'?'Rekeningprofiel':'Importinstellingen';
    const row=(draft.rows||[]).find(item=>String(item.id)===String(error.rowId));
    if(!row)return 'Transactie';
    const description=String(row.bankOriginal?.description||'Onbekende transactie').trim();
    const date=String(row.processing?.processingDate||row.bankOriginal?.bankDate||'').trim();
    const amount=euro(row.processing?.processedAmount??row.bankOriginal?.amount??0);
    return `${date?`${date} · `:''}${description} · ${amount}`;
  }
  function findDraftRowElement(modal,rowId){
    return [...(modal?.querySelectorAll?.('[data-u4-row]')||[])].find(element=>String(element.dataset.u4Row)===String(rowId))||null;
  }
  function focusValidationError(root,draft,error){
    const modal=document.getElementById('u4ImportModalRoot');
    document.querySelector('.u4-validation-overlay')?.remove();
    if(!modal)return;
    if(!error?.rowId){
      const profile=modal.querySelector('[data-u4-profile-select]')||modal.querySelector('.u4-profile-grid');
      profile?.scrollIntoView?.({behavior:'smooth',block:'center'});
      profile?.focus?.({preventScroll:true});
      return;
    }
    let row=findDraftRowElement(modal,error.rowId);
    if(!row){
      UI.visibleRows=Math.max(UI.visibleRows||0,(draft.rows||[]).length);
      renderDraftModal(root,draft);
      row=findDraftRowElement(document.getElementById('u4ImportModalRoot'),error.rowId);
    }
    if(!row)return;
    const section=row.closest('details.u4-section');
    if(section)section.open=true;
    const more=row.querySelector('details');
    if(more)more.open=true;
    row.classList.add('u4-validation-target');
    row.scrollIntoView({behavior:'smooth',block:'center'});
    let target=null;
    if(error.splitIndex!==null&&error.splitIndex!==undefined){const line=row.querySelector(`[data-u4-split="${error.splitIndex}"]`),field=error.field==='category'?'destination':error.field;target=line?.querySelector(`[data-u4-split-field="${field}"]`)||line?.querySelector('input,select');}
    else if(error.field)target=row.querySelector(`[data-u4-field="${error.field}"]`);
    if(!target&&String(error.code).startsWith('split'))target=row.querySelector('[data-u4-split-field="amount"]')||row.querySelector('[data-u4-add-split]');
    else if(error.code==='date')target=row.querySelector('[data-u4-field="processingDate"]');
    else if(error.code==='amount')target=row.querySelector('[data-u4-field="processedAmount"]');
    else if(error.code==='owner')target=row.querySelector('[data-u4-field="budgetOwner"]');
    else if(['goal','goal-choice'].includes(error.code))target=row.querySelector('[data-u4-field="savingsGoalId"]');
    else if(['fixed','fixed-choice'].includes(error.code))target=row.querySelector('[data-u4-field="fixedExpenseId"]');
    else if(error.code==='transfer')target=row.querySelector('[data-u4-field="sourceAccountProfileId"]');
    else if(error.code==='approval')target=row.querySelector('[data-u4-approve]');
    setTimeout(()=>{target?.focus?.({preventScroll:true});},350);
    setTimeout(()=>row?.classList.remove('u4-validation-target'),3500);
  }
  function showValidationErrors(root,draft,errors,title='Import kan nog niet worden verwerkt'){
    document.querySelector('.u4-validation-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.className='u4-validation-overlay';
    const shown=(errors||[]).slice(0,12);
    overlay.innerHTML=`<div class="u4-validation-dialog" role="dialog" aria-modal="true" aria-labelledby="u4-validation-title"><header class="u4-validation-head"><div><h3 id="u4-validation-title">${esc(title)}</h3><p>Pas de onderstaande punten aan. Klik op een fout om direct naar de juiste transactie te gaan.</p></div><button type="button" class="ghost small" data-u4-validation-close>Sluiten</button></header><div class="u4-validation-list">${shown.map((error,index)=>`<button type="button" class="u4-validation-item" data-u4-validation-index="${index}"><span><strong>${esc(validationTargetLabel(draft,error))}</strong><small>${esc(error.message)}</small></span><b>Open transactie</b></button>`).join('')}</div>${(errors||[]).length>shown.length?`<p class="u4-validation-more">Nog ${(errors||[]).length-shown.length} fout(en) worden zichtbaar nadat deze zijn opgelost.</p>`:''}</div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('[data-u4-validation-close]')?.addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    overlay.querySelectorAll('[data-u4-validation-index]').forEach(button=>button.addEventListener('click',()=>focusValidationError(root,draft,shown[Number(button.dataset.u4ValidationIndex)])));
  }
  async function processDraft(root,draft){
    await (ImportPerformance.chains.get(String(draft.id))||Promise.resolve());
    for(const row of draft.rows.filter(row=>isExplicitlyApproved(row)&&!row.importError&&!row.duplicate)){
      if((root.state.transactions||[]).some(tx=>tx.importBatchId===draft.id&&tx.importTransactionId===row.id&&['goedgekeurd','niet-meetellen'].includes(tx.processingStatus)))continue;
      try{await commitImportCommand(root,draft,{type:'source-approve',rowId:row.id});}catch(error){showValidationErrors(root,draft,[{rowId:row.id,code:'source',message:error.message}]);return false;}
    }
    const modal=ensureModalRoot();modal.innerHTML='<div class="u4-import-modal"><header class="u4-modal-head"><h2>Import verwerkt</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body">Goedgekeurde bronnen zijn afzonderlijk verwerkt. Openstaande bronnen blijven via de importhistorie bereikbaar.</main></div>';modal.querySelector('[data-u4-close]').addEventListener('click',()=>{closeDraft();root.renderActiveTab();});return true;
  }
  function renderReceipt(root,summary){
    const profile=(root.state.accountProfiles||[]).find(item=>item.id===summary.accountProfileId);
    const accountTitle=profileDisplayLabel(profile||{name:summary.bank||'Rekening'});
    return `<article class="u4-receipt" data-u4-open-receipt="${esc(summary.id)}"><div class="u4-receipt-head"><div><strong>${esc(accountTitle)}</strong></div><span class="u4-status ${esc(summary.status)}">${esc(summary.status)}</span></div><div class="u4-muted">${Number(summary.newCount)||0} transacties · ${Number(summary.duplicateCount)||0} duplicaten · ${euro(summary.totalExpenses)} uitgaven</div></article>`;
  }
  function summaryMonth(summary){return String(summary.periodFrom||summary.importDate||summary.updatedAt||'').slice(0,7);}
  function summaryIncludesMonth(summary,month){
    const from=String(summary.periodFrom||summary.importDate||'').slice(0,7);
    const to=String(summary.periodTo||summary.periodFrom||summary.importDate||'').slice(0,7);
    return !!from&&from<=month&&(!to||to>=month);
  }
  function importMonthLabel(month){
    if(!/^\d{4}-\d{2}$/.test(month))return 'Zonder maand';
    return new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(new Date(`${month}-01T12:00:00`));
  }
  function renderImportHistoryGroups(root,summaries){
    const groups=new Map();
    summaries.forEach(summary=>{const month=summaryMonth(summary);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(summary);});
    return [...groups.entries()].map(([month,items])=>`<section class="u4-import-month"><h3>${esc(importMonthLabel(month))}</h3><div class="u4-import-receipts">${items.map(summary=>renderReceipt(root,summary)).join('')}</div></section>`).join('');
  }
  function importSummaryOwner(root,summary){
    return (root.state.accountProfiles||[]).find(profile=>profile.id===summary.accountProfileId)?.accountOwner||summary.accountOwner||'';
  }
  function renderImportPanel(root,owner=''){
    const active=root.state.activeImportId;
    const allSummaries=[...(root.state.importSummaries||[]),...[...UI.conflicts.values()].filter(c=>c.localChoice?.rows&&!(root.state.importSummaries||[]).some(s=>s.id===c.importId)).map(c=>({...compactSummary(c.localChoice),status:'synchronisatieconflict'}))].sort((a,b)=>String(b.updatedAt||b.importDate).localeCompare(String(a.updatedAt||a.importDate)));
    const summaries=owner?allSummaries.filter(summary=>importSummaryOwner(root,summary)===owner):allSummaries;
    const current=summaries.find(item=>item.id===active);
    const selectedMonth=String(root.state.meta?.selectedMonth||'').slice(0,7);
    const selectedSummaries=summaries.filter(summary=>summaryIncludesMonth(summary,selectedMonth));
    return `<div class="u4-import-panel">
      <div class="u4-import-actions">
        <label class="primary">Bank-CSV importeren<input type="file" accept=".csv,text/csv" data-u4-file></label>
        <button type="button" class="ghost small" data-u4-manage-rules>Herkenningsregels</button>
      </div>
      ${UI.conflicts.size?`<div class="u4-original">${UI.conflicts.size} synchronisatieconflict(en). Cloudstand behouden; lokale keuzes veilig bewaard.<button type="button" class="ghost small" data-u4-conflicts>Keuzes bekijken</button></div>`:''}
      ${current?`<button type="button" class="u4-concept-banner" data-u4-open-concept="${esc(current.id)}"><strong>Bankimport nog niet verwerkt</strong><br>${Number(current.newCount)||0} transacties klaar om te controleren</button>`:'<p class="hint">ING wordt automatisch herkend. Andere CSV-bestanden kunnen via kolomherkenning worden ingelezen.</p>'}
      <div class="u4-import-receipts">${selectedSummaries.map(summary=>renderReceipt(root,summary)).join('')||`<div class="u4-empty">Geen imports in ${esc(importMonthLabel(selectedMonth))}.</div>`}</div>
      ${summaries.length?'<button type="button" class="ghost small" data-u4-all-imports>Alle imports bekijken</button>':''}
    </div>`;
  }
  function ensureModalRoot(){
    let modal=document.getElementById('u4ImportModalRoot');
    if(!modal){modal=document.createElement('div');modal.id='u4ImportModalRoot';document.body.appendChild(modal);}
    return modal;
  }
  function categoryOptions(root,owner,current,month){
    const contextMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:root.state.meta.selectedMonth;
    const categories=['Ongecategoriseerd',...expenseCategoriesForMonth(root.state,contextMonth,owner,{existingCategory:current||''}),'Vaste lasten'];
    return [...new Set(categories)].map(value=>option(value,value,current)).join('');
  }
  function goalOptions(root,current){
    const rows=[];
    OWNERS.forEach(owner=>(root.state.spaardoelen?.[owner]||[]).forEach(goal=>rows.push({id:goal.id,label:`${ownerLabel(owner)} · ${goal.naam}`})));
    return `<option value="">Geen spaardoel</option>${rows.map(row=>option(row.id,row.label,current)).join('')}`;
  }
  function fixedOptions(root,owner,current,month){
    const rows=/^\d{4}-\d{2}$/.test(month)?resolveFixedExpensesForMonth(root.state,month,owner):[];
    const archived=(root.state.legacyPlanningReferences||[]).find(item=>item.id===current);
    const historical=current&&!rows.some(item=>item.id===current)?`<option value="${esc(current)}" selected disabled>${esc(archived?.naam||'Oude vaste last')} · kies een geldige vaste last</option>`:'';
    return `<option value="">Geen vaste last</option>${historical}${rows.map(row=>option(row.id,row.naam,current)).join('')}`;
  }
  const TYPE_GROUPS=[
    {label:'Uitgaven',items:[['uitgave','Gewone uitgave'],['terugbetaling','Terugbetaling aankoop'],['niet-meetellen','Niet meetellen']]},
    {label:'Inkomsten',items:[['salaris','Salaris'],['vakantiegeld','Vakantiegeld'],['nabetaling','Nabetaling'],['vergoeding','Vergoeding'],['belastingteruggave','Belastingteruggave'],['overige-inkomsten','Overige inkomsten']]},
    {label:'Sparen en overboeken',items:[['sparen','Naar spaardoel'],['naar-spaarrekening','Naar spaarrekening'],['van-spaarrekening','Van spaarrekening'],['interne-overboeking','Interne overboeking'],['maandelijkse-bijdrage','Maandelijkse bijdrage'],['extra-bijdrage','Extra bijdrage']]},
    {label:'Correctie en verrekening',items:[['terugbetaling-voorschot','Terugbetaling voorschot']]}
  ];
  const TYPES=TYPE_GROUPS.flatMap(group=>group.items.map(item=>item[0]));
  const INCOME_TYPES=INCOME_TRANSACTION_TYPES;
  const TRANSFER_TYPES=['naar-spaarrekening','van-spaarrekening','interne-overboeking'];
  const REPAYMENT_TYPES=['terugbetaling','terugbetaling-voorschot'];
  const TRANSACTION_FAMILIES=[['uitgave','Uitgave'],['inkomen','Inkomen'],['sparen','Sparen'],['overboeking','Interne overboeking'],['zakgeld','Zakgeld'],['extra-bijdrage','Extra bijdrage'],['terugbetaling','Terugbetaling'],['niet-meetellen','Niet meetellen']];
  function typeOptions(current){return TYPE_GROUPS.map(group=>`<optgroup label="${esc(group.label)}">${group.items.map(([value,label])=>option(value,label,current)).join('')}</optgroup>`).join('');}
  function transactionFamily(processing={}){
    const type=processing.include===false?'niet-meetellen':processing.transactionType;
    if(type==='niet-meetellen')return 'niet-meetellen';
    if(INCOME_TYPES.includes(type))return 'inkomen';
    if(['sparen','naar-spaarrekening','van-spaarrekening'].includes(type))return 'sparen';
    if(TRANSFER_TYPES.includes(type))return 'overboeking';
    if(type==='maandelijkse-bijdrage')return 'zakgeld';
    if(type==='extra-bijdrage')return 'extra-bijdrage';
    if(REPAYMENT_TYPES.includes(type)||type==='refund')return 'terugbetaling';
    return 'uitgave';
  }
  function familyOptions(current){return TRANSACTION_FAMILIES.map(([value,label])=>option(value,label,current)).join('');}
  function ownerOptions(row){
    const family=transactionFamily(row.processing);
    const owners=family==='zakgeld'?['dion','dara']:OWNERS;
    return `${family==='zakgeld'&&!owners.includes(row.processing.budgetOwner)?'<option value="" selected>Kies Dion of Dara</option>':''}${owners.map(owner=>option(owner,ownerLabel(owner),row.processing.budgetOwner)).join('')}`;
  }
  function setProcessingType(line,type){
    const previous=transactionFamily(line),next=transactionFamily({transactionType:type,include:true});
    line.transactionType=type;
    if(type!=='vaste-last'){line.fixedExpenseId='';line.fixedOccurrenceId='';line.fixedOccurrenceMonth='';line.fixedAmountMode='none';}
    if(next!=='sparen')line.savingsGoalId='';
    if(!['terugbetaling','refund'].includes(type)){line.refundCategory='';line.refundMonth='';}
    if(type!=='interne-overboeking'){line.sourceAccountProfileId='';line.destinationAccountProfileId='';line.internalPairId='';line.transferPairId='';}
    if(type!=='terugbetaling-voorschot')line.repaymentAllocations=[];
    if(!['uitgave','terugbetaling'].includes(next)){line.budgetItemId='';line.advanceMode='none';}
    if(previous!==next){
      line.category=next==='uitgave'?'Ongecategoriseerd':next==='sparen'?'Sparen':next==='inkomen'?'Inkomen':next==='terugbetaling'?'Terugbetaling':next==='overboeking'?'Interne overboeking':next==='zakgeld'?'Zakgeld':next==='extra-bijdrage'?'Extra bijdrage':'Niet meetellen';
    }
    return line;
  }
  function applyTransactionFamily(row,family){
    const p=row.processing;
    const type=family==='uitgave'?'uitgave':family==='inkomen'?(INCOME_TYPES.includes(p.transactionType)?p.transactionType:'overige-inkomsten'):family==='sparen'?'sparen':family==='overboeking'?'interne-overboeking':family==='zakgeld'?'maandelijkse-bijdrage':family==='extra-bijdrage'?'extra-bijdrage':family==='terugbetaling'?'terugbetaling':'niet-meetellen';
    const previous=processingFamily(p.transactionType),lines=p.splits||[];
    setProcessingType(p,type);p.include=family!=='niet-meetellen';p.editorVersion=113;
    for(const line of lines){
      if(previous!==processingFamily(type))setProcessingType(line,type);
      if(family!=='sparen'){line.withdrawalBudgetCategory='';}
      line.include=true;
    }
    p.splits=lines;redistributeProcessing(p);
    if(family==='zakgeld'&&!['dion','dara'].includes(p.budgetOwner))p.budgetOwner='';
  }
  function selectFixedOccurrence(root,row,line,{resetMonth=false}={}){
    if(!line.fixedExpenseId)return;
    if(resetMonth||!line.fixedOccurrenceMonth)line.fixedOccurrenceMonth=String(row.bankOriginal.bankDate).slice(0,7);
    const month=line.fixedOccurrenceMonth;
    const occurrences=plannedOccurrences(resolveFixedExpensesForMonth(root.state,month),month).filter(item=>item.itemId===line.fixedExpenseId);
    if(!occurrences.some(item=>item.id===line.fixedOccurrenceId))line.fixedOccurrenceId=occurrences.length===1?occurrences[0].id:'';
  }
  function transferType(type){return type==='interne-overboeking';}
  function profileOptions(root,current){return `<option value="">Kies rekening</option>${(root.state.accountProfiles||[]).map(profile=>option(profile.id,profileDisplayLabel(profile),current)).join('')}`;}
  function compactText(value){return String(value||'').toLocaleLowerCase('nl-NL').replace(/\s+/g,' ').trim();}
  function matchIdentity(original){
    const description=String(original?.rawDescription||original?.description||'');
    return {
      account:normalizeIban(original?.counterpartyAccount),
      organization:compactText(original?.organization||original?.counterpartyName||organizationName(description)),
      description:compactText(description)
    };
  }
  function matchCandidates(draft,source){
    const src=source.bankOriginal||{};
    const sourceDirection=Number(src.amount)>=0?'in':'out';
    const sourceIdentity=matchIdentity(src);
    return draft.rows.filter(row=>row!==source&&!isExplicitlyApproved(row)&&row.bankOriginal?.valid&&!row.duplicate).map(row=>{
      const original=row.bankOriginal||{};
      if((Number(original.amount)>=0?'in':'out')!==sourceDirection)return null;
      const identity=matchIdentity(original);
      let score=0;const reasons=[];
      if(sourceIdentity.account&&identity.account&&sourceIdentity.account===identity.account){score+=6;reasons.push('zelfde tegenrekening');}
      if(sourceIdentity.organization&&identity.organization&&sourceIdentity.organization===identity.organization){score+=4;reasons.push('zelfde organisatie');}
      if(sourceIdentity.description&&identity.description&&sourceIdentity.description===identity.description){score+=3;reasons.push('zelfde omschrijving');}
      return score>=3?{row,score,reasons}:null;
    }).filter(Boolean).sort((a,b)=>b.score-a.score||String(b.row.processing?.processingDate||'').localeCompare(String(a.row.processing?.processingDate||'')));
  }
  function copiedProcessing(source,target,root){
    setProcessingType(target.processing,source.processing.transactionType);
    ['description','budgetOwner','category','transactionType','budgetItemId','fixedExpenseId','fixedAmountMode','savingsGoalId','refundCategory','refundMonth','advanceMode','include','sourceAccountProfileId','destinationAccountProfileId'].forEach(field=>{
      const value=source.processing[field];
      if(value===undefined)delete target.processing[field];
      else target.processing[field]=clone(value);
    });
    if(target.processing.transactionType==='vaste-last'){target.processing.fixedOccurrenceId='';target.processing.fixedOccurrenceMonth=String(target.bankOriginal.bankDate).slice(0,7);if(root)selectFixedOccurrence(root,target,target.processing);}
  }

  function occurrenceFields(root,row,line,split=false){
    const month=line.fixedOccurrenceMonth||String(row.bankOriginal.bankDate).slice(0,7);
    const attr=split?'data-u4-split-field':'data-u4-field';
    const occurrences=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?plannedOccurrences(resolveFixedExpensesForMonth(root.state,month),month).filter(item=>item.itemId===line.fixedExpenseId):[];
    return `<label>Geplande maand<input type="month" ${attr}="fixedOccurrenceMonth" value="${esc(month)}"></label><label>Betaalmoment<select ${attr}="fixedOccurrenceId"><option value="">Kies expliciet een betaalmoment</option>${occurrences.map(item=>option(item.id,`${displayDate(item.date)} · ${item.naam} · ${euro(item.amount)}`,line.fixedOccurrenceId||'')).join('')}</select></label>`;
  }
  function splitHtml(root,row,split,index){
    const p=row.processing,family=transactionFamily(p),month=split.refundMonth||row.bankOriginal.bankDate.slice(0,7),owner=split.budgetOwner||p.budgetOwner;
    const fixed=split.transactionType==='vaste-last',excluded=split.transactionType==='niet-meetellen'||split.include===false;
    let destination='',extra='';
    if(family==='uitgave'){
      destination=`<select data-u4-split-field="destination" aria-label="Bestemming split ${index+1}">${categoryOptions(root,owner,fixed?'Vaste lasten':excluded?'Niet meetellen':split.category,month)}${option('Niet meetellen','Niet meetellen',excluded?'Niet meetellen':'')}</select>`;
      if(fixed)extra=`<label>Vaste last<select data-u4-split-field="fixedExpenseId">${fixedOptions(root,owner,split.fixedExpenseId,split.fixedOccurrenceMonth||month)}</select></label>${occurrenceFields(root,row,split,true)}`;
    }else if(family==='terugbetaling'){
      destination=`<select data-u4-split-field="refundCategory" aria-label="Budgetcategorie split ${index+1}"><option value="">Kies budgetcategorie</option>${categoryOptions(root,owner,split.refundCategory,month)}</select>`;
      extra=`<label>Correctiemaand<input type="month" data-u4-split-field="refundMonth" value="${esc(split.refundMonth||month)}"></label>`;
    }else if(family==='sparen'&&p.transactionType==='van-spaarrekening'){
      destination=`<select data-u4-split-field="withdrawalBudgetCategory" aria-label="Optionele budgetcategorie split ${index+1}"><option value="">Zonder budgetcorrectie</option>${categoryOptions(root,owner,split.withdrawalBudgetCategory,row.bankOriginal.bankDate.slice(0,7))}</select>`;
    }else destination=`<span>${esc(family==='sparen'?'Naar hetzelfde spaardoel':split.category||'Verwerking')}</span>`;
    const errors=rowProcessingValidation(row,root.state).errors.filter(error=>error.splitIndex===index);
    return `<div class="u4-split-line" data-u4-split="${index}"><div class="u4-split-row"><label><span class="sr-only">Bedrag split ${index+1}</span><input type="number" min="0" step="0.01" value="${Number(split.amount)||0}" data-u4-split-field="amount" aria-label="Bedrag split ${index+1}"></label>${destination}<button type="button" class="danger-ghost small" data-u4-remove-split="${index}" aria-label="Split ${index+1} verwijderen">×</button></div><div class="u4-context-grid">${!excluded?`<label>Budgeteigenaar<select data-u4-split-field="budgetOwner">${OWNERS.map(value=>option(value,ownerLabel(value),owner)).join('')}</select></label>`:''}${extra}</div>${errors.map(error=>`<p class="u4-error" role="status">${esc(error.message)}</p>`).join('')}</div>`;
  }
  function sourceConfirmationFields(root,draft,row){
    const candidates=(root.state.transactions||[]).filter(tx=>tx.source==='manual'&&getTransactionAccountContext(tx,{accountProfiles:root.state.accountProfiles})===row.accountOwner&&!(root.state.manualTransactionReplacements||[]).some(replacement=>replacement.active!==false&&replacement.manualTransaction?.id===tx.id));
    return candidates.length?`<label class="wide">Handmatige registratie vervangen<select data-u4-replacement-choice><option value="">Geen vervanging</option>${candidates.map(tx=>option(tx.id,`${Math.abs(Math.abs(Number(tx.amount))-Math.abs(Number(row.bankOriginal.amount)))<.005&&daysBetween(tx.date,row.bankOriginal.bankDate)<=3?'Mogelijke match · ':''}${displayDate(tx.date)} · ${tx.description||tx.category} · ${euro(tx.amount)}`,'')).join('')}</select></label><button type="button" class="ghost small" data-u4-confirm-replacement>Bevestig vervanging → Nakijken</button>`:'';
  }
  function pairConfirmationFields(root,draft){
    const ids=new Set((root.state.transactions||[]).filter(tx=>tx.importBatchId===draft.id).map(tx=>tx.id));
    const pairs=(root.state.internalTransferPairs||[]).filter(pair=>(pair.transactionIds||[]).some(id=>ids.has(id)));
    return pairs.length?`<details class="u4-section"><summary><span>Interne transferparen</span><span>${pairs.length}</span></summary><div class="u4-section-list">${pairs.map(pair=>`<div class="u4-receipt"><span>${euro(pair.amount)} · ${esc(pair.status)}${pair.status==='voorgesteld'?' · buiten externe huishoudtotalen, nog onbevestigd':''}</span>${pair.status==='voorgesteld'?`<button type="button" class="ghost small" data-u4-confirm-pair="${escAttr(pair.id)}">Bevestig transferpaar</button>`:''}</div>`).join('')}</div></details>`:'';
  }
  function repaymentRelation(root,row){
    const counter=(root.state.accountProfiles||[]).find(profile=>normalizeIban(profile.identifier)===normalizeIban(row.bankOriginal.counterpartyAccount));
    if(!counter)return null;
    return row.bankOriginal.amount>0?{debtor:counter.accountOwner,creditor:row.accountOwner}:{debtor:row.accountOwner,creditor:counter.accountOwner};
  }
  function repaymentHtml(root,row){
    if(row.processing.transactionType!=='terugbetaling-voorschot')return '';
    const relation=repaymentRelation(root,row);
    if(!relation)return '<div class="u4-repayment-list u4-error">De tegenrekening hoort nog niet bij een bekend rekeningprofiel.</div>';
    const allocations=row.processing.repaymentAllocations||[];
    return `<div class="u4-repayment-list"><strong>${ownerLabel(relation.debtor)} → ${ownerLabel(relation.creditor)}</strong>${allocations.map((allocation,index)=>{
      const advance=(root.state.advanceLedger||[]).find(item=>item.id===allocation.advanceId);
      const tx=(root.state.transactions||[]).find(item=>item.id===advance?.transactionId);
      return `<div class="u4-repayment-row" data-u4-allocation="${index}"><span>${esc(tx?.description||advance?.transactionId||'Voorschot')} · open ${euro(advance?.outstandingAmount)}</span><input type="number" step="0.01" value="${Number(allocation.amount)||0}" data-u4-allocation-field="amount"></div>`;
    }).join('')||'<span class="u4-muted">Geen passend openstaand voorschot gevonden.</span>'}</div>`;
  }
  function transferFieldsHtml(root,row){
    if(!transferType(row.processing.transactionType))return '';
    return `<div class="u4-context-block wide"><strong>Interne overboeking</strong><div class="u4-context-grid"><label>Van rekening<select data-u4-field="sourceAccountProfileId">${profileOptions(root,row.processing.sourceAccountProfileId||'')}</select></label><label>Naar rekening<select data-u4-field="destinationAccountProfileId">${profileOptions(root,row.processing.destinationAccountProfileId||'')}</select></label></div><span class="u4-muted">Accountcashflow blijft meetellen. Onbevestigde transfers blijven apart buiten externe huishoudtotalen.</span></div>`;
  }
  function refundFieldsHtml(root,row,line,split=false){
    const attr=split?'data-u4-split-field':'data-u4-field',month=line.refundMonth||row.bankOriginal.bankDate.slice(0,7);
    const owner=line.budgetOwner||row.processing.budgetOwner;
    const categories=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?expenseCategoriesForMonth(root.state,month,owner).filter(category=>refundCategoryIsRecognizable(root.state,category,month,owner)):[];
    if(line.refundCategory&&refundCategoryIsRecognizable(root.state,line.refundCategory,month,owner)&&!categories.includes(line.refundCategory))categories.push(line.refundCategory);
    // Historical receipts can refer to categories no longer active in the current month.
    for(const tx of root.state.transactions||[]){if(String(tx.date||tx.transactionDate||'').slice(0,7)===month&&tx.category&&refundCategoryIsRecognizable(root.state,tx.category,month,owner)&&!categories.includes(tx.category))categories.push(tx.category);}
    return `<div class="u4-context-grid"><label>Correctiemaand<input type="month" ${attr}="refundMonth" value="${esc(month)}"></label><label>Budgetcategorie<select ${attr}="refundCategory"><option value="">Kies categorie</option>${categories.map(category=>option(category,category,line.refundCategory||'')).join('')}</select></label></div>`;
  }
  function dependentFieldsHtml(root,row){
    const p=row.processing;const family=transactionFamily(p);
    if(p.splits?.length&&['uitgave','terugbetaling'].includes(family))return '';
    if(family==='uitgave'){
      const category=p.fixedExpenseId||p.transactionType==='vaste-last'?'Vaste lasten':p.category;
      return `<div class="u4-dependent-grid"><label>Categorie<select data-u4-field="category">${categoryOptions(root,p.budgetOwner,category,String(p.processingDate||row.bankOriginal?.bankDate).slice(0,7))}</select></label>${category==='Vaste lasten'?`<label>Vaste last<select data-u4-field="fixedExpenseId">${fixedOptions(root,p.budgetOwner,p.fixedExpenseId,p.fixedOccurrenceMonth||String(row.bankOriginal?.bankDate).slice(0,7))}</select></label>${occurrenceFields(root,row,p)}`:''}</div>`;
    }
    if(family==='inkomen')return `<div class="u4-dependent-grid"><label>Soort inkomen<select data-u4-field="transactionType">${INCOME_TYPES.map(type=>option(type,TYPE_GROUPS[1].items.find(item=>item[0]===type)?.[1]||type,p.transactionType)).join('')}</select></label></div>`;
    if(family==='sparen')return `<div class="u4-dependent-grid"><label>Spaarbeweging<select data-u4-field="transactionType">${option('sparen','Naar spaardoel',p.transactionType)}${option('naar-spaarrekening','Naar spaarrekening',p.transactionType)}${option('van-spaarrekening','Van spaarrekening',p.transactionType)}</select></label><label>Spaardoel<select data-u4-field="savingsGoalId">${goalOptions(root,p.savingsGoalId)}</select></label>${p.transactionType==='van-spaarrekening'&&!p.splits?.length?`<label>Budgetcorrectie (optioneel)<select data-u4-field="withdrawalBudgetCategory"><option value="">Zonder budgetcorrectie</option>${categoryOptions(root,p.budgetOwner,p.withdrawalBudgetCategory,row.bankOriginal.bankDate.slice(0,7))}</select></label>`:''}</div>`;
    if(family==='overboeking')return `<div class="u4-dependent-grid"><label>Soort overboeking<select data-u4-field="transactionType">${TYPE_GROUPS[2].items.filter(item=>TRANSFER_TYPES.includes(item[0])).map(([type,label])=>option(type,label,p.transactionType)).join('')}</select></label></div>${transferFieldsHtml(root,row)}`;
    if(family==='zakgeld')return '<p class="u4-dependent-hint">Kies Dion of Dara bij Budgeteigenaar.</p>';
    if(family==='extra-bijdrage')return '<p class="u4-dependent-hint">De budgeteigenaar ontvangt deze extra bijdrage.</p>';
    if(family==='terugbetaling')return `<div class="u4-dependent-grid"><label>Soort terugbetaling<select data-u4-field="transactionType">${option('terugbetaling','Terugbetaling aankoop',p.transactionType)}${option('terugbetaling-voorschot','Terugbetaling voorschot',p.transactionType)}</select></label></div>${['terugbetaling','refund'].includes(p.transactionType)?refundFieldsHtml(root,row,p):repaymentHtml(root,row)}`;
    return '';
  }
  function rowHtml(root,row){
    const p=row.processing;const original=row.bankOriginal;
    const family=transactionFamily(p);
    const reviewState=importReviewState(row);
    const statusLabel=reviewState==='niet-meetellen'?'Niet meetellen':reviewState==='goedgekeurd'?'Goedgekeurd':reviewState==='onbekend'?'Onbekend':'Nakijken';
    return `<article class="u4-import-row" data-u4-row="${escAttr(row.id)}">
      <div class="u4-import-row-main"><div><strong>${esc(p.description||original.rawDescription||original.description||'Onbekende transactie')}</strong><span class="u4-muted">${esc(displayDate(original.bankDate))} · ${euro(original.amount)}</span>${Math.abs(Number(p.processedAmount)-Math.abs(Number(original.amount)))>.004?`<span class="u4-muted">Verwerking ${euro(p.processedAmount)} · bankcashflow ${euro(original.amount)}</span>`:''}${row.reasons?.length?`<div class="u4-row-reasons">${esc(row.reasons.join(' · '))}</div>`:''}</div><div class="u4-row-approval">${['onbekend','nakijken'].includes(reviewState)?`<input type="checkbox" data-u4-select-approval="${escAttr(row.id)}" aria-label="${escAttr(p.description||original.description||row.id)} selecteren voor groepsgoedkeuring">`:''}<span class="u4-status ${reviewState}">${statusLabel}</span>${['goedgekeurd','niet-meetellen'].includes(reviewState)?'<button type="button" class="ghost small" data-u4-reopen>Bewerken</button>':`<button type="button" class="primary small" data-u4-approve>Opslaan en verwerken</button>`}</div></div>
      ${(root.state.transactions||[]).filter(tx=>!isBankSource(tx)&&tx.importTransactionId===row.id).map(tx=>`<button type="button" class="ghost small" data-u4-coverage="${escAttr(tx.id)}">Spaardekking · ${esc(tx.category)}${tx.splitId?' · split '+esc(tx.splitId):''}</button>`).join('')}
      <div class="u4-row-grid">
        <label>${p.transactionType==='vaste-last'?'Bankdatum':'Verwerkingsdatum'}<input type="date" data-u4-field="processingDate" value="${esc(p.transactionType==='vaste-last'?original.bankDate:p.processingDate)}" ${p.transactionType==='vaste-last'?'readonly':''}></label>
        <label>Bedrag<input type="number" step="0.01" data-u4-field="${p.singleLineAmount!==undefined?'singleLineAmount':'processedAmount'}" value="${Number(p.singleLineAmount??p.processedAmount)||0}"></label>
        <label>Budgeteigenaar<select data-u4-field="budgetOwner">${ownerOptions(row)}</select></label>
        <label>Transactie<select data-u4-family>${familyOptions(family)}</select></label>
      </div>
      ${row.possibleDuplicate&&!row.identityDecision?'<p class="u4-error">Is dit dezelfde bestaande bankbeweging of een afzonderlijke betaling?</p><button type="button" class="ghost small" data-u4-identity="same">Dezelfde bankbeweging</button><button type="button" class="ghost small" data-u4-identity="distinct">Afzonderlijke betaling</button>':''}
      ${dependentFieldsHtml(root,row)}
      ${rowProcessingValidation(row,root.state).errors.filter(error=>error.splitIndex==null&&error.code!=='splits').map(error=>`<p class="u4-error" data-u4-validation-field="${escAttr(error.field||'')}" role="status">${esc(error.message)}</p>`).join('')}
      <details><summary>Meer opties voor deze verwerking</summary><div class="u4-more-grid">
        <div class="u4-original wide">Origineel: ${esc(displayDate(original.bankDate))} · ${euro(original.amount)}<br>${esc(original.accountIdentifier||'Geen rekeningkenmerk')} → ${esc(original.counterpartyAccount||'Geen tegenrekening')}<br>Regel ${Number(original.lineNumber)||'—'} · ${esc(original.fingerprint)}</div>
        ${['uitgave','terugbetaling'].includes(family)?`<label>Budgetpost<input data-u4-field="budgetItemId" value="${esc(p.budgetItemId)}"></label>${p.transactionType==='vaste-last'?`<label>Afwijkend vast bedrag<select data-u4-field="fixedAmountMode">${option('none','Planning niet aanpassen',p.fixedAmountMode||'none')}${option('month','Alleen deze maand',p.fixedAmountMode)}${option('from','Vanaf deze maand',p.fixedAmountMode)}</select></label>`:''}<label>Voorschot<select data-u4-field="advanceMode">${option('auto','Automatisch bij andere eigenaar',p.advanceMode)}${option('none','Geen voorschot',p.advanceMode)}${option('force','Altijd voorschot',p.advanceMode)}</select></label>`:''}
        <label>Meetellen<select data-u4-field="include">${option('true','Meetellen',String(p.include))}${option('false','Niet meetellen',String(p.include))}</select></label>
        ${sourceConfirmationFields(root,UI.draft,row)}<label class="wide">Notitie<input data-u4-field="note" value="${esc(p.note)}"></label>
      </div>${['uitgave','terugbetaling','sparen','inkomen'].includes(family)?`<div class="u4-split-list">${(p.splits||[]).map((split,index)=>splitHtml(root,row,split,index)).join('')}</div><button type="button" class="ghost small" data-u4-add-split>${p.splits?.length?'+ Regel':'Splitsen'}</button>${(()=>{const d=splitDifference(p);return `<p class="u4-error" role="status" data-u4-split-total ${d.differenceCents?'':'hidden'}>${d.differenceCents>0?'Nog '+euro(d.differenceCents/100)+' te verdelen':d.differenceCents<0?euro(-d.differenceCents/100)+' te veel verdeeld':''}</p>`;})()}`:''}</details>
    </article>`;
  }
  function bulkEditor(root,draft){
    return `<details class="u4-section u4-bulk-section"><summary><span>Meerdere transacties aanpassen</span><span>Optioneel</span></summary><div class="u4-section-list"><p class="u4-muted">Pas één keuze in één keer toe. Goedgekeurde transacties worden standaard overgeslagen en iedere aangepaste regel moet daarna expliciet worden goedgekeurd.</p><div class="u4-profile-grid"><label>Toepassen op<select data-u4-bulk-scope><option value="review">Alleen Nakijken</option><option value="unknown">Alleen Onbekend</option><option value="uncategorized">Alleen ongecategoriseerd</option><option value="all">Alle niet-goedgekeurde transacties</option></select></label><label>Budgeteigenaar<select data-u4-bulk-owner><option value="">Niet wijzigen</option>${OWNERS.map(owner=>option(owner,ownerLabel(owner),'')).join('')}</select></label><label>Categorie<select data-u4-bulk-category><option value="">Niet wijzigen</option>${categoryOptions(root,'gezamenlijk','')}</select></label><label>Transactie<select data-u4-bulk-type><option value="">Niet wijzigen</option>${typeOptions('')}</select></label></div><button type="button" class="ghost small" data-u4-apply-bulk>Voorbeeld en toepassen</button></div></details>`;
  }
  async function showMatchDialog(root,draft,source,modal){
    const validation=rowProcessingValidation(source,root.state);if(!validation.ok){showValidationErrors(root,draft,validation.errors.map(error=>({...error,rowId:source.id})));return;}
    const matches=matchCandidates(draft,source);
    if(!matches.length){
      const previous={certainty:source.certainty,approvalSource:source.approvalSource,approvedAt:source.approvedAt,processingStatus:source.processingStatus,reasons:clone(source.reasons||[])};
      markExplicitlyApproved(source);
      renderDraftModalPreservingView(root,draft,modal,source.id);
      Promise.resolve().then(()=>approveStoredSource(root,draft,source)).catch(error=>{
        if(!error.coreApplied){source.processingStatus=previous.processingStatus;source.certainty=previous.certainty;source.approvalSource=previous.approvalSource;source.approvedAt=previous.approvedAt;source.reasons=previous.reasons;}
        renderDraftModalPreservingView(root,draft,document.getElementById('u4ImportModalRoot'),source.id);
        alert(error.coreApplied?`De goedkeuring is bewaard; importdetails worden uit het lokale journal hersteld. ${error.message}`:`Goedkeuring is afgebroken. ${error.message}\n\nDe bestaande verwerking is niet gewijzigd. Je kunt je invoer aanpassen en opnieuw proberen.`);
      });
      return;
    }
    document.querySelector('.u4-match-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='u4-match-overlay';
    overlay.innerHTML=`<div class="u4-match-dialog" role="dialog" aria-modal="true" aria-labelledby="u4-match-title"><div class="u4-match-head"><div><h3 id="u4-match-title">Vergelijkbare transacties gevonden</h3><p>${matches.length} mogelijke matches. Geselecteerde regels krijgen alleen een voorstel en blijven Nakijken.</p></div><button type="button" class="ghost small" data-u4-match-close>Sluiten</button></div><div class="u4-match-change"><strong>Wordt toegepast</strong><span>${ownerLabel(source.processing.budgetOwner)} · ${esc(source.processing.category)} · ${esc(TYPE_GROUPS.flatMap(g=>g.items).find(item=>item[0]===source.processing.transactionType)?.[1]||source.processing.transactionType)} · Goedgekeurd</span></div><div class="u4-match-list">${matches.map(({row,score,reasons})=>`<label class="u4-match-row"><input type="checkbox" data-u4-match-id="${esc(row.id)}" ${score>=4?'checked':''}><span><strong>${esc(displayDate(row.processing.processingDate))} · ${esc(row.processing.description||row.bankOriginal.description||'Onbekend')}</strong><small>${euro(row.processing.processedAmount)} · ${esc(row.processing.category||'Ongecategoriseerd')} · ${esc(reasons.join(', '))}</small></span></label>`).join('')}</div><div class="u4-match-feedback" data-u4-match-feedback aria-live="polite"></div><div class="u4-match-actions"><button type="button" class="ghost" data-u4-match-only>Alleen deze transactie</button><button type="button" class="primary" data-u4-match-apply>Voorstel overnemen</button></div></div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('[data-u4-match-close]').onclick=close;
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    let busy=false;
    const actionButtons=[...overlay.querySelectorAll('[data-u4-match-only],[data-u4-match-apply],[data-u4-match-close]')];
    const feedback=overlay.querySelector('[data-u4-match-feedback]');
    async function commitSelection(applyMatches,button){
      if(busy)return;
      busy=true;
      actionButtons.forEach(item=>item.disabled=true);
      button.textContent='Bezig…';
      feedback.textContent='Wijzigingen worden toegepast.';
      const snapshots=new Map();
      const remember=row=>snapshots.set(row.id,{processing:clone(row.processing),certainty:row.certainty,approvalSource:row.approvalSource,approvedAt:row.approvedAt,processingStatus:row.processingStatus,reasons:clone(row.reasons||[])});
      try{
        const selected=applyMatches?[...overlay.querySelectorAll('[data-u4-match-id]:checked')].map(input=>draft.rows.find(row=>row.id===input.dataset.u4MatchId)).filter(Boolean):[];
        for(const target of selected){const preview=clone(target);copiedProcessing(source,preview,root);const validation=rowProcessingValidation(preview,root.state);if(!validation.ok)throw new Error(validation.errors.map(item=>item.message).join(' '));}
        remember(source);
        markExplicitlyApproved(source);
        if(applyMatches){
          overlay.querySelectorAll('[data-u4-match-id]:checked').forEach(input=>{
            const target=draft.rows.find(row=>row.id===input.dataset.u4MatchId);
            if(target){remember(target);copiedProcessing(source,target,root);reopenForReview(target);}
          });
        }

        for(const id of snapshots.keys()){const validation=rowProcessingValidation(draft.rows.find(row=>row.id===id),root.state);if(!validation.ok)throw new Error(validation.errors.map(item=>item.message).join(' '));}

        // Verwijder de dialog eerst en geef de browser minimaal één volledig frame om dit te tekenen.
        // De zware her-render van de importlijst en opslag starten pas daarna.
        close();
        const scheduleAfterDialogPaint=callback=>{
          if(typeof requestAnimationFrame==='function'){
            requestAnimationFrame(()=>requestAnimationFrame(callback));
          }else setTimeout(callback,0);
        };
        scheduleAfterDialogPaint(()=>{
          renderDraftModalPreservingView(root,draft,modal,source.id);
          setTimeout(()=>{
            (async()=>{let applied=false;for(const id of [source.id]){try{await approveStoredSource(root,draft,draft.rows.find(row=>row.id===id));applied=true;}catch(error){error.coreApplied=error.coreApplied||applied;throw error;}}})().catch(error=>{
              snapshots.forEach((snapshot,id)=>{
                const row=draft.rows.find(item=>item.id===id);
                if(row&&!(error.coreApplied&&(root.state.transactions||[]).some(tx=>tx.importBatchId===draft.id&&tx.importTransactionId===id&&['goedgekeurd','niet-meetellen'].includes(tx.processingStatus)))){row.processingStatus=snapshot.processingStatus;row.processing=snapshot.processing;row.certainty=snapshot.certainty;row.approvalSource=snapshot.approvalSource;row.approvedAt=snapshot.approvedAt;row.reasons=snapshot.reasons;}
              });
              renderDraftModalPreservingView(root,draft,document.getElementById('u4ImportModalRoot'),source.id);
              alert(error.coreApplied?`De opgeslagen goedkeuringen blijven actief; importdetails worden uit het lokale journal hersteld. ${error.message}`:`De wijziging is afgebroken. ${error.message}`);
            });
          },0);
        });
      }catch(error){
        snapshots.forEach((snapshot,id)=>{
          const row=draft.rows.find(item=>item.id===id);
          if(row&&!(error.coreApplied&&(root.state.transactions||[]).some(tx=>tx.importBatchId===draft.id&&tx.importTransactionId===id&&['goedgekeurd','niet-meetellen'].includes(tx.processingStatus)))){row.processingStatus=snapshot.processingStatus;row.processing=snapshot.processing;row.certainty=snapshot.certainty;row.approvalSource=snapshot.approvalSource;row.approvedAt=snapshot.approvedAt;row.reasons=snapshot.reasons;}
        });
        busy=false;
        actionButtons.forEach(item=>item.disabled=false);
        button.textContent=applyMatches?'Geselecteerde aanpassen':'Alleen deze transactie';
        feedback.textContent=`Aanpassen mislukt: ${error?.message||error}`;
        feedback.classList.add('u4-error');
      }
    }
    overlay.querySelector('[data-u4-match-only]').onclick=event=>commitSelection(false,event.currentTarget);
    overlay.querySelector('[data-u4-match-apply]').onclick=event=>commitSelection(true,event.currentTarget);
  }
  function profileEditor(root,draft){
    const profiles=(root.state.accountProfiles||[]).filter(profile=>!draft.entryOwner||profile.accountOwner===draft.entryOwner);
    const detected=[...new Set(draft.rows.map(row=>row.bankOriginal.accountIdentifier).filter(Boolean))][0]||'';
    const profileOwner=draft.entryOwner||draft.accountOwner||'gezamenlijk';
    const known=Boolean(draft.accountProfileId);
    return `<details class="u4-section u4-profile-section ${known?'':'needs-attention'}" ${known?'':'open'}><summary><span>Rekeningprofiel</span><span>${known?'Gekoppeld':'Actie nodig'}</span></summary><div class="u4-section-list"><div class="u4-profile-grid">
      <label class="wide">Bestaand profiel<select data-u4-profile-select><option value="">Nieuw profiel maken</option>${profiles.map(profile=>option(profile.id,profileDisplayLabel(profile),draft.accountProfileId)).join('')}</select></label>
      <label>Naam<input data-u4-profile-name value="${esc(draft.accountProfileId?'':`ING ${ownerLabel(draft.accountOwner||'gezamenlijk')}`)}"></label>
      <label>IBAN/rekeningkenmerk<input data-u4-profile-identifier value="${esc(detected)}"></label>
      ${draft.entryOwner?`<label>Rekeninghouder<span class="u4-profile-owner-static">${esc(ownerLabel(profileOwner))}</span><input type="hidden" data-u4-profile-owner value="${esc(profileOwner)}"></label>`:`<label>Rekeninghouder<select data-u4-profile-owner>${OWNERS.map(owner=>option(owner,ownerLabel(owner),profileOwner)).join('')}</select></label>`}
      <label>Bank<input data-u4-profile-bank value="${esc(draft.bank||'ING')}"></label>
    </div><button type="button" class="primary small" data-u4-apply-profile>Profiel gebruiken</button></div></details>`;
  }
  function renderDraftModal(root,draft){
    editorSession(draft);
    updateDraftSummary(draft,{touch:false});
    const isConcept=draft.status==='concept';
    const canCorrect=draft.status==='verwerkt'||draft.status==='correctie-nodig';
    const active=draft.rows.filter(row=>row.bankOriginal.valid&&!row.importError&&!row.duplicate);
    const unknown=active.filter(row=>importReviewState(row)==='onbekend').slice(0,UI.visibleRows);
    const review=active.filter(row=>importReviewState(row)==='nakijken').slice(0,UI.visibleRows);
    const approved=active.filter(row=>['goedgekeurd','niet-meetellen'].includes(importReviewState(row))).slice(0,UI.visibleRows);
    const modal=ensureModalRoot();
    modal.innerHTML=`<div class="u4-import-modal" role="dialog" aria-modal="true" aria-label="Bankimport controleren">
      <header class="u4-modal-head"><div><h2>${isConcept?'Bankimport controleren':'Importdetails'}</h2><p>${esc(draft.fileName)} · ${esc(draft.bank)} · ${esc(displayDate(draft.periodFrom)||'—')} t/m ${esc(displayDate(draft.periodTo)||'—')} · ${esc(draft.status)}</p></div><button type="button" class="ghost" data-u4-close>Sluiten</button></header>
      <main class="u4-modal-body"><p class="u4-muted" data-u4-local-notice>Wijzigingen blijven een lokaal concept. Alleen Opslaan en verwerken vervangt de goedgekeurde verwerking. Sluiten bewaart je concept; Annuleren verwijdert het concept.</p><button type="button" class="ghost small" data-u4-approve-selection ${batchLifecycle(draft)!=='active'?'disabled':''}>Geselecteerde regels goedkeuren</button>${draft.syncConflict?`<div class="u4-original">Synchronisatieconflict: de cloudstand blijft behouden. De lokale keuze is veilig bewaard.<button class="ghost small" data-u4-conflict-cloud>Cloudstand behouden</button><button class="primary small" data-u4-conflict-local>Lokale verwerking opnieuw nakijken</button></div>`:''}${isConcept?profileEditor(root,draft)+bulkEditor(root,draft):''}
        <div class="u4-import-summary"><div><span>Nieuw</span><strong>${draft.summary.newCount}</strong></div><div><span>Duplicaten</span><strong>${draft.summary.duplicateCount}</strong></div><div><span>Inkomsten</span><strong>${euro(draft.summary.totalIncome)}</strong></div><div><span>Uitgaven</span><strong>${euro(draft.summary.totalExpenses)}</strong></div></div>
        <details class="u4-section u4-section-unknown" ${draft.summary.unknownCount?'open':''}><summary><span>Onbekend</span><span>${draft.summary.unknownCount}</span></summary><div class="u4-section-list">${unknown.map(row=>rowHtml(root,row)).join('')||'<div class="u4-empty">Alle transacties zijn herkend.</div>'}</div></details>
        <details class="u4-section u4-section-review" ${draft.summary.unknownCount?'':'open'}><summary><span>Nakijken</span><span>${draft.summary.reviewCount}</span></summary><div class="u4-section-list">${review.map(row=>rowHtml(root,row)).join('')||'<div class="u4-empty">Geen herkende transacties om na te kijken.</div>'}</div></details>
        <details class="u4-section u4-section-approved"><summary><span>Goedgekeurd</span><span>${draft.summary.approvedCount}</span></summary><div class="u4-section-list">${approved.map(row=>rowHtml(root,row)).join('')||'<div class="u4-empty">Nog geen transacties expliciet goedgekeurd.</div>'}</div></details>
        ${draft.summary.duplicateCount?`<details class="u4-section"><summary><span>Eerder geïmporteerd — overgeslagen</span><span>${draft.summary.duplicateCount}</span></summary><div class="u4-section-list">${draft.rows.filter(row=>row.duplicate).map(row=>`<div class="u4-original">${esc(displayDate(row.bankOriginal.bankDate))} · ${esc(row.bankOriginal.description)} · ${euro(row.bankOriginal.amount)}</div>`).join('')}</div></details>`:''}
      ${draft.rows.some(row=>row.importError)?`<details class="u4-section" open><summary>Importfouten</summary>${draft.rows.filter(row=>row.importError).map(row=>`<div class="u4-original">${esc(row.importError.message)} · bronregel ${row.bankOriginal.lineNumber}</div>`).join('')}</details>`:''}${draft.rows.some(row=>row.possibleDuplicate)?'<p class="u4-muted">Gelijke bankvelden gevonden: mogelijke duplicaten zijn niet automatisch overgeslagen.</p>':''}${pairConfirmationFields(root,draft)}</main>
      <footer class="u4-modal-actions"><span class="u4-muted" data-u4-save-status>Goedkeuring vraagt altijd een expliciete keuze per bron of geselecteerde groep. ${batchLifecycle(draft)==='withdrawn'?'Deze batch is teruggetrokken.':''}</span><button type="button" class="ghost" data-u4-cancel-concept>Annuleren</button><button type="button" class="ghost" data-u4-save-concept>Concept opslaan</button>${batchLifecycle(draft)==='withdrawn'?'<button type="button" class="primary" data-u4-restore>Herstellen</button>':'<button type="button" class="danger-ghost" data-u4-withdraw>Terugtrekken</button>'}<button type="button" class="danger-ghost" data-u4-delete-batch>Verwijderen</button>${batchLifecycle(draft)==='active'?'<button type="button" class="primary" data-u4-process>Goedgekeurde verwerken</button>':''}</footer>
    </div>`;
    modal.classList.add('open');
    bindDraftModal(root,draft,modal);
  }
  function cloudImportMessage(error){
    if(error?.code==='cloud-missing')return 'Deze import is nog niet vanaf het bronapparaat naar de cloud gesynchroniseerd. Open Finize daar een keer met internetverbinding en probeer het daarna opnieuw.';
    if(error?.code==='cloud-incomplete'||error?.code==='cloud-checksum'||error?.code==='cloud-invalid')return 'De cloudkopie van deze import is niet compleet of beschadigd. Er is niets gedeeltelijk op dit apparaat opgeslagen.';
    if(error?.code==='cloud-permission')return 'De Firebase-verbinding werkt, maar de beveiligingsregels blokkeren bankimports. Publiceer de Finize-importregels en probeer opnieuw.';
    if(error?.code==='cloud-offline')return 'Deze import staat niet lokaal en de cloud is nu niet bereikbaar. Controleer de verbinding en probeer opnieuw.';
    return `De import kon niet worden geopend: ${error?.message||error}`;
  }
  function renderCloudImportState(root,id,error=null){
    const modal=ensureModalRoot();
    const summary=(root.state.importSummaries||[]).find(item=>String(item.id)===String(id));
    const canDiscard=String(root.state.activeImportId||'')===String(id)&&summary?.status==='concept';
    modal.innerHTML=`<div class="u4-import-modal u4-cloud-import-state" role="dialog" aria-modal="true" aria-label="Import uit cloud ophalen">
      <header class="u4-modal-head"><div><h2>${error?'Import niet beschikbaar':'Import uit cloud ophalen…'}</h2><p>${error?'De lokale kopie ontbreekt. Finize probeert de veilig bewaarde importdetails te herstellen.':'De bankregels worden veilig op dit apparaat opgeslagen.'}</p></div><button type="button" class="ghost" data-u4-close>Sluiten</button></header>
      <main class="u4-modal-body"><div class="u4-cloud-message">${error?`<strong>Ophalen mislukt</strong><p>${esc(cloudImportMessage(error))}</p><div class="u4-cloud-actions"><button type="button" class="primary" data-u4-cloud-retry>Opnieuw proberen</button>${canDiscard?'<button type="button" class="danger-ghost" data-u4-discard-concept>Concept verwijderen en nieuwe import toestaan</button>':''}</div>`:'<span class="u4-cloud-spinner" aria-hidden="true"></span><strong>Even geduld…</strong><p>Het oorspronkelijke CSV-bestand is niet nodig.</p>'}</div></main>
    </div>`;
    modal.classList.add('open');
    modal.querySelector('[data-u4-close]')?.addEventListener('click',closeDraft);
    modal.querySelector('[data-u4-cloud-retry]')?.addEventListener('click',()=>openDraft(root,id));
    modal.querySelector('[data-u4-discard-concept]')?.addEventListener('click',async event=>{
      if(!confirm('Dit onverwerkte importconcept verwijderen? De financiële administratie en verwerkte imports blijven behouden.'))return;
      event.currentTarget.disabled=true;
      try{
        await discardImportConcept(root,id);
        closeDraft();
        alert('Het vastgelopen importconcept is verwijderd. Je kunt nu een nieuw CSV-bestand kiezen.');
      }catch(discardError){
        event.currentTarget.disabled=false;
        alert(discardError.message);
      }
    });
  }
  async function openDraft(root,id){
    const request=UI.openSequence=(UI.openSequence||0)+1,sessionAtStart=ImportEditors.get(String(id)),revisionAtStart=sessionAtStart?.revision,baseAtStart=sessionAtStart?clone(sessionAtStart.base):null;
    let local;
    try{local=await ImportStore.getImport(id);}
    catch(error){renderCloudImportState(root,id,error);return null;}
    if(!local)renderCloudImportState(root,id);
    try{
      const resolved=await resolveImportDetails(id,{
        localRead:async()=>local,
        cloudRead:importId=>fetchImportFromCloud(root,importId),
        localWrite:async record=>{const latest=await ImportStore.getImport(id);if(local&&latest&&!sameEditorBase(local,latest))throw cloudImportError('import-conflict','Een nieuwere lokale importkeuze blijft behouden.');return ImportStore.putImport(record);},refresh:root.CloudAdapter?.isConnected?.()===true,pendingRead:async id=>(await ImportStore.listSync()).some(row=>row.importId===id),onConflict:(local,remote)=>preserveImportConflict(root,local,remote)
      });
      if(resolved.record.lifecycle==='deleted'){closeDraft();return resolved.record;}
      if(request!==UI.openSequence||sessionAtStart&&(sessionAtStart.revision!==revisionAtStart||sessionAtStart.committing||!sameEditorBase(sessionAtStart.base,baseAtStart)))return sessionAtStart?.draft||UI.draft;
      resolved.record.syncConflict=(await ImportStore.getJournal(`conflict-${id}`))?.status==='conflict';
      UI.draft=await beginImportEditor(root,resolved.record);renderDraftModal(root,UI.draft);
      return UI.draft;
    }catch(error){
      renderCloudImportState(root,id,error);
      return null;
    }
  }
  function closeDraft(){const modal=document.getElementById('u4ImportModalRoot');modal?.classList.remove('open');}
  async function applyProfile(root,draft,modal){
    const selected=modal.querySelector('[data-u4-profile-select]').value;
    let profile=root.state.accountProfiles.find(item=>item.id===selected);
    if(profile&&draft.entryOwner&&profile.accountOwner!==draft.entryOwner)throw new Error(`Dit rekeningprofiel hoort bij ${ownerLabel(profile.accountOwner)}. Open de juiste persoonlijke of gezamenlijke tab.`);
    if(!profile){
      const name=modal.querySelector('[data-u4-profile-name]').value.trim();
      const identifier=normalizeIban(modal.querySelector('[data-u4-profile-identifier]').value);
      if(!name||!identifier)throw new Error('Vul een profielnaam en rekeningkenmerk in.');
      profile={id:`account-${hashText(identifier)}`,name,identifier,bank:modal.querySelector('[data-u4-profile-bank]').value.trim()||'ING',csvFormat:draft.format,accountOwner:modal.querySelector('[data-u4-profile-owner]').value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      const ok=root.commitChange(()=>{root.state.accountProfiles.push(profile);},{render:false});
      if(!ok)throw new Error('Rekeningprofiel opslaan mislukt.');
    }
    const activeRows=draft.rows.filter(row=>sourceIsActive(root,draft,row));
    activeRows.forEach(markEditorRowChanged);
    draft.accountProfileId=profile.id;draft.accountOwner=profile.accountOwner;
    draft.rows.forEach(row=>{
      row.accountProfileId=profile.id;row.accountOwner=profile.accountOwner;
      const sourceMonth=String(row.bankOriginal.bankDate).slice(0,7);
      const fixedExpenses=/^\d{4}-(0[1-9]|1[0-2])$/.test(sourceMonth)?resolveFixedExpensesForMonth(root.state,sourceMonth):[];
      const proposal=classifyOriginal(row.bankOriginal,profile,root.state.recognitionRules,root.state.accountProfiles,fixedExpenses);
      row.certainty=proposal.certainty;row.processingStatus=proposal.certainty;row.recognitionState=proposal.recognitionState;row.approvalSource='';row.approvedAt='';row.reasons=proposal.reasons;row.processing={...proposal.processing,...row.processing,budgetOwner:row.processing.budgetOwner||profile.accountOwner};
    });
    await persistLocalImportEditor(root,draft);renderDraftModal(root,draft);
  }
  function renderDraftModalPreservingView(root,draft,modal,rowId=''){
    const scroller=modal.querySelector('.u4-import-modal');
    const scrollTop=scroller?.scrollTop||0;
    const openRows=[...modal.querySelectorAll('[data-u4-row] details[open]')].map(details=>details.closest('[data-u4-row]')?.dataset.u4Row).filter(Boolean);
    renderDraftModal(root,draft);
    const next=document.getElementById('u4ImportModalRoot');
    requestAnimationFrame(()=>{
      const nextScroller=next?.querySelector('.u4-import-modal');
      if(nextScroller)nextScroller.scrollTop=scrollTop;
      openRows.forEach(id=>next?.querySelector(`[data-u4-row="${id}"] details`)?.setAttribute('open',''));
      if(rowId&&!openRows.includes(rowId))next?.querySelector(`[data-u4-row="${rowId}"]`)?.scrollIntoView({block:'nearest'});
    });
  }

  function renderDraftRowCard(root,draft,modal,rowId){
    const row=draft.rows.find(item=>String(item.id)===String(rowId));
    const current=modal.querySelector(`[data-u4-row="${rowId}"]`);
    if(!row||!current)return false;
    const detailsOpen=Boolean(current.querySelector('details[open]'));
    const wrapper=document.createElement('div');
    wrapper.innerHTML=rowHtml(root,row);
    const replacement=wrapper.firstElementChild;
    if(detailsOpen)replacement.querySelector('details')?.setAttribute('open','');
    current.replaceWith(replacement);
    return true;
  }

  function bindDraftModal(root,draft,modal){
    UI.root=root;
    UI.draft=draft;
    modal.querySelector('[data-u4-close]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      updateImportSaveStatus('Laatste lokale wijzigingen opslaan…');
      try{await persistLocalImportEditor(root,draft);closeDraft();}
      catch(error){button.disabled=false;updateImportSaveStatus(`Sluiten uitgesteld: ${error?.message||error}`,true);}
    });
    modal.querySelector('[data-u4-apply-profile]')?.addEventListener('click',async()=>{
      try{await applyProfile(root,draft,modal);}catch(error){alert(error.message);}
    });
    if(modal.dataset.u4DraftDelegated==='true')return;
    modal.dataset.u4DraftDelegated='true';
    const onDraftChange=async event=>{
      root=UI.root;draft=UI.draft;modal=ensureModalRoot();
      const container=event.target.closest('[data-u4-row]');if(!container)return;
      const row=draft.rows.find(item=>item.id===container.dataset.u4Row);if(!row)return;
      if(batchLifecycle(draft)!=='active'){alert('Herstel eerst deze teruggetrokken batch.');renderDraftModal(root,draft);return;}
      const wasApproved=isExplicitlyApproved(row)||sourceIsActive(root,draft,row);let rerender=false;
      if(wasApproved)markEditorRowChanged(row);
      if(event.target.hasAttribute('data-u4-family')){
        applyTransactionFamily(row,event.target.value);
        rerender=true;
      }else if(event.target.dataset.u4Field){
        const field=event.target.dataset.u4Field;let value=event.target.value;
        if(['processedAmount','singleLineAmount'].includes(field))value=Math.abs(Number(value));
        if(field==='include')value=value==='true';
        if(field==='transactionType'){setProcessingType(row.processing,value);for(const line of row.processing.splits||[])setProcessingType(line,value);}else row.processing[field]=value;
        row.processing.editorVersion=113;
        if(field==='processedAmount'){redistributeProcessing(row.processing);rerender=true;}
        if(field==='savingsGoalId')for(const line of row.processing.splits||[])line.savingsGoalId=value;
        if(field==='category'){
          if(value==='Vaste lasten'){setProcessingType(row.processing,'vaste-last');if(!row.processing.fixedOccurrenceMonth)row.processing.fixedOccurrenceMonth=String(row.bankOriginal.bankDate).slice(0,7);}
          else if(transactionFamily(row.processing)==='uitgave'){
            setProcessingType(row.processing,'uitgave');
          }
        }
        if(field==='include'&&value===false)row.processing.transactionType='niet-meetellen';
        if(field==='budgetOwner'&&row.processing.fixedExpenseId){
          const wasFixed=row.processing.transactionType==='vaste-last'||row.processing.category==='Vaste lasten'||Boolean(row.processing.fixedExpenseId);
          const processingMonth=String(row.bankOriginal.bankDate).slice(0,7);
          const fixedRows=/^\d{4}-(0[1-9]|1[0-2])$/.test(processingMonth)?resolveFixedExpensesForMonth(root.state,processingMonth):[];
          const selectedFixed=fixedRows.find(item=>item.id===row.processing.fixedExpenseId);
          if(!selectedFixed||(selectedFixed.financialFor||selectedFixed.rekening||'gezamenlijk')!==value){row.processing.fixedExpenseId='';if(wasFixed){row.processing.transactionType='vaste-last';row.processing.category='Vaste lasten';}}
        }
        if(field==='transactionType'){
          row.processing.splits=(row.processing.splits||[]).filter(split=>Math.abs(Number(split.amount)||0)>.004);
        }
        if(field==='transactionType'&&value==='terugbetaling-voorschot'){
          const relation=repaymentRelation(root,row);
          row.processing.repaymentAllocations=relation?proposeRepaymentAllocations(root.state,relation.debtor,relation.creditor,row.processing.processedAmount):[];
        }
        if(field==='fixedOccurrenceId')row.processing.fixedOccurrenceMonth=String(value).slice(-10,-3);
        if(['fixedExpenseId','fixedOccurrenceMonth'].includes(field)){row.processing.fixedOccurrenceId='';selectFixedOccurrence(root,row,row.processing);}
        rerender=rerender||['singleLineAmount','withdrawalBudgetCategory','transactionType','budgetOwner','category','include','fixedExpenseId','processingDate','fixedOccurrenceMonth','fixedOccurrenceId','refundMonth','refundCategory'].includes(field);
      }else if(event.target.hasAttribute('data-u4-row-certainty'))reopenForReview(row);
      else if(event.target.dataset.u4SplitField){
        const split=row.processing.splits[Number(event.target.closest('[data-u4-split]').dataset.u4Split)];
        let value=event.target.value;if(event.target.dataset.u4SplitField==='amount')value=Math.abs(Number(value));
        const field=event.target.dataset.u4SplitField;if(field==='destination'){setProcessingType(split,value==='Vaste lasten'?'vaste-last':value==='Niet meetellen'?'niet-meetellen':'uitgave');split.category=value;split.include=value!=='Niet meetellen';}else if(field==='transactionType')setProcessingType(split,value);else split[field]=value;
        row.processing.editorVersion=113;
        if(field==='amount'){split.amountMode='manual';redistributeProcessing(row.processing);rerender=true;}
        if(field==='fixedOccurrenceId')split.fixedOccurrenceMonth=String(value).slice(-10,-3);
        if(['fixedExpenseId','fixedOccurrenceMonth','budgetOwner','destination'].includes(field)){split.fixedOccurrenceId='';selectFixedOccurrence(root,row,split);}
        if(field==='transactionType'&&value!=='vaste-last'){split.fixedExpenseId='';split.fixedOccurrenceId='';}
        rerender=rerender||['destination','transactionType','fixedExpenseId','fixedOccurrenceMonth','fixedOccurrenceId','budgetOwner','refundMonth','refundCategory'].includes(field);
      }else if(event.target.dataset.u4AllocationField){
        const allocation=row.processing.repaymentAllocations[Number(event.target.closest('[data-u4-allocation]').dataset.u4Allocation)];
        allocation[event.target.dataset.u4AllocationField]=round2(Math.abs(Number(event.target.value)||0));
      }
      if(wasApproved){reopenForReview(row);rerender=true;}
      const amountChange=event.target.dataset.u4SplitField==='amount'||['processedAmount','singleLineAmount'].includes(event.target.dataset.u4Field);
      if(amountChange){
        // Keep focused fields and the next clicked control alive during native blur/change.
        // Replacing the card here loses the user's next amount or Save click.
        container.querySelectorAll('[data-u4-split]').forEach(node=>{const line=row.processing.splits[Number(node.dataset.u4Split)],input=node.querySelector('[data-u4-split-field="amount"]');if(line&&input&&input!==event.target)input.value=line.amount;});
        const difference=splitDifference(row.processing),status=container.querySelector('[data-u4-split-total]');
        if(status){status.textContent=difference.differenceCents>0?'Nog '+euro(difference.differenceCents/100)+' te verdelen':difference.differenceCents<0?euro(-difference.differenceCents/100)+' te veel verdeeld':'';status.hidden=!difference.differenceCents;}
        if(wasApproved){const button=container.querySelector('[data-u4-reopen]');if(button){button.removeAttribute('data-u4-reopen');button.setAttribute('data-u4-approve','');button.textContent='Opslaan en verwerken';button.className='primary small';}const badge=container.querySelector('.u4-status');if(badge){badge.className='u4-status nakijken';badge.textContent='Nakijken';}}
      }else if(rerender)renderDraftRowCard(root,draft,modal,row.id);
      updateImportSaveStatus('Wijziging lokaal bewaren; nog niet toegepast…');
      persistLocalImportEditor(root,draft).catch(error=>console.warn('Automatisch lokaal opslaan mislukt.',error));
    };
    modal.addEventListener('change',onDraftChange);
    modal.addEventListener('input',event=>{if(event.target.dataset.u4SplitField==='amount'||['processedAmount','singleLineAmount'].includes(event.target.dataset.u4Field))onDraftChange(event);});
    modal.addEventListener('click',async event=>{
      const coverage=event.target.closest('[data-u4-coverage]');if(coverage){modal.classList.remove('open');window.FinizeTransactions?.openCoverage(coverage.dataset.u4Coverage);return;}
      root=UI.root;draft=UI.draft;modal=ensureModalRoot();
      const container=event.target.closest('[data-u4-row]');const row=container?draft.rows.find(item=>item.id===container.dataset.u4Row):null;
      if(event.target.closest('[data-u4-cancel-concept]')){await sessionWrite(draft);await ImportStore.deleteJournal(`editor-draft-${draft.id}`);ImportEditors.delete(String(draft.id));closeDraft();return;}
      const identity=event.target.closest('[data-u4-identity]');if(identity&&row){
        try{
          await sessionWrite(draft);
          const local=clone(draft),base=clone(editorSession(draft).base),chosen=base.rows.find(item=>item.id===row.id),decision=identity.dataset.u4Identity;
          chosen.identityDecision=decision;if(decision==='same'){chosen.duplicateSource=clone(row.possibleDuplicate);chosen.duplicate=true;}
          await persistImportDraftImmediate(root,base);
          await ImportStore.deleteJournal(`editor-draft-${draft.id}`);ImportEditors.delete(String(draft.id));
          const current=await openDraft(root,draft.id);
          for(const item of current.rows){const edited=local.rows.find(old=>old.id===item.id);if(edited&&(item.id!==row.id||decision==='distinct')){item.processing=clone(edited.processing);if(!isExplicitlyApproved(edited))reopenForReview(item);}}
          await persistLocalImportEditor(root,current);renderDraftModal(root,current);
        }catch(error){alert(error.message);}
        return;
      }
      const pairButton=event.target.closest('[data-u4-confirm-pair]');
      if(pairButton){try{if(!root.commitChange(()=>confirmInternalTransferPair(root.state,pairButton.dataset.u4ConfirmPair),{render:false}))throw new Error('Transferpaar opslaan mislukt.');renderDraftModalPreservingView(root,draft,modal);}catch(error){alert(error.message);}return;}
      if(event.target.closest('[data-u4-confirm-replacement]')&&row){
        const manualId=container.querySelector('[data-u4-replacement-choice]')?.value;if(!manualId){alert('Kies eerst de handmatige registratie.');return;}
        const snapshot=clone(row);try{await replaceManualSource(root,draft,row,manualId);renderDraftModalPreservingView(root,draft,modal,row.id);}catch(error){if(!error.coreApplied)Object.assign(row,snapshot);alert(error.coreApplied?'Vervanging is bewaard; importdetails worden uit het lokale journal hersteld.':error.message);}return;
      }
      if(event.target.closest('[data-u4-approve-selection]')){
        const ids=[...modal.querySelectorAll('[data-u4-select-approval]:checked')].map(input=>input.dataset.u4SelectApproval);
        if(!ids.length){alert('Selecteer eerst de regels die je wilt goedkeuren.');return;}
        if(!confirm(`${ids.length} geselecteerde regels expliciet goedkeuren?`))return;
        const button=event.target.closest('[data-u4-approve-selection]');button.disabled=true;
        try{await commitImportEditor(root,draft,{approveIds:ids});renderDraftModalPreservingView(root,draft,modal);root.renderActiveTab();}
        catch(error){button.disabled=false;alert(error.message);}
        return;
      }
      if(event.target.closest('[data-u4-approve]')&&row){event.preventDefault();event.stopPropagation();await showMatchDialog(root,draft,row,modal);return;}
      if(event.target.closest('[data-u4-reopen]')&&row){try{reopenForReview(row);await persistLocalImportEditor(root,draft);}catch(error){alert(error.message);return;}renderDraftModalPreservingView(root,draft,modal,row.id);persistLocalImportEditor(root,draft).catch(error=>console.warn('Opnieuw nakijken opslaan mislukt.',error));return;}
      if(event.target.closest('[data-u4-apply-bulk]')){
        const scope=modal.querySelector('[data-u4-bulk-scope]')?.value||'review';const owner=modal.querySelector('[data-u4-bulk-owner]')?.value||'';const category=modal.querySelector('[data-u4-bulk-category]')?.value||'';const type=modal.querySelector('[data-u4-bulk-type]')?.value||'';
        if(!owner&&!category&&!type){alert('Kies minimaal één veld om aan te passen.');return;}
        const targets=draft.rows.filter(item=>item.bankOriginal?.valid&&!item.duplicate&&!isExplicitlyApproved(item)&&(scope==='all'||(scope==='review'&&importReviewState(item)==='nakijken')||(scope==='unknown'&&importReviewState(item)==='onbekend')||(scope==='uncategorized'&&(!item.processing.category||item.processing.category==='Ongecategoriseerd'))));
        if(!targets.length){alert('Geen transacties binnen deze selectie.');return;}
        if(!confirm(`${targets.length} transacties aanpassen?`))return;
        targets.forEach(item=>{if(owner)item.processing.budgetOwner=owner;if(type)setProcessingType(item.processing,type);if(category){item.processing.category=category;if(category==='Vaste lasten'){setProcessingType(item.processing,'vaste-last');selectFixedOccurrence(root,item,item.processing);}}reopenForReview(item);});
        renderDraftModal(root,draft);persistLocalImportEditor(root,draft).catch(error=>console.warn('Bulkbewerking opslaan mislukt.',error));return;
      }
      if(event.target.closest('[data-u4-add-split]')&&row){
        if(isExplicitlyApproved(row)||sourceIsActive(root,draft,row))markEditorRowChanged(row);
        row.processing.editorVersion=113;addProcessingSplit(row.processing,uid('split'),uid('split'));
        renderDraftModalPreservingView(root,draft,modal,row.id);persistLocalImportEditor(root,draft).catch(error=>console.warn('Splitsregel opslaan mislukt.',error));return;
      }
      const remove=event.target.closest('[data-u4-remove-split]');
      if(remove&&row){if(isExplicitlyApproved(row)||sourceIsActive(root,draft,row))markEditorRowChanged(row);removeProcessingSplit(row.processing,Number(remove.dataset.u4RemoveSplit));renderDraftModalPreservingView(root,draft,modal,row.id);persistLocalImportEditor(root,draft).catch(error=>console.warn('Splitsregel verwijderen opslaan mislukt.',error));return;}
      const saveButton=event.target.closest('[data-u4-save-concept]');
      if(saveButton){
        const status=modal.querySelector('[data-u4-save-status]');
        saveButton.disabled=true;
        saveButton.textContent='Opslaan…';
        if(status)status.textContent='Concept wordt lokaal bewaard; de huidige verwerking blijft actief…';
        try{
          await persistLocalImportEditor(root,draft);
          saveButton.textContent='Opgeslagen';
          if(status)status.textContent='Concept is lokaal bewaard. Kies Opslaan en verwerken om het toe te passen.';
          setTimeout(()=>{
            if(!saveButton.isConnected)return;
            saveButton.disabled=false;
            saveButton.textContent='Concept opslaan';
          },1400);
        }catch(error){
          saveButton.disabled=false;
          saveButton.textContent='Opnieuw opslaan';
          if(status)status.textContent='Cloudopslag is niet afgerond. Het concept staat wel lokaal op dit apparaat.';
          alert(`Concept opslaan mislukt: ${error.message}`);
        }
        return;
      }
      if(event.target.closest('[data-u4-conflict-cloud],[data-u4-conflict-local]')){try{await resolveImportConflict(root,draft.id,event.target.closest('[data-u4-conflict-local]')?'local':'cloud');await openDraft(root,draft.id);}catch(error){alert(error.message);}return;}
      if(event.target.closest('[data-u4-withdraw],[data-u4-restore],[data-u4-delete-batch]')){const type=event.target.closest('[data-u4-delete-batch]')?'delete':event.target.closest('[data-u4-restore]')?'restore':'withdraw';if(type==='delete'&&!confirm('Deze batch permanent verwijderen? Alleen technisch verwijderbewijs blijft bewaard.'))return;try{await sessionWrite(draft);const stored=await ImportStore.getImport(draft.id);const result=await commitImportCommand(root,stored||draft,{type});applyFinancialCandidate(draft,clone(result.batch));ImportEditors.delete(String(draft.id));if(type==='delete')closeDraft();else renderDraftModal(root,draft);root.renderActiveTab();}catch(error){alert(error.message);}return;}
      if(event.target.closest('[data-u4-process]')){
        if(typeof root.FinizeUpdate4Process!=='function'){alert('De verwerkingslaag wordt in de volgende fase geactiveerd. Het concept blijft bewaard.');return;}
        await root.FinizeUpdate4Process(draft);
      }
      if(event.target.closest('[data-u4-undo]')){
        if(confirm('Deze import terugtrekken?'))await commitImportCommand(root,draft,{type:'withdraw'});
      }
      if(event.target.closest('[data-u4-reconcile]')){
        if(confirm('De bestaande import vervangen door deze aangepaste verwerking?'))await reconcileImport(root,draft);
      }
    });
  }
  function bindImportPanel(rootElement,root,owner=''){
    rootElement.querySelector('[data-u4-conflicts]')?.addEventListener('click',()=>renderImportConflicts(root));
    rootElement.querySelector('[data-u4-file]')?.addEventListener('change',event=>{
      const file=event.target.files?.[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=async loaded=>{
        try{
          const draft=createImportDraft({text:String(loaded.target.result||''),fileName:file.name,profiles:root.state.accountProfiles,rules:root.state.recognitionRules,transactions:root.state.transactions,existingImports:await ImportStore.listImports(),fixedExpenses:root.state.recurringFixedExpenses||[],entryOwner:owner});
          if(owner&&draft.accountProfileId&&draft.accountOwner!==owner)throw new Error(`Dit bankbestand hoort bij ${ownerLabel(draft.accountOwner)}. Open de juiste persoonlijke of gezamenlijke tab.`);
          if(owner){
            draft.entryOwner=owner;
            if(!draft.accountProfileId){
              draft.accountOwner=owner;
              draft.rows.forEach(row=>{row.accountOwner=owner;row.processing.budgetOwner=owner;});
            }
          }
          UI.draft=draft;await saveDraft(root,draft,{sync:true});root.renderActiveTab();renderDraftModal(root,draft);
        }catch(error){alert(`CSV importeren mislukt: ${error.message}`);}
      };
      reader.readAsText(file);
    });
    rootElement.querySelectorAll('[data-u4-open-concept],[data-u4-open-receipt]').forEach(button=>button.addEventListener('click',()=>openDraft(root,button.dataset.u4OpenConcept||button.dataset.u4OpenReceipt).catch(error=>alert(error.message))));
    rootElement.querySelector('[data-u4-all-imports]')?.addEventListener('click',()=>renderImportHistory(root,owner));
    rootElement.querySelector('[data-u4-manage-rules]')?.addEventListener('click',()=>renderRules(root));
  }
  function renderImportHistory(root,owner=''){
    const modal=ensureModalRoot();const allSummaries=[...(root.state.importSummaries||[]),...[...UI.conflicts.values()].filter(c=>c.localChoice?.rows&&!(root.state.importSummaries||[]).some(s=>s.id===c.importId)).map(c=>({...compactSummary(c.localChoice),status:'synchronisatieconflict'}))].sort((a,b)=>String(b.updatedAt||b.importDate).localeCompare(String(a.updatedAt||a.importDate)));const summaries=owner?allSummaries.filter(summary=>importSummaryOwner(root,summary)===owner):allSummaries;
    modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><h2>Alle imports</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body"><div class="u4-import-history">${renderImportHistoryGroups(root,summaries)||'<div class="u4-empty">Nog geen imports.</div>'}</div></main></div>`;
    modal.classList.add('open');modal.querySelector('[data-u4-close]').addEventListener('click',closeDraft);modal.querySelectorAll('[data-u4-open-receipt]').forEach(item=>item.addEventListener('click',()=>openDraft(root,item.dataset.u4OpenReceipt)));
  }
  function openBankImportForOwner(root,owner){
    if(!OWNERS.includes(owner))return;
    const modal=ensureModalRoot();
    modal.innerHTML=`<div class="u4-import-modal u4-entry-import-modal" role="dialog" aria-modal="true" aria-label="Bankimport voor ${esc(ownerLabel(owner))}"><header class="u4-modal-head"><div><h2>Bankimport</h2><p>${esc(ownerLabel(owner))} · ${esc(importMonthLabel(String(root.state.meta?.selectedMonth||'').slice(0,7)))}</p></div><button type="button" class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body">${renderImportPanel(root,owner)}</main></div>`;
    modal.classList.add('open');
    modal.querySelector('[data-u4-close]').addEventListener('click',closeDraft);
    bindImportPanel(modal,root,owner);
  }
  function renderRules(root){
    const modal=ensureModalRoot();const rules=root.state.recognitionRules||[];
    modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><div><h2>Herkenningsregels</h2><p>Eigenaren worden nooit in regels opgeslagen.</p></div><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body"><div class="u4-import-receipts">${rules.map(rule=>`<article class="u4-receipt" data-u4-rule="${esc(rule.id)}"><div class="u4-row-grid"><label>Type<select data-rule-field="level">${['counterparty','description','organization','keyword','prediction'].map(level=>option(level,level,rule.level)).join('')}</select></label><label class="wide">Waarde<input data-rule-field="value" value="${esc(rule.value)}"></label><label>Categorie<input data-rule-field="category" value="${esc(rule.category)}"></label><label><input type="checkbox" data-rule-field="enabled" ${rule.enabled!==false?'checked':''}> Actief</label><label><input type="checkbox" data-rule-field="alwaysReview" ${rule.alwaysReview?'checked':''}> Altijd Nakijken</label><button class="danger-ghost small" data-u4-delete-rule="${esc(rule.id)}">Verwijderen</button></div></article>`).join('')||'<div class="u4-empty">Nog geen herkenningsregels.</div>'}</div></main></div>`;
    modal.classList.add('open');modal.querySelector('[data-u4-close]').addEventListener('click',closeDraft);
    modal.addEventListener('change',event=>{const card=event.target.closest('[data-u4-rule]');if(!card)return;const rule=rules.find(item=>item.id===card.dataset.u4Rule);if(!rule)return;const field=event.target.dataset.ruleField;rule[field]=event.target.type==='checkbox'?event.target.checked:event.target.value;root.commitChange(()=>{}, {render:false});});
    modal.addEventListener('click',event=>{const button=event.target.closest('[data-u4-delete-rule]');if(!button)return;root.commitChange(()=>{root.state.recognitionRules=root.state.recognitionRules.filter(rule=>rule.id!==button.dataset.u4DeleteRule);},{render:false});renderRules(root);});
  }
  function injectSettlementCard(root){
    document.querySelector('[data-dashboard-accordion="settlement"]')?.remove();
    document.querySelector('.u4-settlement-card')?.remove();
  }
  function renderSettlementDetail(root,filters={}){
    const modal=ensureModalRoot();const person=filters.person||'';const month=filters.month||'';
    const advances=(root.state.advanceLedger||[]).filter(row=>Number(row.outstandingAmount)>0&&(!person||(row.debtor===person||row.creditor===person))&&(!month||row.month===month));
    const months=[...new Set((root.state.advanceLedger||[]).map(row=>row.month).filter(Boolean))].sort().reverse();
    modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><div><h2>Onderling te verrekenen</h2><p>Directionele saldi worden niet automatisch tegen elkaar weggestreept.</p></div><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body"><div class="u4-profile-grid"><label>Persoon<select data-u4-settlement-person><option value="">Iedereen</option>${OWNERS.map(owner=>option(owner,ownerLabel(owner),person)).join('')}</select></label><label>Maand<select data-u4-settlement-month><option value="">Alle maanden</option>${months.map(value=>option(value,value,month)).join('')}</select></label></div><div class="u4-import-receipts">${advances.map(advance=>{const tx=(root.state.transactions||[]).find(item=>item.id===advance.transactionId);const paid=round2(Number(advance.originalAmount||0)-Number(advance.outstandingAmount||0));return `<article class="u4-receipt"><div class="u4-receipt-head"><div><strong>${esc(tx?.description||'Voorschot')}</strong><div class="u4-muted">${esc(tx?.date||advance.month)} · ${ownerLabel(advance.debtor)} → ${ownerLabel(advance.creditor)}</div></div><strong>${euro(advance.outstandingAmount)}</strong></div><div class="u4-muted">Oorspronkelijk ${euro(advance.originalAmount)} · afgelost ${euro(paid)}</div></article>`;}).join('')||'<div class="u4-empty">Geen openstaande voorschotten voor dit filter.</div>'}</div></main></div>`;
    modal.classList.add('open');modal.querySelector('[data-u4-close]').addEventListener('click',closeDraft);
    modal.querySelector('[data-u4-settlement-person]').addEventListener('change',event=>renderSettlementDetail(root,{person:event.target.value,month:modal.querySelector('[data-u4-settlement-month]').value}));
    modal.querySelector('[data-u4-settlement-month]').addEventListener('change',event=>renderSettlementDetail(root,{person:modal.querySelector('[data-u4-settlement-person]').value,month:event.target.value}));
  }
  function installUI(root){
    root.renderBankImportSection=()=>renderImportPanel(root);
    root.bindBankImport=element=>bindImportPanel(element,root);
    root.openBankImportForOwner=owner=>openBankImportForOwner(root,owner);
    if(typeof root.renderActiveTab==='function'&&!root.renderActiveTab.__u4Wrapped){
      const legacy=root.renderActiveTab;
      const wrapped=function(){const result=legacy.apply(this,arguments);queueMicrotask(()=>injectSettlementCard(root));return result;};
      wrapped.__u4Wrapped=true;root.renderActiveTab=wrapped;
    }
    root.__finizeInstallUpdate4Hooks?.({
      renderBankImportSection:root.renderBankImportSection,
      bindBankImport:root.bindBankImport,
      renderActiveTab:root.renderActiveTab
    });
    root.FinizeUpdate4Process=draft=>processDraft(root,draft).catch(error=>{alert(error.message);return false;});
    if(root.state.activeImportId)ImportStore.getImport(root.state.activeImportId).then(draft=>{UI.draft=draft||null;}).catch(()=>{});
  }

  async function preserveImportConflict(root,local,remote,conflicts=[]){
    const id=`conflict-${local.id}`;
    const existing=await ImportStore.getJournal(id);
    const conflict={...existing,id,operation:'conflict',status:'conflict',importId:local.id,localChoice:clone(local),cloudChoice:clone(remote),conflicts,createdAt:existing?.createdAt||new Date().toISOString()};await ImportStore.putJournal(conflict);UI.conflicts.set(local.id,conflict);
    if(UI.draft?.id===local.id)UI.draft.syncConflict=true;
    updateImportSaveStatus('Synchronisatieconflict: de cloudstand blijft behouden; je lokale keuze is veilig bewaard.',true);
    root.dispatchEvent?.(new CustomEvent('finize:import-conflict',{detail:{id:local.id}}));
  }
  function renderImportConflicts(root){
    const modal=ensureModalRoot();modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><h2>Synchronisatieconflicten</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body">${[...UI.conflicts.values()].map(conflict=>`<div class="u4-receipt"><strong>${esc(conflict.localChoice?.fileName||conflict.importId)}</strong><p>Cloudstand blijft actief. Lokale keuze is veilig opgeslagen.</p><button class="ghost small" data-u4-resolve="${escAttr(conflict.importId)}" data-choice="cloud">Cloudstand behouden</button>${conflict.localChoice?.rows||conflict.localChoice?.lifecycle==='deleted'?`<button class="primary small" data-u4-resolve="${escAttr(conflict.importId)}" data-choice="local">Lokale keuze opnieuw toetsen</button>`:'<p class="u4-muted">De lokale snapshot is bewaard. Beoordeel de betrokken imports afzonderlijk.</p>'}</div>`).join('')}</main></div>`;modal.classList.add('open');modal.querySelector('[data-u4-close]').onclick=closeDraft;
    modal.querySelectorAll('[data-u4-resolve]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await resolveImportConflict(root,button.dataset.u4Resolve,button.dataset.choice);renderImportConflicts(root);root.renderActiveTab();}catch(error){button.disabled=false;alert(error.message);}});
  }
  async function preservePendingImportsBeforeRemote(root,remote){
    let preserved=false;
    for(const queued of await ImportStore.listSync()){
      const summary=(remote.importSummaries||[]).find(row=>row.id===queued.importId)||(remote.importDeletionProofs||[]).find(row=>row.id===queued.importId);
      if(summary?.operationId===queued.operationId){const local=await ImportStore.getImport(queued.importId);if(local)await ImportStore.confirmCloudReceipt(pendingQueueReceipt(local),local);continue;}
      const local=await ImportStore.getImport(queued.importId);if(!local)continue;
      await preserveImportConflict(root,local,summary||{id:queued.importId,version:0},[{kind:'initial-pending-import'}]);preserved=true;
    }
    return preserved;
  }
  async function resolveImportConflict(root,id,choice){
    const conflict=await ImportStore.getJournal(`conflict-${id}`);if(!conflict||conflict.status!=='conflict')return false;
    if(id==='compact-state'){if(choice!=='cloud')throw new Error('Deze keuze omvat meerdere imports. Heropen en beoordeel de veilig bewaarde imports afzonderlijk.');conflict.status='resolved';delete conflict.localChoice;delete conflict.cloudChoice;await ImportStore.putJournal(conflict);UI.conflicts.delete(id);root.CloudAdapter.conflict=UI.conflicts.size>0;return true;}
    const local=conflict.localChoice;let remote;try{remote=await fetchImportFromCloud(root,id);}catch(error){if(error.code!=='cloud-missing')throw error;remote={...clone(local),rows:[],version:0,baseVersion:0,operationId:'',lifecycle:'active'};}
    if(choice==='local'&&(['deleted','withdrawn'].includes(local.lifecycle)||local.lifecycle==='active'&&remote.lifecycle==='withdrawn')){await ImportStore.deleteImport(id);await ImportStore.putImport(remote);await commitImportCommand(root,remote,{type:local.lifecycle==='deleted'?'delete':local.lifecycle==='withdrawn'?'withdraw':'restore'});}
    else if(choice==='cloud'){
      await ImportStore.deleteSync(id);await ImportStore.deleteImport(id);await ImportStore.putImport(remote);
    }else{
      if(remote.lifecycle==='deleted')throw new Error('Deze batch is permanent verwijderd. Een nieuwe import heeft een nieuw batch-ID nodig.');
      await ImportStore.deleteImport(id);await ImportStore.putImport(remote);
      await commitImportCommand(root,remote,{type:'source-choices',rows:clone(local.rows||[])});
    }
    conflict.status='resolved';delete conflict.localChoice;delete conflict.cloudChoice;await ImportStore.putJournal(conflict);
    await ImportStore.deleteJournal(`editor-draft-${id}`);ImportEditors.delete(String(id));
    UI.conflicts.delete(id);
    if(root.CloudAdapter){root.CloudAdapter.conflict=UI.conflicts.size>0;root.CloudAdapter.queueSave?.(root.state);root.CloudAdapter.flushQueue?.();}return true;
  }
  function commitImportCommand(root,draft,command){const id=String(draft.id),previous=ImportPerformance.chains.get(id)||Promise.resolve();const operation=previous.catch(()=>{}).then(()=>commitImportCommandUnlocked(root,draft,command));ImportPerformance.chains.set(id,operation);operation.finally(()=>{if(ImportPerformance.chains.get(id)===operation)ImportPerformance.chains.delete(id);}).catch(()=>{});return operation;}
  async function commitImportCommandUnlocked(root,draft,command){
    const commandScope=ImportStore.scope,sourceToken=JSON.stringify(draft.rows?.find(row=>row.id===command.rowId));
    const stored=await ImportStore.getImport(draft.id);
    if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. Heropen de import in het oorspronkelijke huishouden.');
    if(command.operationId&&stored?.operationId===command.operationId)return {state:clone(root.state),batch:clone(stored),noop:true};
    if(stored&&(importVersion(stored)!==importVersion(draft)||command.type==='editor-commit'&&!sameEditorBase(stored,draft))){if(command.type==='editor-commit')await preserveImportConflict(root,{...clone(draft),rows:clone(command.rows)},stored,[{kind:'editor-base-changed'}]);throw cloudImportError('import-conflict','Importdetails zijn intussen gewijzigd. De lokale keuze blijft veilig bewaard.');}
    if(command.type==='delete'){const dependent=(await ImportStore.listJournal()).find(entry=>entry.importId!==draft.id&&['pending','conflict'].includes(entry.status)&&[...(entry.candidate?.transactions||[]),...(entry.localChoice?.state?.transactions||[])].some(tx=>tx.importBatchId===draft.id));if(dependent)throw new Error('Een nog openstaande lokale keuze gebruikt deze batch. Los eerst dat conflict op.');}
    if(stored&&sameImportOperation(stored,draft))draft.baseVersion=Number(stored.baseVersion??draft.baseVersion??0);
    if(command.type==='editor-commit'&&!(command.approveIds||[]).length&&!(command.reopenIds||[]).length&&!command.profile&&JSON.stringify(command.rows)===JSON.stringify(draft.rows))return {state:clone(root.state),batch:clone(draft),noop:true};
    for(const rowId of command.approveIds||[command.rowId].filter(Boolean)){const source=bankSourceForImport(root.state,draft.id,rowId),row=draft.rows.find(row=>row.id===rowId);if(row?.bankSourceRevision!==undefined&&(source?.processingRevision||0)!==row.bankSourceRevision)throw cloudImportError('import-conflict','Deze banktransactie is via een andere import of apparaat gewijzigd. Heropen de actuele verwerking. Je concept blijft bewaard.');}
    const intent={...command,operationId:command.operationId||uid('import-op'),timestamp:command.timestamp||new Date().toISOString(),deviceId:root.state.meta?.updatedBy||''};
    let planned;
    if(['withdraw','restore','delete'].includes(intent.type))planned=planImportCommand(root.state,draft,intent,{validateRow:rowProcessingValidation});
    else{
      const candidate=clone(root.state),nextBatch=clone(draft);ensureImportBankSources(candidate,nextBatch);const row=nextBatch.rows.find(row=>row.id===intent.rowId);
      if(!row&&!['source-choices','editor-commit'].includes(intent.type))throw new Error('Importbron ontbreekt.');
      if(row?.importError)throw cloudImportError(row.importError.code,row.importError.message);
      if(batchLifecycle(draft)!=='active')throw new Error('Herstel eerst deze teruggetrokken batch.');
      if(intent.type==='editor-commit'){
        const desiredRows=intent.rows||[],selected=new Set(intent.approveIds||[]),reopenIds=new Set(intent.reopenIds||[]);
        if(desiredRows.length!==nextBatch.rows.length||desiredRows.some(source=>!nextBatch.rows.some(original=>original.id===source.id)))throw new Error('De bronregels van deze batch zijn gewijzigd. Heropen de actuele import.');
        assertOriginalBankDataUnchanged(nextBatch.rows,desiredRows);
        if(intent.profile)for(const key of ['accountProfileId','accountOwner'])nextBatch[key]=intent.profile[key];
        for(const source of nextBatch.rows){
          const desired=desiredRows.find(value=>value.id===source.id),changed=JSON.stringify(source.processing)!==JSON.stringify(desired.processing)||source.accountProfileId!==desired.accountProfileId||source.accountOwner!==desired.accountOwner||getTransactionProcessingStatus({...source,source:'csv'})!==getTransactionProcessingStatus({...desired,source:'csv'});
          if(changed||reopenIds.has(source.id)){
            source.approvalHistory=[...(source.approvalHistory||[]),{approvalSource:source.approvalSource||'',approvedAt:source.approvedAt||'',status:source.processingStatus||source.certainty}];
            source.processing=clone(desired.processing);for(const key of ['accountProfileId','accountOwner','recognitionState','reasons']){if(desired[key]!==undefined)source[key]=clone(desired[key]);}reopenForReview(source);reopenIds.add(source.id);
          }
          if(selected.has(source.id))markExplicitlyApproved(source);
        }
        if([...selected].some(id=>!nextBatch.rows.some(source=>source.id===id)))throw new Error('Een geselecteerde bron ontbreekt.');
        const selectedRows=nextBatch.rows.filter(source=>selected.has(source.id));
        for(const source of selectedRows){const validation=rowProcessingValidation(source,candidate);if(!validation.ok)throw new Error(validation.errors.map(error=>error.message).join(' '));}
        const changed=nextBatch.rows.some((source,index)=>JSON.stringify(source)!==JSON.stringify(draft.rows[index]));
        if(!changed&&!intent.profile&&!selected.size&&!reopenIds.size)return {state:clone(root.state),batch:clone(draft),noop:true};
        const plan=selectedRows.length?planImportEffects({...nextBatch,rows:selectedRows},candidate):null;
        if(plan&&!plan.ok)throw new Error(plan.errors.map(error=>error.message).join(' '));
        commitProcessedSourceGroup(candidate,draft.id,{reopenIds:[...reopenIds],replacements:selectedRows.map(source=>({rowId:source.id,rows:plan.transactions.filter(tx=>tx.bankSourceId===bankSourceForImport(candidate,draft.id,source.id)?.bankSourceId)}))},state=>{
          if(plan)applyImportPlanInPlace(state,{...plan,fixedAdjustments:[],sourceCorrection:true});
        });
        if(plan){nextBatch.effectManifest=nextBatch.effectManifest||{};const effects=effectManifest(plan);for(const key of ['transactionIds','savingIds','advanceIds','repaymentIds','replacementIds','internalPairIds'])nextBatch.effectManifest[key]=[...new Set([...(nextBatch.effectManifest[key]||[]),...(effects[key]||[])])];}
      }else if(intent.type==='source-choices'){
        const existingSourceIds=new Set(nextBatch.rows.map(source=>source.id));
        if(!nextBatch.rows.length)nextBatch.rows=clone(intent.rows||[]);
        for(const source of nextBatch.rows){const desired=(intent.rows||[]).find(value=>value.id===source.id);if(!desired)continue;
          assertOriginalBankDataUnchanged([source],[desired]);
          if(existingSourceIds.has(source.id)&&JSON.stringify(source.processing)===JSON.stringify(desired.processing)&&getTransactionProcessingStatus({...source,source:'csv'})===getTransactionProcessingStatus({...desired,source:'csv'}))continue;
          reopenTransactionSource(candidate,draft.id,source.id);
          source.processing=clone(desired.processing);source.approvalHistory=[...(source.approvalHistory||[]),{approvalSource:source.approvalSource||'',approvedAt:source.approvedAt||'',status:source.processingStatus||source.certainty}];reopenForReview(source);
        }
        assertFinancialMutationSafe(root.state,candidate);
      }else if(intent.type==='source-approve'){
        const single={...nextBatch,rows:[row]},plan=planImportEffects(single,candidate);if(!plan.ok)throw new Error(plan.errors.map(e=>e.message).join(' '));
        applySourceApproval(candidate,nextBatch,row,plan);
        nextBatch.effectManifest=nextBatch.effectManifest||{};const effects=effectManifest(plan);
        for(const key of ['transactionIds','savingIds','advanceIds','repaymentIds','replacementIds','internalPairIds'])nextBatch.effectManifest[key]=[...new Set([...(nextBatch.effectManifest[key]||[]),...(effects[key]||[])])];
      }else if(intent.type==='source-reopen'){reopenTransactionSource(candidate,draft.id,row.id);reopenForReview(row);}
      else if(intent.type==='source-replacement'){confirmManualReplacement(candidate,row,intent.manualId,draft.id);synchronizeChangedSavings(candidate,root.state);assertFinancialMutationSafe(root.state,candidate);}
      else throw new Error('Onbekende bronactie.');
      for(const row of nextBatch.rows)row.bankSourceRevision=bankSourceForImport(candidate,nextBatch.id,row.id)?.processingRevision||0;
      nextBatch.version=importVersion(draft)+1;nextBatch.operationId=intent.operationId;nextBatch.updatedAt=intent.timestamp;nextBatch.lifecycle='active';
      nextBatch.status=deriveBatchReviewStatus(nextBatch).status;
      const summary=(candidate.importSummaries||[]).find(s=>s.id===draft.id);if(summary)Object.assign(summary,compactSummary(nextBatch));
      else candidate.importSummaries=[...(candidate.importSummaries||[]),compactSummary(nextBatch)];
      planned={state:candidate,batch:nextBatch};
    }
    if(planned.noop)return planned;
    assertNoDuplicateSources(root.state,planned.state);
    planned.batch.baseVersion=Number(draft.baseVersion??draft.version??0);
    // Capture both sides before touching either persistent representation. Recovery uses the
    // operation receipt, never transaction count or viewport. A changing core aborts the command.
    if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. De oorspronkelijke verwerking blijft behouden.');
    const baseSignature=JSON.stringify(root.state);
    const journal={id:intent.operationId,importId:draft.id,operation:'import-command',status:'pending',intent,baseSignature,candidate:planned.state,batch:planned.batch,previousBatch:clone(stored||draft)};
    await ImportStore.putJournal(journal);
    if(command.rowId&&JSON.stringify(draft.rows?.find(row=>row.id===command.rowId))!==sourceToken){journal.status='rolled-back';await ImportStore.putJournal(journal);throw new Error('De verwerking is intussen gewijzigd. Keur de huidige verwerking opnieuw expliciet goed.');}
    if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. De oorspronkelijke verwerking blijft behouden.');
    if(JSON.stringify(root.state)!==baseSignature){journal.status='conflict';await ImportStore.putJournal(journal);await preserveImportConflict(root,planned.batch,stored||{id:draft.id,version:0},[{kind:'local-core-changed'}]);throw new Error('De financiële state wijzigde tijdens de actie. De keuze is bewaard; probeer opnieuw op de actuele stand.');}
    const previousQueue=(await ImportStore.listSync()).find(item=>item.importId===draft.id);
    let detailsWritten=false;
    try{
      if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. De oorspronkelijke verwerking blijft behouden.');
      await ImportStore.putImport(planned.batch);detailsWritten=true;
      if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. De oorspronkelijke verwerking blijft behouden.');
      await queueImportSync(planned.batch);
      if(ImportStore.scope!==commandScope)throw new Error('Het huishouden is intussen gewijzigd. De oorspronkelijke verwerking blijft behouden.');
      if(JSON.stringify(root.state)!==baseSignature){await preserveImportConflict(root,planned.batch,stored||{id:draft.id,version:0},[{kind:'local-core-changed'}]);throw new Error('De state wijzigde tijdens de opslagcommit. De keuze blijft veilig bewaard; beoordeel de actuele stand.');}
      const ok=root.commitChange(()=>applyFinancialCandidate(root.state,planned.state),{render:false,mutationMode:'correction',throwOnError:true});
      if(!ok)throw new Error('Financiële commit is afgebroken; oorspronkelijke effecten blijven behouden.');
    }catch(error){
      if(ImportStore.scope===commandScope){
        // A reported failure is not an interrupted accepted command: never replay it on reload.
        journal.status='rolled-back';await ImportStore.putJournal(journal);
        if(detailsWritten)await ImportStore.rollbackImport(planned.batch,journal.previousBatch,previousQueue);
      }
      throw error;
    }
    applyFinancialCandidate(draft,clone(planned.batch));
    journal.status='completed';delete journal.candidate;delete journal.previousBatch;delete journal.baseSignature;
    try{
      if(planned.deleted){await purgeDeletedBatch(draft.id,intent.operationId);delete journal.candidate;delete journal.previousBatch;delete journal.baseSignature;journal.batch=clone(planned.batch);}
      if(ImportStore.scope===commandScope)await ImportStore.putJournal(journal);
    }catch(error){
      // Core and import details already share the durable operation receipt. Recovery
      // finalizes a remaining pending journal without applying the effects twice.
      console.warn('De verwerking is opgeslagen; het journal wordt bij herstart afgerond.',error);
    }
    if(ImportStore.scope===commandScope)flushImportSync(root).catch(()=>{});return planned;
  }
  async function purgeDeletedBatch(id,except=''){
    const session=ImportEditors.get(String(id));if(session)await session.write.catch(()=>{});ImportEditors.delete(String(id));
    for(const entry of await ImportStore.listJournal()){if(entry.importId===id&&entry.id!==except)await ImportStore.deleteJournal(entry.id);else if(entry.id!==except&&!['pending','conflict'].includes(entry.status)&&entry.candidate){delete entry.candidate;delete entry.baseSignature;await ImportStore.putJournal(entry);}}
    const pending=ImportPerformance.pending.get(id);if(pending){clearTimeout(pending.timer);ImportPerformance.pending.delete(id);pending.resolvers.forEach(r=>r.reject(new Error('De batch is permanent verwijderd.')));}
  }
  async function queueImportSync(record){
    await ImportStore.putSync({...pendingQueueReceipt(record),queuedAt:new Date().toISOString(),attempts:0});
  }
  function reportImportSyncDiagnostics(diagnostics){
    ImportPerformance.syncDiagnostics=diagnostics;
    const signature=JSON.stringify(diagnostics);
    if(diagnostics.length&&signature!==ImportPerformance.diagnosticSignature)console.warn('Importsynchronisatie wacht; lokale wachtrij blijft behouden: '+signature);
    ImportPerformance.diagnosticSignature=signature;
  }
  async function collectImportCloudIntents(snapshot){
    const intents=[],diagnostics=[];
    for(const item of await ImportStore.listSync()){
      if((await ImportStore.getJournal(`conflict-${item.importId}`))?.status==='conflict'){diagnostics.push({importId:item.importId,code:'import-conflict'});continue;}
      const record=await ImportStore.getImport(item.importId);if(!record){diagnostics.push({importId:item.importId,code:'import-details-missing'});continue;}
      const summary=(snapshot.importSummaries||[]).find(row=>row.id===record.id)||(snapshot.importDeletionProofs||[]).find(row=>row.id===record.id);
      if(!summary||importVersion(summary)!==importVersion(record)||String(summary.operationId||'')!==String(record.operationId||'')){diagnostics.push({importId:item.importId,code:'import-pending-snapshot'});reportImportSyncDiagnostics(diagnostics);throw cloudImportError('import-pending-snapshot','Importdetails en financiële snapshot behoren nog niet tot dezelfde versie.');}
      intents.push(record);
    }
    reportImportSyncDiagnostics(diagnostics);
    return intents;
  }
  async function stageImportCloudWrites(root,snapshot){
    const cloud=root.CloudAdapter,firestore=cloud?.modules?.firestore;
    if(!firestore?.runTransaction)throw new Error('Transactionele import-cloudopslag is niet beschikbaar. De lokale keuze blijft bewaard.');
    const stages=[];
    for(const record of await collectImportCloudIntents(snapshot)){
      const envelope=record.lifecycle==='deleted'?{header:clone(record),chunks:[],sourceChunks:[]}:buildCloudImportEnvelope(record);
      for(let index=0;index<envelope.chunks.length;index++)await firestore.setDoc(cloudImportChunkRef(cloud,firestore,record.id,`${record.operationId?record.operationId+'-':''}${String(index).padStart(4,'0')}`),envelope.chunks[index],{merge:false});
      for(let index=0;index<envelope.sourceChunks.length;index++)await firestore.setDoc(cloudImportChunkRef(cloud,firestore,record.id,`${record.operationId}-source-${index}`),{generation:record.operationId,index,text:envelope.sourceChunks[index]},{merge:false});
      stages.push({record,receipt:pendingQueueReceipt(record),header:envelope.header,ref:cloudImportRef(cloud,firestore,record.id)});
    }
    return {
      stages,
      async readAndValidate(transaction){
        const snapshots=[];for(const stage of stages)snapshots.push(await transaction.get(stage.ref));
        for(let i=0;i<stages.length;i++){
          const stage=stages[i],remote=snapshots[i].exists()?snapshots[i].data():null;
          try{stage.echo=assertImportBase(remote,stage.record)==='echo';}catch(error){error.importConflict={local:stage.record,remote};throw error;}
        }
      },
      publish(transaction){for(const stage of stages)if(!stage.echo)transaction.set(stage.ref,stage.header);},
      async acknowledge(){for(const stage of stages){
        await ImportStore.confirmCloudReceipt(stage.receipt,stage.record);
        if(stage.record.lifecycle==='deleted'&&!await cleanupDeletedCloudChunks(root,stage.record.id))await queueImportSync(stage.record);
      }}
    };
  }
  async function cleanupDeletedCloudChunks(root,id){
    const cloud=root.CloudAdapter,f=cloud.modules.firestore;
    // Tombstone is already committed. It permanently rejects stale writes; chunk cleanup retries.
    if(!f.getDocs||!f.collection||!f.deleteDoc)return false;
    const snapshot=await f.getDocs(f.collection(cloudImportRef(cloud,f,id),'chunks'));
    for(const doc of snapshot.docs||[])await f.deleteDoc(doc.ref);
    return true;
  }
  async function flushImportSync(root){
    ImportPerformance.syncRequested=true;if(ImportPerformance.syncPromise)return ImportPerformance.syncPromise;
    ImportPerformance.syncPromise=(async()=>{
      const cloud=root.CloudAdapter;
      if(!cloud?.isConnected?.()||cloud.initialSyncComplete===false)return false;
      if(cloud.docRef){
        for(const item of await ImportStore.listSync()){if((await ImportStore.getJournal(`conflict-${item.importId}`))?.status==='conflict')continue;const legacy=await ImportStore.getImport(item.importId);if(legacy&&!legacy.operationId){await persistImportDraftImmediate(root,legacy,{syncCloud:false});await queueImportSync(legacy);}}
        // A preserved orphan/conflict is not a publishable operation. Never commit core just to retry it.
        if(!(await collectImportCloudIntents(root.state)).length)return !ImportPerformance.syncDiagnostics.length;
        cloud.queueSave(root.state);const ok=await cloud.flushQueue();return ok;
      }
      // Connector/test compatibility without compact-state adapter: still require guarded headers.
      if(!cloud.modules?.firestore?.runTransaction)return false;
      while(ImportPerformance.syncRequested){ImportPerformance.syncRequested=false;
        const staged=await stageImportCloudWrites(root,root.state);
        if(!staged.stages.length)return !ImportPerformance.syncDiagnostics.length;
        await cloud.modules.firestore.runTransaction(cloud.db,async tx=>{await staged.readAndValidate(tx);staged.publish(tx);});await staged.acknowledge();
      }return true;
    })().catch(async error=>{
      if(error.importConflict)await preserveImportConflict(root,error.importConflict.local,error.importConflict.remote);
      return false;
    }).finally(()=>{ImportPerformance.syncPromise=null;});return ImportPerformance.syncPromise;
  }

  async function recoverJournal(root){
    const entries=await ImportStore.listJournal();
    for(const entry of entries.filter(item=>item.status==='pending')){
      if(entry.operation==='import-command'){const receipt=(root.state.importSummaries||[]).find(row=>row.id===entry.importId)||(root.state.importDeletionProofs||[]).find(row=>row.id===entry.importId);if(receipt?.operationId===entry.intent.operationId){await ImportStore.putImport(entry.batch);await queueImportSync(entry.batch);entry.status='completed';if(entry.batch.lifecycle==='deleted'){await purgeDeletedBatch(entry.importId,entry.id);delete entry.candidate;delete entry.previousBatch;delete entry.baseSignature;}}else if(JSON.stringify(root.state)===entry.baseSignature){await ImportStore.putImport(entry.batch);await queueImportSync(entry.batch);if(JSON.stringify(root.state)!==entry.baseSignature)throw new Error('State wijzigde tijdens journalherstel; keuze blijft bewaard.');if(!root.commitChange(()=>applyFinancialCandidate(root.state,entry.candidate),{render:false,mutationMode:'correction'}))throw new Error('Herstelcommit mislukt.');entry.status='completed';}else{entry.status='conflict';await preserveImportConflict(root,entry.batch,(await ImportStore.getImport(entry.importId))||{id:entry.importId,version:0},[{kind:'journal-core-changed'}]);}if(entry.status==='completed'){await acknowledgeRecoveredEditor(entry);delete entry.candidate;delete entry.previousBatch;delete entry.baseSignature;}await ImportStore.putJournal(entry);continue;}
      if(entry.operation==='discard'){
        if(root.state?.activeImportId===entry.importId){
          entry.status='rolled-back';
        }else{
          try{
            await ImportStore.deleteImport(entry.importId);
            await ImportStore.deleteSync(entry.importId);
            entry.localCleanup=true;
          }catch(error){
            entry.localCleanup=false;entry.localCleanupError=String(error?.message||error);
          }
          if(entry.localCleanup){
            entry.cloudCleanup=await deleteCloudImportBestEffort(root,entry.importId);
            entry.status='completed';entry.completedAt=new Date().toISOString();
          }else{
            entry.status='pending';
          }
        }
        entry.recoveredAt=new Date().toISOString();
        await ImportStore.putJournal(entry);
        continue;
      }
      if(['source-approve','source-replacement'].includes(entry.operation)){
        const applied=entry.operation==='source-approve'?(root.state.transactions||[]).some(tx=>tx.importBatchId===entry.importId&&tx.importTransactionId===entry.rowId&&tx.processingStatus==='goedgekeurd'||tx.importBatchId===entry.importId&&tx.importTransactionId===entry.rowId&&tx.processingStatus==='niet-meetellen'):(root.state.manualTransactionReplacements||[]).some(item=>item.id===`replacement-${entry.importId}-${entry.manualId}`&&item.active!==false);
        if(applied){const draft=await ImportStore.getImport(entry.importId),row=draft?.rows.find(row=>row.id===entry.rowId);if(!row)throw new Error('Importbron ontbreekt bij herstel; journal blijft behouden.');Object.assign(row,clone(entry.row));if(entry.manifest)draft.effectManifest=clone(entry.manifest);if(entry.operation==='source-replacement'){draft.effectManifest=draft.effectManifest||{};draft.effectManifest.replacementIds=[...new Set([...(draft.effectManifest.replacementIds||[]),`replacement-${entry.importId}-${entry.manualId}`])];}await persistImportDraft(root,draft);entry.status='completed';}else entry.status='rolled-back';
        await ImportStore.putJournal(entry);continue;
      }
      if(entry.operation==='source-reopen'){const rows=(root.state.transactions||[]).filter(tx=>tx.importBatchId===entry.importId&&tx.importTransactionId===entry.rowId);if(rows.length&&rows.every(tx=>tx.processingStatus==='nakijken')){const draft=await ImportStore.getImport(entry.importId);const row=draft?.rows.find(row=>row.id===entry.rowId);if(row){reopenForReview(row);await ImportStore.putImport(draft);}entry.status='completed';}else entry.status='rolled-back';await ImportStore.putJournal(entry);continue;}
      const processed=(root.state?.transactions||[]).some(tx=>tx.importBatchId===entry.importId);
      entry.status=entry.operation==='undo'?!processed?'completed':'rolled-back':processed?'completed':'rolled-back';
      entry.recoveredAt=new Date().toISOString();
      await ImportStore.putJournal(entry);
    }
  }

  async function commitSourceRepair(root,txId,baseBatch,bank,options={}){
    const repairScope=ImportStore.scope,signature=JSON.stringify(root.state),batchSignature=JSON.stringify(baseBatch||null),operationId=uid('source-repair');
    const plan=planSourceRepair(root.state,txId,baseBatch,bank,{...options,operationId,timestamp:new Date().toISOString()});
    const backup=options.backupStore||createStateBackupStore();
    const record=await backup.persist(`${repairScope}:source-repair`,{reason:'Voor bronherstel',state:clone(root.state),importDetails:baseBatch?clone(baseBatch):null},{operationId});
    if(!record?.payload||JSON.stringify(JSON.parse(record.payload).state)!==signature||JSON.stringify(JSON.parse(record.payload).importDetails)!==batchSignature)throw new Error('De herstelback-up kon niet volledig worden teruggelezen. De oorspronkelijke toestand is behouden.');
    const current=await ImportStore.getImport(plan.batch.id);
    if(ImportStore.scope!==repairScope||JSON.stringify(root.state)!==signature||JSON.stringify(current||null)!==batchSignature)throw new Error('De transactie of import is intussen gewijzigd. Heropen de actuele stand; de herstelkeuze overschrijft geen nieuwere gegevens.');
    const previousQueue=(await ImportStore.listSync()).find(row=>row.importId===plan.batch.id);
    const journal={id:operationId,importId:plan.batch.id,operation:'import-command',status:'pending',intent:{type:'source-repair',operationId,backupId:record.id},baseSignature:signature,candidate:plan.state,batch:plan.batch,previousBatch:baseBatch?clone(baseBatch):null};
    await ImportStore.putJournal(journal);
    if(ImportStore.scope!==repairScope||JSON.stringify(root.state)!==signature)throw new Error('De financiële toestand wijzigde tijdens herstel. Probeer opnieuw op de actuele stand.');
    let detailsWritten=false;
    try{
      await ImportStore.putImport(plan.batch);detailsWritten=true;await queueImportSync(plan.batch);
      if(ImportStore.scope!==repairScope||JSON.stringify(root.state)!==signature)throw new Error('De financiële toestand wijzigde tijdens opslag van het herstel.');
      if(!root.commitChange(()=>applyFinancialCandidate(root.state,plan.state),{render:false,mutationMode:'correction'}))throw new Error('Het herstel kon niet worden opgeslagen.');
    }catch(error){if(ImportStore.scope===repairScope){if(detailsWritten)await ImportStore.rollbackImport(plan.batch,baseBatch,previousQueue);journal.status='rolled-back';await ImportStore.putJournal(journal);}throw error;}
    journal.status='completed';delete journal.candidate;delete journal.previousBatch;delete journal.baseSignature;await ImportStore.putJournal(journal);flushImportSync(root).catch(()=>{});return plan;
  }
  async function openTransactionSource(root,txId){
    const tx=(root.state.transactions||[]).find(row=>row.id===txId);if(!tx)throw new Error('De oorspronkelijke banktransactie ontbreekt.');
    const source=tx.bankSourceId?(root.state.transactions||[]).find(row=>isBankSource(row)&&row.bankSourceId===tx.bankSourceId):tx;
    const live=source?.importReferences?.find(ref=>(root.state.importSummaries||[]).some(batch=>batch.id===ref.batchId&&batch.lifecycle!=='withdrawn'));
    const batchId=live?.batchId||tx.importBatchId,rowId=live?.rowId||tx.importTransactionId;
    let batch=batchId?await ImportStore.getImport(batchId):null;
    if(!batch&&batchId){try{batch=await fetchImportFromCloud(root,batchId);}catch{}}
    const check=inspectSourceAvailability(root.state,{...tx,importBatchId:batchId,importTransactionId:rowId},batch);
    if(check.ok){
      const draft=await openDraft(root,batchId),modal=ensureModalRoot();
      const row=findDraftRowElement(modal,rowId);
      if(row){const section=row.closest('details.u4-section');if(section)section.open=true;const details=row.querySelector('details');if(details)details.open=true;row.scrollIntoView({block:'nearest'});}
      return draft;
    }
    const modal=ensureModalRoot();modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><h2>Oorspronkelijke bron herstellen</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body"><p>${check.issues.map(esc).join(' ')}</p><p>Je goedgekeurde verwerking blijft behouden. Kies de oorspronkelijke CSV om een bronkoppeling voor te stellen.</p><label>Oorspronkelijke CSV<input type="file" accept=".csv,text/csv" data-u4-repair-file></label><div data-u4-repair-result role="status"></div></main></div>`;modal.classList.add('open');modal.querySelector('[data-u4-close]').onclick=closeDraft;
    const baseSignature=JSON.stringify(root.state);
    modal.querySelector('[data-u4-repair-file]').onchange=async event=>{
      const result=modal.querySelector('[data-u4-repair-result]');
      try{
        const file=event.target.files?.[0];if(!file)return;const text=await file.text(),parsed=parseBankCsv(text),matches=sourceRepairCandidates(root.state,tx,parsed.rows);
        if(!matches.length)throw new Error('Geen passende bankregel gevonden met dezelfde rekening, oorspronkelijke datum en hetzelfde bedrag. Controleer of dit de juiste oorspronkelijke CSV is.');
        result.innerHTML=`<p>Controleer en bevestig de juiste bankregel. Een gelijk bedrag en dezelfde datum vormen op zichzelf geen bewijs.</p>${matches.map((bank,index)=>`<button type="button" class="ghost" data-u4-repair-match="${index}">${esc(bank.bankDate)} · ${euro(bank.amount)} · ${esc(bank.description)} · ${esc(bank.accountIdentifier)} · regel ${bank.lineNumber}</button>`).join('')}`;
        result.querySelectorAll('[data-u4-repair-match]').forEach(button=>button.onclick=async()=>{
          try{if(JSON.stringify(root.state)!==baseSignature)throw new Error('De transactie is intussen gewijzigd. Sluit herstel en open de actuele transactie.');const bank=matches[Number(button.dataset.u4RepairMatch)],index=parsed.rows.indexOf(bank);const repaired=await commitSourceRepair(root,tx.id,batch,bank,{confirmed:true,sourceIdentityProof:{kind:'file-row',fileDigest:csvFileDigest(text),rowOrdinal:index+1}});await openDraft(root,repaired.batch.id);root.renderActiveTab();}
          catch(error){result.textContent=error.message;}
        });
      }catch(error){result.textContent=error.message;}
    };
  }
  function install(root){
    if(!root?.state)return;
    ImportStore.setScope(root.CloudAdapter?.importScope?.()||'legacy');ImportStore.legacyReferences=new Set((root.state.importSummaries||[]).map(row=>String(row.id)));
    root.FinizeImportSync={get pendingDiagnostics(){return clone(ImportPerformance.syncDiagnostics);},onCloudAccepted:async()=>{if(root.CloudAdapter?.conflict)return;const queued=await ImportStore.listSync();if(queued.length)flushImportSync(root);},beforeInitialRemote:remote=>preservePendingImportsBeforeRemote(root,remote),prepareCloudSnapshot:snapshot=>stageImportCloudWrites(root,snapshot),setScope:()=>{ImportStore.setScope(root.CloudAdapter?.importScope?.()||'legacy');ImportStore.legacyReferences=new Set((root.state.importSummaries||[]).map(row=>String(row.id)));},findConflicts:findImportConflicts,preserveConflict:(local,remote,conflicts)=>preserveImportConflict(root,local,remote,conflicts),refresh:()=>{const session=UI.draft&&ImportEditors.get(String(UI.draft.id));if(UI.draft&&!session?.revision&&!session?.committing&&!ImportPerformance.pending.has(UI.draft.id)&&!ImportPerformance.chains.has(UI.draft.id))openDraft(root,UI.draft.id);}};
    // The core load route has already migrated and validated the complete state.
    const validation=validateCore(root.state);
    if(!validation.ok){console.error('Update 4 migratie ongeldig',validation.errors);return;}
    // Import installation is read-only: it must not perform a second migration/write.
    root.FinizeUpdate4=Object.freeze({
      schemaVersion:SCHEMA_VERSION,
      normalize:candidate=>root.migrateBudgetState(candidate),
      validate:candidate=>validateCore(candidate),
      getTransactionAccountContext,getTransactionSource,getTransactionProcessingStatus,isTransactionFinanciallyActive,getTransactionOriginalBankData,
      normalizeIban,
      chunkRows,
      rowsChecksum,
      buildCloudImportEnvelope,
      assembleCloudImport,
      classifyCloudError,
      fetchImportFromCloud,
      resolveImportDetails,
      reconcileActiveImportReference,
      discardImportConcept,
      openTransactionSource:id=>openTransactionSource(root,id),
      openImportDetails:async(id,rowId='')=>{const draft=await openDraft(root,id);if(rowId){const modal=ensureModalRoot(),row=[...modal.querySelectorAll('[data-u4-row]')].find(node=>node.dataset.u4Row===rowId);if(row){row.closest('.u4-section')?.setAttribute('open','');row.scrollIntoView({block:'center'});}}return draft;},
      parseBankCsv,
      createImportDraft,
      fingerprint,
      classifyOriginal,
      fixedRecognition,
      transactionFamily,
      applyTransactionFamily,
      learnedRecognitionRules,
      validateDraft,
      planImportEffects,
      planImportCommand,
      resolveConflict:(id,choice)=>resolveImportConflict(root,id,choice),
      batchCommand:(id,type)=>ImportStore.getImport(id).then(draft=>commitImportCommand(root,draft,{type})),
      undoImportEffects,
      directionalBalances,
      proposeRepaymentAllocations,
      calculateGoalSavedAmount:(goalId,candidate=root.state)=>calculateGoalSavedAmount(candidate,goalId),
      importStore:ImportStore
    });
    installUI(root);
    if(!root.__finizeUpdate4CloudListener){
      root.__finizeUpdate4CloudListener=true;
      root.addEventListener?.('finize:cloud-connected',()=>recoverJournal(root).then(()=>flushImportSync(root)).catch(error=>console.warn('Importsynchronisatie uitgesteld.',error)));
    }
    Promise.resolve()
      .then(async()=>{for(const entry of await ImportStore.listJournal())if(entry.status==='conflict'&&entry.operation==='conflict')UI.conflicts.set(entry.importId,entry);await recoverJournal(root);})
      .then(()=>reconcileActiveImportReference(root))
      .then(()=>ImportStore.listImports())
      .catch(error=>console.warn('Update 4 opslaginitialisatie uitgesteld.',error))
      .finally(()=>{
        if(root.__finizeBootstrap)root.__finizeBootstrap.update4Ready=true;
        root.__finizeMaybeFinishBootstrap?.();
        flushImportSync(root).catch(error=>console.warn('Importsynchronisatie uitgesteld.',error));
      });
  }

  return {inspectSourceAvailability,sourceRepairCandidates,planSourceRepair,commitSourceRepair,openTransactionSource,addProcessingSplit,removeProcessingSplit,redistributeProcessing,splitDifference,getTransactionAccountContext,getTransactionSource,getTransactionProcessingStatus,isTransactionFinanciallyActive,getTransactionOriginalBankData,beginImportEditor,persistLocalImportEditor,commitImportEditor,setProcessingType,selectFixedOccurrence,SCHEMA_VERSION,CLOUD_STORAGE_VERSION,CLOUD_READ_CONCURRENCY,OWNERS,IMPORT_STATUSES,normalizeIban,normalizeRule,normalizeTransaction,normalizeCore,validateCore,calculateGoalSavedAmount,reconcileGoalSavedAmounts,chunkRows,canonicalValue,rowsChecksum,buildCloudImportEnvelope,assembleCloudImport,mapWithConcurrency,classifyCloudError,fetchImportFromCloud,resolveImportDetails,reconcileActiveImportReference,deleteCloudImportBestEffort,discardImportConcept,rowProcessingValidation,reopenStoredSource,approveStoredSource,normalizeText,matchIdentity,matchCandidates,detectDelimiter,parseDelimited,parseDate,parseAmount,detectFormat,inferMapping,hashText,fingerprint,organizationName,proposeType,recognitionProposal,fixedAmountAt,fixedRecognition,isExplicitlyApproved,importReviewState,markExplicitlyApproved,classifyOriginal,parseBankCsv,findProfile,createImportDraft,updateDraftSummary,compactSummary,validateDraft,transactionKind,expenseImpact,financialRows,advanceForTransaction,savingsForTransaction,detectInternalPairs,directionalBalances,proposeRepaymentAllocations,planImportCommand,commitImportCommand,deriveBatchReviewStatus,stageImportCloudWrites,preserveImportConflict,resolveImportConflict,preservePendingImportsBeforeRemote,planImportEffects,applyImportPlan,learnedRecognitionRules,rememberRecognitionRules,effectManifest,undoImportEffects,transactionFamily,applyTransactionFamily,ImportStore,persistImportDraft,scheduleImportDraftPersist,flushScheduledImportDraft,queueImportSync,flushImportSync,recoverJournal,install,round2,uid,clone,testRenderDraftModal:renderDraftModal};
});

const FinizeImportRuntime=globalThis.FinizeUpdate4Runtime;
export { FinizeImportRuntime };
