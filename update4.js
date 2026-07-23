(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.FinizeUpdate4Runtime=api;
    api.install(root);
  }
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=5;
  const DB_NAME='finize-imports-v1';
  const DB_VERSION=1;
  const IMPORT_STORE='imports';
  const JOURNAL_STORE='journal';
  const SYNC_STORE='syncQueue';
  const OWNERS=['gezamenlijk','dion','dara'];
  const IMPORT_STATUSES=['concept','verwerkt','teruggedraaid','correctie-nodig'];

  function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function round2(value){return Math.round((Number(value)+Number.EPSILON)*100)/100;}
  function normalizeIban(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function validOwner(value){return OWNERS.includes(value)?value:'gezamenlijk';}
  function uid(prefix='u4'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;}

  function normalizeRule(rule,index=0){
    const next={
      id:String(rule?.id||`u4-rule-${index}`),
      enabled:rule?.enabled!==false,
      level:['counterparty','description','organization','keyword','prediction'].includes(rule?.level)?rule.level:(rule?.counterparty?'counterparty':'description'),
      value:String(rule?.value||rule?.counterparty||rule?.text||rule?.match||'').trim(),
      category:String(rule?.category||'Ongecategoriseerd'),
      transactionType:String(rule?.transactionType||rule?.kind||'uitgave'),
      budgetItemId:String(rule?.budgetItemId||''),
      fixedExpenseId:String(rule?.fixedExpenseId||''),
      savingsGoalId:String(rule?.savingsGoalId||''),
      alwaysReview:rule?.alwaysReview===true,
      updatedAt:String(rule?.updatedAt||new Date(0).toISOString())
    };
    return next;
  }

  function normalizeTransaction(tx){
    if(!plain(tx))return tx;
    const accountOwner=validOwner(tx.accountOwner||tx.account||tx.owner);
    const budgetOwner=validOwner(tx.budgetOwner||tx.processing?.budgetOwner||tx.financialFor||tx.owner||accountOwner);
    tx.accountOwner=accountOwner;
    tx.budgetOwner=budgetOwner;
    tx.account=accountOwner;
    tx.financialFor=budgetOwner;
    tx.owner=budgetOwner;
    if(tx.bankOriginal){
      tx.bankOriginal.accountIdentifier=normalizeIban(tx.bankOriginal.accountIdentifier);
      tx.bankOriginal.counterpartyAccount=normalizeIban(tx.bankOriginal.counterpartyAccount);
    }
    if(tx.processing){
      tx.processing.budgetOwner=budgetOwner;
      tx.processing.processedAmount=round2(tx.processing.processedAmount??tx.amount??0);
      tx.processing.processingDate=tx.processing.processingDate||tx.date||'';
    }
    return tx;
  }

  function normalizeCore(candidate){
    const target=candidate||{};
    target.meta=plain(target.meta)?target.meta:{};
    target.accountProfiles=Array.isArray(target.accountProfiles)?target.accountProfiles.filter(plain):[];
    target.accountProfiles=target.accountProfiles.map((profile,index)=>({
      id:String(profile.id||`account-${index}`),
      name:String(profile.name||profile.rekeningnaam||'Rekening'),
      identifier:normalizeIban(profile.identifier||profile.iban),
      bank:String(profile.bank||'ING'),
      csvFormat:String(profile.csvFormat||'ing'),
      accountOwner:validOwner(profile.accountOwner||profile.owner),
      createdAt:String(profile.createdAt||new Date(0).toISOString()),
      updatedAt:String(profile.updatedAt||new Date(0).toISOString())
    }));
    target.importSummaries=Array.isArray(target.importSummaries)?target.importSummaries.filter(plain):[];
    target.importSummaries.forEach(summary=>{
      summary.status=IMPORT_STATUSES.includes(summary.status)?summary.status:'concept';
      summary.id=String(summary.id||uid('import'));
    });
    target.activeImportId=String(target.activeImportId||'');
    target.savingsGoalLedger=Array.isArray(target.savingsGoalLedger)?target.savingsGoalLedger.filter(plain):[];
    target.manualTransactionReplacements=Array.isArray(target.manualTransactionReplacements)?target.manualTransactionReplacements.filter(plain):[];
    target.actualIncomeOverrides=plain(target.actualIncomeOverrides)?target.actualIncomeOverrides:{};
    target.recognitionRules=(Array.isArray(target.recognitionRules)?target.recognitionRules:[]).map(normalizeRule).filter(rule=>rule.value);
    target.transactions=Array.isArray(target.transactions)?target.transactions:[];
    target.transactions.forEach(normalizeTransaction);
    target.meta.schemaVersion=SCHEMA_VERSION;
    return target;
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
    dbPromise:null,
    open(){
      if(this.dbPromise)return this.dbPromise;
      this.dbPromise=new Promise((resolve,reject)=>{
        if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is niet beschikbaar.'));return;}
        const request=indexedDB.open(DB_NAME,DB_VERSION);
        request.onupgradeneeded=()=>{
          const db=request.result;
          if(!db.objectStoreNames.contains(IMPORT_STORE))db.createObjectStore(IMPORT_STORE,{keyPath:'id'});
          if(!db.objectStoreNames.contains(JOURNAL_STORE))db.createObjectStore(JOURNAL_STORE,{keyPath:'id'});
          if(!db.objectStoreNames.contains(SYNC_STORE))db.createObjectStore(SYNC_STORE,{keyPath:'id'});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error('Importopslag openen mislukt.'));
      });
      return this.dbPromise;
    },
    async request(storeName,mode,action){
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,mode);
        const store=tx.objectStore(storeName);
        let request;
        try{request=action(store);}
        catch(error){reject(error);return;}
        if(request){
          request.onsuccess=()=>resolve(request.result);
          request.onerror=()=>reject(request.error||new Error('Importopslagactie mislukt.'));
        }else tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Importopslagtransactie mislukt.'));
        tx.onabort=()=>reject(tx.error||new Error('Importopslagtransactie afgebroken.'));
      });
    },
    putImport(record){return this.request(IMPORT_STORE,'readwrite',store=>store.put(clone(record)));},
    getImport(id){return this.request(IMPORT_STORE,'readonly',store=>store.get(String(id)));},
    deleteImport(id){return this.request(IMPORT_STORE,'readwrite',store=>store.delete(String(id)));},
    listImports(){return this.request(IMPORT_STORE,'readonly',store=>store.getAll());},
    putJournal(record){return this.request(JOURNAL_STORE,'readwrite',store=>store.put(clone(record)));},
    getJournal(id){return this.request(JOURNAL_STORE,'readonly',store=>store.get(String(id)));},
    listJournal(){return this.request(JOURNAL_STORE,'readonly',store=>store.getAll());},
    putSync(record){return this.request(SYNC_STORE,'readwrite',store=>store.put(clone(record)));},
    deleteSync(id){return this.request(SYNC_STORE,'readwrite',store=>store.delete(String(id)));},
    listSync(){return this.request(SYNC_STORE,'readonly',store=>store.getAll())}
  };

  function chunkRows(rows,maxBytes=700000){
    const chunks=[];let current=[];let bytes=2;
    (rows||[]).forEach(row=>{
      const size=JSON.stringify(row).length+1;
      if(current.length&&(bytes+size>maxBytes||current.length>=200)){chunks.push(current);current=[];bytes=2;}
      current.push(row);bytes+=size;
    });
    if(current.length)chunks.push(current);
    return chunks;
  }

  async function queueImportSync(record){
    await ImportStore.putSync({id:record.id,importId:record.id,queuedAt:new Date().toISOString(),attempts:0});
  }

  async function flushImportSync(root){
    const cloud=root.CloudAdapter;
    if(!cloud?.isConnected?.()||!cloud.modules?.firestore||!cloud.db)return false;
    const firestore=cloud.modules.firestore;
    for(const item of await ImportStore.listSync()){
      const record=await ImportStore.getImport(item.importId);
      if(!record){await ImportStore.deleteSync(item.id);continue;}
      try{
        const chunks=chunkRows(record.rows||[]);
        const header={...record,rows:undefined,rowCount:(record.rows||[]).length,chunkCount:chunks.length,syncedAt:new Date().toISOString()};
        const importRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',record.id);
        await firestore.setDoc(importRef,header,{merge:true});
        for(let index=0;index<chunks.length;index++){
          const chunkRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',record.id,'chunks',String(index).padStart(4,'0'));
          await firestore.setDoc(chunkRef,{index,rows:chunks[index]},{merge:false});
        }
        await ImportStore.deleteSync(item.id);
      }catch(error){
        item.attempts=(item.attempts||0)+1;item.lastError=String(error?.message||error);item.updatedAt=new Date().toISOString();
        await ImportStore.putSync(item);
        return false;
      }
    }
    return true;
  }

  async function recoverJournal(root){
    const entries=await ImportStore.listJournal();
    for(const entry of entries.filter(item=>item.status==='pending')){
      const processed=(root.state?.transactions||[]).some(tx=>tx.importBatchId===entry.importId);
      entry.status=processed?'completed':'rolled-back';
      entry.recoveredAt=new Date().toISOString();
      await ImportStore.putJournal(entry);
    }
  }

  function install(root){
    if(!root?.state)return;
    normalizeCore(root.state);
    const validation=validateCore(root.state);
    if(!validation.ok){console.error('Update 4 migratie ongeldig',validation.errors);return;}
    try{
      if(typeof root.localSave==='function')root.localSave(root.state);
    }catch(error){console.error('Update 4 lokale migratie opslaan mislukt',error);}
    root.FinizeUpdate4=Object.freeze({
      schemaVersion:SCHEMA_VERSION,
      normalize:candidate=>normalizeCore(clone(candidate)),
      validate:candidate=>validateCore(candidate),
      normalizeIban,
      chunkRows,
      importStore:ImportStore
    });
    Promise.resolve().then(()=>recoverJournal(root)).then(()=>flushImportSync(root)).catch(error=>console.warn('Update 4 opslaginitialisatie uitgesteld.',error));
  }

  return {SCHEMA_VERSION,OWNERS,IMPORT_STATUSES,normalizeIban,normalizeRule,normalizeTransaction,normalizeCore,validateCore,chunkRows,ImportStore,queueImportSync,flushImportSync,recoverJournal,install,round2,uid,clone};
});

