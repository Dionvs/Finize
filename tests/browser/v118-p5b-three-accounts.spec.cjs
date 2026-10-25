const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const visual=require('../fixtures/v50-visual-state.json'),{state:fixture}=require('../helpers/package5-fixture.cjs');
test.setTimeout(60000);test.use({actionTimeout:8000});
async function boot(page,width=390){
  await page.setViewportSize({width,height:950});await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());
  await page.route('https://api.enablebanking.com/**',()=>{throw Error('Real provider requests forbidden');});
  const {syntheticIban}=await import('../helpers/bank-multi-fixture.mjs');
  const profiles=['gezamenlijk','dion','dara'].map((owner,i)=>({id:'profile-'+owner,accountOwner:owner,name:owner==='gezamenlijk'?'Gezamenlijk':owner==='dion'?'Dion':'Dara',bank:'ING',identifier:syntheticIban(i+1),accountType:'payment',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:0,salaryDays:owner==='gezamenlijk'?{dion:26}:{},allowanceDays:owner!=='gezamenlijk'?{[owner]:'last'}:{}}}));
  const seed={...visual,...fixture()};seed.meta.selectedMonth='2026-10';seed.monthRecords={};seed.accountProfiles=profiles;
  seed.bankSyncStatus={'profile-dion':{fetchedAt:'2026-10-24T12:00:00Z',complete:true}};
  seed.balanceCheckpoints=profiles.map(p=>({version:1,id:'opening-'+p.id,operationId:'opening-'+p.id,householdId:'legacy',accountProfileId:p.id,amountCents:100000,currency:'EUR',asOfDate:'2026-10-23',boundary:'end-of-bank-day',source:'manual-observation',createdAt:'2026-10-23T20:00:00Z',actor:'synthetic',note:'',revision:1,supersedesId:null}));
  const calls=[],connected=new Set(['profile-dion']),syncTimes=new Map([['profile-dion','2026-10-24T12:00:00Z']]);let gate=null,wrongResponse=false;
  await page.route('https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname.replace('/enableBanking',''),body=JSON.parse(route.request().postData()||'{}'),id=body.accountProfileId;
    calls.push({endpoint,id});expect(route.request().headers().authorization).toBe('Bearer synthetic-only');
    let result;
    if(endpoint==='/status')result={connected:connected.has(id),accountProfileId:id,validUntil:connected.has(id)?'2026-11-25T12:00:00Z':null,
      activationBlocked:id==='profile-dara',blockedReason:id==='profile-dara'?'provider-access-blocked':null,lastSuccessfulSync:syncTimes.has(id)?{fetchedAt:syncTimes.get(id)}:null};
    if(endpoint==='/auth/start')result={url:'https://auth.enablebanking.com/ais/start?synthetic=joint'};
    if(endpoint==='/disconnect'){connected.delete(id);result={connected:false};}
    if(endpoint==='/sync'){
      if(gate&&id==='profile-dion')await gate();
      const target=wrongResponse?'profile-gezamenlijk':id,profile=profiles.find(p=>p.id===target);
      syncTimes.set(target,'2026-10-25T12:00:00Z');
      result={version:1,runId:'synthetic-'+target,householdId:'legacy',accountProfileId:target,fetchedAt:'2026-10-25T12:00:00Z',account:{iban:profile.identifier,identificationHash:'hash-'+target},fromDate:'2026-10-24',toDate:'2026-10-25',complete:true,balances:[],transactions:[{entry_reference:'same-bank-reference',status:'BOOK',booking_date:'2026-10-25',transaction_amount:{amount:'10.00',currency:'EUR'},credit_debit_indicator:'DBIT',remittance_information:['Synthetische mutatie '+profile.name]}]};
    }
    if(!result)throw Error('Unexpected synthetic route');
    await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('https://auth.enablebanking.com/ais/start?synthetic=joint',r=>r.fulfill({contentType:'text/html',body:'<h1>Synthetische ING-toestemming Gezamenlijk</h1>'}));
  await page.addInitScript(value=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));},seed);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>{window.FinizeAuth={user:{uid:'synthetic-dion',getIdToken:async()=> 'synthetic-only'}};});
  return {calls,connected,gate:value=>gate=value,wrongResponse:()=>wrongResponse=true};
}
async function details(page,id){await page.evaluate(id=>openBankAccountDetails(id),id);await expect(page.locator('[data-bank-status]')).not.toContainText('controleren…');}
for(const width of [1440,390,320])test('drie rekeningen: status, toestemming, gescheiden import en dashboard '+width,async({page},info)=>{
  const f=await boot(page,width);await details(page,'profile-dion');
  await expect(page.locator('[data-bank-status]')).toContainText('Verbonden');await expect(page.locator('[data-bank-status]')).toContainText('Toestemming geldig tot');
  expect(f.calls.filter(x=>x.endpoint==='/auth/start').length).toBe(0);
  await page.locator('[data-bank-sync]').click();await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  const dion=await page.evaluate(()=>JSON.stringify(state.transactions.filter(x=>x.accountProfileId==='profile-dion')));
  await details(page,'profile-gezamenlijk');await expect(page.locator('[data-bank-status]')).toContainText('Geen geldige bankverbinding');
  await page.locator('[data-bank-authorize]').click();await expect(page.getByRole('heading',{name:'Synthetische ING-toestemming Gezamenlijk'})).toBeVisible();
  f.connected.add('profile-gezamenlijk');await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>{window.FinizeAuth={user:{uid:'synthetic-dion',getIdToken:async()=> 'synthetic-only'}};});
  await details(page,'profile-gezamenlijk');await expect(page.locator('[data-bank-sync]')).toBeEnabled();
  await page.locator('[data-bank-sync]').click();await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  expect(await page.evaluate(()=>JSON.stringify(state.transactions.filter(x=>x.accountProfileId==='profile-dion')))).toBe(dion);
  expect(await page.evaluate(()=>state.transactions.filter(x=>x.recordRole==='bank-source').length)).toBe(2);
  expect(await page.evaluate(()=>FinizeTransactions.total('realExpense',{month:'2026-10'}))).toBe(0);
  await details(page,'profile-dara');await expect(page.locator('[data-bank-status]')).toContainText('eigen toestemming');
  await expect(page.locator('[data-bank-authorize]')).toBeDisabled();await expect(page.locator('[data-bank-sync]')).toBeDisabled();await expect(page.locator('[data-bank-review]')).toBeEnabled();
  expect(await page.locator('[data-bank-connection]').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.locator('[data-bank-connection]').screenshot({path:info.outputPath('dara-bankpaneel.png')});
  await page.screenshot({path:info.outputPath('dara-geblokkeerd.png')});
  await page.locator('[data-tab="dashboard"]:visible').first().click();await expect(page.locator('[data-bank-compact] [data-bank-sync]')).toBeEnabled();
  const prior=f.calls.length;await page.locator('[data-bank-compact] [data-bank-sync]').click();await expect(page.locator('[data-bank-compact] [data-bank-sync]')).toBeEnabled();
  expect(f.calls.slice(prior).filter(x=>x.endpoint==='/sync').map(x=>x.id)).toEqual(['profile-gezamenlijk']);
  await page.locator('[data-p3-context="persoonlijk"]').click();await expect(page.locator('[data-bank-compact] [data-bank-sync]')).toBeEnabled();
  const next=f.calls.length;await page.locator('[data-bank-compact] [data-bank-sync]').click();await expect(page.locator('[data-bank-compact] [data-bank-sync]')).toBeEnabled();
  expect(f.calls.slice(next).filter(x=>x.endpoint==='/sync').map(x=>x.id)).toEqual(['profile-dion']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('dashboard-dion.png')});
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(()=>state.transactions.filter(x=>x.recordRole==='bank-source').length)).toBe(2);
  expect(await page.evaluate(()=>state.importSummaries.filter(x=>x.channel==='bank-api').length)).toBe(2);
});
test('eigen vergrendeling laat tweede rekening ophalen en intrekken zonder Dion te blokkeren',async({page})=>{
  const f=await boot(page);f.connected.add('profile-gezamenlijk');let release,entered;
  const started=new Promise(resolve=>entered=resolve);f.gate(()=>{entered();return new Promise(resolve=>release=resolve);});
  await details(page,'profile-dion');await page.locator('[data-bank-sync]').click();await started;await expect(page.locator('[data-bank-sync]')).toBeDisabled();
  await details(page,'profile-gezamenlijk');await expect(page.locator('[data-bank-sync]')).toBeEnabled();
  await page.locator('[data-bank-sync]').click();await expect(page.locator('[data-balance-value]')).toContainText('990,00');
  await page.locator('[data-bank-disconnect]').click();await expect(page.locator('[data-bank-status]')).toContainText('ingetrokken');
  expect(f.connected.has('profile-dion')).toBe(true);release();
  await expect.poll(()=>page.evaluate(()=>state.transactions.filter(x=>x.recordRole==='bank-source').length)).toBe(2);
});
test('bankantwoord van verkeerde rekening wordt voor opslag afgewezen',async({page})=>{
  const f=await boot(page);await details(page,'profile-dion');f.wrongResponse();
  const before=await page.evaluate(()=>JSON.stringify(state));await page.locator('[data-bank-sync]').click();
  await expect(page.locator('[data-bank-status]')).toContainText('andere rekening');expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});
