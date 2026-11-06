const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {cases,weekly,financialFixture}=require('../helpers/pakket1-weekly.cjs');
test.use({timezoneId:'Europe/Amsterdam'});
for(const width of [390,1440])test(`B2 ${width}px kalenderplanning, prognose en financiële kaarten`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.addInitScript(s=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s)),{...visual,...financialFixture()});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Europe/Amsterdam');
 for(const [label,start,month,expected]of cases){const item=weekly({begindatum:start});expect(await page.evaluate(({item,month})=>FinizeUpdate3.occurrenceDates(item,month),{item,month}),label).toEqual(expected);}
 const before=await page.evaluate(()=>JSON.stringify(state));
 const result=await page.evaluate(async()=>{
  const p=await FinizeLiquidity.project({accountProfileId:'joint',asOfDate:'2026-10-31',endDate:'2026-11-30',monthEndSavingsMonth:'2026-10'});
  return {minimum:p.minimumBalanceCents,savings:p.monthEndSavings.safeCents??p.monthEndSavings.indicativeCents,burden:FinizeTransactions.forecast('2026-11').owners.gezamenlijk.fixedBurden};
 });
 expect(result).toEqual({minimum:95000,savings:75000,burden:50});
 await expect(page.locator('.p3-savings-amount')).toContainText('750,00');
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`weekly-${width}.png`),fullPage:true});
});
