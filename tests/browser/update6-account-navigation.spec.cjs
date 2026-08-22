const {test,expect} = require('@playwright/test');

async function installAccount(page,{otherShared=false,hiddenKpis=[]}={}){
  await page.addInitScript(({otherShared,hiddenKpis})=>{
    const profile={uid:'uid-dion',role:'dion',householdId:'dion-dara',displayName:'Dion',sharePersonalTab:false,hiddenKpis:[]};
    const members=[profile,{uid:'uid-dara',role:'dara',householdId:'dion-dara',displayName:'Dara',sharePersonalTab:otherShared,hiddenKpis}];
    window.__FINIZE_AUTH_ENABLED__=true;
    window.__FINIZE_AUTH_TEST_DRIVER__={
      initialize(callback){setTimeout(()=>callback({uid:'uid-dion',email:'dion@example.test',emailVerified:true}),0);},
      loadAssignment:async()=>({householdId:'dion-dara',role:'dion',displayName:'Dion'}),
      getProfile:()=>profile,
      getHouseholdMembers:()=>members,
      updateSharingPreferences:async preferences=>Object.assign(profile,preferences),
      setPersistence:async()=>{},signInEmail:async()=>{},registerEmail:async()=>{},signInGoogle:async()=>{},
      sendPasswordReset:async()=>{},sendVerification:async()=>{},reloadUser:async user=>user,signOut:async()=>{}
    };
  },{otherShared,hiddenKpis});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('#authRoot')).toBeHidden();
  await expect(page.locator('#tab-dashboard')).toHaveClass(/active/);
}

test('accountnavigatie toont eigen tab en Instellingen',async({page})=>{
  await installAccount(page);
  const sidebar=page.locator('.v4-sidebar .tab-btn:visible');
  await expect(sidebar).toHaveCount(5);
  await expect(page.locator('.v4-sidebar .tab-btn[data-tab="dion"]')).toContainText('Dion (jij)');
  await expect(page.locator('.v4-sidebar .tab-btn[data-tab="dara"]')).toBeHidden();
  await page.locator('.v4-sidebar .tab-btn[data-tab="settings"]').click();
  await expect(page.getByRole('heading',{name:'Instellingen'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Account'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Huishouden'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Delen'})).toBeVisible();
  await expect(page.getByText('dion@example.test')).toBeVisible();
});

test('mobiel houdt vijf knoppen in de afgesproken volgorde',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await installAccount(page);
  const labels=await page.locator('.v4-bottom-nav .bottom-nav-btn:visible > span:last-child').allTextContents();
  expect(labels).toEqual(['Dashboard','Gezamenlijk','Dion','Spaardoelen','Instellingen']);
});

test('dashboard en gezamenlijk blijven voor ieder account bewerkbaar op desktop',async({page})=>{
  await installAccount(page);
  await expect(page.getByRole('button',{name:'Inkomen van Dion aanpassen'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Inkomen van Dara aanpassen'})).toBeEnabled();

  await page.locator('.v4-sidebar .tab-btn[data-tab="gezamenlijk"]').click();
  await expect(page.locator('#tab-gezamenlijk .u6-readonly-banner')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Gezamenlijke maandbudgetten wijzigen'})).toBeEnabled();
  await expect(page.locator('#tab-gezamenlijk input[data-path$="spaarpotDezeMaand"]')).toBeEnabled();

  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  await expect(page.locator('#tab-dion .u6-readonly-banner')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Maandbudgetten van Dion wijzigen'})).toBeEnabled();
});

test('persoonlijke inkomenskaart toont op mobiel en desktop dezelfde totale bronnen',async({page})=>{
  await installAccount(page);
  await page.evaluate(()=>{
    const month=window.state.meta.selectedMonth;
    window.state.transactions.push(
      {id:'income-refund-test',date:month+'-10',owner:'dion',kind:'terugbetaling',transactionType:'terugbetaling',amount:25,description:'Terugbetaling'},
      {id:'income-other-test',date:month+'-11',owner:'dion',kind:'inkomen',transactionType:'vergoeding',amount:50,description:'Vergoeding'}
    );
    window.renderActiveTab();
  });
  await page.locator('.v4-sidebar .tab-btn[data-tab="dion"]').click();
  const desktopCard=page.locator('#tab-dion .overview-kpi-row [data-personal-kpi="income"]');
  await expect(desktopCard).toContainText('Totaal inkomen');
  await expect(desktopCard).toContainText('Zakgeld');
  await expect(desktopCard).toContainText('Terugbetalingen');
  await expect(desktopCard).toContainText('Vergoedingen');
  const desktopTotal=await desktopCard.locator('.metric-value').innerText();

  await page.setViewportSize({width:390,height:844});
  const mobileCard=page.locator('#tab-dion .mobile-kpi-card[data-personal-kpi-mobile="income"]');
  await expect(mobileCard).toBeVisible();
  await expect(mobileCard).toContainText('Totaal inkomen');
  await expect(mobileCard).toContainText('Zakgeld');
  await expect(mobileCard).toContainText('Terugbetalingen');
  await expect(mobileCard).toContainText('Vergoedingen');
  await expect(mobileCard.locator('.mobile-kpi-value')).toHaveText(desktopTotal);
});

test('gedeelde andere tab opent alleen-lezen en verbergt gekozen KPI',async({page})=>{
  await installAccount(page,{otherShared:true,hiddenKpis:['income']});
  await page.locator('.v4-sidebar .tab-btn[data-tab="settings"]').click();
  await page.getByRole('button',{name:'Open gedeeld overzicht van Dara'}).click();
  await expect(page.locator('#tab-dara .u6-readonly-banner')).toBeVisible();
  await expect(page.locator('#tab-dara [data-personal-kpi="income"]')).toHaveCount(0);
  await expect(page.locator('#tab-dara [data-personal-kpi]')).toHaveCount(3);
  await expect(page.locator('#tab-dara input:not([type="hidden"])').first()).toBeDisabled();
});
