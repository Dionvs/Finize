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
      parseBankCsv,
      createImportDraft,
      fingerprint,
      classifyOriginal,
      importStore:ImportStore
    });
    Promise.resolve().then(()=>recoverJournal(root)).then(()=>flushImportSync(root)).catch(error=>console.warn('Update 4 opslaginitialisatie uitgesteld.',error));
  }

  return {SCHEMA_VERSION,OWNERS,IMPORT_STATUSES,normalizeIban,normalizeRule,normalizeTransaction,normalizeCore,validateCore,chunkRows,normalizeText,detectDelimiter,parseDelimited,parseDate,parseAmount,detectFormat,inferMapping,hashText,fingerprint,organizationName,proposeType,recognitionProposal,classifyOriginal,parseBankCsv,findProfile,createImportDraft,ImportStore,queueImportSync,flushImportSync,recoverJournal,install,round2,uid,clone};
});
