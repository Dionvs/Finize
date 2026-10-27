const {test,expect}=require('@playwright/test'),visual=require('../fixtures/v50-visual-state.json'),{timingFixture}=require('../helpers/budget-timing.cjs');
for(const width of [320,390,430,1440])test('daily budget timing, bounded guard explanation and unchanged KPI '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1100});
 await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());
 await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},{...visual,...timingFixture()});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);const before=await page.evaluate(()=>JSON.stringify(state));
 const card=page.locator('.p3-kpi').first();await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 6.651,60');
 await expect(card.locator('[data-p3-savings-plan]')).toContainText('500,00');await expect(card.locator('[data-p3-savings-extra]')).toContainText('6.151,60');
 await expect(card).not.toContainText('Al uitgevoerd');await expect(card).not.toContainText('Nog uit te voeren');
 await card.locator('[data-p3-info="free"]').click();await expect(page.locator('#p3-info-free')).toContainText('dagelijks gespreid');
 await expect(page.locator('#p3-info-free')).toContainText('De rest van die maand is hiermee niet als gedekt aangetoond');
 await expect(page.locator('#p3-info-free')).toContainText('5 dec');await page.locator('[data-p3-close-info="free"]').click();
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 const minimumBefore=await page.locator('.p3-kpi').nth(2).innerText();
 await page.evaluate(()=>{state.monthlySavingOverrides={'2026-10':{gezamenlijk:600}};renderActiveTab();});
 await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 6.651,60');await expect(card.locator('[data-p3-savings-extra]')).toContainText('6.051,60');
 expect(await page.locator('.p3-kpi').nth(2).innerText()).toBe(minimumBefore);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('budgettiming-'+width+'.png')});
});
