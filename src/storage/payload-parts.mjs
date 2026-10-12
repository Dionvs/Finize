import { profileSync, profileStart, profileCount } from './performance.mjs';
import { csvFileDigest as rawDigest } from '../import/import-identity.mjs';

// Physical representation only. Financial schema-v11 and the P3 wire codec stay unchanged.
export const PAYLOAD_FORMAT = 2;
export const PAYLOAD_STORE = 'payloadParts';
export const PAYLOAD_PROTECTION = 'payloadProtection';
export const REPRESENTATION_META = 'representationMeta';
export const REPRESENTATION_BACKUP = 'representationBackup';
export const REPRESENTATION_STAGE = 'representationStage';
const threshold=1024;
const refKey='__finizePayloadRef';
const csvFileDigest=(value,stage='verify')=>profileSync('payload.sha256',()=>profileSync('payload.sha256.'+stage,()=>rawDigest(value)));
const json=value=>profileSync('payload.stringify',()=>JSON.stringify(value));
const clone=value=>profileSync('payload.clone',()=>structuredClone(value));
const failure=(code,message)=>Object.assign(new Error(message),{code,storageFailure:true});
const isRef=value=>value&&typeof value==='object'&&!Array.isArray(value)&&value[refKey]===PAYLOAD_FORMAT&&typeof value.hash==='string'&&Object.keys(value).length===2;
export function payloadReferences(value,found=new Set()){
  if(isRef(value))found.add(value.hash);
  else if(value&&typeof value==='object')for(const child of Object.values(value))payloadReferences(child,found);
  return found;
}

// Exact JSON content is eligible only when JSON is lossless for the value.
// Undefined, exotic prototypes and non-JSON numbers use the original full codec.
// Never use JSON.stringify alone as an equality proof (undefined/null aliasing).
export function preparationSignature(value){
  let eligible=true,root=true;
  const signature=JSON.stringify(value,function(key,item){
    const original=root?value:this[key];root=false;
    if(original===undefined||typeof original==='function'||typeof original==='symbol'||typeof original==='bigint'||typeof original==='number'&&(!Number.isFinite(original)||Object.is(original,-0)))eligible=false;
    if(original&&typeof original==='object'&&!Array.isArray(original)&&Object.getPrototypeOf(original)!==Object.prototype)eligible=false;
    if(original&&typeof original==='object'&&typeof original.toJSON==='function')eligible=false;
    return item;
  });
  return eligible?signature:null;
}

// Optional operation-local artifacts, explicitly threaded through the pending
// journal and its financial commit. They contain physical representations, not
// financial values. A bounded explicit group may inherit exact-content artifacts;
// no cache survives that group or is shared by households.
export function createPayloadPreparation(binding=null,previous=null){
  const result={binding:binding&&Object.freeze({...binding}),records:new Map(),strings:new Map(),digests:new Map(),invalid:false};
  if(previous&&!previous.invalid&&binding&&['scope','sha256','storageRevision','migration'].every(key=>previous.binding?.[key]===binding[key])){
    // Retain only small exact-content record artifacts, never whole-state strings.
    let bytes=0;for(const [signature,entry]of previous.records){
      if(signature.length>32768||entry.parts.size>128)continue;
      bytes+=signature.length*2;if(bytes>4*1024*1024||result.records.size>=4096)break;
      result.records.set(signature,entry);
    }
    profileCount('preparation.groupRecords',result.records.size);
  }
  return result;
}
export function advancePayloadPreparation(preparation,head,operationId){
  const base=preparation?.binding;
  if(!base||preparation.invalid||head?.operationId!==operationId||head.storageRevision!==base.storageRevision+1||JSON.stringify(head.migration??null)!==base.migration)return null;
  return {...preparation,binding:Object.freeze({...base,sha256:head.sha256,storageRevision:head.storageRevision})};
}

export function encodePayloadRow(row,digests=new Map(),preparation=createPayloadPreparation()){
  const finish=profileStart('payload.encodeRoot');
  const parts=new Map(),strings=preparation.strings,collectors=[],counts={compared:0,encoded:0,reused:0};
  const digest=text=>{if(!digests.has(text))digests.set(text,csvFileDigest(text,'encode'));return digests.get(text);};
  function reference(node){
    const payload=json(node),id=digest(payload);
    const part={id,format:PAYLOAD_FORMAT,payload};parts.set(id,part);for(const collector of collectors)collector.set(id,part);return {[refKey]:PAYLOAD_FORMAT,hash:id};
  }
  function reuse(entry){for(const [hash,part]of entry.parts){parts.set(hash,part);for(const collector of collectors)collector.set(hash,part);}return entry.encoded;}
  function encode(value,force=false){
    // Memo lives for this operation only. Exact eligible content signatures cannot
    // confuse undefined with null or reuse an object mutated by a later command.
    if(typeof value==='string'&&strings.has(value))return reuse(strings.get(value));
    const record=value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.id==='string';
    const signature=record?profileSync('preparation.recordSignature',()=>preparationSignature(value)):null;
    if(record)counts.compared++;
    if(signature!==null&&preparation.records.has(signature)){counts.reused++;return reuse(preparation.records.get(signature));}
    const used=new Map(),collect=signature!==null||typeof value==='string';if(collect)collectors.push(used);
    let encoded;try{encoded=encodeValue(value,force);}finally{if(collect)collectors.pop();}
    const entry={encoded,parts:used};
    if(typeof value==='string')strings.set(value,entry);
    if(signature!==null){counts.encoded++;preparation.records.set(signature,entry);}
    return encoded;
  }
  function encodeValue(value,force=false){
    if(value===undefined)return reference({type:'undefined'});
    if(value===null||typeof value!=='object'&&typeof value!=='string')return value;
    // Use the same representation for an object stored as a financial row and
    // the identical object referenced by a later recovery proof. Inlining small
    // objects here would materialize all historic objects on the first edit.
    if(typeof value==='string'&&!force&&(value.length*6+2<threshold||json(value).length<threshold))return value;
    if(typeof value==='string'){
      // Journal signatures and cloud document payloads are exact JSON text. Split
      // their logical rows as well, rather than keeping a whole-state string blob.
      try{const parsed=JSON.parse(value);if(json(parsed)===value&&parsed&&typeof parsed==='object')return reference({type:'json',value:encode(parsed,true)});}catch{}
      const chunks=[];for(let i=0;i<value.length;i+=4096)chunks.push(reference({type:'text',value:value.slice(i,i+4096)}));
      return reference({type:'string',chunks});
    }
    if(Array.isArray(value)){
      const keys=value.map(item=>typeof item==='string'?'s:'+item:item&&typeof item==='object'&&typeof item.id==='string'?'o:'+item.id:null);
      if(value.length>16&&keys.every(key=>key!==null)&&new Set(keys).size===keys.length){
        // Stable source IDs, rather than array positions, determine membership.
        // Removing/re-appending an edited effect changes a few order links; it
        // cannot shift every historical row into a newly written chunk.
        const entries=value.map((item,i)=>({key:keys[i],hash:digest(keys[i]),value:encode(item,item!==null&&typeof item==='object'),next:keys[i+1]??null}));
        const index=(items,depth=0)=>{
          if(items.length===1){const {key,value,next}=items[0];return reference({type:'index-entry',key,value,next});}
          const buckets=new Map();for(const item of items){const digit=item.hash[depth];if(!buckets.has(digit))buckets.set(digit,[]);buckets.get(digit).push(item);}
          if(depth>=64)throw failure('storage-payload-collision','Onverwachte botsing in de bronidentiteit.');
          return reference({type:'index-branch',children:[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([,children])=>index(children,depth+1))});
        };
        return reference({type:'keyed-array',first:keys[0],length:value.length,index:index(entries)});
      }
      // Bounded manifests: editing one row changes its leaf and a logarithmic
      // reference path, never a flat manifest containing every historic row.
      const tree=items=>items.length<=16?reference({type:'array',values:items.map(item=>encode(item,item!==null&&typeof item==='object'))}):reference({type:'concat',left:tree(items.slice(0,Math.floor(items.length/2))),right:tree(items.slice(Math.floor(items.length/2)))});
      return tree(value);
    }
    if(Object.getPrototypeOf(value)!==Object.prototype)throw failure('storage-payload-type','Niet-ondersteund type in de financiële opslag.');
    return reference({type:'object',entries:Object.entries(value).map(([key,item])=>[key,encode(item,item!==null&&typeof item==='object')])});
  }
  // Keep scalar/index fields native so existing IndexedDB indexes keep their meaning.
  const stored=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key==='id'||key==='periods'?clone(value):encode(value)]));
  for(const [name,count]of Object.entries(counts))profileCount('preparation.records.'+name,count);
  finish();return {stored,parts};
}

// Verified immutable DAGs are shared only within one native transaction. Materialize
// a separate value tree per logical result: no mutable aliases within/across rows.
export function createPayloadDecoder(readPart){
  const pending=new Map();
  async function decode(value){
    if(!isRef(value))return value;
    const hash=value.hash;
    if(!pending.has(hash))pending.set(hash,(async()=>{
      const part=await readPart(hash);
      if(!part||part.format!==PAYLOAD_FORMAT||csvFileDigest(part.payload)!==hash)throw failure('storage-payload-integrity','Een vereist opslagbewijs ontbreekt of is beschadigd.');
      const node=profileSync('payload.parsePart',()=>JSON.parse(part.payload));
      if(node.type==='undefined')return undefined;
      if(node.type==='text')return node.value;
      if(node.type==='json')return json(await decode(node.value));
      if(node.type==='string')return (await Promise.all(node.chunks.map(decode))).join('');
      if(node.type==='array')return Promise.all(node.values.map(decode));
      if(node.type==='concat')return [...await decode(node.left),...await decode(node.right)];
      if(node.type==='index-entry')return [[node.key,{value:await decode(node.value),next:node.next}]];
      if(node.type==='index-branch')return (await Promise.all(node.children.map(decode))).flat();
      if(node.type==='keyed-array'){
        const entries=new Map(await decode(node.index)),values=[],seen=new Set();let key=node.first;
        while(key!==null){const entry=entries.get(key);if(!entry||seen.has(key))throw failure('storage-payload-integrity','De bronvolgorde is onvolledig of bevat een cyclus.');seen.add(key);values.push(entry.value);key=entry.next;}
        if(values.length!==node.length||seen.size!==entries.size)throw failure('storage-payload-integrity','Het aantal bronverwijzingen wijkt af.');return values;
      }
      if(node.type==='object')return Object.fromEntries(await Promise.all(node.entries.map(async([key,item])=>[key,await decode(item)])));
      throw failure('storage-payload-integrity','Onbekend opslagbewijsformaat.');
    })());
    return pending.get(hash);
  }
  function materialize(value){
    if(value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(materialize);
    if(Object.getPrototypeOf(value)!==Object.prototype)return clone(value);
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,materialize(item)]));
  }
  return async row=>{
    if(row===undefined)return row;
    const finish=profileStart('payload.hydrateRoot.wall');
    try{
      const decoded=Object.fromEntries(await Promise.all(Object.entries(row).map(async([key,value])=>[key,await decode(value)])));
      return profileSync('payload.materialize',()=>materialize(decoded));
    }finally{finish();}
  };
}
export async function decodePayloadRow(row,readPart){return createPayloadDecoder(readPart)(row);}

const result=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const complete=tx=>{const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||failure('storage-aborted','Opslagtransactie afgebroken.'));});done.catch(()=>{});return done;};

// Writes of immutable parts join the caller's native transaction. Cache knowledge
// becomes visible only on transaction completion, never on request success.
function partWriter(tx,known){
  const pending=new Set(),accepted=new Set(),protectedPending=new Set(),parts=tx.objectStore(PAYLOAD_STORE),protection=tx.objectStore(PAYLOAD_PROTECTION);
  tx.addEventListener('complete',()=>{for(const hash of accepted)known.add(hash);while(known.size>20000)known.delete(known.values().next().value);});
  return (values,protect=true,roots=values.keys())=>{
    // Protection follows immutable dependencies. Promoting an existing cache
    // graph therefore writes only its roots, never one flag per historical node.
    if(protect)for(const hash of roots)if(!protectedPending.has(hash)){protectedPending.add(hash);const read=protection.get(hash);read.onsuccess=()=>{if(!read.result)protection.add({id:hash,protected:true});};}
    for(const [hash,part]of values){
    if(known.has(hash)||pending.has(hash))continue;pending.add(hash);
    const read=parts.get(hash);read.onsuccess=()=>{
      if(read.result){if(read.result.format!==PAYLOAD_FORMAT||csvFileDigest(read.result.payload)!==hash){tx.abort();return;}}
      else parts.add(part);
      if(protect)accepted.add(hash);
    };
  }};
}

// Central adapter over native IndexedDB, shared by finance, imports, journals,
// outbox and cache. No global prototype patch and no additional financial model.
export function payloadDatabase(db,logicalStores){
  const known=new Set();
  return new Proxy(db,{get(target,key){
    if(key==='rawDatabase')return target;
    if(key!=='transaction'){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}
    return (names,mode='readonly',options)=>{
      const requested=typeof names==='string'?[names]:Array.from(names),usesPayload=requested.some(name=>logicalStores.includes(name));
      const {finizePreparation,...nativeOptions}=options||{};
      if(finizePreparation?.binding&&target.name!==(finizePreparation.binding.scope==='legacy'?'finize-imports-v1':'finize-imports-v1-'+finizePreparation.binding.scope))throw failure('household-scope','De commitvoorbereiding hoort bij een ander huishouden.');
      const native=target.transaction(usesPayload?[...new Set([...requested,PAYLOAD_STORE,...(mode==='readwrite'?[PAYLOAD_PROTECTION]:[])])]:requested,mode,options?nativeOptions:undefined);
      if(!usesPayload)return native;
      // Artifacts live for one native transaction, or one explicitly supplied
      // import operation. Exact comparison and the caller's durable basis CAS
      // govern reuse; no financial state is retained between operations.
      const preparation=finizePreparation&&!finizePreparation.invalid?finizePreparation:createPayloadPreparation();
      native.addEventListener('abort',()=>{preparation.invalid=true;preparation.records.clear();preparation.strings.clear();preparation.digests.clear();});
      const writeParts=mode==='readwrite'?partWriter(native,known):null,readCache=new Map(),digests=preparation.digests,delivery=[];let abortError=null;
      const rawStore=name=>native.objectStore(name);
      const readPart=hash=>{if(!readCache.has(hash))readCache.set(hash,result(rawStore(PAYLOAD_STORE).get(hash)));return readCache.get(hash);};
      const decodeRow=createPayloadDecoder(readPart);
      const flush=()=>{while(delivery[0]?.ready){const next=delivery.shift();next.fire();}};
      const bridge=(request,transform)=>{
        let value,problem,handler,errorHandler,ready=false;
        const callbacks=new Map(),entry={ready:false,fire(){ready=true;if(problem){errorHandler?.({target:facade});for(const callback of callbacks.get('error')||[])callback({target:facade});}else{handler?.({target:facade});for(const callback of callbacks.get('success')||[])callback({target:facade});}}};
        delivery.push(entry);
        const facade={get result(){return value;},get error(){return problem;},get readyState(){return ready?'done':'pending';},get source(){return request.source;},transaction:native,get onsuccess(){return handler;},set onsuccess(callback){handler=callback;},get onerror(){return errorHandler;},set onerror(callback){errorHandler=callback;},addEventListener(type,callback){if(!callbacks.has(type))callbacks.set(type,[]);callbacks.get(type).push(callback);}};
        request.onsuccess=()=>{Promise.resolve().then(()=>transform(request.result)).then(decoded=>{value=decoded;entry.ready=true;flush();}).catch(error=>{problem=abortError=error;entry.ready=true;try{native.abort();}catch{}flush();});};
        request.onerror=()=>{problem=request.error;entry.ready=true;flush();};return facade;
      };
      const adaptIndex=index=>new Proxy(index,{get(target,key){
        if(key==='get')return (...args)=>bridge(target.get(...args),row=>decodeRow(row));
        if(key==='getAll')return (...args)=>bridge(target.getAll(...args),rows=>Promise.all(rows.map(row=>decodeRow(row))));
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      }});
      const adaptStore=store=>new Proxy(store,{get(target,key){
        if(key==='getAllMatching')return criteria=>{
          // Query only native scalar metadata; never guess from encoded refs.
          const entries=Object.entries(criteria);
          if(entries.some(([field,values])=>!['status','operation','importId'].includes(field)||(Array.isArray(values)?values:[values]).some(value=>typeof value!=='string')))throw failure('storage-query','Ongeldige opslagmetadataquery.');
          return bridge(target.getAll(),rows=>Promise.all(rows.filter(row=>entries.every(([field,values])=>{
            if(isRef(row[field]))throw failure('storage-query','Deze metadata vereist een ondersteunde opslagindex.');
            return (Array.isArray(values)?values:[values]).includes(row[field]);
          })).map(decodeRow)));
        };
        if(key==='get')return (...args)=>bridge(target.get(...args),row=>decodeRow(row));
        if(key==='getAll')return (...args)=>bridge(target.getAll(...args),rows=>Promise.all(rows.map(row=>decodeRow(row))));
        if(key==='index')return name=>adaptIndex(target.index(name));
        if(key==='put'||key==='add')return (row,...args)=>{
          const encoded=encodePayloadRow(row,digests,preparation),id=args[0]??row[target.keyPath],read=target.get(id);
          // Compare physical representations before scheduling any write. A
          // repeated journal finalization must not rewrite its unchanged payload.
          return bridge(read,old=>{
            if(key==='put'&&json(old)===json(encoded.stored))return id;
            writeParts(encoded.parts,target.name!=='periodCache',payloadReferences(encoded.stored));return result(target[key](encoded.stored,...args));
          });
        };
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      }});
      return new Proxy(native,{get(target,key){
        if(key==='seedStatePayload')return state=>{
          if(!writeParts)throw failure('storage-contract','Een opslagbewijs vereist een schrijftransactie.');
          const finishSeed=profileStart('commit.seedStatePayload');
          const encoded=encodePayloadRow({id:'state-proof',state},digests,preparation);finishSeed();
          writeParts(encoded.parts,true,payloadReferences(encoded.stored));return encoded.stored.state.hash;
        };
        if(key==='objectStore')return name=>logicalStores.includes(name)?adaptStore(rawStore(name)):rawStore(name);
        if(key==='error')return abortError||target.error;
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      },set(target,key,value){return Reflect.set(target,key,value,target);}});
    };
  }});
}

// Resumable, non-destructive physical migration. Normal app access waits for
// this gate. Old-version connections are closed by IndexedDB versionchange.
export async function migratePayloadRepresentation(db,logicalStores,scope,{decodeState}={}){
  const readMeta=async()=>{const tx=db.transaction(REPRESENTATION_META),done=complete(tx),meta=await result(tx.objectStore(REPRESENTATION_META).get('current'));await done;return meta;};
  let meta=await readMeta();
  if(meta&&meta.scope!==scope)throw failure('household-scope','De opslagmigratie hoort bij een ander huishouden.');
  if(meta&&(meta.format!==PAYLOAD_FORMAT||!['copying','active'].includes(meta.phase)))throw failure('storage-version','Onbekend lokaal opslagversiecontract; de administratie blijft beschermd.');
  if(meta?.format===PAYLOAD_FORMAT&&meta.phase==='active')return;
  for(let storeIndex=meta?.storeIndex||0;storeIndex<logicalStores.length;storeIndex++){
    const name=logicalStores[storeIndex];let lastKey=meta?.storeIndex===storeIndex?meta.lastKey:null;
    for(;;){
      const tx=db.transaction([name,PAYLOAD_STORE,PAYLOAD_PROTECTION,REPRESENTATION_META,REPRESENTATION_BACKUP,REPRESENTATION_STAGE],'readwrite',{durability:'strict'}),done=complete(tx),writeParts=partWriter(tx,new Set());
      const saved=await result(tx.objectStore(REPRESENTATION_META).get('current'));
      if(saved?.phase==='active'){await done;return;}
      const rows=await result(tx.objectStore(name).getAll(lastKey===null?null:IDBKeyRange.lowerBound(lastKey,true),50));
      if(!rows.length){tx.objectStore(REPRESENTATION_META).put({id:'current',format:PAYLOAD_FORMAT,phase:'copying',scope,storeIndex:storeIndex+1,lastKey:null});await done;break;}
      for(const row of rows){
        const id=JSON.stringify([name,row.id]),originalHash=csvFileDigest(json(row)),encoded=encodePayloadRow(row);
        const backup=await result(tx.objectStore(REPRESENTATION_BACKUP).get(id));
        if(backup&&backup.sha256!==originalHash){tx.abort();await done;throw failure('storage-migration-conflict','Oorspronkelijke gegevens wijzigden tijdens de opslagmigratie.');}
        if(!backup)tx.objectStore(REPRESENTATION_BACKUP).add({id,store:name,key:row.id,scope,sha256:originalHash,value:row});
        writeParts(encoded.parts,true,payloadReferences(encoded.stored));tx.objectStore(REPRESENTATION_STAGE).put({id,store:name,key:row.id,scope,sha256:originalHash,value:encoded.stored});
        lastKey=row.id;
      }
      tx.objectStore(REPRESENTATION_META).put({id:'current',format:PAYLOAD_FORMAT,phase:'copying',scope,storeIndex,lastKey});await done;
    }
    meta=null;
  }
  // Full readback is confined to migration. Recheck originals and staging in
  // the activation transaction; no writer can publish a partially copied head.
  const names=[...logicalStores,PAYLOAD_STORE,PAYLOAD_PROTECTION,REPRESENTATION_META,REPRESENTATION_BACKUP,REPRESENTATION_STAGE],tx=db.transaction(names,'readwrite',{durability:'strict'}),done=complete(tx);
  try{
  const current=await result(tx.objectStore(REPRESENTATION_META).get('current'));
  if(current?.phase==='active'){await done;return;}
  const stage=await result(tx.objectStore(REPRESENTATION_STAGE).getAll()),sourceLists=await Promise.all(logicalStores.map(name=>result(tx.objectStore(name).getAll())));
  const originals=sourceLists.flat(),originalStores=new Map(logicalStores.map((name,i)=>[name,sourceLists[i]]));
  if(originals.length!==stage.length){tx.abort();await done;throw failure('storage-migration-integrity','De aantallen tijdens opslagmigratie verschillen.');}
  const partCache=new Map(),readPart=hash=>{if(!partCache.has(hash))partCache.set(hash,result(tx.objectStore(PAYLOAD_STORE).get(hash)));return partCache.get(hash);};
  for(const row of stage){
    const original=await result(tx.objectStore(row.store).get(row.key)),decoded=await decodePayloadRow(row.value,readPart);
    if(row.scope!==scope||csvFileDigest(json(original))!==row.sha256||json(decoded)!==json(original)){tx.abort();await done;throw failure('storage-migration-integrity','De teruggelezen opslagmigratie wijkt af.');}
    tx.objectStore(row.store).put(row.value);
  }
  const originalHead=originalStores.get('financialHead')?.find(row=>row.id==='current');
  if(originalHead&&decodeState){
    const sourceRecords=originalStores.get('financialRecords')||[];
    const state=decodeState(originalHead,sourceRecords),encoded=encodePayloadRow({id:'state-proof',state});
    partWriter(tx,new Set())(encoded.parts,true,payloadReferences(encoded.stored));
    const currentHead=stage.find(row=>row.store==='financialHead'&&row.key==='current');
    tx.objectStore('financialHead').put({...currentHead.value,payloadStateHash:encoded.stored.state.hash});
  }
  tx.objectStore(REPRESENTATION_META).put({id:'current',format:PAYLOAD_FORMAT,phase:'active',scope,verifiedCount:stage.length,activatedAt:new Date().toISOString()});
  await done;
  }catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
}
