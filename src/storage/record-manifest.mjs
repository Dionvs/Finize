import { canonical,digest,storageError } from './period-projections.mjs';

// Hash buckets contain identities and hashes only. Normal writes read touched buckets.
export const manifestBucket=row=>(row.collection.startsWith('@')?'i':'s')+row.logicalId.slice(0,2);
export async function recordManifests(records,existingIds=[]){
  const buckets=new Map(existingIds.map(id=>[id,{id,entries:{}}]));
  for(const row of records.filter(row=>!row.removed)){
    const id=manifestBucket(row);if(!buckets.has(id))buckets.set(id,{id,entries:{}});
    buckets.get(id).entries[row.id]=await digest(row);
  }
  const manifests=[...buckets.values()].sort((a,b)=>a.id.localeCompare(b.id));
  return {manifests,manifestHashes:Object.fromEntries(await Promise.all(manifests.map(async row=>[row.id,await digest(row)])))};
}
export async function manifestRoots(hashes){
  const root=prefix=>digest(Object.fromEntries(Object.entries(hashes).filter(([id])=>id.startsWith(prefix))));
  return {stateHash:await root('s'),importsHash:await root('i')};
}
export async function verifyRecordManifests(head,records,manifests){
  if(!head.manifestHashes)throw storageError('manifest-missing','Deze cloudversie vereist eerst een gecontroleerde manifestmigratie.');
  const computed=await recordManifests(records,Object.keys(head.manifestHashes));
  if(canonical(computed.manifestHashes)!==canonical(head.manifestHashes))throw storageError('record-integrity','De recordmanifesten sluiten niet aan op de canonieke bronnen.');
  for(const expected of computed.manifests){const stored=manifests.find(row=>row.id===expected.id);if(!stored||await digest(stored)!==head.manifestHashes[expected.id])throw storageError('record-integrity','Een geverifieerd recordmanifest ontbreekt.');}
  if(head.integrityMode==='manifest'){
    const roots=await manifestRoots(head.manifestHashes);
    if(roots.stateHash!==head.stateHash||roots.importsHash!==head.importsHash)throw storageError('record-integrity','De administratie wijkt af van het manifestcontract.');
  }
}
