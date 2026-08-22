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

test('gedeelde andere tab opent alleen-lezen en verbergt gekozen KPI',async({page})=>{
  await installAccount(page,{otherShared:true,hiddenKpis:['income']});
  await page.locator('.v4-sidebar .tab-btn[data-tab="settings"]').click();
  await page.getByRole('button',{name:'Open gedeeld overzicht van Dara'}).click();
  await expect(page.locator('#tab-dara .u6-readonly-banner')).toBeVisible();
  await expect(page.locator('#tab-dara [data-personal-kpi="income"]')).toHaveCount(0);
  await expect(page.locator('#tab-dara [data-personal-kpi]')).toHaveCount(3);
  await expect(page.locator('#tab-dara input:not([type="hidden"])').first()).toBeDisabled();
});
