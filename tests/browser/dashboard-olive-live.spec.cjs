const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v50-visual-state.json')));
const {fixture:savingsFixture}=require('../helpers/month-end-savings.cjs');

async function boot(page,width){
  await page.setViewportSize({width,height:1000});
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'));
  await page.route('https://www.gstatic.com/**',route=>route.abort());
  await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.addInitScript(seed=>{
    const goals=structuredClone(seed.spaardoelen);goals.gezamenlijk.slice(0,2).forEach(goal=>goal.favoriet=true);
    localStorage.setItem('finize-budget-planner-v1',JSON.stringify({...seed,spaardoelen:goals,meta:{...seed.meta,selectedMonth:'2026-10'},accountProfiles:[{id:'p3-joint',name:'Gezamenlijk betalen',accountOwner:'gezamenlijk',accountType:'payment',identifier:'NL91ABNA0417164300',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:20000,salaryDays:{dion:25,dara:27}}},{id:'p3-person',name:'Dion betalen',accountOwner:'dion',accountType:'payment',identifier:'NL02ABNA0123456789',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:0,salaryDays:{}}}]}));
  },fixture);
  await page.goto('/');
  await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.evaluate(()=>{state.recurringFixedExpenses.forEach((row,i)=>row.afschrijfdatum=`2026-01-${String(16+i%8).padStart(2,'0')}`);openBankAccountDetails('p3-joint');});
  await page.locator('[data-balance-add]').click();
  await page.locator('[data-balance-amount]').fill('3100');
  await page.locator('[data-balance-date]').fill('2026-10-14');
  await page.locator('[data-balance-check]').click();
  await page.locator('[data-balance-confirm]').click();
  await expect(page.locator('[data-balance-value]')).toContainText('3.100,00');
  await page.evaluate(()=>document.querySelector('#tabs [data-tab="dashboard"]').click());
  await expect(page.locator('.p3-savings-card')).toBeVisible();
  await expect(page.locator('[data-p3-chart] svg')).toBeVisible();
}

for(const width of [320,390,430,768,1280,1440])test(`nieuw dashboard ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boot(page,width);
  const expected=await page.evaluate(async()=>{
    const p=await FinizeLiquidity.project({accountProfileId:'p3-joint',asOfDate:'2026-10-14',incomeKpis:true,monthEndSavingsMonth:'2026-10'});
    return {safe:p.monthEndSavings.safeCents??p.monthEndSavings.indicativeCents,balance:p.opening.balanceCents,minimum:p.minimumBalanceCents,buffer:p.bufferCents};
  });
  const eur=n=>n===null?'—':new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n/100);
  await expect(page.locator('.p3-savings-card')).toContainText(eur(expected.safe));
  await expect(page.locator('.p3-savings-card')).toContainText(eur(expected.balance));
  await expect(page.locator('.p3-chart-stats')).toContainText(eur(expected.minimum));
  await expect(page.locator('.p3-chart-stats')).toContainText(eur(expected.buffer));
  await expect(page.locator('[data-p3-payments]')).toContainText('Waterschap');
  await expect(page.locator('.p3-goal')).toHaveCount(2);
  await expect(page.locator('.p3-budget,.p3-year')).toHaveCount(0);
  await expect(page.locator('[data-p3-filter]')).toHaveValue('month');
  await expect(page.locator('[data-p3-chart] svg')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width<=430){
    const layout=await page.evaluate(()=>{
      const last=document.querySelector('.p3-goals .p3-link').getBoundingClientRect();
      const calculation=document.querySelector('.p3-savings-copy .p3-info-button').getBoundingClientRect();
      return {bottomSpace:document.body.scrollHeight-(last.bottom+scrollY),calculationWidth:calculation.width};
    });
    expect(layout.bottomSpace).toBeLessThanOrEqual(125);
    expect(layout.calculationWidth).toBeGreaterThan(100);
  }
  fs.mkdirSync('.cache/dashboard-olive-live',{recursive:true});
  await page.screenshot({path:`.cache/dashboard-olive-live/dashboard-${width}.png`,fullPage:true});
  await page.locator('[data-p3-filter]').selectOption('7');
  await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-10-20');
  await page.locator('[data-p3-filter]').selectOption('custom');
  await page.locator('[data-p3-custom]').fill('2026-10-30');
  await page.locator('[data-p3-custom]').dispatchEvent('change');
  await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-10-30');
  await page.locator('[data-p3-day]').selectOption('2026-10-16');
  await expect(page.locator('[data-p3-point-detail]')).toBeVisible();
  await page.locator('[data-p3-context="persoonlijk"]').click();
  await expect(page.locator('[data-p3-person]')).toBeVisible();
  await expect(page.locator('.p3-allowance-row')).toHaveCount(1);
  await page.locator('[data-p3-action="goals"]').click();
  expect(await page.evaluate(()=>document.querySelector('.wrap.active')?.id)).toBe('tab-spaardoelen');
  expect(errors).toEqual([]);
});

test('Veilig te sparen blijft dezelfde berekening bij elke grafiekperiode',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.route('https://**',route=>route.abort());
  await page.addInitScript(seed=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed)),{...fixture,...savingsFixture()});
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await expect(page.locator('.p3-savings-amount')).toHaveText('€ 750,00');
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const value of ['7','14','salary','month']){
    await page.locator('[data-p3-filter]').selectOption(value);
    await expect(page.locator('.p3-savings-amount')).toHaveText('€ 750,00');
  }
  await page.locator('[data-p3-info="free"]').click();
  await expect(page.locator('#p3-info-free')).toContainText('Gepland sparen: € 500,00');
  await expect(page.locator('#p3-info-free')).toContainText('Extra ruimte: € 250,00');
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});
