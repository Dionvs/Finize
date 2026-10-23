const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json'),'utf8'));
const IBAN='NL91ABNA0417164300',OTHER='NL20INGB0001234567';
test.setTimeout(60000);
test.use({actionTimeout:5000});
async function boot(page,width=390){
  await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',route=>route.abort());await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify({...seed,accountProfiles:[]}));},fixture);
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await overview(page);
}
async function overview(page){await page.locator('[data-tab="settings"]:visible').first().click();const shortcut=page.locator('[data-open-bank-accounts]');if(await shortcut.count())await shortcut.click();await expect(page.locator('[data-account-add]')).toBeVisible();}
async function add(page,{name='Dara sparen',owner='dara',iban=IBAN,type='savings',settle=true}={}){
  await page.locator('[data-account-add]').click();await page.locator('[name="name"]').fill(name);await page.locator('[name="identifier"]').fill(iban);await page.locator('[name="accountOwner"]').selectOption(owner);await page.locator('[name="accountType"]').selectOption(type);await page.locator('[data-account-form] button[type="submit"]').click();
  if(settle)await expect(page.locator('[data-account-edit], [data-account-error]:not(:empty)')).toBeVisible();
}
async function enterBalance(page,amount='1000',date='2026-10-10'){
  await page.locator('[data-balance-add]').click();await page.locator('[data-balance-amount]').fill(amount);await page.locator('[data-balance-date]').fill(date);await page.locator('[data-balance-check]').click();await expect(page.locator('[data-balance-confirm]')).toBeVisible();
}
const financial=page=>page.evaluate(()=>({transactions:state.transactions,goals:state.spaardoelen,ledger:state.savingsGoalLedger,forecast:FinizeTransactions.forecast('2026-10')}));
for(const width of [1440,390,320])test(`P1b ${width}px toevoegen bewerken saldo corrigeren archiveren heractiveren herladen`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await boot(page,width);const before=await financial(page);
  await add(page);await expect(page.locator('.bank-accounts-heading')).toContainText('Dara sparen');await expect(page.locator('.bank-account-details')).toContainText('Onbekend');await expect(page.locator('[data-balance-value]')).toHaveText('Onbekend');
  const id=await page.evaluate(()=>state.accountProfiles[0].id);await enterBalance(page);await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-value]')).toContainText('1.000,00');
  await page.locator('[data-account-edit]').click();await page.locator('[name="name"]').fill('Dara spaarrekening');await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('.bank-accounts-heading')).toContainText('Dara spaarrekening');
  await page.locator('[data-account-status]').click();await page.locator('[data-account-archive]').click();await expect(page.locator('[data-balance-add]')).toBeDisabled();
  await page.locator('[data-accounts-back]').click();await expect(page.locator('[data-account-open]')).toHaveCount(0);await page.locator('[data-accounts-archived]').check();await page.locator('[data-account-open]').click();
  await page.locator('[data-account-status]').click();await expect(page.locator('[data-balance-add]')).toBeEnabled();
  await page.locator('.balance-history').evaluate(element=>element.open=true);await page.locator('[data-balance-correct]').first().click();await page.locator('[data-balance-amount]').fill('980');await page.locator('[data-balance-check]').click();await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-value]')).toContainText('980,00');
  await page.locator('.balance-history').evaluate(element=>element.open=true);await page.screenshot({path:testInfo.outputPath(`details-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);expect(await financial(page)).toEqual(before);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await overview(page);await page.screenshot({path:testInfo.outputPath(`overview-${width}.png`),fullPage:true});await page.locator('[data-account-open]').click();await expect(page.locator('[data-balance-value]')).toContainText('980,00');
  expect(await page.evaluate(()=>state.accountProfiles[0].id)).toBe(id);expect(await page.evaluate(()=>state.balanceCheckpoints.length)).toBe(2);expect(await page.evaluate(()=>state.accountProfiles[0].bank)).toBe('');expect(errors).toEqual([]);
});
test('P1b checksum dubbel IBAN en veilige correctie via formulier',async({page})=>{
  await boot(page);await add(page,{iban:'NL92ABNA0417164300'});await expect(page.locator('[data-account-error]')).toContainText('controlecijfers');await page.locator('[name="identifier"]').fill(IBAN);await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('[data-account-edit]')).toBeVisible();
  const id=await page.evaluate(()=>state.accountProfiles[0].id);await page.locator('[data-account-edit]').click();await page.locator('[name="identifier"]').fill(OTHER);await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('[data-account-edit]')).toBeVisible();expect(await page.evaluate(()=>state.accountProfiles[0].id)).toBe(id);
  await page.locator('[data-accounts-back]').click();await add(page,{iban:OTHER,name:'Dubbel'});await expect(page.locator('[data-account-error]')).toContainText('hoort al');expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(1);
});
test('P1b verouderd formulier behoudt invoer en overschrijft actuele rekening niet',async({page})=>{
  await boot(page);await add(page);await page.locator('[data-account-edit]').click();await page.locator('[name="name"]').fill('Mijn invoer');
  await page.evaluate(async()=>{const p=structuredClone(state.accountProfiles[0]);await FinizeAccountsSave({type:'update',id:p.id,expectedProfile:p,values:{...p,name:'Andere lokale wijziging'},operationId:'parallel',createdAt:'2026-10-13T12:01:00Z'});});
  await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('[data-account-error]')).toContainText('intussen gewijzigd');await expect(page.locator('[name="name"]')).toHaveValue('Mijn invoer');expect(await page.evaluate(()=>state.accountProfiles[0].name)).toBe('Andere lokale wijziging');
});
test('P1b IndexedDB abort bewaart oude stand; herhalen gebruikt hetzelfde ID en operatie',async({page})=>{
  await boot(page);await page.locator('[data-account-add]').click();await page.locator('[name="name"]').fill('Dion betalen');await page.locator('[name="identifier"]').fill(IBAN);await page.locator('[name="accountOwner"]').selectOption('dion');await page.locator('[name="accountType"]').selectOption('payment');
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__restore=()=>IDBObjectStore.prototype.put=original;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='financialRecords'&&value.collection==='accountProfiles'){this.transaction.abort();throw new DOMException('P1b opslagtest','QuotaExceededError');}return original.call(this,value,...args);};});
  await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('[data-account-error]')).not.toBeEmpty();expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(0);expect(await page.evaluate(async()=>(await DataAdapter.readDurableState()).accountProfiles.length)).toBe(0);
  await page.evaluate(()=>__restore());await page.locator('[data-account-form] button[type="submit"]').click();await expect(page.locator('[data-account-edit]')).toBeVisible();expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(1);
});
test('P1b verloren ontvangstbevestiging wordt hersteld; kandidaat wacht op duurzame opslag',async({page})=>{
  await boot(page);await page.evaluate(()=>{const store=DataAdapter.store(),original=store.commit;store.commit=async function(...args){await new Promise(resolve=>window.__release=resolve);await original.apply(this,args);store.commit=original;throw new Error('Verloren ontvangstbevestiging');};});
  await add(page,{owner:'gezamenlijk',type:'payment',settle:false});await page.waitForFunction(()=>window.__release);expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(0);await expect(page.locator('[data-account-form] button[type="submit"]')).toBeDisabled();await page.evaluate(()=>__release());await expect(page.locator('[data-account-edit]')).toBeVisible();expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(1);
});
test('P1b nieuwe rekening in CSV en interne tegenrekeningselectie; oude saldoroute verwijst door',async({page})=>{
  await boot(page);await add(page,{owner:'gezamenlijk',name:'Gezamenlijke rekening',type:'payment'});await page.locator('[data-accounts-back]').click();await add(page,{owner:'dara',name:'Dara tegenrekening',iban:OTHER,type:'payment'});
  await page.evaluate(async()=>{const draft=FinizeUpdate4Runtime.createImportDraft({id:'p1b-transfer',text:'Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n2026-10-11;Overboeking;NL91ABNA0417164300;NL20INGB0001234567;-10.00',profiles:state.accountProfiles,entryOwner:'gezamenlijk',today:'2026-10-13'});await FinizeUpdate4Runtime.persistImportDraft(window,draft,{syncCloud:false});window.__draft=draft;});
  expect(await page.evaluate(()=>__draft.accountProfileId)).toBe(await page.evaluate(()=>state.accountProfiles.find(p=>p.accountOwner==='gezamenlijk').id));
  await page.evaluate(()=>FinizeUpdate4.openImportDetails('p1b-transfer'));await expect(page.locator('[data-u4-field="destinationAccountProfileId"]')).toContainText('Dara tegenrekening');await page.locator('[data-u4-close]').click();
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));await expect(page.locator('#u4ImportModalRoot [data-balance-panel]')).toHaveCount(0);await page.locator('[data-u4-bank-accounts]').click();await expect(page.locator('[data-account-add]')).toBeVisible();
});
test('P1b werkelijke cloudacceptatie bewaart beide rekeningversies en conflict kan lokaal worden opgelost',async({page})=>{
  await boot(page);await add(page);const outcome=await page.evaluate(async()=>{const before=structuredClone(state),remote=structuredClone(state);remote.accountProfiles[0].name='Cloudnaam';remote.meta.revision++;let code;try{await CloudAdapter.acceptRemote({syncVersion:1,state:remote},remote,'');}catch(error){code=error.code;}const journal=await FinizeUpdate4.importStore.getJournal('conflict-account-profiles');return {code,localName:state.accountProfiles[0].name,localChoice:journal.localChoice.state.accountProfiles[0].name,cloudChoice:journal.cloudChoice.state.accountProfiles[0].name};});
  expect(outcome).toEqual({code:'finize/cloud-conflict',localName:'Dara sparen',localChoice:'Dara sparen',cloudChoice:'Cloudnaam'});
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await overview(page);await page.locator('[data-accounts-conflicts]').click();await expect(page.locator('#u4ImportModalRoot')).toContainText('Cloudnaam');await page.locator('[data-u4-resolve="account-profiles"][data-choice="cloud"]').click();await expect.poll(()=>page.evaluate(()=>state.accountProfiles[0].name)).toBe('Cloudnaam');
  expect(await page.evaluate(async()=>(await FinizeUpdate4.importStore.getJournal('conflict-account-profiles')).status)).toBe('resolved');
});
test('P1b directe schrijfroutes blokkeren IBAN en eigenaar met ijkpunthistorie',async({page})=>{
  await boot(page);await add(page);await enterBalance(page);await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-value]')).toContainText('1.000,00');
  const result=await page.evaluate(async()=>{const before=JSON.stringify(state);const command=async values=>{const p=structuredClone(state.accountProfiles[0]);try{await FinizeAccountsSave({type:'update',id:p.id,expectedProfile:p,values:{...p,...values},operationId:crypto.randomUUID(),createdAt:new Date().toISOString()});}catch(error){return error.code;}};return {iban:await command({identifier:'NL20INGB0001234567'}),owner:await command({accountOwner:'dion'}),unchanged:before===JSON.stringify(state)};});
  expect(result).toEqual({iban:'account-identity-in-use',owner:'account-identity-in-use',unchanged:true});
});

test('Conflictbackup bewaart beide versies zonder keuzes of financiën te wijzigen',async({page})=>{
  await boot(page,320);
  const before=await page.evaluate(async()=>{
    const local=structuredClone(state),cloud=structuredClone(state);
    local.transactions=[{id:'conflict-example',description:'Veilig bewaarde lokale keuze',amount:12}];
    cloud.transactions=[{id:'conflict-example',description:'Cloudkeuze',amount:15}];
    await FinizeImportSync.preserveConflict({id:'compact-state',state:local},{id:'compact-state',state:cloud},[{kind:'snapshot'}]);
    FinizeUpdate4.openConflicts();
    return {state:JSON.stringify(state),journal:await FinizeUpdate4.importStore.getJournal('conflict-compact-state')};
  });
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Beide versies downloaden',exact:true}).click();
  const download=await downloaded;
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  expect(download.suggestedFilename()).toMatch(/^finize-conflict-compact-state-\d{4}-\d{2}-\d{2}\.json$/);
  expect(exported.conflict).toEqual(before.journal);
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);
  expect(await page.evaluate(async()=>await FinizeUpdate4.importStore.getJournal('conflict-compact-state'))).toEqual(before.journal);
  await expect(page.getByRole('button',{name:'Cloudstand behouden',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  expect(await page.evaluate(async()=>await FinizeUpdate4.importStore.getJournal('conflict-compact-state'))).toEqual(before.journal);
});
test('P1b profiel vanuit echte CSV-invoer gebruikt hetzelfde centrale register',async({page})=>{
  await boot(page);await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  await page.locator('[data-u4-file]').setInputFiles({name:'rekening.csv',mimeType:'text/csv',buffer:Buffer.from(`Datum;Omschrijving;Rekening;Bedrag\n2026-10-11;Boodschappen;${IBAN};-10.00`)});
  await expect(page.locator('[data-u4-profile-name]')).toBeVisible();await page.locator('[data-u4-profile-name]').fill('CSV betaalrekening');await page.locator('[data-u4-profile-type]').selectOption('payment');await page.locator('[data-u4-apply-profile]').click();
  await expect.poll(()=>page.evaluate(()=>state.accountProfiles.length)).toBe(1);const profile=await page.evaluate(()=>state.accountProfiles[0]);expect(profile.identifier).toBe(IBAN);expect(profile.accountType).toBe('payment');
  await page.locator('[data-u4-close]').click();await page.evaluate(()=>openBankAccountDetails());await expect(page.locator('[data-account-open]')).toContainText('CSV betaalrekening');
});
test('P1b ingelogde Dion mag volgens lokale afspraak ook Dara toevoegen en saldo beheren',async({page})=>{
  await page.addInitScript(()=>{
    const profile={uid:'uid-dion',role:'dion',householdId:'p1b-test',displayName:'Dion',sharePersonalTab:false,hiddenKpis:[]};
    window.__FINIZE_AUTH_ENABLED__=true;window.__FINIZE_AUTH_TEST_DRIVER__={initialize:callback=>setTimeout(()=>callback({uid:'uid-dion',email:'dion@example.test',emailVerified:true}),0),loadAssignment:async()=>({householdId:'p1b-test',role:'dion',displayName:'Dion'}),getProfile:()=>profile,getHouseholdMembers:()=>[profile],updateSharingPreferences:async values=>Object.assign(profile,values),setPersistence:async()=>{},signOut:async()=>{}};
  });
  await boot(page);await add(page,{owner:'dara'});await enterBalance(page,'250');await page.locator('[data-balance-confirm]').click();await expect(page.locator('[data-balance-value]')).toContainText('250,00');expect(await page.evaluate(()=>state.accountProfiles[0].accountOwner)).toBe('dara');expect(await page.evaluate(()=>state.balanceCheckpoints[0].actor)).toBe('uid-dion');
});
test('P1b nieuwe rekening vereist expliciete eigenaar en behoudt toetsenbordbediening',async({page},testInfo)=>{
  await boot(page,390);await page.locator('[data-account-add]').click();await page.locator('[name="name"]').fill('Nog geen eigenaar');await page.locator('[name="identifier"]').fill(IBAN);await page.locator('[name="accountType"]').selectOption('payment');
  await expect(page.locator('[name="accountOwner"]')).toHaveValue('');await page.locator('[data-account-form] button[type="submit"]').click();expect(await page.evaluate(()=>state.accountProfiles.length)).toBe(0);expect(await page.locator('[name="accountOwner"]').evaluate(element=>element.validity.valueMissing)).toBe(true);
  await page.locator('[name="accountOwner"]').selectOption('dion');await page.locator('[data-account-form] button[type="submit"]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-account-edit]')).toBeVisible();await page.locator('[data-account-edit]').click();await page.screenshot({path:testInfo.outputPath('edit-form-390.png'),fullPage:true});
});
