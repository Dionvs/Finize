import { encodeHouseholdState, decodeHouseholdState } from './household-store.mjs';
import { canonical, digest, storageError, financialPeriods, transactionPeriodDependencies, periodFinancials, cumulativeFinancials } from './period-projections.mjs';
export const RECORD_STORAGE_VERSION=2;
export const MAX_RECORD_PAYLOAD=180000;
export const clone=value=>structuredClone(value);

function parts(text){const result=[];let part='',bytes=0;for(const char of text){const n=new TextEncoder().encode(char).length;if(bytes+n>MAX_RECORD_PAYLOAD){result.push(part);part='';bytes=0;}part+=char;bytes+=n;}result.push(part);return result;}
const rawSource=value=>value?.bankOriginal??(value?.originalCsv!==undefined?{originalCsv:value.originalCsv,sourceFile:value.sourceFile??null}:null);

export async function buildRecordSnapshot(state,imports=[],options={}){
  if(state?.meta?.schemaVersion!==11||state.__finizePartialHistory)throw storageError('incomplete-state','Publicatie vereist een bewezen complete financiële basis.');
  const expanded=clone(state);expanded['@imports']=imports.map(batch=>{const {rows,...header}=clone(batch);expanded['@rows:'+batch.id]=rows||[];return header;});
  const encoded=encodeHouseholdState(expanded),months=financialPeriods(state,options.periods),dependencies=transactionPeriodDependencies(state,months),records=[],ordinals=new Map();
  for(const record of encoded.records){
    const ordinal=ordinals.get(record.collection)||0;ordinals.set(record.collection,ordinal+1);
    const payload=canonical(record.value),chunks=parts(payload),key=await digest(record.id),source=rawSource(record.value),sourceHash=source?await digest(source):'';
    const periods=record.collection==='transactions'?months.filter(month=>dependencies.get(month).has(record.recordId)):[];
    for(let part=0;part<chunks.length;part++)records.push({id:key+'-'+part,logicalId:key,recordKey:record.id,collection:record.collection,recordId:record.recordId,kind:encoded.layout[record.collection].kind,ordinal,part,partCount:chunks.length,logicalHash:await digest(payload),payload:chunks[part],hash:await digest(chunks[part]),sourceHash,periods,removed:false});
  }
  const periodDocuments=[];
  for(const month of months){
    const selected=records.filter(row=>row.periods.includes(month)),payload=canonical(periodFinancials(state,month,options));
    periodDocuments.push({id:month,month,projectionVersion:1,payload,dependencies:selected.map(row=>({id:row.id,hash:row.hash})).sort((a,b)=>a.id.localeCompare(b.id))});
  }
  const global={id:'financial',projectionVersion:1,payload:canonical(cumulativeFinancials(state))};
  const layout=Object.fromEntries(Object.entries(encoded.layout).map(([key,value])=>[key,value.kind]));
  return {records,periods:periodDocuments,global,layout,stateHash:await digest(state),importsHash:await digest(imports),recordCount:records.length,importCount:imports.length,periodHashes:Object.fromEntries(await Promise.all(periodDocuments.map(async row=>[row.month,await digest(row)]))),globalHash:await digest(global)};
}

export async function decodeRecordValues(records){
  const groups=new Map();
  for(const row of records.filter(row=>!row.removed)){
    if(await digest(row.payload)!==row.hash)throw storageError('record-integrity','Een opgeslagen recorddeel is corrupt.');
    if(!groups.has(row.logicalId))groups.set(row.logicalId,[]);groups.get(row.logicalId).push(row);
  }
  const decoded=[];
  for(const rows of groups.values()){
    rows.sort((a,b)=>a.part-b.part);const first=rows[0];
    if(rows.length!==first.partCount||rows.some((row,index)=>row.part!==index||row.partCount!==first.partCount||row.recordKey!==first.recordKey||row.logicalHash!==first.logicalHash||row.sourceHash!==first.sourceHash))throw storageError('record-integrity','Een financieel record is niet compleet.');
    const payload=rows.map(row=>row.payload).join('');if(await digest(payload)!==first.logicalHash)throw storageError('record-integrity','De recordhash wijkt af.');
    const value=JSON.parse(payload),source=rawSource(value);
    if((source?await digest(source):'')!==first.sourceHash)throw storageError('source-integrity','De onveranderlijke bank- of CSV-bron wijkt af van het bronbewijs.');
    decoded.push({id:first.recordKey,collection:first.collection,recordId:first.recordId,value,ordinal:first.ordinal});
  }
  return decoded;
}

export async function decodeRecordSnapshot(head,records){
  const decoded=await decodeRecordValues(records);
  const layout={};for(const[key,kind]of Object.entries(head.layout)){layout[key]=kind==='list'?{kind,ids:decoded.filter(row=>row.collection===key).sort((a,b)=>a.ordinal-b.ordinal).map(row=>row.recordId)}:{kind};}
  if(records.filter(row=>!row.removed).length!==head.recordCount)throw storageError('record-integrity','Het aantal financiële records wijkt af.');
  const expanded=decodeHouseholdState({storageVersion:1,schemaVersion:11,layout},decoded),imports=expanded['@imports']||[];delete expanded['@imports'];
  for(const batch of imports){batch.rows=expanded['@rows:'+batch.id]||[];delete expanded['@rows:'+batch.id];}
  if(await digest(expanded)!==head.stateHash||await digest(imports)!==head.importsHash)throw storageError('record-integrity','De teruggelezen administratie of importhistorie wijkt af.');
  return {state:expanded,imports};
}

export function recordChanges(previous,next){
  const documents=snapshot=>new Map([...(snapshot?.records||[]).map(row=>['records/'+row.id,row]),...(snapshot?.periods||[]).map(row=>['periods/'+row.id,row]),...(snapshot?.global?[['globals/financial',snapshot.global]]:[])]);
  const a=documents(previous),b=documents(next),result=[];
  for(const path of new Set([...a.keys(),...b.keys()])){
    const before=a.get(path)||null,value=b.get(path)||null;
    if(before?.sourceHash&&value&&before.sourceHash!==value.sourceHash)throw storageError('source-immutable','Onveranderlijke bankbron of CSV-bron gewijzigd.');
    if(canonical(before)===canonical(value))continue;
    const after=value||{...before,removed:true,periods:[]};
    if(canonical(before)===canonical(after))continue;
    result.push({id:path.replace('/','_'),path,before,after});
  }
  return result;
}
