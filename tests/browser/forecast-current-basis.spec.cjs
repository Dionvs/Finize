const {test,expect}=require('@playwright/test'),visual=require('../fixtures/v50-visual-state.json'),{fixture}=require('../helpers/forecast-current-basis.cjs');
test.setTimeout(60000);
async function boot(page,width,settings){await page.setViewportSize({width,height:1000});await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},{...visual,...fixture(settings)});await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await expect(page.locator('.p3-kpis')).toBeVisible();}
for(const width of [320,390,430])test('current cash, graph and minimum share the future basis after past unreviewed salary '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);const before=await page.evaluate(()=>JSON.stringify(state));
 await expect(page.locator('.p3-kpi-copy>strong').nth(1)).toContainText('2.000,00');await expect(page.locator('.p3-kpi-copy>strong').nth(2)).toContainText('1.900,00');
 for(const filter of ['month','7','14','custom','salary']){
  await page.locator(`[data-p3-filter="${filter}"]`).click();if(filter==='custom'){await page.locator('[data-p3-custom]').fill('2026-10-30');await page.locator('[data-p3-custom]').dispatchEvent('change');}
  await expect(page.locator('[data-p3-day]')).toBeVisible();await page.locator('[data-p3-day]').selectOption('2026-10-26');await expect(page.locator('[data-p3-point-detail]')).toContainText('Berekend eindsaldo: € 2.000,00');await expect(page.locator('.p3-kpi-copy>strong').nth(2)).toContainText('1.900,00');if(filter==='month'){await expect(page.locator('[data-p3-point-detail]')).toContainText('Actuele saldobasis');await expect(page.locator('[data-p3-point-detail]')).toContainText('alleen in deze grafiek');}else await expect(page.locator('[data-p3-point-detail]')).not.toContainText('Actuele saldobasis');
 }
 await page.locator('[data-p3-day]').selectOption('2026-11-04');await expect(page.locator('[data-p3-point-detail]')).toContainText('Berekend eindsaldo: € 1.900,00');await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-11-05');
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('current-basis-'+width+'.png')});
});
test('calendar budget keeps the same November day in KPI, graph and selected-day details',async({page})=>{
 await boot(page,390,{pastSalary:false,budget:true});await page.locator('[data-p3-filter="salary"]').click();await expect(page.locator('.p3-kpi-copy>strong').nth(2)).toContainText('986,64');await page.locator('[data-p3-day]').selectOption('2026-11-04');await expect(page.locator('[data-p3-point-detail]')).toContainText('Berekend eindsaldo: € 986,64');
});
