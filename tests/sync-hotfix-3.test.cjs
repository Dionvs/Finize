const {test}=require('node:test'),assert=require('node:assert/strict');
const u=require('../src/import/update4-runtime.cjs');
const {state,row,materialize,memory,copy}=require('./helpers/package5-fixture.cjs');
function adapter(root,counter){const docs=new Map(),snap=ref=>({exists:()=>docs.has(ref),data:()=>copy(docs.get(ref))});return {docRef:'core',initialSyncComplete:true,isConnected:()=>true,db:{},modules:{firestore:{doc:(_, ...parts)=>parts.join('/'),setDoc:async(ref,data)=>docs.set(ref,copy(data)),runTransaction:async(_,work)=>work({get:async ref=>snap(ref),set:(ref,data)=>docs.set(ref,copy(data))})}},queueSave:()=>counter.saves++,flushQueue:async()=>{const staged=await u.stageImportCloudWrites(root,root.state);await staged.readAndValidate({get:async ref=>snap(ref)});staged.publish({set:(ref,data)=>docs.set(ref,copy(data))});await staged.acknowledge();return true;}};}
test('S1/S2/S14 zero-stage orphan queue never requests core save and stays intact',async()=>{
 const mem=memory();try{const s=state(),before=copy(s),queue={id:'missing',importId:'missing',version:1,operationId:'orphan'},root={state:s},counter={saves:0};mem.queue.set(queue.id,copy(queue));root.CloudAdapter=adapter(root,counter);
  for(let i=0;i<3;i++)await u.flushImportSync(root);
  assert.equal(counter.saves,0);assert.deepEqual(mem.queue.get(queue.id),queue);assert.deepEqual(s,before);assert.equal(mem.imports.size,0);assert.equal(mem.journals.size,0);
 }finally{mem.restore();}
});
test('S3 conflict queue is preserved without empty core commit',async()=>{
 const mem=memory();try{const s=state(),batch=materialize(s,[row('conflict-row')]),root={state:s},counter={saves:0};mem.imports.set(batch.id,copy(batch));await u.queueImportSync(batch);mem.journals.set('conflict-'+batch.id,{id:'conflict-'+batch.id,status:'conflict',local:copy(batch)});root.CloudAdapter=adapter(root,counter);const before=copy([...mem.queue.values()]),journal=copy([...mem.journals.values()]);await u.flushImportSync(root);assert.equal(counter.saves,0);assert.deepEqual([...mem.queue.values()],before);assert.deepEqual([...mem.journals.values()],journal);
 }finally{mem.restore();}
});
test('S4/S13 later real import intent retries once and acknowledges only its receipt',async()=>{
 const mem=memory();try{const s=state(),batch=materialize(s,[row('source')]),root={state:s},counter={saves:0};await u.queueImportSync(batch);root.CloudAdapter=adapter(root,counter);await u.flushImportSync(root);assert.equal(counter.saves,0);assert.equal(mem.queue.size,1);mem.imports.set(batch.id,copy(batch));const financial=copy(s);assert.equal(await u.flushImportSync(root),true);assert.equal(counter.saves,1);assert.equal(mem.queue.size,0);assert.deepEqual(s,financial);await u.flushImportSync(root);assert.equal(counter.saves,1);
 }finally{mem.restore();}
});
test('S3/S14 conflicted legacy record is not upgraded or reconstructed on automatic retry',async()=>{
 const mem=memory();try{const s=state(),batch=materialize(s,[row('legacy-conflict')]),root={state:s},counter={saves:0};delete batch.operationId;mem.imports.set(batch.id,copy(batch));await u.queueImportSync(batch);mem.journals.set('conflict-'+batch.id,{id:'conflict-'+batch.id,status:'conflict',local:copy(batch)});root.CloudAdapter=adapter(root,counter);const before=JSON.stringify({s,imports:[...mem.imports],queue:[...mem.queue],journal:[...mem.journals]});await u.flushImportSync(root);assert.equal(counter.saves,0);assert.equal(JSON.stringify({s,imports:[...mem.imports],queue:[...mem.queue],journal:[...mem.journals]}),before);
 }finally{mem.restore();}
});
test('S1/S2 inconsistent compact receipt blocks save while preserving the full pending choice',async()=>{
 const mem=memory();try{const s=state(),batch=materialize(s,[row('mismatched-receipt')]),root={state:s},counter={saves:0};mem.imports.set(batch.id,copy(batch));await u.queueImportSync(batch);s.importSummaries[0].operationId='different-operation';root.CloudAdapter=adapter(root,counter);const before=JSON.stringify({s,imports:[...mem.imports],queue:[...mem.queue]});assert.equal(await u.flushImportSync(root),false);assert.equal(counter.saves,0);assert.equal(JSON.stringify({s,imports:[...mem.imports],queue:[...mem.queue]}),before);
 }finally{mem.restore();}
});
