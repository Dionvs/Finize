import { storageError } from './period-projections.mjs';
const toValue=value=>value===null?{nullValue:null}:Array.isArray(value)?{arrayValue:{values:value.map(toValue)}}:typeof value==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,toValue(v)]))}}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value}:{stringValue:String(value)};
const fromValue=value=>'nullValue'in value?null:'mapValue'in value?Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,fromValue(v)])):'arrayValue'in value?(value.arrayValue.values||[]).map(fromValue):'integerValue'in value?Number(value.integerValue):'doubleValue'in value?value.doubleValue:'booleanValue'in value?value.booleanValue:value.stringValue;

// Deliberately cannot address production. Production cutover requires a separate approval.
export function createEmulatorRecordTransport({host='127.0.0.1:8181',projectId='demo-finize-v117',token,fetch:fetcher=globalThis.fetch}={}){
  if(!/^127\.0\.0\.1:\d+$/.test(host)||!/^demo-[a-z0-9-]+$/.test(projectId)||!token)throw storageError('emulator-only','Recordopslag is uitsluitend voor een expliciete lokale Firebase-emulator beschikbaar.');
  const root=`projects/${projectId}/databases/(default)/documents`,base=`http://${host}/v1/${root}`,metrics={requests:0,reads:0,writes:0,requestBytes:0};
  async function request(method,url,data){
    const body=data===undefined?undefined:JSON.stringify(data);metrics.requests++;metrics.requestBytes+=body?new TextEncoder().encode(body).length:0;
    const response=await fetcher(url,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+(typeof token==='function'?await token():token)},body});
    if(response.status===404)return null;
    const result=await response.json();
    if(!response.ok)throw Object.assign(storageError(response.status===403?'permission-denied':['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(result.error?.status)?'cloud-conflict':'firestore-error',result.error?.message||'Firestore-verzoek mislukt.'),{httpStatus:response.status,response:result});
    return result;
  }
  const decode=document=>document?{path:document.name.slice(root.length+1),data:fromValue({mapValue:{fields:document.fields||{}}}),version:document.updateTime}:null;
  async function get(path){metrics.reads++;return decode(await request('GET',base+'/'+path));}
  async function query(path,filter=null){
    const segments=path.split('/'),collectionId=segments.pop(),parent=segments.length?'/'+segments.join('/'):'';
    const structuredQuery={from:[{collectionId}]};
    if(filter)structuredQuery.where={fieldFilter:{field:{fieldPath:filter.field},op:filter.op||'EQUAL',value:toValue(filter.value)}};
    const result=await request('POST',base+parent+':runQuery',{structuredQuery});
    const rows=(result||[]).filter(row=>row.document).map(row=>decode(row.document));metrics.reads+=Math.max(1,rows.length);return rows;
  }
  async function commit(writes,expected=new Map()){
    for(const {data}of writes)if(new TextEncoder().encode(JSON.stringify(data)).length>800000)throw storageError('document-too-large','Een cloudbewijs overschrijdt de veilige documentgrens; de lokale administratie blijft bewaard.');
    const encoded=writes.map(({path,data})=>{
      const write={update:{name:root+'/'+path,fields:toValue(data).mapValue.fields}};
      if(expected.has(path)){const version=expected.get(path);write.currentDocument=version?{updateTime:version}:{exists:false};}
      return write;
    });
    if(new TextEncoder().encode(JSON.stringify(encoded)).length>8000000)throw storageError('request-too-large','De cloudaanvraag overschrijdt de veilige aanvraaggrens.');
    const result=await request('POST',base+':commit',{writes:encoded});metrics.writes+=writes.length;return result;
  }
  return {emulator:{host,projectId},get,query,commit,metrics};
}
