const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),visual=require('../fixtures/v50-visual-state.json'),{state:fixture}=require('../helpers/package5-fixture.cjs');
test.setTimeout(60000);
async function boot(page){
 await page.route('https://**',route=>route.abort());
 await page.route('http://127.0.0.1:4173/src/**',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.resolve(__dirname,'../..')+new URL(route.request().url()).pathname,'utf8')}));
 const seed={...visual,...fixture()};seed.accountProfiles=[{id:'personal',accountOwner:'dion',identifier:'NL20INGB0001234567',name:'Persoonlijk',status:'active',accountType:'payment'},{id:'joint',accountOwner:'gezamenlijk',identifier:'NL91ABNA0417164300',name:'Gezamenlijk',status:'active',accountType:'payment'}];seed.monthRecords={};
 await page.addInitScript(value=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));},seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await configure(page);
 await page.evaluate(async()=>{
  const personal=await FinizeBank.ingest(bankSnapshot('personal'),CloudAdapter.importScope());
  await FinizeUpdate4Runtime.commitImportCommand(window,personal,{type:'source-approve',rowId:personal.rows[0].id});
  const joint=await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope());
  await FinizeUpdate4Runtime.commitImportCommand(window,joint,{type:'delete'});
  window.deletedId=joint.id;window.remoteBankImports.set(joint.id,await FinizeUpdate4Runtime.ImportStore.getImport(joint.id));
  window.originalBankState=JSON.stringify(state);window.originalDeletion=JSON.stringify(await FinizeUpdate4Runtime.ImportStore.getImport(joint.id));
 });
}
async function configure(page){await page.evaluate(async()=>{
 const {installBankConnection}=await import('/src/ui/bank-connection.mjs');
 window.remoteBankImports=new Map();
 CloudAdapter.isConnected=()=>true;CloudAdapter.initialSyncComplete=true;CloudAdapter.recordAutomatic=false;CloudAdapter.recordSession={loadImport:async id=>{if(remoteBankImports.has(id))return structuredClone(remoteBankImports.get(id));throw Object.assign(new Error('cloud-missing'),{code:'cloud-missing'});}};
 window.FinizeBank=installBankConnection(window,{enabled:true,baseUrl:'http://127.0.0.1:4999/bank'});
 window.bankSnapshot=id=>({version:1,runId:'synthetic-'+id,householdId:CloudAdapter.importScope(),accountProfileId:id,fetchedAt:'2026-10-26T12:00:00Z',account:{iban:state.accountProfiles.find(p=>p.id===id).identifier,identificationHash:'synthetic-'+id},fromDate:'2026-10-01',toDate:'2026-10-26',complete:true,balances:[],transactions:[{entry_reference:'same-reference',status:'BOOK',booking_date:'2026-10-23',transaction_amount:{amount:'10.00',currency:'EUR'},credit_debit_indicator:'DBIT',remittance_information:['Synthetische controle']}]});
});}
test('deleted second account needs explicit confirmation; cancellation preserves all financial state and first approval',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const errors=[];for(const options of [{},{confirmRestart:()=>false}])try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',options);}catch(e){errors.push(e.code);}
  return {errors,same:JSON.stringify(state)===originalBankState,tombstone:JSON.stringify(await FinizeUpdate4Runtime.ImportStore.getImport(deletedId))===originalDeletion,imports:(await FinizeUpdate4Runtime.ImportStore.listImports()).length};
 });expect(result).toEqual({errors:['bank-import-deleted','bank-import-restart-cancelled'],same:true,tombstone:true,imports:2});
});
test('confirmed generation survives repeat and reload without duplicate sources or loss of personal approval',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>state.transactions.filter(t=>t.accountProfileId==='personal'));
 const first=await page.evaluate(async()=>{window.newBankBatch=await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});return newBankBatch;});
 expect(first.id).not.toBe(first.providerRestartFrom.id);expect(first.rows[0].approvalSource).toBe('');expect(first.rows[0].processingStatus).toBe('nakijken');
 await page.evaluate(async()=>{const again=await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope());if(again.id!==newBankBatch.id)throw Error('unstable generation');});
 expect(await page.evaluate(()=>state.transactions.filter(t=>t.accountProfileId==='personal'))).toEqual(before);
 const rootId=first.providerRestartFrom.id;await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await configure(page);
 const after=await page.evaluate(async rootId=>{remoteBankImports.set(rootId,await FinizeUpdate4Runtime.ImportStore.getImport(rootId));const batch=await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope());return {id:batch.id,rows:batch.rows.length,sources:state.transactions.filter(t=>t.recordRole==='bank-source').length,tombstone:await FinizeUpdate4Runtime.ImportStore.getImport(rootId),proof:state.importDeletionProofs.find(x=>x.id===rootId)};},rootId);
 expect(after.id).toBe(first.id);expect(after.rows).toBe(1);expect(after.sources).toBe(2);expect(after.tombstone.lifecycle).toBe('deleted');expect(after.proof.operationId).toBe(first.providerRestartFrom.operationId);
});
test('financial change while confirmation is open rejects stale consent without a new generation',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:async()=>{await commitChange(s=>{s.meta.syntheticConsentRace=true;},{render:false,throwOnError:true});return true;}});}catch(e){return {code:e.code,count:(await FinizeUpdate4Runtime.ImportStore.listImports()).length};}});expect(result).toEqual({code:'import-conflict',count:2});
});
test('parallel confirmations create at most one stable generation',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const outcomes=await Promise.allSettled([1,2].map(()=>FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true})));const active=(await FinizeUpdate4Runtime.ImportStore.listImports()).filter(b=>b.providerRestartFrom);return {success:outcomes.filter(x=>x.status==='fulfilled').length,active:active.length,ids:active.map(x=>x.id),sources:state.transactions.filter(t=>t.recordRole==='bank-source').length};});expect(result.success).toBeGreaterThan(0);expect(result.active).toBe(1);expect(result.sources).toBe(2);
});
test('commit-time pending parent operation aborts all financial and import writes',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const original=window.commitChange;window.commitChange=async(fn,options)=>{if(options?.importMutation?.batch.providerRestartFrom)await FinizeUpdate4Runtime.ImportStore.putJournal({id:'synthetic-late-conflict',importId:deletedId,status:'uncertain'});return original(fn,options);};
  let code;try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});}catch(e){code=e.code;}
  return {code,same:JSON.stringify(state)===originalBankState,count:(await FinizeUpdate4Runtime.ImportStore.listImports()).length,tombstone:JSON.stringify(await FinizeUpdate4Runtime.ImportStore.getImport(deletedId))===originalDeletion};
 });expect(result.code).toBe('bank-import-restart-blocked');expect(result.same).toBe(true);expect(result.count).toBe(2);expect(result.tombstone).toBe(true);
});
test('offline tombstone fallback never authorizes a new import generation',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{CloudAdapter.recordSession.loadImport=async()=>{throw Object.assign(new Error('cloud-offline'),{code:'cloud-offline'});};try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});}catch(e){return {code:e.code,same:JSON.stringify(state)===originalBankState,count:(await FinizeUpdate4Runtime.ImportStore.listImports()).length};}});expect(result).toEqual({code:'cloud-offline',same:true,count:2});
});
test('native IndexedDB abort leaves no generation or financial effects; retry creates one',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const put=IDBObjectStore.prototype.put;let once=true;IDBObjectStore.prototype.put=function(record,...args){if(once&&this.name==='imports'&&record.providerRestartFrom){once=false;this.transaction.abort();throw new DOMException('Synthetic abort','QuotaExceededError');}return put.call(this,record,...args);};
  let failed=false;try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});}catch{failed=true;}
  const untouched=JSON.stringify(state)===originalBankState,count=(await FinizeUpdate4Runtime.ImportStore.listImports()).length;IDBObjectStore.prototype.put=put;
  const batch=await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});return {failed,untouched,count,rows:batch.rows.length,imports:(await FinizeUpdate4Runtime.ImportStore.listImports()).length};
 });expect(result).toEqual({failed:true,untouched:true,count:2,rows:1,imports:3});
});
test('atomic store rejects a restart batch from another household without financial writes',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const commit=window.commitChange;window.commitChange=(fn,options)=>{if(options?.importMutation?.batch.providerRestartFrom)options.importMutation.batch.householdId='synthetic-other-household';return commit(fn,options);};try{await FinizeBank.ingest(bankSnapshot('joint'),CloudAdapter.importScope(),'joint',{confirmRestart:()=>true});}catch(e){return {code:e.code,same:JSON.stringify(state)===originalBankState,count:(await FinizeUpdate4Runtime.ImportStore.listImports()).length};}});expect(result).toEqual({code:'household-scope',same:true,count:2});
});
for(const width of [320,390,430])test('manual bank update shows explicit new-bundle confirmation and review-only result '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await boot(page);let confirmations=0;
 page.on('dialog',async dialog=>{expect(dialog.message()).toContain('nieuwe importbundel');confirmations++;await dialog.accept();});
 await page.route('http://127.0.0.1:4999/bank/**',async route=>{const payload=route.request().url().endsWith('/sync')?await page.evaluate(()=>bankSnapshot('joint')):{connected:true};await route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});});
 await page.evaluate(()=>{window.FinizeAuth={user:{getIdToken:async()=>'synthetic-only'}};openBankAccountDetails('joint');});
 await expect(page.locator('[data-bank-sync]')).toBeEnabled();await page.locator('[data-bank-sync]').click();await expect.poll(()=>page.evaluate(async()=>(await FinizeUpdate4Runtime.ImportStore.listImports()).length)).toBe(3);await expect(page.locator('[data-bank-sync]')).toBeEnabled();expect(confirmations).toBe(1);
 const result=await page.evaluate(async()=>({imports:(await FinizeUpdate4Runtime.ImportStore.listImports()).length,newSource:state.transactions.find(t=>t.accountProfileId==='joint'),overflow:document.documentElement.scrollWidth>innerWidth+1}));expect(result.imports).toBe(3);expect(result.newSource.processingStatus).toBe('nakijken');expect(result.overflow).toBe(false);
});
