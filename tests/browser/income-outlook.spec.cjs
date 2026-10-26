const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json'),{setup,receivedAllowance}=require('../helpers/income-outlook-fixture.cjs');
test.setTimeout(60000);
async function boot(page,width=390,asOf='2026-10-10',received=false){
 await page.setViewportSize({width,height:1000});await page.clock.setFixedTime(new Date(asOf+'T12:00:00Z'));
 await page.route('https://**',r=>r.abort());const seed={...visual,...setup(asOf)};if(received)receivedAllowance(seed);
 await page.addInitScript(value=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));},seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await expect(page.locator('.p3-kpis')).toBeVisible();
}
const values=page=>page.locator('.p3-kpi-copy>strong').allTextContents();
for(const width of [320,390,430])test('income KPI values remain fixed through five filters in both contexts '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);
 const before=await page.evaluate(()=>JSON.stringify(state)),joint=await values(page);expect(joint[0]).toContain('700,00');expect(joint[2]).toContain('800,00');
 await expect(page.locator('[data-p3-filter]')).toHaveCount(5);
 for(const filter of ['7','14','salary','month','custom']){
  await page.locator(`[data-p3-filter="${filter}"]`).click();
  if(filter==='custom'){await page.locator('[data-p3-custom]').fill('2026-10-12');await page.locator('[data-p3-custom]').dispatchEvent('change');}
  await expect(page.locator('.p3-kpis')).toBeVisible();expect(await values(page)).toEqual(joint);
 }
 await page.locator('[data-p3-context="persoonlijk"]').click();await expect(page.locator('.p3-kpis')).toContainText('1.000,00');
 const personal=await values(page);expect(personal[0]).toContain('900,00');expect(personal[2]).toContain('1.000,00');
 for(const filter of ['7','14','month','custom','salary']){
  await page.locator(`[data-p3-filter="${filter}"]`).click();if(filter==='custom'){await page.locator('[data-p3-custom]').fill('2026-10-12');await page.locator('[data-p3-custom]').dispatchEvent('change');}
  await expect(page.locator('.p3-kpis')).toBeVisible();expect(await values(page)).toEqual(personal);
 }
 await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-10-31');await expect(page.locator('[data-p3-payments]')).toContainText('Zakgeld Dion ontvangen');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('income-outlook-'+width+'.png')});
});
test('received October 31 allowance makes salary filter include November income while KPI stops before it',async({page})=>{
 await boot(page,390,'2026-10-31',true);await page.locator('[data-p3-context="persoonlijk"]').click();await expect(page.locator('.p3-kpis')).toBeVisible();
 await page.locator('[data-p3-filter="salary"]').click();await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-11-30');
 const result=await page.evaluate(async()=>{const p=await FinizeLiquidity.project({accountProfileId:'personal',asOfDate:'2026-10-31',incomeKpis:true});return {end:p.horizon.endDate,receipt:p.horizon.receiptDate,minimum:p.minimumBalanceCents};});expect(result).toEqual({end:'2026-11-29',receipt:'2026-11-30',minimum:100000});
 await expect(page.locator('[data-p3-payments]')).toContainText('Zakgeld Dion ontvangen');await expect(page.locator('.p3-kpis')).toContainText('900,00');
});
test('a late previous KPI projection cannot overwrite a newer graph filter or account context',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>JSON.stringify(state));
 await page.evaluate(()=>{const original=FinizeLiquidity;let once=true;window.FinizeLiquidity={...original,project:async options=>{if(once&&options.incomeKpis){once=false;window.incomeGateStarted=true;await new Promise(resolve=>window.releaseIncomeGate=resolve);}return original.project(options);}};});
 await page.locator('[data-p3-filter="7"]').click();await page.waitForFunction(()=>window.incomeGateStarted);await page.locator('[data-p3-context="persoonlijk"]').click();await page.locator('[data-p3-filter="salary"]').click();
 await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-10-31');await page.evaluate(()=>releaseIncomeGate());await expect(page.locator('.p3-kpis')).toContainText('900,00');
 await expect(page.locator('[data-p3-context="persoonlijk"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-p3-filter="salary"]')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});
test('financial change between KPI and graph retries both against the same committed snapshot and date',async({page})=>{
 await boot(page);await page.evaluate(()=>{const original=FinizeLiquidity;let once=true;window.incomeCalculationDates=[];window.FinizeLiquidity={...original,project:async options=>{incomeCalculationDates.push(options.asOfDate);const result=await original.project(options);if(once&&options.incomeKpis){once=false;await commitChange(s=>{s.recurringFixedExpenses[0].bedrag=250;s.recurringFixedExpenses[0].amountHistory[0].amount=250;},{render:false,throwOnError:true});}return result;}};});
 await page.locator('[data-p3-filter="7"]').click();await expect(page.locator('.p3-kpis')).toBeVisible();await expect(page.locator('.p3-kpi-copy>strong').nth(0)).toContainText('650,00');await expect(page.locator('.p3-kpi-copy>strong').nth(2)).toContainText('750,00');
 const dates=await page.evaluate(()=>incomeCalculationDates);expect(dates).toHaveLength(4);expect(new Set(dates)).toEqual(new Set(['2026-10-10']));
});
