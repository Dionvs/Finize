const {test,expect}=require('@playwright/test'),visual=require('../fixtures/v50-visual-state.json'),{timingFixture}=require('../helpers/budget-timing.cjs');
for(const width of [320,390,430,1440])test('month-end budget timing, full next month explanation and unchanged KPI '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1100});
 await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());
 await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},{...visual,...timingFixture()});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);const before=await page.evaluate(()=>JSON.stringify(state));
 const card=page.locator('.p3-kpi').first();await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 6.850,00');
 await expect(card.locator('[data-p3-savings-plan]')).toContainText('500,00');await expect(card.locator('[data-p3-savings-extra]')).toContainText('6.350,00');
 await expect(card).not.toContainText('Al uitgevoerd');await expect(card).not.toContainText('Nog uit te voeren');
 await card.locator('[data-p3-info="free"]').click();await expect(page.locator('#p3-info-free')).toContainText('alleen op de laatste kalenderdag');
 await expect(page.locator('#p3-info-free')).toContainText('Alleen de volledige volgende kalendermaand');
 await expect(page.locator('#p3-info-free')).toContainText('30 nov');await page.locator('[data-p3-close-info="free"]').click();
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 const minimumBefore=await page.locator('.p3-kpi').nth(2).innerText();
 await page.evaluate(()=>{state.monthlySavingOverrides={'2026-10':{gezamenlijk:600}};renderActiveTab();});
 await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 6.850,00');await expect(card.locator('[data-p3-savings-extra]')).toContainText('6.250,00');
 expect(await page.locator('.p3-kpi').nth(2).innerText()).toBe(minimumBefore);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('budgettiming-'+width+'.png')});
});

test('3000 end balance leaves 950 safe savings and at least 200 on every next-month day',async({page})=>{
 const {fixture}=require('../helpers/month-end-savings.cjs');
 await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());
 await page.addInitScript(seed=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed)),{...visual,...fixture({balance:300000,first:1850})});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 const before=await page.evaluate(()=>JSON.stringify(state)),card=page.locator('.p3-kpi').first();
 await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 950,00');
 const p=await page.evaluate(async()=>(await FinizeLiquidity.project({accountProfileId:'joint',asOfDate:'2026-10-26',incomeKpis:true,monthEndSavingsMonth:'2026-10'})).monthEndSavings);
 expect(p.requiredOpeningCents).toBe(205000);expect(p.expectedEndBalanceCents).toBe(300000);expect(p.safeCents).toBe(95000);
 const days=p.protectionDays.filter(d=>d.date>'2026-10-31');expect(days).toHaveLength(30);
 expect(Math.min(...days.map(d=>d.protectedBalanceCents-p.safeCents))).toBe(20000);
 await card.locator('[data-p3-info="free"]').click();await expect(page.locator('#p3-info-free')).toContainText('2.050,00');
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});

test('confirmed month-end bank cash is not reduced by the unused budget of the closed month',async({page})=>{
 const {fixture}=require('../helpers/month-end-savings.cjs'),s=fixture({asOf:'2026-10-31',balance:1000000});s.budgetDefaultsHistory=timingFixture().budgetDefaultsHistory;
 await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));await page.route('https://**',r=>r.abort());await page.addInitScript(seed=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed)),{...visual,...s});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);const card=page.locator('.p3-kpi').first();await expect(card.locator('.p3-kpi-copy>strong')).toHaveText('€ 8.000,00');
 const p=await page.evaluate(async()=>(await FinizeLiquidity.project({accountProfileId:'joint',asOfDate:'2026-10-31',incomeKpis:true,monthEndSavingsMonth:'2026-10'})).monthEndSavings);
 expect(p.expectedEndBalanceCents).toBe(1000000);expect(p.requiredOpeningCents).toBe(200000);expect(p.protectionDays[0].budgetReservedCents).toBe(0);expect(p.protectionDays.at(-1).budgetReservedCents).toBe(115000);
});
