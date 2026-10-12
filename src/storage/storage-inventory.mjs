// Explicit diagnostics only. Never deletes or modifies protected backup stores.
export function storageScopeMatches(key,base,scope){
  return typeof key==='string'&&(scope==='legacy'?key===base:key.startsWith(`${base}:account:${scope}:`));
}
export function imageScopeMatches(key,scope){
  let household=null;try{const parsed=JSON.parse(key);if(Array.isArray(parsed))household=parsed[0];}catch{}
  return scope==='legacy'?household===null:household===scope;
}
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
async function existingStoreBytes(name,storeName,include,{indexedDB=globalThis.indexedDB}={}){
  if(indexedDB.databases&&!(await indexedDB.databases()).some(row=>row.name===name))return 0;
  const db=await new Promise((resolve,reject)=>{
    const open=indexedDB.open(name);let absent=false;
    open.onupgradeneeded=()=>{absent=true;open.transaction.abort();};
    open.onerror=()=>absent?resolve(null):reject(open.error);
    open.onsuccess=()=>resolve(open.result);
    open.onblocked=()=>reject(new Error('Beschermde opslaginventaris is geblokkeerd.'));
  });
  if(!db)return 0;
  try{
    if(!db.objectStoreNames.contains(storeName))throw new Error('Onbekende beschermde opslagstructuur: '+name);
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readonly'),cursor=tx.objectStore(storeName).openCursor();let total=0,failure;
      cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;try{if(include(row.key,row.value))total+=bytes(row.value);row.continue();}catch(error){failure=error;tx.abort();}};
      tx.oncomplete=()=>resolve(total);tx.onabort=tx.onerror=()=>reject(failure||tx.error||cursor.error);
    });
  }finally{db.close();}
}
export async function protectedStorageUsage(scope,{indexedDB=globalThis.indexedDB,storage=globalThis.localStorage}={}){
  const stateBase='finize-budget-planner-v1',backupBase=stateBase+'-last-good-backup',migrationBase=stateBase+'-pre-schema-v5';
  const [migrationBackups,emergencyBackups,goalImages]=await Promise.all([
    existingStoreBytes('finize-migration-backups','originals',(_,row)=>storageScopeMatches(row.scope||'',migrationBase,scope),{indexedDB}),
    existingStoreBytes('finize-state-backups','snapshots',(_,row)=>storageScopeMatches(row.scope||'',backupBase,scope),{indexedDB}),
    existingStoreBytes('finize-goal-images-v1','images',key=>imageScopeMatches(String(key),scope),{indexedDB})
  ]);
  const local={financialState:0,migrationBackups:0,emergencyBackups:0};
  if(storage)for(let i=0;i<storage.length;i++){
    const key=storage.key(i);let category;
    if(storageScopeMatches(key,stateBase,scope))category='financialState';
    else if(storageScopeMatches(key,migrationBase,scope))category='migrationBackups';
    else if(storageScopeMatches(key,backupBase,scope))category='emergencyBackups';
    if(category)local[category]+=new TextEncoder().encode(storage.getItem(key)||'').length;
  }
  return {migrationBackups,emergencyBackups,goalImages,localStorage:local};
}
