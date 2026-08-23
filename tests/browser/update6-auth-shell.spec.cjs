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

test('toont na accountaanmaak direct de verificatiestap',async({page})=>{
  await page.getByRole('button',{name:'Nieuw account aanmaken'}).click();
  await page.getByLabel('E-mailadres').fill('test@example.com');
  await page.getByLabel('Wachtwoord').fill('veilig-wachtwoord');
  await page.getByRole('button',{name:'Account aanmaken',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Bevestig je e-mailadres'})).toBeVisible();
  await expect(page.getByText('test@example.com')).toBeVisible();
});

test('vernieuwt na e-mailbevestiging de koppeling en opent de app',async({page})=>{
  await page.getByRole('button',{name:'Nieuw account aanmaken'}).click();
  await page.getByLabel('E-mailadres').fill('dara_endenburg@hotmail.com');
  await page.getByLabel('Wachtwoord').fill('veilig-wachtwoord');
  await page.getByRole('button',{name:'Account aanmaken',exact:true}).click();
  await page.evaluate(()=>{
    window.__FINIZE_AUTH_TEST_DRIVER__.reloadUser=async user=>({...user,uid:'uid-dara',emailVerified:true});
    window.__FINIZE_AUTH_TEST_DRIVER__.loadAssignment=async()=>({householdId:'dion-dara',role:'dara',displayName:'Dara'});
  });
  await page.getByRole('button',{name:'Ik heb mijn e-mail bevestigd'}).click();
  await expect(page.locator('#authRoot')).toBeHidden();
  await expect(page.locator('.v4-sidebar')).toBeVisible();
});

test('rondt Google-inloggen af zonder redirect van de PWA',async({page})=>{
  await page.evaluate(()=>{
    window.__FINIZE_AUTH_TEST_DRIVER__.signInGoogle=async()=>({user:{uid:'uid-dion',email:'dion@example.test',emailVerified:true}});
    window.__FINIZE_AUTH_TEST_DRIVER__.loadAssignment=async()=>({householdId:'dion-dara',role:'dion',displayName:'Dion'});
  });
  await page.getByRole('button',{name:'Doorgaan met Google'}).click();
  await expect(page.locator('#authRoot')).toBeHidden();
  await expect(page.locator('.v4-sidebar')).toBeVisible();
});

test('blijft bruikbaar op telefoonformaat',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Welkom terug'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
