const assert=require('node:assert/strict');
const u4=require('../update4.js');

function snapshot(value){
  return {exists:()=>value!==undefined,data:()=>value};
}

(async()=>{
  const rows=Array.from({length:405},(_,index)=>({id:`row-${index}`,bankOriginal:{lineNumber:index+1},processing:{category:'Overig'}}));
  const record={id:'cloud-1',fileName:'bank.csv',status:'concept',rawText:'gevoelige csv-inhoud',rows};
  const envelope=u4.buildCloudImportEnvelope(record);

  assert.equal(envelope.header.storageVersion,2);
  assert.equal(envelope.header.rowCount,405);
  assert.equal(envelope.header.chunkCount,3);
  assert.equal(envelope.header.rowsChecksum,u4.rowsChecksum(rows));
  assert.equal(u4.rowsChecksum([{b:2,a:1}]),u4.rowsChecksum([{a:1,b:2}]),'checksum moet onafhankelijk zijn van Firestore-veldvolgorde');
  assert.equal('rows' in envelope.header,false);
  assert.equal('rawText' in envelope.header,false);

  const reversed=[...envelope.chunks].reverse();
  const assembled=u4.assembleCloudImport(envelope.header,reversed,'cloud-1');
  assert.deepEqual(assembled.rows,rows,'chunks moeten op index worden geassembleerd');

  const legacyHeader={...envelope.header};
  delete legacyHeader.storageVersion;
  delete legacyHeader.rowsChecksum;
  assert.deepEqual(u4.assembleCloudImport(legacyHeader,reversed,'cloud-1').rows,rows,'oude cloudimports blijven ondersteund');

  const damaged=envelope.chunks.map(chunk=>u4.clone(chunk));
  damaged[0].rows[0].processing.category='Beschadigd';
  assert.throws(()=>u4.assembleCloudImport(envelope.header,damaged,'cloud-1'),error=>error.code==='cloud-checksum');
  assert.throws(()=>u4.assembleCloudImport(envelope.header,envelope.chunks.slice(1),'cloud-1'),error=>error.code==='cloud-incomplete');
  assert.throws(()=>u4.assembleCloudImport(envelope.header,[envelope.chunks[0],envelope.chunks[0],envelope.chunks[2]],'cloud-1'),error=>error.code==='cloud-incomplete');

  let cloudReads=0;
  let localWrites=0;
  const localResult=await u4.resolveImportDetails('local',{
    localRead:async()=>({id:'local',rows:[]}),
    cloudRead:async()=>{cloudReads++;return {id:'cloud'};},
    localWrite:async()=>{localWrites++;}
  });
  assert.equal(localResult.source,'local');
  assert.equal(cloudReads,0,'een lokale import mag geen cloudread starten');
  assert.equal(localWrites,0);

  const cached=[];
  const cloudResult=await u4.resolveImportDetails('cloud-1',{
    localRead:async()=>undefined,
    cloudRead:async()=>assembled,
    localWrite:async value=>cached.push(value)
  });
  assert.equal(cloudResult.source,'cloud');
  assert.equal(cached.length,1);
  assert.deepEqual(cached[0].rows,rows);

  const documents=new Map();
  documents.set('budgetPlanners/finize/imports/cloud-1',envelope.header);
  envelope.chunks.forEach((chunk,index)=>documents.set(`budgetPlanners/finize/imports/cloud-1/chunks/${String(index).padStart(4,'0')}`,chunk));
  let active=0;
  let maximumActive=0;
  const firestore={
    doc:(_db,...parts)=>parts.join('/'),
    getDoc:async ref=>{
      const isChunk=ref.includes('/chunks/');
      if(isChunk){active++;maximumActive=Math.max(maximumActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;}
      return snapshot(documents.get(ref));
    }
  };
  const root={CloudAdapter:{isConnected:()=>true,modules:{firestore},db:{}}};
  const fetched=await u4.fetchImportFromCloud(root,'cloud-1');
  assert.deepEqual(fetched.rows,rows);
  assert.ok(maximumActive<=4,'maximaal vier chunkreads tegelijk');

  documents.delete('budgetPlanners/finize/imports/cloud-1/chunks/0001');
  await assert.rejects(()=>u4.fetchImportFromCloud(root,'cloud-1'),error=>error.code==='cloud-incomplete');
  await assert.rejects(()=>u4.fetchImportFromCloud({CloudAdapter:{isConnected:()=>false,isConfigured:()=>false}},'cloud-1'),error=>error.code==='cloud-offline');

  const originalListSync=u4.ImportStore.listSync;
  const originalGetImport=u4.ImportStore.getImport;
  const originalDeleteSync=u4.ImportStore.deleteSync;
  const writes=[];
  u4.ImportStore.listSync=async()=>[{id:'cloud-1',importId:'cloud-1'}];
  u4.ImportStore.getImport=async()=>record;
  u4.ImportStore.deleteSync=async()=>{};
  try{
    const writeFirestore={
      doc:(_db,...parts)=>parts.join('/'),
      setDoc:async(ref,value,options)=>writes.push({ref,value,options})
    };
    const synced=await u4.flushImportSync({CloudAdapter:{isConnected:()=>true,modules:{firestore:writeFirestore},db:{}}});
    assert.equal(synced,true);
    assert.ok(writes.slice(0,-1).every(write=>write.ref.includes('/chunks/')),'chunks moeten vóór de header worden geschreven');
    assert.equal(writes.at(-1).ref,'budgetPlanners/finize/imports/cloud-1');
    assert.equal(writes.at(-1).options.merge,false,'de compacte header moet oude rawText verwijderen');
    assert.equal('rawText' in writes.at(-1).value,false);
  }finally{
    u4.ImportStore.listSync=originalListSync;
    u4.ImportStore.getImport=originalGetImport;
    u4.ImportStore.deleteSync=originalDeleteSync;
  }

  console.log('UPDATE4_CLOUD_IMPORT_OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
