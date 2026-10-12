const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {encodePayloadRow,decodePayloadRow,createPayloadDecoder}=require('../src/storage/payload-parts.mjs');
const {createPayloadPreparation,preparationSignature}=require('../src/storage/payload-parts.mjs');

test('P4.3 preparation preserves exact hashes across cloned journal/state roots and changed inputs',async()=>{
  const preparation=createPayloadPreparation(),rows=Array.from({length:100},(_,i)=>({id:'source-'+i,amount:-10,bankOriginal:{bankDate:'2025-01-03',description:'original '+i}}));
  const initial={id:'journal',candidate:{transactions:rows},baseSignature:JSON.stringify({transactions:rows})};
  const first=encodePayloadRow(initial,preparation.digests,preparation);
  assert.deepEqual(first,encodePayloadRow(initial));
  const next={id:'proof',state:structuredClone(initial.candidate)};
  const reused=encodePayloadRow(next,preparation.digests,preparation),full=encodePayloadRow(next);
  assert.deepEqual(reused.stored,full.stored);
  assert.deepEqual(await decodePayloadRow(reused.stored,id=>reused.parts.get(id)),next);
  next.state.transactions[0].amount=-99;
  const edited=encodePayloadRow(next,preparation.digests,preparation);
  assert.deepEqual(edited.stored,encodePayloadRow(next).stored);
  assert.deepEqual(await decodePayloadRow(edited.stored,id=>edited.parts.get(id)),next);
});

test('P4.3 JSON-ineligible values cannot alias preparation entries',()=>{
  for(const value of [{id:'a',missing:undefined},{id:'a',value:NaN},{id:'a',value:-0},{id:'a','':new Date('2026-01-01')},[undefined]])assert.equal(preparationSignature(value),null);
  assert.notEqual(preparationSignature({id:'a',value:null}),preparationSignature({id:'a'}));
  assert.notEqual(preparationSignature({id:'a',a:1,b:2}),preparationSignature({id:'a',b:2,a:1}));
});

test('P4 payload codec is lossless for ordered JSON signatures, Unicode, undefined and marker-shaped user values',async()=>{
  const data={id:'receipt',status:'pending',undefinedValue:undefined,signature:JSON.stringify({z:'é🐈'.repeat(2000),a:[1,2,3]}),nested:{a:'x'.repeat(4097),b:[{__finizePayloadRef:2,hash:'literal user content'}]}};
  const packed=encodePayloadRow(data);
  assert.deepEqual(await decodePayloadRow(packed.stored,id=>packed.parts.get(id)),data);
  for(const [hash,part]of packed.parts)assert.equal(hash,createHash('sha256').update(part.payload).digest('hex'));
});

test('P4 unchanged history shares identical immutable part hashes across ten revisions',async()=>{
  const history=Array.from({length:100},(_,id)=>({id:'historic-'+id,bankOriginal:{amount:-10,description:'Source '+id,raw:'immutable'.repeat(150)}}));
  const first=encodePayloadRow({id:'journal',candidate:{transactions:history,meta:{revision:1}}});
  const all=new Map(first.parts),added=[];
  for(let revision=2;revision<=11;revision++){
    const next=encodePayloadRow({id:'journal',candidate:{transactions:history,meta:{revision}}});
    const fresh=[...next.parts].filter(([id])=>!all.has(id));added.push(fresh.length);for(const pair of fresh)all.set(...pair);
    assert.deepEqual((await decodePayloadRow(next.stored,id=>all.get(id))).candidate.transactions,history);
    assert.equal(fresh.length,2,'only the changed revision and its small candidate manifest are new');
  }
  assert.equal(added.length,10);
});

test('P4 missing and corrupted immutable parts fail closed',async()=>{
  const packed=encodePayloadRow({id:'financial',value:{history:'x'.repeat(4000)}});
  await assert.rejects(decodePayloadRow(packed.stored,()=>undefined),{code:'storage-payload-integrity'});
  await assert.rejects(decodePayloadRow(packed.stored,id=>({...packed.parts.get(id),payload:'corrupt'})),{code:'storage-payload-integrity'});
});

test('P4.2 transaction decoder verifies each shared part once and never returns mutable aliases',async()=>{
  const value={a:{amount:100},b:{amount:100},array:[{amount:100},{amount:100}],missing:undefined};
  const first=encodePayloadRow({id:'first',value}),second=encodePayloadRow({id:'second',value});
  const reads=new Map(),read=id=>{reads.set(id,(reads.get(id)||0)+1);return first.parts.get(id)||second.parts.get(id);};
  const decode=createPayloadDecoder(read),[a,b]=await Promise.all([decode(first.stored),decode(second.stored)]);
  assert.deepEqual(a.value,value);assert.deepEqual(b.value,value);
  a.value.a.amount=999;a.value.array[0].amount=888;
  assert.equal(a.value.b.amount,100);assert.equal(a.value.array[1].amount,100);assert.equal(b.value.a.amount,100);
  assert.deepEqual((await decode(first.stored)).value,value);
  assert([...reads.values()].every(count=>count===1));
  // A fresh transaction must read and validate again, including after deletion/corruption.
  await assert.rejects(createPayloadDecoder(()=>undefined)(first.stored),{code:'storage-payload-integrity'});
  await assert.rejects(createPayloadDecoder(id=>({...first.parts.get(id),payload:'broken'}))(first.stored),{code:'storage-payload-integrity'});
});

test('P4.2 encoding memo uses exact immutable text and preserves hashes when an input is mutated',async()=>{
  const memo=new Map(),value={amount:100},first=encodePayloadRow({id:'a',value},memo);
  value.amount=200;const second=encodePayloadRow({id:'a',value},memo);
  assert.notEqual(first.stored.value.hash,second.stored.value.hash);
  assert.deepEqual(await decodePayloadRow(second.stored,id=>second.parts.get(id)),{id:'a',value:{amount:200}});
  for(const [hash,part]of second.parts)assert.equal(hash,createHash('sha256').update(part.payload).digest('hex'));
});

test('P4 small financial objects share their existing proof parts inside a later journal',()=>{
  const history=Array.from({length:100},(_,i)=>({id:'historic-'+i,bankOriginal:{amount:-10,bankDate:'2025-01-03',rawCells:['source-'+i]},approvedProcessing:{category:'OV',budgetItemId:'ov'}}));
  const existing=new Map();
  for(const value of history)for(const part of encodePayloadRow({id:value.id,value}).parts)existing.set(...part);
  const journal=encodePayloadRow({id:'next-journal',candidate:{transactions:history}});
  for(const [hash,part]of journal.parts){
    if(part.payload.includes('bankOriginal')||part.payload.includes('rawCells')||part.payload.includes('approvedProcessing'))assert(existing.has(hash),'unchanged financial objects must already exist before the first edit');
  }
});

test('P4 updating and moving one existing source does not rewrite shifted history',async()=>{
  const totals=[];
  for(const count of [20,100]){
    const rows=Array.from({length:count},(_,i)=>({id:'bank-'+i,category:'OV',original:'immutable-source-'+i+'x'.repeat(1200)}));
    const first=encodePayloadRow({id:'state',transactions:rows}),all=new Map(first.parts);
    const changed={...rows[0],category:'Overig'},next=encodePayloadRow({id:'state',transactions:[...rows.slice(1),changed]});
    const fresh=[...next.parts].filter(([hash])=>!all.has(hash));
    for(const [,part]of fresh)assert.equal(part.payload.includes('immutable-source-1x'),false);
    totals.push(fresh.reduce((sum,[,part])=>sum+Buffer.byteLength(JSON.stringify(part)),0));
    for(const entry of fresh)all.set(...entry);
    assert.deepEqual((await decodePayloadRow(next.stored,id=>all.get(id))).transactions,[...rows.slice(1),changed]);
  }
  assert(totals[1]<=totals[0]+8192,JSON.stringify(totals));
});
