const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {fixture}=require('../helpers/personal-month-summary-fixture.cjs');

async function boot(page,width=390,owner='dion',options){
  await page.setViewportSize({width,height:900});
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.route('https://**',route=>route.abort());
  await page.addInitScript(seed=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed)),{...visual,...fixture(owner,options)});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
}
async function tab(page,name){await page.evaluate(name=>document.querySelector(`#tabs [data-tab="${name}"]`).click(),name);}

for(const width of [320,390,430])for(const owner of ['dion','dara'])test(`mobiele tabs ${owner} ${width}: bedragen, details en navigatie`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boot(page,width,owner);const before=await page.evaluate(()=>JSON.stringify(state));
  for(const name of ['gezamenlijk',owner,'spaardoelen']){
    await tab(page,name);const root=page.locator('#tab-'+name);
    await expect(root.locator('.mt-surface')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(name===owner){
      await expect(root.locator('.mt-amount')).toContainText('395,00');
      await root.locator('.mt-calculation summary').click();
      await expect(root.locator('.mt-calculation')).toContainText('Inkomen en teruggaven');
      await root.locator('.mt-calculation summary').click();
      await expect(root.locator('[data-fixed-payment-total]')).toContainText('50,00');
      await expect(root.locator('.mt-fixed-list')).toContainText('Synthetische vaste last');
      await expect(root.locator('.mt-fixed-list')).toContainText('Nog niet betaald');
      await expect(root.locator('.mt-pot')).toContainText('42,50');
      await expect(root.locator('.mt-goal-open')).toContainText('Synthetische buffer');
      await root.locator('.mt-extra').last().locator('summary').click();
      await expect(root.locator('.goal-table-wrap')).toBeVisible();
    }
    if(name==='spaardoelen'){
      await expect(root.locator('.mt-monthly')).toContainText('Inleg deze maand');
      for(const section of await root.locator('.mobile-goal-section').all())await expect(section.locator('[data-add-goal]')).toHaveCount(1);
      for(const label of ['Verdeling van spaardoelen','Inleg per rekening','Doelen beheren','Spaargeschiedenis']){
        const summary=root.locator('summary').filter({hasText:label}).first();await summary.click();
        await expect(summary.locator('..')).toHaveAttribute('open','');await summary.click();
      }
    }
    await page.screenshot({path:info.outputPath(`${name}-${width}.png`),fullPage:true});
  }
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);expect(errors).toEqual([]);
});

test('bestaande acties openen zonder financiële state te wijzigen',async({page})=>{
  await boot(page);await tab(page,'dion');const before=await page.evaluate(()=>JSON.stringify(state));
  await page.locator('[data-open-income-overview="dion"]').click();await expect(page.locator('#incomeEditModal')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.locator('[data-mt-fixed]').click();await expect(page.locator('#u3RecName')).toHaveValue('Synthetische vaste last');await page.keyboard.press('Escape');
  await page.locator('[data-mt-add-fixed]').click();await expect(page.locator('#u3RecName')).toHaveValue('');await page.keyboard.press('Escape');
  await page.locator('[data-open-owner-variable="dion"]').click();await expect(page.locator('.joint-variable-editor-list')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('.mt-goal-open').click();await expect(page.locator('#goalEditFavorite')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('[data-personal-saving-edit="dion"]').click();await expect(page.locator('#personalSavingInput')).toHaveValue('42.5');await page.locator('#btnCancelPersonalSaving').click();
  await page.locator('.joint-transaction-add-btn').click();await expect(page.locator('#transactionModal')).toHaveClass(/open/);await page.keyboard.press('Escape');
  await tab(page,'spaardoelen');await page.locator('[data-u2-process-owner="dion"]').click();await expect(page.locator('[data-u2-confirm]')).toBeVisible();await page.locator('[data-u2-close]').first().click();
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});

test('tekort en lege doelen blijven leesbaar',async({page})=>{
  await boot(page,320,'dion',{expense:800,refund:0,withdrawal:0});await tab(page,'dion');
  await expect(page.locator('.mt-amount')).toContainText('250,00');await expect(page.locator('.mt-amount')).toHaveClass(/mt-negative/);
  await page.evaluate(()=>{state.spaardoelen={gezamenlijk:[],dion:[],dara:[]};renderActiveTab();});
  await expect(page.locator('.mt-surface')).toContainText('Nog geen spaardoelen');
  await tab(page,'spaardoelen');await expect(page.locator('.mt-savings-hero')).toContainText('0,00');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('maandwissel gebruikt de bestaande maandbediening in alle nieuwe tabs',async({page})=>{
  await boot(page);
  const before=await page.evaluate(()=>JSON.stringify({transactions:state.transactions,fixed:state.recurringFixedExpenses,goals:state.spaardoelen}));
  for(const name of ['gezamenlijk','dion','spaardoelen']){
    await tab(page,name);
    for(const month of ['2026-11','2026-10']){
      await page.locator('#monthPickerButton').click();await page.locator(`[data-month-value="${month}"]`).click();
      await expect(page.locator('#tab-'+name+' .mt-surface')).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>state.meta.selectedMonth)).toBe(month);
    }
  }
  expect(await page.evaluate(()=>JSON.stringify({transactions:state.transactions,fixed:state.recurringFixedExpenses,goals:state.spaardoelen}))).toBe(before);
});

for(const width of [768,1440])test(`desktop behoudt bestaande weergave ${width}`,async({page})=>{
  await boot(page,width);for(const name of ['gezamenlijk','dion','dara','spaardoelen']){
    await tab(page,name);await expect(page.locator('#tab-'+name+' .mt-surface')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});
