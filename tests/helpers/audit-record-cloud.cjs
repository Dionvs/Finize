// Synthetic HTTP responses for the existing record transport. Never reaches a server.
async function attachMockRecordCloud(page){return page.evaluate(async()=>{
 const documents=new Map();let revision=0;
 const base='projects/demo-finize-audit/databases/(default)/documents';
 const native=v=>'nullValue'in v?null:'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,native(x)])):'arrayValue'in v?(v.arrayValue.values||[]).map(native):'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:v.stringValue;
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const fetch=async(url,options={})=>{
  if(!url.startsWith('http://127.0.0.1:4998/v1/'+base))throw Error('Synthetic transport forbids other hosts');
  const path=url.slice(('http://127.0.0.1:4998/v1/').length),body=options.body?JSON.parse(options.body):null;
  if(path.endsWith(':commit')){
   for(const write of body.writes){const old=documents.get(write.update.name),guard=write.currentDocument;
    if(guard&&(guard.exists===false&&old||guard.updateTime&&guard.updateTime!==old?.updateTime))return response({error:{status:'FAILED_PRECONDITION',message:'Synthetic revision conflict'}},409);
   }
   const time=new Date(Date.UTC(2026,9,25,12,0,0,++revision)).toISOString();
   for(const write of body.writes)documents.set(write.update.name,{...structuredClone(write.update),updateTime:time});
   return response({writeResults:body.writes.map(()=>({updateTime:time})),commitTime:time});
  }
  if(path.endsWith(':runQuery')){
   const q=body.structuredQuery,prefix=path.slice(0,-':runQuery'.length)+'/'+q.from[0].collectionId+'/',filter=q.where?.fieldFilter;
   const found=[...documents.entries()].filter(([key,doc])=>{
    if(!key.startsWith(prefix)||key.slice(prefix.length).includes('/'))return false;
    if(!filter)return true;const value=native({mapValue:{fields:doc.fields}})[filter.field.fieldPath],expected=native(filter.value);
    return filter.op==='ARRAY_CONTAINS'?Array.isArray(value)&&value.includes(expected):JSON.stringify(value)===JSON.stringify(expected);
   }).map(([,document])=>({document:structuredClone(document)}));return response(found);
  }
  return documents.has(path)?response(documents.get(path)):response({error:{status:'NOT_FOUND'}},404);
 };
 const session=await FinizeCloudRecords.createEmulatorSession({householdId:CloudAdapter.importScope(),host:'127.0.0.1:4998',projectId:'demo-finize-audit',token:'synthetic-only',fetch});
 const snapshot=await session.readLocal();
 await session.cloudStore.initializeNew({state:snapshot.state,imports:snapshot.imports,epoch:'synthetic-audit',approveTestCutover:true});
 await session.establishBase();await session.sync();await session.attach({automatic:false,periodLoading:false});
 window.auditRecordSession=session;window.auditRecordDocuments=documents;return session.transport.metrics;
});}
module.exports={attachMockRecordCloud};
