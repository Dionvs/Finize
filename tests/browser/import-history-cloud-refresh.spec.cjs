const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));

for(const width of [390,1440])for(const changed of [false,true])test(`legacy history cloud refresh ${changed?'protects a real concurrent local edit':'opens an unchanged local copy'} ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.addInitScript(input=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(input)),fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const before=await page.evaluate(async()=>{
    const u=FinizeUpdate4Runtime,copy=value=>JSON.parse(JSON.stringify(value));
    const profiles=[{id:'history-dion',name:'Dion testrekening',identifier:'NL01TEST',accountOwner:'dion'}];
    const local=u.createImportDraft({id:'history-september',text:'Datum;Omschrijving;Rekening;Bedrag\n2026-09-17;Historische septemberregel;NL01TEST;-10',profiles,existingImports:[],entryOwner:'dion'});
    local.status='verwerkt';delete local.version;delete local.operationId;
    await u.ImportStore.putImport(local);
    commitChange(()=>{state.accountProfiles=profiles;state.importSummaries=[u.compactSummary(local)];},{render:false});
    const cloudRecord={...copy(local),version:1,operationId:'cloud-history-1'},envelope=u.buildCloudImportEnvelope(cloudRecord);
    const cloud=CloudAdapter;cloud.db={};cloud.isConnected=()=>true;
    cloud.importRef=id=>'imports/'+id;cloud.importChunkRef=(id,chunk)=>'imports/'+id+'/chunks/'+chunk;
    window.__historyWrites=0;cloud.queueSave=()=>{window.__historyWrites++;};cloud.flushQueue=async()=>false;
    const gate=new Promise(resolve=>window.__historyRelease=resolve);
    cloud.modules={firestore:{getDoc:async ref=>{
      if(ref==='imports/'+local.id){window.__historyFetching=true;await gate;return {exists:()=>true,data:()=>copy(envelope.header)};}
      const chunk=envelope.chunks.find(item=>ref.endsWith('/'+envelope.header.generation+'-'+String(item.index).padStart(4,'0')));
      const sourceIndex=Number(ref.split('-source-')[1]);
      const data=Number.isInteger(sourceIndex)&&envelope.sourceChunks[sourceIndex]!==undefined?{generation:envelope.header.generation,text:envelope.sourceChunks[sourceIndex]}:chunk;
      return {exists:()=>Boolean(data),data:()=>copy(data)};
    }}};
    openBankImportForOwner('dion');
    return {state:copy(state),original:copy(local.rows[0].bankOriginal),forecast:FinizeTransactions.forecast('2026-10')};
  });
  const modal=page.locator('#u4ImportModalRoot');
  await modal.locator('[data-u4-all-imports]').click();
  await modal.locator('[data-u4-open-receipt="history-september"]').click();
  await page.waitForFunction(()=>window.__historyFetching);
  if(changed)await page.evaluate(async()=>{
    const local=await FinizeUpdate4Runtime.ImportStore.getImport('history-september');
    local.rows[0].processing.note='Een echte lokale wijziging tijdens ophalen';
    await FinizeUpdate4Runtime.ImportStore.putImport(local);
  });
  await page.evaluate(()=>__historyRelease());
  if(changed){
    await expect(modal).toContainText('Een nieuwere lokale importkeuze blijft behouden.');
    const local=await page.evaluate(()=>FinizeUpdate4Runtime.ImportStore.getImport('history-september'));
    expect(local.rows[0].processing.note).toBe('Een echte lokale wijziging tijdens ophalen');
    expect(local.version).toBeUndefined();expect(local.operationId).toBeUndefined();
  }else{
    await expect(modal.locator('h2')).toHaveText('Importdetails');
    await expect(modal).toContainText('Historische Septemberregel');
    await expect(modal).not.toContainText('Ophalen mislukt');
    const local=await page.evaluate(()=>FinizeUpdate4Runtime.ImportStore.getImport('history-september'));
    expect(local.version).toBe(1);expect(local.operationId).toBe('cloud-history-1');
    expect(local.rows[0].bankOriginal).toEqual(before.original);
  }
  expect(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))).toEqual(before.state);
  expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10'))).toEqual(before.forecast);
  expect(await page.evaluate(()=>window.__historyWrites)).toBe(0);
  expect(errors).toEqual([]);
});
