(function(root,factory){
  const api=factory();
  root.FinizeUpdate4Runtime=api;
  api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=9;
  const DB_NAME='finize-imports-v1';
  const DB_VERSION=1;
  const IMPORT_STORE='imports';
  const JOURNAL_STORE='journal';
  const SYNC_STORE='syncQueue';
  const CLOUD_STORAGE_VERSION=2;
  const CLOUD_READ_CONCURRENCY=4;
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

  function allGoals(state){
    return OWNERS.flatMap(owner=>(state?.spaardoelen?.[owner]||[]).map(goal=>({owner,goal})));
  }
  function contributionAmount(entry){
    if(entry?.active===false||['geannuleerd','teruggedraaid'].includes(entry?.status))return 0;
    const value=Number(entry?.effectiveAmount??entry?.amount);
    return Number.isFinite(value)?round2(value):0;
  }
  function calculateGoalSavedAmount(state,goalId){
    return round2((state?.savingsGoalLedger||[]).filter(entry=>entry.goalId===goalId).reduce((sum,entry)=>sum+contributionAmount(entry),0));
  }
  function reconcileGoalSavedAmounts(state,goalIds=null){
    const selected=goalIds?new Set(goalIds):null;
    allGoals(state).forEach(({goal})=>{
      if(selected&&!selected.has(goal.id))return;
      const saved=Math.max(0,calculateGoalSavedAmount(state,goal.id));
      goal.algespaard=round2(saved);
      if(Array.isArray(goal.subdoelen)&&goal.subdoelen.length){
        let remaining=Math.round(saved*100);
        goal.subdoelen.forEach(child=>{
          const capacity=Math.max(0,Math.round((Number(child.doelbedrag)||0)*100));
          const applied=Math.min(capacity,Math.max(0,remaining));
          child.gespaard=round2(applied/100);
          child.voltooid=capacity>0&&applied>=capacity;
          remaining-=applied;
        });
        goal.algespaard=round2(goal.subdoelen.reduce((sum,child)=>sum+(Number(child.gespaard)||0),0));
      }
    });
    return state;
  }
  function normalizeSavingsLedger(target){
    target.savingsGoalLedger=Array.isArray(target.savingsGoalLedger)?target.savingsGoalLedger.filter(plain):[];
    target.savingsGoalLedger=target.savingsGoalLedger.map((entry,index)=>{
      const amount=Number(entry.effectiveAmount??entry.amount??0);
      const actual=Number(entry.actualAmount??entry.amount);
      const month=String(entry.month||'').slice(0,7)||String((target.transactions||[]).find(tx=>tx.id===entry.transactionId)?.date||'').slice(0,7);
      return {
        ...entry,
        id:String(entry.id||`saving-legacy-${index}`),
        goalId:String(entry.goalId||''),
        month,
        plannedAmount:round2(Number(entry.plannedAmount)||0),
        actualAmount:Number.isFinite(actual)?round2(actual):null,
        effectiveAmount:round2(Number.isFinite(amount)?amount:0),
        status:String(entry.status||'uitgevoerd'),
        source:String(entry.source||'bank-import'),
        transactionId:String(entry.transactionId||''),
        active:entry.active!==false,
        createdAt:String(entry.createdAt||new Date(0).toISOString()),
        updatedAt:String(entry.updatedAt||entry.createdAt||new Date(0).toISOString())
      };
    });
    allGoals(target).forEach(({goal})=>{
      const id=`saving-opening-${goal.id}`;
      if(target.savingsGoalLedger.some(entry=>entry.id===id))return;
      const existing=target.savingsGoalLedger.filter(entry=>entry.goalId===goal.id).reduce((sum,entry)=>sum+contributionAmount(entry),0);
      const opening=round2((Number(goal.algespaard)||0)-existing);
      target.savingsGoalLedger.unshift({
        id,goalId:goal.id,month:'',plannedAmount:0,actualAmount:null,effectiveAmount:opening,
        status:'uitgevoerd',source:'legacy-opening',transactionId:'',active:true,
        createdAt:new Date(0).toISOString(),updatedAt:new Date(0).toISOString()
      });
    });
    reconcileGoalSavedAmounts(target);
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
    normalizeSavingsLedger(target);
    target.manualTransactionReplacements=Array.isArray(target.manualTransactionReplacements)?target.manualTransactionReplacements.filter(plain):[];
    target.internalTransferPairs=Array.isArray(target.internalTransferPairs)?target.internalTransferPairs.filter(plain):[];
    target.advanceRepayments=Array.isArray(target.advanceRepayments)?target.advanceRepayments.filter(plain):[];
    target.actualIncomeOverrides=plain(target.actualIncomeOverrides)?target.actualIncomeOverrides:{};
    target.monthlyIncomeOverrides=plain(target.monthlyIncomeOverrides)?target.monthlyIncomeOverrides:{};
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
    putImport(record){const next=clone(record);delete next.rawText;return this.request(IMPORT_STORE,'readwrite',store=>store.put(next));},
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
    delete header.rawText;
    header.storageVersion=CLOUD_STORAGE_VERSION;
    header.rowCount=rows.length;
    header.chunkCount=chunks.length;
    header.rowsChecksum=rowsChecksum(rows);
    header.syncedAt=new Date().toISOString();
    return {header,chunks:chunks.map((chunk,index)=>({index,rows:clone(chunk)}))};
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
    const importRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(id));
    let headerSnapshot;
    try{headerSnapshot=await firestore.getDoc(importRef);}
    catch(error){throw classifyCloudError(error,'De importheader kon niet worden opgehaald.');}
    if(!headerSnapshot?.exists?.()){
      throw cloudImportError('cloud-missing','Deze import is nog niet vanaf het bronapparaat naar de cloud gesynchroniseerd.');
    }
    const header=headerSnapshot.data();
    const count=Number(header?.chunkCount);
    if(!Number.isInteger(count)||count<0)throw cloudImportError('cloud-invalid','De cloudkopie bevat geen geldige importindeling.');
    const indices=Array.from({length:count},(_,index)=>index);
    const chunks=await mapWithConcurrency(indices,CLOUD_READ_CONCURRENCY,async index=>{
      const chunkRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(id),'chunks',String(index).padStart(4,'0'));
      let snapshot;
      try{snapshot=await firestore.getDoc(chunkRef);}
      catch(error){throw classifyCloudError(error,`Importdeel ${index+1} van ${count} kon niet worden opgehaald.`);}
      if(!snapshot?.exists?.())throw cloudImportError('cloud-incomplete',`Importdeel ${index+1} van ${count} ontbreekt in de cloud.`);
      return snapshot.data();
    });
    return assembleCloudImport(header,chunks,id);
  }

  async function resolveImportDetails(id,{localRead,cloudRead,localWrite}){
    const local=await localRead(String(id));
    if(local)return {record:local,source:'local'};
    const cloud=await cloudRead(String(id));
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
    if(match)return `${match[1]}-${match[2]}-${match[3]}`;
    match=text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if(!match)return '';
    return `${match[3].length===2?'20'+match[3]:match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
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
    date:['datum','date','boekdatum','transactiedatum','rentedatum'],
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
      .replace(/\b\d{3,}\b/g,'').trim();
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

  function classifyOriginal(original,profile,rules=[],profiles=[]){
    const type=proposeType(original,profiles);
    const proposal=recognitionProposal(original,rules);
    const special=!['uitgave'].includes(type);
    const strong=proposal&&['counterparty','description','organization'].includes(proposal.level);
    const category=proposal?.rule?.category||'Ongecategoriseerd';
    const alwaysReview=proposal?.rules?.some(rule=>rule.alwaysReview)===true;
    const review=!profile||special||!strong||proposal?.conflict||alwaysReview||category==='Ongecategoriseerd'||!!proposal?.rule?.fixedExpenseId||!!proposal?.rule?.savingsGoalId;
    return {
      certainty:review?'nakijken':'zeker',
      reasons:[
        !profile?'rekeningprofiel ontbreekt':'',
        special?`bijzonder type: ${type}`:'',
        proposal?.conflict?'conflicterende herkenningsregels':'',
        !proposal?'geen herkenningsregel':'',
        category==='Ongecategoriseerd'?'categorie onbekend':'',
        alwaysReview?'regel staat op altijd nakijken':''
      ].filter(Boolean),
      processing:{
        processingDate:original.bankDate,
        processedAmount:round2(Math.abs(Number(original.amount)||0)),
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
        bankDate:parseDate(cells[mapping.date]),
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

  function createImportDraft({text,fileName='import.csv',profiles=[],rules=[],transactions=[],id=uid('import')}){
    const parsed=parseBankCsv(text);
    const profile=findProfile(parsed,profiles);
    const existingFingerprints=new Set((transactions||[]).map(tx=>tx.bankOriginal?.fingerprint).filter(Boolean));
    const rows=parsed.rows.map((original,index)=>{
      original.importBatchId=id;
      original.importTransactionId=`${id}-${String(index+1).padStart(5,'0')}`;
      original.fingerprint=fingerprint(original,profile?.id||original.accountIdentifier);
      const duplicate=existingFingerprints.has(original.fingerprint);
      const proposal=classifyOriginal(original,profile,rules,profiles);
      return {id:original.importTransactionId,bankOriginal:original,accountProfileId:profile?.id||'',accountOwner:profile?.accountOwner||'',duplicate,...proposal};
    });
    const active=rows.filter(row=>row.bankOriginal.valid&&!row.duplicate);
    const dates=active.map(row=>row.bankOriginal.bankDate).sort();
    const income=active.filter(row=>row.bankOriginal.amount>0).reduce((sum,row)=>sum+row.processing.processedAmount,0);
    const expenses=active.filter(row=>row.bankOriginal.amount<0).reduce((sum,row)=>sum+row.processing.processedAmount,0);
    return {
      id,fileName,bank:parsed.format==='ing'?'ING':'Onbekend',format:parsed.format,headers:parsed.headers,mapping:parsed.mapping,
      accountProfileId:profile?.id||'',accountOwner:profile?.accountOwner||'',status:'concept',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      periodFrom:dates[0]||'',periodTo:dates[dates.length-1]||'',rows,
      summary:{newCount:active.length,duplicateCount:rows.filter(row=>row.duplicate).length,totalIncome:round2(income),totalExpenses:round2(expenses),sureCount:active.filter(row=>row.certainty==='zeker').length,reviewCount:active.filter(row=>row.certainty==='nakijken').length}
    };
  }

  const UI={draft:null,visibleRows:60,root:null};
  const ImportPerformance={pending:new Map(),chains:new Map(),syncPromise:null,syncRequested:false};
  function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function escAttr(value){return esc(value).replace(/`/g,'&#96;').replace(/[\u0000-\u001f\u007f]/g,'');}
  function euro(value){return new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value)||0);}
  function ownerLabel(value){return value==='gezamenlijk'?'Gezamenlijk':value==='dara'?'Dara':'Dion';}
  function option(value,label,current){return `<option value="${escAttr(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;}
  function updateDraftSummary(draft){
    const active=(draft.rows||[]).filter(row=>row.bankOriginal?.valid&&!row.duplicate);
    draft.summary={
      newCount:active.length,
      duplicateCount:(draft.rows||[]).filter(row=>row.duplicate).length,
      totalIncome:round2(active.filter(row=>row.bankOriginal.amount>0&&row.processing.include).reduce((sum,row)=>sum+Number(row.processing.processedAmount||0),0)),
      totalExpenses:round2(active.filter(row=>row.bankOriginal.amount<0&&row.processing.include).reduce((sum,row)=>sum+Number(row.processing.processedAmount||0),0)),
      sureCount:active.filter(row=>row.certainty==='zeker').length,
      reviewCount:active.filter(row=>row.certainty==='nakijken').length,
      uncategorizedCount:active.filter(row=>row.processing.category==='Ongecategoriseerd').length
    };
    draft.updatedAt=new Date().toISOString();
    return draft.summary;
  }
  function compactSummary(draft){
    updateDraftSummary(draft);
    return {
      id:draft.id,fileName:draft.fileName,accountProfileId:draft.accountProfileId,bank:draft.bank,status:draft.status,
      importDate:draft.createdAt,periodFrom:draft.periodFrom,periodTo:draft.periodTo,
      newCount:draft.summary.newCount,duplicateCount:draft.summary.duplicateCount,uncategorizedCount:draft.summary.uncategorizedCount||0,
      totalIncome:draft.summary.totalIncome,totalExpenses:draft.summary.totalExpenses,updatedAt:draft.updatedAt
    };
  }
  function commitSummary(root,draft){
    const summary=compactSummary(draft);
    const ok=root.commitChange(()=>{
      root.state.importSummaries=root.state.importSummaries||[];
      const index=root.state.importSummaries.findIndex(item=>item.id===summary.id);
      if(index>=0)root.state.importSummaries[index]=summary;else root.state.importSummaries.unshift(summary);
      root.state.activeImportId=draft.status==='concept'?draft.id:(root.state.activeImportId===draft.id?'':root.state.activeImportId);
    },{render:false});
    if(!ok)throw new Error('Importsamenvatting kon niet worden opgeslagen.');
  }
  function updateImportSaveStatus(text,error=false){
    const status=document.querySelector('#u4ImportModalRoot [data-u4-save-status]');
    if(!status)return;
    status.textContent=text;
    status.classList.toggle('u4-error',Boolean(error));
  }
  function persistImportDraftImmediate(root,draft,{syncCloud=true,updateSummary=true}={}){
    if(!plain(draft)||!draft.id)return Promise.reject(new Error('Importconcept mist een geldig ID.'));
    const id=String(draft.id);
    const previous=ImportPerformance.chains.get(id)||Promise.resolve();
    const operation=previous.catch(()=>{}).then(async()=>{
      if(updateSummary)updateDraftSummary(draft);
      else draft.updatedAt=new Date().toISOString();
      await ImportStore.putImport(draft);
      commitSummary(root,draft);
      if(syncCloud){
        await queueImportSync(draft);
        flushImportSync(root).catch(error=>console.warn('Importsynchronisatie wordt later opnieuw geprobeerd.',error));
      }
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
      const importRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(id));
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
          firestore.doc(cloud.db,'budgetPlanners','finize','imports',String(id),'chunks',String(index).padStart(4,'0'))
        ));
      }
      await firestore.deleteDoc(importRef);
      return true;
    }catch(error){
      console.warn('Cloudkopie van verwijderd importconcept kon niet worden opgeruimd.',classifyCloudError(error,'Cloudopschoning mislukt.'));
      return false;
    }
  }

  async function discardImportConcept(root,id,{cleanupCloud=true}={}){
    const importId=String(id||'');
    const summary=(root?.state?.importSummaries||[]).find(item=>String(item.id)===importId);
    if(!importId||String(root?.state?.activeImportId||'')!==importId||summary?.status!=='concept'){
      throw new Error('Alleen het actieve, onverwerkte importconcept kan worden verwijderd.');
    }
    let local=null;
    try{local=await ImportStore.getImport(importId);}
    catch(error){console.warn('Lokaal importconcept kon niet worden gelezen voor verwijdering.',error);}
    const journal={id:`discard-${importId}`,operation:'discard',importId,status:'pending',createdAt:new Date().toISOString()};
    await ImportStore.putJournal(journal);
    const ok=root.commitChange(()=>{
      root.state.importSummaries=(root.state.importSummaries||[]).filter(item=>String(item.id)!==importId);
      if(root.state.activeImportId===importId)root.state.activeImportId='';
    },{render:false});
    if(!ok){
      journal.status='rolled-back';journal.updatedAt=new Date().toISOString();await ImportStore.putJournal(journal);
      throw new Error('Het importconcept is niet verwijderd; de bestaande gegevens zijn behouden.');
    }
    let localCleanup=true;
    try{
      await ImportStore.deleteImport(importId);
      await ImportStore.deleteSync(importId);
    }catch(error){
      localCleanup=false;journal.localCleanupError=String(error?.message||error);
    }
    const cloudCleanup=cleanupCloud?await deleteCloudImportBestEffort(root,importId,local):false;
    if(UI.draft?.id===importId)UI.draft=null;
    journal.status=localCleanup?'completed':'pending';
    if(localCleanup)journal.completedAt=new Date().toISOString();
    journal.localCleanup=localCleanup;journal.cloudCleanup=cloudCleanup;
    await ImportStore.putJournal(journal);
    root.renderActiveTab?.();
    return {ok:true,localCleanup,cloudCleanup};
  }
  function goalExists(state,id){
    if(!id)return true;
    return OWNERS.some(owner=>(state.spaardoelen?.[owner]||[]).some(goal=>goal.id===id));
  }
  function fixedExists(state,id){
    if(!id)return true;
    return ['voor','na'].some(scenario=>(state.recurringFixedExpenses?.[scenario]||[]).some(item=>item.id===id));
  }
  function findFixedItem(state,id){
    for(const scenario of ['voor','na']){
      const item=(state.recurringFixedExpenses?.[scenario]||[]).find(row=>row.id===id);
      if(item)return {scenario,item};
    }
    return null;
  }
  function validateDraft(draft,state){
    const errors=[];
    const profile=(state.accountProfiles||[]).find(item=>item.id===draft.accountProfileId);
    if(!profile)errors.push({code:'profile',message:'Kies of maak eerst een rekeningprofiel.'});
    (draft.rows||[]).filter(row=>!row.duplicate).forEach(row=>{
      if(!row.bankOriginal?.valid)errors.push({rowId:row.id,code:'original',message:'Originele bankregel mist datum, omschrijving of bedrag.'});
      const p=row.processing||{};
      if(!parseDate(p.processingDate))errors.push({rowId:row.id,code:'date',message:'Ongeldige verwerkingsdatum.'});
      if(!Number.isFinite(Number(p.processedAmount)))errors.push({rowId:row.id,code:'amount',message:'Verwerkt bedrag ontbreekt.'});
      if(!OWNERS.includes(p.budgetOwner))errors.push({rowId:row.id,code:'owner',message:'Budgeteigenaar ontbreekt.'});
      if(p.savingsGoalId&&!goalExists(state,p.savingsGoalId))errors.push({rowId:row.id,code:'goal',message:'Het gekozen spaardoel bestaat niet meer.'});
      if(p.fixedExpenseId&&!fixedExists(state,p.fixedExpenseId))errors.push({rowId:row.id,code:'fixed',message:'De gekozen vaste last bestaat niet meer.'});
      const activeSplits=(p.splits||[]).filter(split=>Math.abs(Number(split.amount)||0)>.004);
      if(activeSplits.length){
        const splitTotal=round2(activeSplits.reduce((sum,split)=>sum+Number(split.amount||0),0));
        if(Math.abs(splitTotal-round2(p.processedAmount))>.004)errors.push({rowId:row.id,code:'splits',message:`De splitsregels zijn samen ${euro(splitTotal)}, maar deze transactie is ${euro(p.processedAmount)}. Pas de splitbedragen aan of verwijder de lege splitsregels.`});
        activeSplits.forEach(split=>{
          if(!OWNERS.includes(split.budgetOwner)||!split.category)errors.push({rowId:row.id,code:'split-fields',message:'Iedere splitregel heeft een budgeteigenaar en categorie nodig.'});
          if(split.savingsGoalId&&!goalExists(state,split.savingsGoalId))errors.push({rowId:row.id,code:'split-goal',message:'Een spaardoel in een splitregel bestaat niet meer.'});
        });
      }
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
    if(!include||['salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten','interne-overboeking','naar-spaarrekening','van-spaarrekening','maandelijkse-bijdrage','extra-bijdrage','sparen','terugbetaling-voorschot','terugbetaling','vaste-last'].includes(type))return 0;
    return Math.abs(amount);
  }
  function financialRows(row){
    const p=row.processing;
    const activeSplits=(p.splits||[]).filter(split=>Math.abs(Number(split.amount)||0)>.004);
    if(activeSplits.length)return activeSplits.map((split,index)=>({
      id:`${row.id}-split-${split.id||index+1}`,amount:round2(split.amount),budgetOwner:split.budgetOwner,category:split.category,
      budgetItemId:split.budgetItemId||'',savingsGoalId:split.savingsGoalId||'',advanceMode:split.advanceMode||'auto',include:split.include!==false,splitId:split.id||String(index+1),isFirst:index===0
    }));
    return [{id:`tx-${row.id}`,amount:round2(p.processedAmount),budgetOwner:p.budgetOwner,category:p.category,budgetItemId:p.budgetItemId||'',savingsGoalId:p.savingsGoalId||'',advanceMode:p.advanceMode||'auto',include:p.include!==false,splitId:'',isFirst:true}];
  }
  function advanceForTransaction(tx){
    if(tx.kind==='niet-meetellen'||tx.kind==='interne-overboeking'||tx.processing?.advanceMode==='none'||tx.accountOwner===tx.budgetOwner)return null;
    const incoming=tx.kind==='inkomen';
    const debtor=incoming?tx.accountOwner:tx.budgetOwner;
    const creditor=incoming?tx.budgetOwner:tx.accountOwner;
    return {id:`advance-${tx.id}`,transactionId:tx.id,month:String(tx.date).slice(0,7),debtor,creditor,originalAmount:round2(tx.amount),outstandingAmount:round2(tx.amount),status:'open',createdAt:tx.createdAt,settlementTransferIds:[],repaymentAllocationIds:[]};
  }
  function savingsForTransaction(tx,state){
    if(tx.transactionType!=='sparen'||!tx.savingsGoalId||tx.kind==='niet-meetellen')return null;
    const month=String(tx.date||'').slice(0,7);
    const amount=round2(tx.amount);
    const candidates=(state?.savingsGoalLedger||[]).filter(entry=>
      entry.goalId===tx.savingsGoalId&&entry.month===month&&entry.active!==false&&!entry.transactionId&&
      entry.source==='planned'
    );
    const planned=candidates.find(entry=>Math.abs(Number(entry.plannedAmount||entry.effectiveAmount)-amount)<=.01)||(candidates.length===1?candidates[0]:null);
    return {
      id:`saving-${tx.id}`,transactionId:tx.id,importBatchId:tx.importBatchId,goalId:tx.savingsGoalId,month,
      plannedAmount:0,actualAmount:amount,effectiveAmount:planned?round2(amount-Number(planned.effectiveAmount||0)):amount,
      matchedContributionId:planned?.id||'',status:planned&&Math.abs(amount-Number(planned.plannedAmount||0))>.004?'afwijkend':'uitgevoerd',
      source:planned?'bank-match':'bank-import',active:true,createdAt:tx.createdAt,updatedAt:tx.createdAt
    };
  }
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
    (state.advanceLedger||[]).filter(row=>row.status!=='voldaan'&&Number(row.outstandingAmount)>0&&String(row.month||'')<=throughMonth).forEach(row=>{
      const key=`${row.debtor}|${row.creditor}`;map.set(key,round2((map.get(key)||0)+Number(row.outstandingAmount||0)));
    });
    return [...map.entries()].map(([key,amount])=>{const [debtor,creditor]=key.split('|');return {debtor,creditor,amount};}).filter(row=>row.amount>.004).sort((a,b)=>b.amount-a.amount);
  }
  function proposeRepaymentAllocations(state,debtor,creditor,amount){
    let remaining=round2(amount);const allocations=[];
    (state.advanceLedger||[]).filter(row=>row.debtor===debtor&&row.creditor===creditor&&row.status!=='voldaan'&&Number(row.outstandingAmount)>0).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).forEach(row=>{
      if(remaining<=.004)return;const applied=round2(Math.min(remaining,Number(row.outstandingAmount)||0));
      allocations.push({id:`allocation-${row.id}`,advanceId:row.id,amount:applied});remaining=round2(remaining-applied);
    });
    return allocations;
  }
  function planImportEffects(draft,state){
    const validation=validateDraft(draft,state);
    if(!validation.ok)return {ok:false,errors:validation.errors};
    const profile=state.accountProfiles.find(item=>item.id===draft.accountProfileId);
    const transactions=[];const replacements=[];const savingsEntries=[];const advances=[];const repayments=[];const fixedAdjustments=[];const affectedMonths=new Set();const counts={expenses:0,income:0,internal:0,savings:0,refunds:0,advances:0,uncategorized:0};
    for(const row of draft.rows.filter(item=>item.bankOriginal.valid&&!item.duplicate)){
      const p=row.processing;const type=p.include===false?'niet-meetellen':p.transactionType;
      financialRows(row).forEach(part=>{
        const kind=transactionKind(type,part.include);
        const tx={
          id:part.id,date:p.processingDate,amount:round2(part.amount),description:row.bankOriginal.description,category:part.category||'Ongecategoriseerd',
          kind,transactionType:type,reviewStatus:'bevestigd',accountOwner:profile.accountOwner,budgetOwner:part.budgetOwner,
          account:profile.accountOwner,financialFor:part.budgetOwner,owner:part.budgetOwner,accountProfileId:profile.id,
          importBatchId:draft.id,importTransactionId:row.id,splitId:part.splitId,bankOriginal:clone(row.bankOriginal),
          processing:{...clone(p),processedAmount:part.amount,budgetOwner:part.budgetOwner,category:part.category,budgetItemId:part.budgetItemId,savingsGoalId:part.savingsGoalId,include:part.include},
          expenseImpact:expenseImpact(type,part.amount,part.include),
          accountDelta:part.isFirst?round2(row.bankOriginal.amount):0,
          fixedExpenseId:p.fixedExpenseId||'',fixedOccurrenceId:'',incomeSourceId:p.incomeSourceId||'',incomeOccurrenceId:'',
          savingsGoalId:part.savingsGoalId,note:p.note||'',createdAt:new Date().toISOString()
        };
        transactions.push(tx);affectedMonths.add(String(tx.date).slice(0,7));
        const saving=savingsForTransaction(tx,state);if(saving)savingsEntries.push(saving);
        const advance=advanceForTransaction(tx);if(advance){advances.push(advance);counts.advances++;}
        if(type==='terugbetaling-voorschot'){
          const allocations=p.repaymentAllocations||[];
          allocations.forEach(allocation=>repayments.push({id:`repayment-${tx.id}-${allocation.advanceId}`,transactionId:tx.id,advanceId:allocation.advanceId,amount:round2(allocation.amount),date:tx.date,status:'actief'}));
        }
        if(kind==='inkomen')counts.income++;else if(kind==='interne-overboeking')counts.internal++;else if(kind!=='niet-meetellen')counts.expenses++;
        if(type==='sparen')counts.savings++;if(type==='terugbetaling')counts.refunds++;if(tx.category==='Ongecategoriseerd')counts.uncategorized++;
      });
      if(p.manualMatchId){
        const manual=state.transactions.find(tx=>tx.id===p.manualMatchId&&!tx.importBatchId);
        if(manual)replacements.push({id:`replacement-${draft.id}-${manual.id}`,manualTransaction:clone(manual),replacementTransactionId:transactions.find(tx=>tx.importTransactionId===row.id)?.id||''});
      }
      if(p.fixedExpenseId&&['month','from'].includes(p.fixedAmountMode)){
        const found=findFixedItem(state,p.fixedExpenseId);
        if(found&&!fixedAdjustments.some(item=>item.fixedExpenseId===p.fixedExpenseId&&item.month===String(p.processingDate).slice(0,7))){
          fixedAdjustments.push({
            id:`fixed-adjustment-${draft.id}-${p.fixedExpenseId}-${String(p.processingDate).slice(0,7)}`,
            fixedExpenseId:p.fixedExpenseId,scenario:found.scenario,month:String(p.processingDate).slice(0,7),
            mode:p.fixedAmountMode,amount:round2(p.processedAmount),
            before:{amountHistory:clone(found.item.amountHistory||[]),monthOverrides:clone(found.item.monthOverrides||{})}
          });
        }
      }
    }
    const internalPairs=detectInternalPairs(transactions,state);
    return {ok:true,importId:draft.id,transactions,replacements,savingsEntries,advances,repayments,internalPairs,fixedAdjustments,affectedMonths:[...affectedMonths],counts,duplicateCount:draft.summary.duplicateCount||0,totalIncome:draft.summary.totalIncome,totalExpenses:draft.summary.totalExpenses};
  }
  function findGoal(state,id){
    for(const owner of OWNERS){const goal=(state.spaardoelen?.[owner]||[]).find(item=>item.id===id);if(goal)return goal;}
    return null;
  }
  function applyImportPlan(state,plan){
    const transactionIds=new Set((state.transactions||[]).map(tx=>tx.id));
    plan.transactions.forEach(tx=>{if(!transactionIds.has(tx.id)){state.transactions.push(clone(tx));transactionIds.add(tx.id);}});
    state.manualTransactionReplacements=state.manualTransactionReplacements||[];
    plan.replacements.forEach(replacement=>{
      if(!state.manualTransactionReplacements.some(item=>item.id===replacement.id))state.manualTransactionReplacements.push(clone(replacement));
      state.transactions=state.transactions.filter(tx=>tx.id!==replacement.manualTransaction.id);
    });
    state.savingsGoalLedger=state.savingsGoalLedger||[];
    plan.savingsEntries.forEach(entry=>{
      if(state.savingsGoalLedger.some(item=>item.id===entry.id))return;
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
      state.savingsGoalLedger.push(clone(entry));
    });
    reconcileGoalSavedAmounts(state,plan.savingsEntries.map(entry=>entry.goalId));
    state.advanceLedger=state.advanceLedger||[];
    plan.advances.forEach(entry=>{if(!state.advanceLedger.some(item=>item.id===entry.id))state.advanceLedger.push(clone(entry));});
    state.advanceRepayments=state.advanceRepayments||[];
    plan.repayments.forEach(repayment=>{
      if(state.advanceRepayments.some(item=>item.id===repayment.id))return;
      const advance=state.advanceLedger.find(item=>item.id===repayment.advanceId);if(!advance)return;
      const applied=round2(Math.min(Number(repayment.amount)||0,Number(advance.outstandingAmount)||0));
      advance.outstandingAmount=round2(Number(advance.outstandingAmount||0)-applied);if(advance.outstandingAmount<=.004){advance.outstandingAmount=0;advance.status='voldaan';}
      advance.repaymentAllocationIds=[...new Set([...(advance.repaymentAllocationIds||[]),repayment.id])];
      state.advanceRepayments.push({...clone(repayment),amount:applied});
    });
    state.internalTransferPairs=state.internalTransferPairs||[];
    plan.internalPairs.forEach(pair=>{if(!state.internalTransferPairs.some(item=>item.id===pair.id))state.internalTransferPairs.push(clone(pair));});
    (plan.fixedAdjustments||[]).forEach(adjustment=>{
      const found=findFixedItem(state,adjustment.fixedExpenseId);if(!found)return;
      const item=found.item;item.amountHistory=Array.isArray(item.amountHistory)?item.amountHistory:[];item.monthOverrides=plain(item.monthOverrides)?item.monthOverrides:{};
      if(adjustment.mode==='month')item.monthOverrides[adjustment.month]=adjustment.amount;
      else{
        delete item.monthOverrides[adjustment.month];
        item.amountHistory=item.amountHistory.filter(row=>String(row.effectiveFrom||'').slice(0,7)!==adjustment.month);
        item.amountHistory.push({id:`amount-${item.id}-${adjustment.month}`,effectiveFrom:`${adjustment.month}-01`,amount:adjustment.amount});
      }
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
    if(summary){summary.status=plan.affectedMonths.some(month=>state.monthRecords?.[month]?.status==='correctie-nodig')?'correctie-nodig':'verwerkt';summary.processedAt=new Date().toISOString();summary.counts=clone(plan.counts);}
    if(state.activeImportId===plan.importId)state.activeImportId='';
    return plan;
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
  function undoImportEffects(state,draft){
    const manifest=draft.effectManifest||{};
    const transactionIds=new Set(manifest.transactionIds||[]);
    const savingIds=new Set(manifest.savingIds||[]);
    const advanceIds=new Set(manifest.advanceIds||[]);
    const repaymentIds=new Set(manifest.repaymentIds||[]);
    const pairIds=new Set(manifest.internalPairIds||[]);
    const replacementIds=new Set(manifest.replacementIds||[]);

    state.advanceRepayments=state.advanceRepayments||[];
    state.advanceRepayments.filter(item=>repaymentIds.has(item.id)).forEach(repayment=>{
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
      if(planned){planned.transactionId='';planned.actualAmount=null;planned.status='gepland';planned.updatedAt=new Date().toISOString();}
    });
    state.savingsGoalLedger=state.savingsGoalLedger.filter(item=>!savingIds.has(item.id));
    reconcileGoalSavedAmounts(state,affectedSavingGoals);
    state.advanceLedger=(state.advanceLedger||[]).filter(item=>!advanceIds.has(item.id));
    state.internalTransferPairs=(state.internalTransferPairs||[]).filter(item=>!pairIds.has(item.id));
    (manifest.fixedAdjustments||[]).forEach(adjustment=>{
      const found=findFixedItem(state,adjustment.fixedExpenseId);if(!found)return;
      found.item.amountHistory=clone(adjustment.before?.amountHistory||[]);
      found.item.monthOverrides=clone(adjustment.before?.monthOverrides||{});
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
    if(summary){summary.status='teruggedraaid';summary.undoneAt=new Date().toISOString();summary.updatedAt=summary.undoneAt;}
    if(state.activeImportId===draft.id)state.activeImportId='';
    return state;
  }
  async function undoImport(root,draft){
    if(draft.status==='teruggedraaid')return true;
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
    const working=clone(root.state);
    undoImportEffects(working,draft);
    const plan=planImportEffects(draft,working);
    if(!plan.ok){showValidationErrors(root,draft,plan.errors,'Correctie kan nog niet worden verwerkt');return false;}
    const journal={id:`reconcile-${draft.id}-${Date.now()}`,importId:draft.id,operation:'reconcile',status:'pending',createdAt:new Date().toISOString()};
    await ImportStore.putJournal(journal);
    const ok=root.commitChange(()=>{undoImportEffects(root.state,draft);applyImportPlan(root.state,plan);},{render:false,mutationMode:'correction'});
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
    if(String(error.code).startsWith('split'))target=row.querySelector('[data-u4-split-field="amount"]')||row.querySelector('[data-u4-add-split]');
    else if(error.code==='date')target=row.querySelector('[data-u4-field="processingDate"]');
    else if(error.code==='amount')target=row.querySelector('[data-u4-field="processedAmount"]');
    else if(error.code==='owner')target=row.querySelector('[data-u4-field="budgetOwner"]');
    else if(error.code==='goal')target=row.querySelector('[data-u4-field="savingsGoalId"]');
    else if(error.code==='fixed')target=row.querySelector('[data-u4-field="fixedExpenseId"]');
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
    const plan=planImportEffects(draft,root.state);
    if(!plan.ok){showValidationErrors(root,draft,plan.errors);return false;}
    const journal={id:`process-${draft.id}`,importId:draft.id,status:'pending',createdAt:new Date().toISOString(),transactionIds:plan.transactions.map(tx=>tx.id)};
    await ImportStore.putJournal(journal);
    const ok=root.commitChange(()=>applyImportPlan(root.state,plan),{render:false,mutationMode:'late-import'});
    if(!ok){journal.status='rolled-back';journal.updatedAt=new Date().toISOString();await ImportStore.putJournal(journal);throw new Error('De import is volledig teruggedraaid omdat opslaan mislukte.');}
    draft.status=root.state.importSummaries.find(item=>item.id===draft.id)?.status||'verwerkt';
    draft.processedAt=new Date().toISOString();draft.effectManifest=effectManifest(plan);
    await ImportStore.putImport(draft);await queueImportSync(draft);
    journal.status='completed';journal.completedAt=new Date().toISOString();await ImportStore.putJournal(journal);
    flushImportSync(root).catch(()=>{});
    const modal=ensureModalRoot();modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><h2>Import verwerkt</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body">${processedSummaryHtml(plan)}</main></div>`;modal.querySelector('[data-u4-close]').addEventListener('click',()=>{closeDraft();root.renderActiveTab();});
    return true;
  }
  function renderReceipt(summary){
    return `<article class="u4-receipt" data-u4-open-receipt="${esc(summary.id)}"><div class="u4-receipt-head"><div><strong>${esc(summary.fileName)}</strong><div class="u4-muted">${esc(summary.bank)} · ${esc(summary.periodFrom||'—')} t/m ${esc(summary.periodTo||'—')}</div></div><span class="u4-status ${esc(summary.status)}">${esc(summary.status)}</span></div><div class="u4-muted">${Number(summary.newCount)||0} transacties · ${Number(summary.duplicateCount)||0} duplicaten · ${euro(summary.totalExpenses)} uitgaven</div></article>`;
  }
  function renderImportPanel(root){
    const active=root.state.activeImportId;
    const summaries=(root.state.importSummaries||[]).slice().sort((a,b)=>String(b.updatedAt||b.importDate).localeCompare(String(a.updatedAt||a.importDate)));
    const current=summaries.find(item=>item.id===active);
    return `<div class="u4-import-panel">
      <div class="u4-import-actions">
        <label class="primary">Bank-CSV importeren<input type="file" accept=".csv,text/csv" data-u4-file></label>
        <button type="button" class="ghost small" data-u4-manage-rules>Herkenningsregels</button>
      </div>
      ${current?`<button type="button" class="u4-concept-banner" data-u4-open-concept="${esc(current.id)}"><strong>Bankimport nog niet verwerkt</strong><br>${Number(current.newCount)||0} transacties klaar om te controleren</button>`:'<p class="hint">ING wordt automatisch herkend. Andere CSV-bestanden kunnen via kolomherkenning worden ingelezen.</p>'}
      <div class="u4-import-receipts">${summaries.slice(0,3).map(renderReceipt).join('')||'<div class="u4-empty">Nog geen imports.</div>'}</div>
      ${summaries.length>3?'<button type="button" class="ghost small" data-u4-all-imports>Alle imports bekijken</button>':''}
    </div>`;
  }
  function ensureModalRoot(){
    let modal=document.getElementById('u4ImportModalRoot');
    if(!modal){modal=document.createElement('div');modal.id='u4ImportModalRoot';document.body.appendChild(modal);}
    return modal;
  }
  function categoryOptions(root,owner,current){
    let categories=['Ongecategoriseerd','Overig','Vaste lasten','Boodschappen','Entertainment','Vervoer','Kleding'];
    try{if(typeof root.bankOwnerCategories==='function')categories=['Ongecategoriseerd',...root.bankOwnerCategories(owner)];}catch(_){}
    return [...new Set(categories)].map(value=>option(value,value,current)).join('');
  }
  function goalOptions(root,current){
    const rows=[];
    OWNERS.forEach(owner=>(root.state.spaardoelen?.[owner]||[]).forEach(goal=>rows.push({id:goal.id,label:`${ownerLabel(owner)} · ${goal.naam}`})));
    return `<option value="">Geen spaardoel</option>${rows.map(row=>option(row.id,row.label,current)).join('')}`;
  }
  function fixedOptions(root,current){
    const rows=root.state.recurringFixedExpenses?.[root.state.meta.scenario]||[];
    return `<option value="">Geen vaste last</option>${rows.map(row=>option(row.id,`${ownerLabel(row.financialFor||row.rekening)} · ${row.naam}`,current)).join('')}`;
  }
  const TYPE_GROUPS=[
    {label:'Uitgaven',items:[['uitgave','Gewone uitgave'],['terugbetaling','Terugbetaling aankoop'],['niet-meetellen','Niet meetellen']]},
    {label:'Inkomsten',items:[['salaris','Salaris'],['vakantiegeld','Vakantiegeld'],['nabetaling','Nabetaling'],['vergoeding','Vergoeding'],['belastingteruggave','Belastingteruggave'],['overige-inkomsten','Overige inkomsten']]},
    {label:'Sparen en overboeken',items:[['sparen','Naar spaardoel'],['naar-spaarrekening','Naar spaarrekening'],['van-spaarrekening','Van spaarrekening'],['interne-overboeking','Interne overboeking'],['maandelijkse-bijdrage','Maandelijkse bijdrage'],['extra-bijdrage','Extra bijdrage']]},
    {label:'Correctie en verrekening',items:[['terugbetaling-voorschot','Terugbetaling voorschot']]}
  ];
  const TYPES=TYPE_GROUPS.flatMap(group=>group.items.map(item=>item[0]));
  function typeOptions(current){return TYPE_GROUPS.map(group=>`<optgroup label="${esc(group.label)}">${group.items.map(([value,label])=>option(value,label,current)).join('')}</optgroup>`).join('');}
  function transferType(type){return ['naar-spaarrekening','van-spaarrekening','interne-overboeking'].includes(type);}
  function profileOptions(root,current){return `<option value="">Kies rekening</option>${(root.state.accountProfiles||[]).map(profile=>option(profile.id,`${profile.name} · ${ownerLabel(profile.accountOwner)}`,current)).join('')}`;}
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
    return draft.rows.filter(row=>row!==source&&row.bankOriginal?.valid&&!row.duplicate).map(row=>{
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
  function copiedProcessing(source,target){
    ['budgetOwner','category','transactionType','budgetItemId','fixedExpenseId','fixedAmountMode','savingsGoalId','advanceMode','include','sourceAccountProfileId','destinationAccountProfileId'].forEach(field=>{
      const value=source.processing[field];
      if(value===undefined)delete target.processing[field];
      else target.processing[field]=clone(value);
    });
  }

  function splitHtml(root,row,split,index){
    return `<div class="u4-split-row" data-u4-split="${index}"><input type="number" step="0.01" value="${Number(split.amount)||0}" data-u4-split-field="amount" aria-label="Splitbedrag"><select data-u4-split-field="budgetOwner">${OWNERS.map(owner=>option(owner,ownerLabel(owner),split.budgetOwner)).join('')}</select><select data-u4-split-field="category">${categoryOptions(root,split.budgetOwner,split.category)}</select><button type="button" class="danger-ghost small" data-u4-remove-split="${index}">×</button></div>`;
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
    return `<div class="u4-context-block wide"><strong>Interne overboeking</strong><div class="u4-context-grid"><label>Van rekening<select data-u4-field="sourceAccountProfileId">${profileOptions(root,row.processing.sourceAccountProfileId||'')}</select></label><label>Naar rekening<select data-u4-field="destinationAccountProfileId">${profileOptions(root,row.processing.destinationAccountProfileId||'')}</select></label></div><span class="u4-muted">Interne overboekingen tellen niet als inkomen of uitgave.</span></div>`;
  }
  function rowHtml(root,row){
    const p=row.processing;const original=row.bankOriginal;
    return `<article class="u4-import-row" data-u4-row="${escAttr(row.id)}">
      <div class="u4-import-row-main"><div><strong>${esc(original.description||'Onbekende transactie')}</strong><span class="u4-muted">${esc(p.processingDate)} · ${euro(p.processedAmount)}</span>${row.reasons?.length?`<div class="u4-row-reasons">${esc(row.reasons.join(' · '))}</div>`:''}</div><div class="u4-row-approval"><span class="u4-status ${row.certainty}">${row.certainty==='zeker'?'Zeker':'Nakijken'}</span>${row.certainty==='nakijken'?'<button type="button" class="primary small" data-u4-approve>✓ Goedkeuren</button>':'<button type="button" class="ghost small" data-u4-reopen>Opnieuw nakijken</button>'}</div></div>
      <div class="u4-row-grid">
        <label>Datum<input type="date" data-u4-field="processingDate" value="${esc(p.processingDate)}"></label>
        <label>Bedrag<input type="number" step="0.01" data-u4-field="processedAmount" value="${Number(p.processedAmount)||0}"></label>
        <label>Budgeteigenaar<select data-u4-field="budgetOwner">${OWNERS.map(owner=>option(owner,ownerLabel(owner),p.budgetOwner)).join('')}</select></label>
        <label>Categorie<select data-u4-field="category">${categoryOptions(root,p.budgetOwner,p.category)}</select></label>
        <label class="wide">Transactie<select data-u4-field="transactionType">${typeOptions(p.transactionType)}</select></label>
        ${transferFieldsHtml(root,row)}
      </div>
      <details><summary>Meer opties voor deze verwerking</summary><div class="u4-more-grid">
        <div class="u4-original wide">Origineel: ${esc(original.bankDate)} · ${euro(original.amount)}<br>${esc(original.accountIdentifier||'Geen rekeningkenmerk')} → ${esc(original.counterpartyAccount||'Geen tegenrekening')}<br>Regel ${Number(original.lineNumber)||'—'} · ${esc(original.fingerprint)}</div>
        ${['uitgave','terugbetaling'].includes(p.transactionType)?`<label>Budgetpost<input data-u4-field="budgetItemId" value="${esc(p.budgetItemId)}"></label><label>Vaste last<select data-u4-field="fixedExpenseId">${fixedOptions(root,p.fixedExpenseId)}</select></label><label>Afwijkend vast bedrag<select data-u4-field="fixedAmountMode">${option('none','Planning niet aanpassen',p.fixedAmountMode||'none')}${option('month','Alleen deze maand',p.fixedAmountMode)}${option('from','Vanaf deze maand',p.fixedAmountMode)}</select></label><label>Voorschot<select data-u4-field="advanceMode">${option('auto','Automatisch bij andere eigenaar',p.advanceMode)}${option('none','Geen voorschot',p.advanceMode)}${option('force','Altijd voorschot',p.advanceMode)}</select></label>`:''}
        ${p.transactionType==='sparen'?`<label>Spaardoel<select data-u4-field="savingsGoalId">${goalOptions(root,p.savingsGoalId)}</select></label>`:''}
        <label>Meetellen<select data-u4-field="include">${option('true','Meetellen',String(p.include))}${option('false','Niet meetellen',String(p.include))}</select></label>
        <label class="wide">Notitie<input data-u4-field="note" value="${esc(p.note)}"></label>
      ${repaymentHtml(root,row)}</div>${['uitgave','terugbetaling'].includes(p.transactionType)?`<div class="u4-split-list">${(p.splits||[]).map((split,index)=>splitHtml(root,row,split,index)).join('')}</div><button type="button" class="ghost small" data-u4-add-split>+ Splitsregel</button>`:''}</details>
    </article>`;
  }
  function bulkEditor(root,draft){
    return `<section class="u4-section u4-bulk-section"><div class="u4-section-list"><h3>Meerdere transacties aanpassen</h3><p class="u4-muted">Pas één keuze in één keer toe. Handmatig aangepaste zekere transacties worden standaard overgeslagen.</p><div class="u4-profile-grid"><label>Toepassen op<select data-u4-bulk-scope><option value="review">Alleen Nakijken</option><option value="uncategorized">Alleen ongecategoriseerd</option><option value="all">Alle transacties</option></select></label><label>Budgeteigenaar<select data-u4-bulk-owner><option value="">Niet wijzigen</option>${OWNERS.map(owner=>option(owner,ownerLabel(owner),'')).join('')}</select></label><label>Categorie<select data-u4-bulk-category><option value="">Niet wijzigen</option>${categoryOptions(root,'gezamenlijk','')}</select></label><label>Transactie<select data-u4-bulk-type><option value="">Niet wijzigen</option>${typeOptions('')}</select></label></div><button type="button" class="ghost small" data-u4-apply-bulk>Voorbeeld en toepassen</button></div></section>`;
  }
  async function showMatchDialog(root,draft,source,modal){
    const matches=matchCandidates(draft,source);
    if(!matches.length){
      const previous=source.certainty;
      source.certainty='zeker';
      renderDraftModalPreservingView(root,draft,modal,source.id);
      Promise.resolve().then(()=>persistImportDraft(root,draft)).catch(error=>{
        source.certainty=previous;
        renderDraftModalPreservingView(root,draft,document.getElementById('u4ImportModalRoot'),source.id);
        alert(`Goedkeuren kon niet lokaal worden opgeslagen en is teruggedraaid. Probeer het opnieuw.\n\n${error?.message||error}`);
      });
      return;
    }
    document.querySelector('.u4-match-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='u4-match-overlay';
    overlay.innerHTML=`<div class="u4-match-dialog" role="dialog" aria-modal="true" aria-labelledby="u4-match-title"><div class="u4-match-head"><div><h3 id="u4-match-title">Vergelijkbare transacties gevonden</h3><p>${matches.length} mogelijke matches. Vink uit wat niet mee aangepast moet worden.</p></div><button type="button" class="ghost small" data-u4-match-close>Sluiten</button></div><div class="u4-match-change"><strong>Wordt toegepast</strong><span>${ownerLabel(source.processing.budgetOwner)} · ${esc(source.processing.category)} · ${esc(TYPE_GROUPS.flatMap(g=>g.items).find(item=>item[0]===source.processing.transactionType)?.[1]||source.processing.transactionType)} · Zeker</span></div><div class="u4-match-list">${matches.map(({row,score,reasons})=>`<label class="u4-match-row"><input type="checkbox" data-u4-match-id="${esc(row.id)}" ${score>=4?'checked':''}><span><strong>${esc(row.processing.processingDate)} · ${esc(row.bankOriginal.description||'Onbekend')}</strong><small>${euro(row.processing.processedAmount)} · ${esc(row.processing.category||'Ongecategoriseerd')} · ${esc(reasons.join(', '))}</small></span></label>`).join('')}</div><div class="u4-match-feedback" data-u4-match-feedback aria-live="polite"></div><div class="u4-match-actions"><button type="button" class="ghost" data-u4-match-only>Alleen deze transactie</button><button type="button" class="primary" data-u4-match-apply>Geselecteerde aanpassen</button></div></div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('[data-u4-match-close]').onclick=close;
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    let busy=false;
    const actionButtons=[...overlay.querySelectorAll('[data-u4-match-only],[data-u4-match-apply],[data-u4-match-close]')];
    const feedback=overlay.querySelector('[data-u4-match-feedback]');
    function commitSelection(applyMatches,button){
      if(busy)return;
      busy=true;
      actionButtons.forEach(item=>item.disabled=true);
      button.textContent='Bezig…';
      feedback.textContent='Wijzigingen worden toegepast.';
      const snapshots=new Map();
      const remember=row=>snapshots.set(row.id,{processing:clone(row.processing),certainty:row.certainty,reasons:clone(row.reasons||[])});
      try{
        remember(source);
        source.certainty='zeker';source.reasons=[];
        if(applyMatches){
          overlay.querySelectorAll('[data-u4-match-id]:checked').forEach(input=>{
            const target=draft.rows.find(row=>row.id===input.dataset.u4MatchId);
            if(target){remember(target);copiedProcessing(source,target);target.certainty='zeker';target.reasons=[];}
          });
        }

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
            persistImportDraft(root,draft).catch(error=>{
              snapshots.forEach((snapshot,id)=>{
                const row=draft.rows.find(item=>item.id===id);
                if(row){row.processing=snapshot.processing;row.certainty=snapshot.certainty;row.reasons=snapshot.reasons;}
              });
              renderDraftModalPreservingView(root,draft,document.getElementById('u4ImportModalRoot'),source.id);
              alert(`De wijziging kon niet lokaal worden opgeslagen en is teruggedraaid. Probeer het opnieuw.\n\n${error?.message||error}`);
            });
          },0);
        });
      }catch(error){
        snapshots.forEach((snapshot,id)=>{
          const row=draft.rows.find(item=>item.id===id);
          if(row){row.processing=snapshot.processing;row.certainty=snapshot.certainty;row.reasons=snapshot.reasons;}
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
    const profiles=root.state.accountProfiles||[];
    const detected=[...new Set(draft.rows.map(row=>row.bankOriginal.accountIdentifier).filter(Boolean))][0]||'';
    return `<section class="u4-section"><div class="u4-section-list"><h3>Rekeningprofiel</h3><div class="u4-profile-grid">
      <label class="wide">Bestaand profiel<select data-u4-profile-select><option value="">Nieuw profiel maken</option>${profiles.map(profile=>option(profile.id,`${profile.name} · ${ownerLabel(profile.accountOwner)}`,draft.accountProfileId)).join('')}</select></label>
      <label>Naam<input data-u4-profile-name value="${esc(draft.accountProfileId?'':`ING ${ownerLabel(draft.accountOwner||'gezamenlijk')}`)}"></label>
      <label>IBAN/rekeningkenmerk<input data-u4-profile-identifier value="${esc(detected)}"></label>
      <label>Rekeninghouder<select data-u4-profile-owner>${OWNERS.map(owner=>option(owner,ownerLabel(owner),draft.accountOwner||'gezamenlijk')).join('')}</select></label>
      <label>Bank<input data-u4-profile-bank value="${esc(draft.bank||'ING')}"></label>
    </div><button type="button" class="primary small" data-u4-apply-profile>Profiel gebruiken</button></div></section>`;
  }
  function renderDraftModal(root,draft){
    updateDraftSummary(draft);
    const isConcept=draft.status==='concept';
    const canCorrect=draft.status==='verwerkt'||draft.status==='correctie-nodig';
    const active=draft.rows.filter(row=>row.bankOriginal.valid&&!row.duplicate);
    const review=active.filter(row=>row.certainty==='nakijken').slice(0,UI.visibleRows);
    const sure=active.filter(row=>row.certainty==='zeker').slice(0,UI.visibleRows);
    const modal=ensureModalRoot();
    modal.innerHTML=`<div class="u4-import-modal" role="dialog" aria-modal="true" aria-label="Bankimport controleren">
      <header class="u4-modal-head"><div><h2>${isConcept?'Bankimport controleren':'Importdetails'}</h2><p>${esc(draft.fileName)} · ${esc(draft.bank)} · ${esc(draft.periodFrom||'—')} t/m ${esc(draft.periodTo||'—')} · ${esc(draft.status)}</p></div><button type="button" class="ghost" data-u4-close>Sluiten</button></header>
      <main class="u4-modal-body">${isConcept?profileEditor(root,draft)+bulkEditor(root,draft):''}
        <div class="u4-import-summary"><div><span>Nieuw</span><strong>${draft.summary.newCount}</strong></div><div><span>Duplicaten</span><strong>${draft.summary.duplicateCount}</strong></div><div><span>Inkomsten</span><strong>${euro(draft.summary.totalIncome)}</strong></div><div><span>Uitgaven</span><strong>${euro(draft.summary.totalExpenses)}</strong></div></div>
        <details class="u4-section" open><summary><span>Nakijken</span><span>${draft.summary.reviewCount}</span></summary><div class="u4-section-list">${review.map(row=>rowHtml(root,row)).join('')||'<div class="u4-empty">Geen transacties om na te kijken.</div>'}</div></details>
        <details class="u4-section"><summary><span>Zeker</span><span>${draft.summary.sureCount}</span></summary><div class="u4-section-list">${sure.map(row=>rowHtml(root,row)).join('')||'<div class="u4-empty">Geen zekere transacties.</div>'}</div></details>
        ${draft.summary.duplicateCount?`<details class="u4-section"><summary><span>Eerder geïmporteerd — overgeslagen</span><span>${draft.summary.duplicateCount}</span></summary><div class="u4-section-list">${draft.rows.filter(row=>row.duplicate).map(row=>`<div class="u4-original">${esc(row.bankOriginal.bankDate)} · ${esc(row.bankOriginal.description)} · ${euro(row.bankOriginal.amount)}</div>`).join('')}</div></details>`:''}
      </main>
      <footer class="u4-modal-actions"><span class="u4-muted" data-u4-save-status>${isConcept?'Wijzigingen worden automatisch lokaal bewaard.':canCorrect?'Aanpassingen worden pas financieel verwerkt na bevestiging.':'Deze import is financieel teruggedraaid.'}</span>${canCorrect?'<button type="button" class="danger-ghost" data-u4-undo>Import ongedaan maken</button><button type="button" class="primary" data-u4-reconcile>Wijzigingen verwerken</button>':isConcept?'<button type="button" class="ghost" data-u4-save-concept>Concept opslaan</button><button type="button" class="primary" data-u4-process>Alles verwerken</button>':''}</footer>
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
    let local;
    try{local=await ImportStore.getImport(id);}
    catch(error){renderCloudImportState(root,id,error);return null;}
    if(!local)renderCloudImportState(root,id);
    try{
      const resolved=await resolveImportDetails(id,{
        localRead:async()=>local,
        cloudRead:importId=>fetchImportFromCloud(root,importId),
        localWrite:record=>ImportStore.putImport(record)
      });
      UI.draft=resolved.record;renderDraftModal(root,resolved.record);
      return resolved.record;
    }catch(error){
      renderCloudImportState(root,id,error);
      return null;
    }
  }
  function closeDraft(){const modal=document.getElementById('u4ImportModalRoot');modal?.classList.remove('open');}
  async function applyProfile(root,draft,modal){
    const selected=modal.querySelector('[data-u4-profile-select]').value;
    let profile=root.state.accountProfiles.find(item=>item.id===selected);
    if(!profile){
      const name=modal.querySelector('[data-u4-profile-name]').value.trim();
      const identifier=normalizeIban(modal.querySelector('[data-u4-profile-identifier]').value);
      if(!name||!identifier)throw new Error('Vul een profielnaam en rekeningkenmerk in.');
      profile={id:`account-${hashText(identifier)}`,name,identifier,bank:modal.querySelector('[data-u4-profile-bank]').value.trim()||'ING',csvFormat:draft.format,accountOwner:modal.querySelector('[data-u4-profile-owner]').value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      const ok=root.commitChange(()=>{root.state.accountProfiles.push(profile);},{render:false});
      if(!ok)throw new Error('Rekeningprofiel opslaan mislukt.');
    }
    draft.accountProfileId=profile.id;draft.accountOwner=profile.accountOwner;
    draft.rows.forEach(row=>{
      row.accountProfileId=profile.id;row.accountOwner=profile.accountOwner;
      const proposal=classifyOriginal(row.bankOriginal,profile,root.state.recognitionRules,root.state.accountProfiles);
      row.certainty=proposal.certainty;row.reasons=proposal.reasons;row.processing={...proposal.processing,...row.processing,budgetOwner:row.processing.budgetOwner||profile.accountOwner};
    });
    await saveDraft(root,draft,{sync:true});renderDraftModal(root,draft);
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
      try{await flushScheduledImportDraft(root,draft,{syncCloud:true,updateSummary:true});closeDraft();}
      catch(error){button.disabled=false;updateImportSaveStatus(`Sluiten uitgesteld: ${error?.message||error}`,true);}
    });
    modal.querySelector('[data-u4-apply-profile]')?.addEventListener('click',async()=>{
      try{await applyProfile(root,draft,modal);}catch(error){alert(error.message);}
    });
    if(modal.dataset.u4DraftDelegated==='true')return;
    modal.dataset.u4DraftDelegated='true';
    modal.addEventListener('change',event=>{
      root=UI.root;draft=UI.draft;modal=ensureModalRoot();
      const container=event.target.closest('[data-u4-row]');if(!container)return;
      const row=draft.rows.find(item=>item.id===container.dataset.u4Row);if(!row)return;
      let rerender=false;
      if(event.target.dataset.u4Field){
        const field=event.target.dataset.u4Field;let value=event.target.value;
        if(field==='processedAmount')value=round2(Math.abs(Number(value)||0));
        if(field==='include')value=value==='true';
        row.processing[field]=value;
        if(field==='transactionType'){
          row.processing.splits=(row.processing.splits||[]).filter(split=>Math.abs(Number(split.amount)||0)>.004);
        }
        if(field==='transactionType'&&value==='terugbetaling-voorschot'){
          const relation=repaymentRelation(root,row);
          row.processing.repaymentAllocations=relation?proposeRepaymentAllocations(root.state,relation.debtor,relation.creditor,row.processing.processedAmount):[];
        }
        rerender=['transactionType','budgetOwner','category'].includes(field);
      }else if(event.target.hasAttribute('data-u4-row-certainty'))row.certainty=event.target.value;
      else if(event.target.dataset.u4SplitField){
        const split=row.processing.splits[Number(event.target.closest('[data-u4-split]').dataset.u4Split)];
        let value=event.target.value;if(event.target.dataset.u4SplitField==='amount')value=round2(Math.abs(Number(value)||0));
        split[event.target.dataset.u4SplitField]=value;
      }else if(event.target.dataset.u4AllocationField){
        const allocation=row.processing.repaymentAllocations[Number(event.target.closest('[data-u4-allocation]').dataset.u4Allocation)];
        allocation[event.target.dataset.u4AllocationField]=round2(Math.abs(Number(event.target.value)||0));
      }
      if(rerender)renderDraftRowCard(root,draft,modal,row.id);
      updateImportSaveStatus('Wijziging klaarzetten voor lokale opslag…');
      scheduleImportDraftPersist(root,draft,{delay:350,syncCloud:true,updateSummary:true}).catch(error=>console.warn('Automatisch lokaal opslaan mislukt.',error));
    });
    modal.addEventListener('click',async event=>{
      root=UI.root;draft=UI.draft;modal=ensureModalRoot();
      const container=event.target.closest('[data-u4-row]');const row=container?draft.rows.find(item=>item.id===container.dataset.u4Row):null;
      if(event.target.closest('[data-u4-approve]')&&row){event.preventDefault();event.stopPropagation();await showMatchDialog(root,draft,row,modal);return;}
      if(event.target.closest('[data-u4-reopen]')&&row){row.certainty='nakijken';renderDraftModalPreservingView(root,draft,modal,row.id);scheduleImportDraftPersist(root,draft,{delay:0}).catch(error=>console.warn('Opnieuw nakijken opslaan mislukt.',error));return;}
      if(event.target.closest('[data-u4-apply-bulk]')){
        const scope=modal.querySelector('[data-u4-bulk-scope]')?.value||'review';const owner=modal.querySelector('[data-u4-bulk-owner]')?.value||'';const category=modal.querySelector('[data-u4-bulk-category]')?.value||'';const type=modal.querySelector('[data-u4-bulk-type]')?.value||'';
        if(!owner&&!category&&!type){alert('Kies minimaal één veld om aan te passen.');return;}
        const targets=draft.rows.filter(item=>item.bankOriginal?.valid&&!item.duplicate&&(scope==='all'||(scope==='review'&&item.certainty==='nakijken')||(scope==='uncategorized'&&(!item.processing.category||item.processing.category==='Ongecategoriseerd'))));
        if(!targets.length){alert('Geen transacties binnen deze selectie.');return;}
        if(!confirm(`${targets.length} transacties aanpassen?`))return;
        targets.forEach(item=>{if(owner)item.processing.budgetOwner=owner;if(category)item.processing.category=category;if(type)item.processing.transactionType=type;});
        renderDraftModal(root,draft);scheduleImportDraftPersist(root,draft,{delay:0}).catch(error=>console.warn('Bulkbewerking opslaan mislukt.',error));return;
      }
      if(event.target.closest('[data-u4-add-split]')&&row){
        row.processing.splits=row.processing.splits||[];row.processing.splits.push({id:uid('split'),amount:0,budgetOwner:row.processing.budgetOwner,category:row.processing.category,budgetItemId:'',savingsGoalId:'',advanceMode:'auto',include:true});
        renderDraftModalPreservingView(root,draft,modal,row.id);scheduleImportDraftPersist(root,draft,{delay:0}).catch(error=>console.warn('Splitsregel opslaan mislukt.',error));return;
      }
      const remove=event.target.closest('[data-u4-remove-split]');
      if(remove&&row){row.processing.splits.splice(Number(remove.dataset.u4RemoveSplit),1);renderDraftModalPreservingView(root,draft,modal,row.id);scheduleImportDraftPersist(root,draft,{delay:0}).catch(error=>console.warn('Splitsregel verwijderen opslaan mislukt.',error));return;}
      const saveButton=event.target.closest('[data-u4-save-concept]');
      if(saveButton){
        const status=modal.querySelector('[data-u4-save-status]');
        saveButton.disabled=true;
        saveButton.textContent='Opslaan…';
        if(status)status.textContent='Concept wordt lokaal en in de cloud opgeslagen…';
        try{
          await flushScheduledImportDraft(root,draft,{syncCloud:true,updateSummary:true});
          await flushImportSync(root);
          saveButton.textContent='Opgeslagen';
          if(status)status.textContent='Concept is lokaal en in de cloud opgeslagen.';
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
      if(event.target.closest('[data-u4-process]')){
        if(typeof root.FinizeUpdate4Process!=='function'){alert('De verwerkingslaag wordt in de volgende fase geactiveerd. Het concept blijft bewaard.');return;}
        await root.FinizeUpdate4Process(draft);
      }
      if(event.target.closest('[data-u4-undo]')){
        if(confirm('Deze import en alle bijbehorende financiële gevolgen ongedaan maken?'))await undoImport(root,draft);
      }
      if(event.target.closest('[data-u4-reconcile]')){
        if(confirm('De bestaande import vervangen door deze aangepaste verwerking?'))await reconcileImport(root,draft);
      }
    });
  }
  function bindImportPanel(rootElement,root){
    rootElement.querySelector('[data-u4-file]')?.addEventListener('change',event=>{
      const file=event.target.files?.[0];if(!file)return;
      if(root.state.activeImportId){event.target.value='';openDraft(root,root.state.activeImportId);return;}
      const reader=new FileReader();
      reader.onload=async loaded=>{
        try{
          const draft=createImportDraft({text:String(loaded.target.result||''),fileName:file.name,profiles:root.state.accountProfiles,rules:root.state.recognitionRules,transactions:root.state.transactions});
          UI.draft=draft;await saveDraft(root,draft,{sync:true});root.renderActiveTab();renderDraftModal(root,draft);
        }catch(error){alert(`CSV importeren mislukt: ${error.message}`);}
      };
      reader.readAsText(file);
    });
    rootElement.querySelectorAll('[data-u4-open-concept],[data-u4-open-receipt]').forEach(button=>button.addEventListener('click',()=>openDraft(root,button.dataset.u4OpenConcept||button.dataset.u4OpenReceipt).catch(error=>alert(error.message))));
    rootElement.querySelector('[data-u4-all-imports]')?.addEventListener('click',()=>renderImportHistory(root));
    rootElement.querySelector('[data-u4-manage-rules]')?.addEventListener('click',()=>renderRules(root));
  }
  function renderImportHistory(root){
    const modal=ensureModalRoot();const summaries=(root.state.importSummaries||[]).slice().sort((a,b)=>String(b.updatedAt||b.importDate).localeCompare(String(a.updatedAt||a.importDate)));
    modal.innerHTML=`<div class="u4-import-modal"><header class="u4-modal-head"><h2>Alle imports</h2><button class="ghost" data-u4-close>Sluiten</button></header><main class="u4-modal-body"><div class="u4-import-receipts">${summaries.map(renderReceipt).join('')||'<div class="u4-empty">Nog geen imports.</div>'}</div></main></div>`;
    modal.classList.add('open');modal.querySelector('[data-u4-close]').addEventListener('click',closeDraft);modal.querySelectorAll('[data-u4-open-receipt]').forEach(item=>item.addEventListener('click',()=>openDraft(root,item.dataset.u4OpenReceipt)));
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
    if(document.body.dataset.activeTab!=='dashboard')return;
    const target=document.querySelector('#tab-dashboard .manage-stack')||document.querySelector('.manage-stack');
    if(!target)return;
    const balances=directionalBalances(root.state,root.state.meta.selectedMonth||'9999-12');
    const accordion=document.createElement('details');accordion.className='manage-section';accordion.dataset.dashboardAccordion='settlement';
    accordion.innerHTML=`<summary><span class="manage-title">Onderling te verrekenen</span><span class="expand-chevron" aria-hidden="true"></span></summary><div class="manage-body"><section class="card u4-settlement-card"><div class="card-head"><div></div><button type="button" class="ghost small" data-u4-open-settlement>Details</button></div><div class="u4-settlement-lines">${balances.map(row=>`<div class="u4-settlement-line"><span>${ownerLabel(row.debtor)} → ${ownerLabel(row.creditor)}</span><strong>${euro(row.amount)}</strong></div>`).join('')||'<span class="u4-muted">Geen openstaande voorschotten.</span>'}</div></section></div>`;
    target.prepend(accordion);accordion.querySelector('[data-u4-open-settlement]').addEventListener('click',()=>renderSettlementDetail(root));
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

  async function queueImportSync(record){
    await ImportStore.putSync({id:record.id,importId:record.id,queuedAt:new Date().toISOString(),attempts:0});
  }

  async function flushImportSync(root){
    ImportPerformance.syncRequested=true;
    if(ImportPerformance.syncPromise)return ImportPerformance.syncPromise;
    ImportPerformance.syncPromise=(async()=>{
      let overall=true;
      while(ImportPerformance.syncRequested){
        ImportPerformance.syncRequested=false;
        const cloud=root.CloudAdapter;
        if(!cloud?.isConnected?.()&&cloud?.isConfigured?.()&&typeof cloud.connect==='function')await cloud.connect();
        if(!cloud?.isConnected?.()||!cloud.modules?.firestore||!cloud.db)return false;
        const firestore=cloud.modules.firestore;
        for(const item of await ImportStore.listSync()){
          const record=await ImportStore.getImport(item.importId);
          if(!record){await ImportStore.deleteSync(item.id);continue;}
          try{
            const envelope=buildCloudImportEnvelope(record);
            for(let index=0;index<envelope.chunks.length;index++){
              const chunkRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',record.id,'chunks',String(index).padStart(4,'0'));
              await firestore.setDoc(chunkRef,envelope.chunks[index],{merge:false});
            }
            const importRef=firestore.doc(cloud.db,'budgetPlanners','finize','imports',record.id);
            await firestore.setDoc(importRef,envelope.header,{merge:false});
            await ImportStore.deleteSync(item.id);
          }catch(error){
            const classified=classifyCloudError(error,'De import kon niet worden gesynchroniseerd.');
            item.attempts=(item.attempts||0)+1;item.lastError=classified.message;item.lastErrorCode=classified.code;item.updatedAt=new Date().toISOString();
            await ImportStore.putSync(item);
            overall=false;
            break;
          }
        }
      }
      return overall;
    })().finally(()=>{ImportPerformance.syncPromise=null;});
    return ImportPerformance.syncPromise;
  }

  async function recoverJournal(root){
    const entries=await ImportStore.listJournal();
    for(const entry of entries.filter(item=>item.status==='pending')){
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
      const processed=(root.state?.transactions||[]).some(tx=>tx.importBatchId===entry.importId);
      entry.status=entry.operation==='undo'?!processed?'completed':'rolled-back':processed?'completed':'rolled-back';
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
      rowsChecksum,
      buildCloudImportEnvelope,
      assembleCloudImport,
      classifyCloudError,
      fetchImportFromCloud,
      resolveImportDetails,
      reconcileActiveImportReference,
      discardImportConcept,
      parseBankCsv,
      createImportDraft,
      fingerprint,
      classifyOriginal,
      validateDraft,
      planImportEffects,
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
      .then(()=>recoverJournal(root))
      .then(()=>reconcileActiveImportReference(root))
      .catch(error=>console.warn('Update 4 opslaginitialisatie uitgesteld.',error))
      .finally(()=>{
        if(root.__finizeBootstrap)root.__finizeBootstrap.update4Ready=true;
        root.__finizeMaybeFinishBootstrap?.();
        flushImportSync(root).catch(error=>console.warn('Importsynchronisatie uitgesteld.',error));
      });
  }

  return {SCHEMA_VERSION,CLOUD_STORAGE_VERSION,CLOUD_READ_CONCURRENCY,OWNERS,IMPORT_STATUSES,normalizeIban,normalizeRule,normalizeTransaction,normalizeCore,validateCore,calculateGoalSavedAmount,reconcileGoalSavedAmounts,chunkRows,canonicalValue,rowsChecksum,buildCloudImportEnvelope,assembleCloudImport,mapWithConcurrency,classifyCloudError,fetchImportFromCloud,resolveImportDetails,reconcileActiveImportReference,deleteCloudImportBestEffort,discardImportConcept,normalizeText,matchIdentity,matchCandidates,detectDelimiter,parseDelimited,parseDate,parseAmount,detectFormat,inferMapping,hashText,fingerprint,organizationName,proposeType,recognitionProposal,classifyOriginal,parseBankCsv,findProfile,createImportDraft,updateDraftSummary,compactSummary,validateDraft,transactionKind,expenseImpact,financialRows,advanceForTransaction,savingsForTransaction,detectInternalPairs,directionalBalances,proposeRepaymentAllocations,planImportEffects,applyImportPlan,effectManifest,undoImportEffects,ImportStore,persistImportDraft,scheduleImportDraftPersist,flushScheduledImportDraft,queueImportSync,flushImportSync,recoverJournal,install,round2,uid,clone,testRenderDraftModal:renderDraftModal};
});
