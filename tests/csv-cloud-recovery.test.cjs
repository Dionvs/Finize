const assert=require('node:assert/strict');
const u4=require('../update4.js');

function rootWith(state){
  return {
    state,
    commitChange(mutator){mutator();return true;},
    renderActiveTab(){this.rendered=(this.rendered||0)+1;},
    CloudAdapter:{isConnected:()=>false}
  };
}

(async()=>{
  const stale=rootWith({
    activeImportId:'stale-import',
    importSummaries:[{id:'processed-import',status:'verwerkt'}],
    transactions:[{id:'keep-transaction'}]
  });
  const staleResult=await u4.reconcileActiveImportReference(stale,{localRead:async()=>undefined});
  assert.equal(staleResult.action,'cleared-stale');
  assert.equal(stale.state.activeImportId,'');
  assert.equal(stale.state.transactions.length,1);

  const cloudOnly=rootWith({
    activeImportId:'cloud-concept',
    importSummaries:[{id:'cloud-concept',status:'concept'}],
    transactions:[]
  });
  const cloudResult=await u4.reconcileActiveImportReference(cloudOnly,{localRead:async()=>undefined});
  assert.equal(cloudResult.action,'cloud-needed');
  assert.equal(cloudOnly.state.activeImportId,'cloud-concept');

  const localConcept={id:'local-concept',status:'concept',rows:[]};
  const local=rootWith({
    activeImportId:'local-concept',
    importSummaries:[{id:'local-concept',status:'concept'}],
    transactions:[]
  });
  const localResult=await u4.reconcileActiveImportReference(local,{localRead:async()=>localConcept});
  assert.equal(localResult.action,'local');
  assert.equal(local.state.activeImportId,'local-concept');

  const cloudDeletes=[];
  const firestore={
    doc:(_db,...parts)=>parts.join('/'),
    getDoc:async()=>({exists:()=>true,data:()=>({chunkCount:2})}),
    deleteDoc:async ref=>cloudDeletes.push(ref)
  };
  const cloudCleanup=await u4.deleteCloudImportBestEffort({
    CloudAdapter:{isConnected:()=>true,modules:{firestore},db:{}}
  },'cloud-concept');
  assert.equal(cloudCleanup,true);
  assert.deepEqual(cloudDeletes,[
    'budgetPlanners/finize/imports/cloud-concept/chunks/0000',
    'budgetPlanners/finize/imports/cloud-concept/chunks/0001',
    'budgetPlanners/finize/imports/cloud-concept'
  ]);

  const original={
    getImport:u4.ImportStore.getImport,
    putJournal:u4.ImportStore.putJournal,
    deleteImport:u4.ImportStore.deleteImport,
    deleteSync:u4.ImportStore.deleteSync
  };
  const journals=[];
  const deleted=[];
  u4.ImportStore.getImport=async()=>localConcept;
  u4.ImportStore.putJournal=async journal=>journals.push(u4.clone(journal));
  u4.ImportStore.deleteImport=async id=>deleted.push(`import:${id}`);
  u4.ImportStore.deleteSync=async id=>deleted.push(`sync:${id}`);
  try{
    const discardRoot=rootWith({
      activeImportId:'local-concept',
      importSummaries:[
        {id:'local-concept',status:'concept'},
        {id:'processed-import',status:'verwerkt'}
      ],
      transactions:[{id:'keep-transaction',importBatchId:'processed-import'}],
      savingsGoalLedger:[{id:'keep-saving'}],
      advanceLedger:[{id:'keep-advance'}],
      monthRecords:{'2026-07':{status:'open'}}
    });
    const before=JSON.stringify({
      transactions:discardRoot.state.transactions,
      savingsGoalLedger:discardRoot.state.savingsGoalLedger,
      advanceLedger:discardRoot.state.advanceLedger,
      monthRecords:discardRoot.state.monthRecords
    });
    const result=await u4.discardImportConcept(discardRoot,'local-concept',{cleanupCloud:false});
    assert.equal(result.ok,true);
    assert.equal(discardRoot.state.activeImportId,'');
    assert.deepEqual(discardRoot.state.importSummaries,[{id:'processed-import',status:'verwerkt'}]);
    assert.equal(JSON.stringify({
      transactions:discardRoot.state.transactions,
      savingsGoalLedger:discardRoot.state.savingsGoalLedger,
      advanceLedger:discardRoot.state.advanceLedger,
      monthRecords:discardRoot.state.monthRecords
    }),before,'conceptherstel mag geen financiële gegevens wijzigen');
    assert.deepEqual(deleted,['import:local-concept','sync:local-concept']);
    assert.equal(journals.at(-1).status,'completed');
    assert.equal(discardRoot.rendered,1);
  }finally{
    Object.assign(u4.ImportStore,original);
  }

  console.log('CSV_CLOUD_RECOVERY_OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
