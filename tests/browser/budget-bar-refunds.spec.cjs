const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {state:fixture}=require('../helpers/package5-fixture.cjs');
for(const width of [360,390,430,1440])test(`budget bars retain signed amounts and clamp display at ${width}px`,async({page},info)=>{
 const seed={...visual,...fixture()};seed.meta.selectedMonth='2026-10';seed.budgetDefaultsHistory.gezamenlijk[0].rows[0].bedrag=100;
 seed.monthlyBudgets={};seed.monthlyBudgetOverrides={};
 await page.setViewportSize({width,height:900});await page.route('https://**',r=>r.abort());
 await page.addInitScript(s=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s)),seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(()=>document.querySelector('#tabs [data-tab="gezamenlijk"]').click());
 for(const [used,percent] of [[-400,0],[0,0],[25,25],[150,100]]){
  await page.evaluate(async used=>{
   const tx={id:'synthetic-budget-bar',source:'manual',processingStatus:'goedgekeurd',accountContext:'gezamenlijk',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',budgetOwner:'gezamenlijk',date:'2026-10-03',amount:Math.abs(used),transactionType:used<0?'terugbetaling':'uitgave',category:'Kleding',description:'Synthetic budget bar',...(used<0?{refundCategory:'Kleding',refundMonth:'2026-10'}:{})};
   await commitChange(()=>{state.transactions=[tx];},{render:true,throwOnError:true});
  },used);
  expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBe(used);
  const before=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>renderActiveTab());
  const row=page.locator('#tab-gezamenlijk [data-open-budget-transactions="Kleding"]');await expect(row).toBeVisible();
  const bar=row.locator('.progress-fill');expect(await bar.evaluate(el=>el.style.width)).toBe(percent+'%');
  const size=await bar.evaluate(el=>({fill:el.getBoundingClientRect().width,track:el.parentElement.clientWidth}));
  expect(Math.abs(size.fill-size.track*percent/100),JSON.stringify({used,percent,size})).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].algespaard)).toBe(2000);
  expect(await page.evaluate(()=>state.monthRecords['2026-08'])).toEqual(seed.monthRecords['2026-08']);
  if(used<0)await page.screenshot({path:info.outputPath('negative-budget-corrected.png')});
 }
});
