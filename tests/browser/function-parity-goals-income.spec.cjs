const {test,expect} = require('@playwright/test');

async function installAccount(page,role){
  await page.addInitScript(role=>{
    const otherRole=role==='dion'?'dara':'dion';
    const displayName=role==='dion'?'Dion':'Dara';
    const otherName=otherRole==='dion'?'Dion':'Dara';
    const profile={uid:`uid-${role}`,role,householdId:'dion-dara',displayName,sharePersonalTab:false,hiddenKpis:[]};
    window.__FINIZE_AUTH_ENABLED__=true;
    window.__FINIZE_AUTH_TEST_DRIVER__={
      initialize(callback){setTimeout(()=>callback({uid:`uid-${role}`,email:`${role}@example.test`,emailVerified:true}),0);},
      loadAssignment:async()=>({householdId:'dion-dara',role,displayName}),
      getProfile:()=>profile,
      getHouseholdMembers:()=>[profile,{uid:`uid-${otherRole}`,role:otherRole,householdId:'dion-dara',displayName:otherName,sharePersonalTab:false,hiddenKpis:[]}],
      updateSharingPreferences:async preferences=>Object.assign(profile,preferences),
      setPersistence:async()=>{},signInEmail:async()=>{},registerEmail:async()=>{},signInGoogle:async()=>{},
      sendPasswordReset:async()=>{},sendVerification:async()=>{},reloadUser:async user=>user,signOut:async()=>{}
    };
  },role);
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('#authRoot')).toBeHidden();
}

async function openGoals(page,width){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>window.renderActiveTab());
  const selector=width<768?'.v4-bottom-nav [data-tab="spaardoelen"]':'.v4-sidebar [data-tab="spaardoelen"]';
  await page.locator(selector).click();
}

for(const role of ['dion','dara']){
  test(`spaardoel toevoegen blijft op ieder formaat bij ${role}`,async({page})=>{
    await installAccount(page,role);
    const other=role==='dion'?'dara':'dion';
    for(const width of [390,768,1024,1280]){
      await openGoals(page,width);
      if(width<768){
        await page.locator(`.mobile-goal-section[data-goal-owner="${role}"] [data-add-goal="${role}"]`).click();
      }else{
        await page.locator(`[data-u5-goal-filter="${role}"]`).click();
        await page.locator(`.u5-goal-list [data-add-goal="${role}"]`).click();
      }
      await expect(page.locator('#incomeEditModal')).toHaveClass(/open/);
      await expect(page.locator('#u2GoalOwner')).toHaveValue(role);
      await expect(page.locator('#u2GoalOwner option')).toHaveText(['Gezamenlijk',role==='dion'?'Dion':'Dara']);
      const created=await page.evaluate(({role,other})=>{
        const goal=state.spaardoelen[role].at(-1);
        return {
          goal:structuredClone(goal),
          otherCount:state.spaardoelen[other].length
        };
      },{role,other});
      expect(created.goal).toMatchObject({eigenaar:role,ratoVerdeling:true,vastBedrag:false,subdoelen:[]});
      expect(created.goal.id).toBeTruthy();
      await page.locator('[data-close-goal-editor]').click();
      await page.evaluate(({role,id})=>{
        state.spaardoelen[role]=state.spaardoelen[role].filter(goal=>goal.id!==id);
        renderActiveTab();
      },{role,id:created.goal.id});
    }
  });
}

test('spaarpot verwerken en geschiedenis zijn mobiel, tablet en desktop bereikbaar',async({page})=>{
  await installAccount(page,'dion');
  for(const width of [390,768,1024,1280]){
    await openGoals(page,width);
    await expect(page.locator('[data-u2-process-owner="gezamenlijk"]')).toBeVisible();
    await expect(page.getByText('Spaargeschiedenis',{exact:true})).toBeVisible();
  }
});

test('spaardoelen blijven op alle afgesproken breedtes binnen beeld',async({page})=>{
  await installAccount(page,'dion');
  for(const width of [360,390,768,1024,1280]){
    await openGoals(page,width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if(width>=768){
      const bounds=await page.locator('.u5-goal-processing').evaluate(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,viewport:document.documentElement.clientWidth};});
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.viewport+1);
    }
  }
});

test('de gedeelde doelbewerker bewaart eigenaar, verdeling en subdoelen over viewports',async({page})=>{
  await installAccount(page,'dion');
  await page.evaluate(()=>{
    state.spaardoelen.gezamenlijk=[{id:'parity-goal',naam:'Oud doel',doelbedrag:500,algespaard:25,doeldatum:'2028-12-31',vasteInleg:10,vastBedrag:false,rendement:.0125,rendementPeriode:'jaarlijks',favoriet:false,eigenaar:'gezamenlijk',ratoVerdeling:true,subdoelen:[]}];
    renderActiveTab();
  });
  await openGoals(page,390);
  await page.locator('[data-open-goal-editor="gezamenlijk:parity-goal"]').first().click();
  await page.locator('#goalEditName').fill('Nieuwe laptop');
  await page.locator('#goalEditMonthly').fill('35');
  await page.locator('#goalEditReturn').fill('2.5');
  await page.locator('#goalEditFavorite').check();
  await page.locator('.u2-editor-details').filter({hasText:'Verdeling en eigenaar'}).locator('summary').click();
  await page.locator('#u2GoalOwner').selectOption('dion');
  await page.locator('#u2GoalRatio').uncheck();
  const subgoals=page.locator('.u2-editor-details').filter({hasText:'Subdoelen'});
  await subgoals.locator('summary').click();
  await subgoals.locator('[data-u2-add-child]').click();
  await subgoals.locator('[data-u2-child-name="0"]').fill('Laptop en accessoires');
  await subgoals.locator('[data-u2-child-target="0"]').fill('1200');
  await subgoals.locator('[data-u2-child-link="0"]').fill('https://example.test/laptop');
  await page.locator('#goalEditSave').click();
  await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  const saved=await page.evaluate(()=>state.spaardoelen.dion.find(goal=>goal.id==='parity-goal'));
  expect(saved).toMatchObject({naam:'Nieuwe laptop',doelbedrag:1200,vasteInleg:35,rendement:.025,favoriet:true,eigenaar:'dion',ratoVerdeling:false,vastBedrag:true});
  expect(saved.subdoelen).toHaveLength(1);
  expect(saved.subdoelen[0]).toMatchObject({naam:'Laptop en accessoires',doelbedrag:1200,link:'https://example.test/laptop'});
  expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk.some(goal=>goal.id==='parity-goal'))).toBe(false);

  await openGoals(page,1280);
  await page.locator('[data-u5-goal-filter="dion"]').click();
  await expect(page.locator('.u5-goal-list-card').filter({hasText:'Nieuwe laptop'})).toBeVisible();
});

test('inkomen gebruikt op mobiel en desktop dezelfde historie zonder legacy-write',async({page})=>{
  await installAccount(page,'dion');
  await page.setViewportSize({width:390,height:900});
  await page.locator('.v4-bottom-nav [data-tab="dion"]').click();
  const legacyBefore=await page.evaluate(()=>JSON.stringify(state.personen.dion.vasteTeruggaven));
  await page.getByRole('button',{name:'Inkomen van Dion aanpassen'}).click();
  await page.locator('#incomeEditInput').fill('2345.67');
  await page.locator('#incomeRefundInput').fill('89.10');
  await page.locator('#btnSaveIncomeEdit').click();
  const mobileState=await page.evaluate(()=>({
    history:structuredClone(state.incomeDefaultsHistory.dion),
    legacy:JSON.stringify(state.personen.dion.vasteTeruggaven)
  }));
  expect(mobileState.legacy).toBe(legacyBefore);
  expect(mobileState.history.at(-1)).toMatchObject({salary:2345.67,refund:89.1});

  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>renderActiveTab());
  await page.locator('#tab-dion details.manage-section').filter({hasText:'Inkomen en vaste teruggaven'}).locator('summary').click();
  await page.locator('#tab-dion [data-income-edit="dion"]').click();
  await expect(page.locator('#incomeEditInput')).toHaveValue('2345.67');
  await expect(page.locator('#incomeRefundInput')).toHaveValue('89.1');
  expect(await page.evaluate(()=>state.incomeDefaultsHistory.dion)).toEqual(mobileState.history);
  expect(await page.evaluate(()=>JSON.stringify(state.personen.dion.vasteTeruggaven))).toBe(legacyBefore);
});
