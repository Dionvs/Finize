import { decodeCloudState } from '../shared/cloud-chunks.mjs';

const fail=(code,status=503)=>{throw Object.assign(new Error(code),{code,status});};
// The same native profile reader is used by HTTP authorization and the admin CLI.
export async function readBankProfile(db,householdId,profileId) {
  const current=db.doc('households/'+householdId+'/budgetState/current');
  const first=await current.get(),pointer=first.data();
  if(!pointer)fail('household-not-found',403);
  let state=pointer.state;
  if(pointer.stateFormat==='finize-json-chunks-v1') {
    const generation=current.collection('generations').doc(pointer.activeGeneration),descriptor=(await generation.get()).data();
    if(!Number.isSafeInteger(descriptor?.chunkCount)||descriptor.chunkCount<1||descriptor.chunkCount>10000)fail('storage-unavailable');
    const chunks=await generation.collection('chunks').get();
    state=await decodeCloudState(pointer,descriptor,chunks.docs.map(doc=>doc.data()).sort((a,b)=>a.sequence-b.sequence));
  }else if(pointer.stateFormat)fail('storage-version-unsupported');
  if((await current.get()).updateTime?.toMillis()!==first.updateTime?.toMillis())fail('storage-changed',409);
  const matches=state?.accountProfiles?.filter(row=>row.id===profileId)||[];
  return matches.length===1?matches[0]:null;
}
