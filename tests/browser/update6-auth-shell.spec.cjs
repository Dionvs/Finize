const {test,expect} = require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    window.__FINIZE_AUTH_ENABLED__=true;
    window.__FINIZE_AUTH_TEST_DRIVER__={
      initialize(callback){setTimeout(callback,0);},
      setPersistence:async()=>{},
      signInEmail:async()=>{},
      registerEmail:async()=>({user:{email:'test@example.com',emailVerified:false}}),
      signInGoogle:async()=>{},
      sendPasswordReset:async()=>{},
      sendVerification:async()=>{},
      reloadUser:async user=>user,
      signOut:async()=>{},
      loadAssignment:async()=>null
    };
  });
  await page.goto('/');
});

test('toont de accountkeuzes en ingelogd blijven zonder de app erachter',async({page})=>{
  await expect(page.getByRole('heading',{name:'Welkom terug'})).toBeVisible();
  await expect(page.getByLabel('Ingelogd blijven')).toBeChecked();
  await expect(page.getByRole('button',{name:'Doorgaan met Google'})).toBeVisible();
  await expect(page.locator('.v4-sidebar')).toBeHidden();
  await page.getByRole('button',{name:'Nieuw account aanmaken'}).click();
  await expect(page.getByRole('heading',{name:'Account aanmaken'})).toBeVisible();
});

test('blijft bruikbaar op telefoonformaat',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Welkom terug'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
