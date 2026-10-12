// Test-only observer. Uses native IndexedDB; never changes request ordering or data.
async function installWriteMeter(page) {
  await page.evaluate(async()=>{
    const encoder=new TextEncoder(),bytes=value=>encoder.encode(JSON.stringify(value)).length;
    const signature=value=>JSON.stringify(value);
    const current=new Map(),rows=[],transactions=new WeakMap();let sequence=0,phase='idle';
    const dbs=await indexedDB.databases();
    for(const info of dbs.filter(row=>row.name.startsWith('finize-imports-v1'))){
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(info.name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      await Promise.all(Array.from(db.objectStoreNames).map(name=>new Promise((resolve,reject)=>{
        const tx=db.transaction(name),r=tx.objectStore(name).openCursor();
        r.onsuccess=()=>{const cursor=r.result;if(cursor){current.set(info.name+'|'+name+'|'+JSON.stringify(cursor.key),signature(cursor.value));cursor.continue();}};
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      })));db.close();
    }
    function unchangedBytes(before,after){
      if(signature(before)===signature(after))return before===undefined?0:bytes(after);
      if(!before||!after||typeof before!=='object'||typeof after!=='object')return 0;
      return Object.keys(after).reduce((sum,key)=>sum+unchangedBytes(before[key],after[key]),0);
    }
    const native={put:IDBObjectStore.prototype.put,add:IDBObjectStore.prototype.add,delete:IDBObjectStore.prototype.delete};
    for(const method of Object.keys(native))IDBObjectStore.prototype[method]=function(value,...args){
      const tx=this.transaction,db=tx.db.name;
      if(!db.startsWith('finize-imports-v1'))return native[method].call(this,value,...args);
      let entry=transactions.get(tx);
      if(!entry){entry={id:++sequence,rows:[],pending:new Map()};transactions.set(tx,entry);
        tx.addEventListener('complete',()=>{for(const row of entry.rows)row.completed=row.requestSucceeded&&!row.thrown;for(const [key,value]of entry.pending){if(value===undefined)current.delete(key);else current.set(key,value);}});
        tx.addEventListener('abort',()=>{for(const row of entry.rows)row.aborted=true;});
      }
      const key=method==='delete'?value:(args[0]??value?.[this.keyPath]);
      const address=db+'|'+this.name+'|'+JSON.stringify(key),old=entry.pending.has(address)?entry.pending.get(address):current.get(address);
      const serialized=method==='delete'?undefined:signature(value);
      const row={phase,transaction:entry.id,store:this.name,method,key,bytes:method==='delete'?bytes(key):bytes(value),unchanged:method!=='delete'&&old===serialized,unchangedEmbeddedBytes:method==='delete'?0:unchangedBytes(old?JSON.parse(old):undefined,value),operationId:value?.operationId||value?.intent?.operationId||null,revision:value?.storageRevision??value?.revision??null,completed:false,aborted:false};
      if(this.name==='payloadParts'&&method!=='delete')row.payloadNode=JSON.parse(value.payload);
      rows.push(row);entry.rows.push(row);
      row.requestSucceeded=false;
      try{const result=native[method].call(this,value,...args);result.addEventListener('success',()=>{row.requestSucceeded=true;entry.pending.set(address,serialized);});return result;}catch(error){row.thrown=error.name;throw error;}
    }
    window.idbWriteMeter={start(label){phase=label;},stop(){phase='idle';},async report(label){
      const selected=rows.filter(row=>row.phase===label),stores={};
      for(const row of selected){const s=stores[row.store]??={attempted:0,completed:0,aborted:0,bytes:0,completedBytes:0,unchangedWrites:0,unchangedEmbeddedBytes:0};s.attempted++;s.completed+=Number(row.completed);s.aborted+=Number(row.aborted);s.bytes+=row.bytes;s.completedBytes+=row.completed?row.bytes:0;s.unchangedWrites+=Number(row.unchanged);s.unchangedEmbeddedBytes+=row.unchangedEmbeddedBytes;}
      return {label,stores,operationIds:[...new Set(selected.map(row=>row.operationId).filter(Boolean))],revisions:[...new Set(selected.map(row=>row.revision).filter(value=>value!==null))],attempted:selected.length,completed:selected.filter(row=>row.completed).length,bytes:selected.reduce((sum,row)=>sum+row.bytes,0),writes:selected,browserEstimate:await navigator.storage.estimate()};
    },restore(){for(const method of Object.keys(native))IDBObjectStore.prototype[method]=native[method];}};
  });
}
module.exports={installWriteMeter};
