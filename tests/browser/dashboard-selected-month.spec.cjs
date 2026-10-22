const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {boot,navigate}=require('./helpers/v118-ux-fixture.cjs');
test.setTimeout(90000);
async function changeMonth(page,month){
 await page.locator('#monthPickerButton').click();
 if(!(await page.locator(`[data-month-value="${month}"]`).count()))await page.locator(`[data-month-year="${month.slice(0,4)}"]`).click();
 await page.locator(`[data-month-value="${month}"]`).click();
 await expect(page.locator('[data-p3-filter="month"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-p3-day] option').first()).toHaveAttribute('value',month+'-01');
}
const snapshot=page=>page.evaluate(()=>JSON.stringify({transactions:state.transactions,fixed:state.recurringFixedExpenses,goals:state.savingsGoalLedger,profiles:state.accountProfiles,checkpoints:state.balanceCheckpoints}));
for(const width of [320,390,768,1440])test(`gekozen kalendermaand, onbekende dagen en contexten ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);
 const before=await snapshot(page);
 await expect(page.locator('[data-p3-day] option')).toHaveCount(31);
 await expect(page.locator('[data-p3-day]')).toHaveValue('2026-10-01');
 await expect(page.locator('[data-p3-point-detail]')).toContainText('Saldo onbekend');
 await expect(page.locator('g[data-p3-point="2026-10-01"]')).toHaveCount(0);
 await expect(page.locator('[data-p3-unknown-days]')).toContainText('1 okt – 13 okt');
 await page.locator('[data-p3-filter="7"]').click();
 await expect(page.locator('[data-p3-period]')).toContainText('20 okt');
 await changeMonth(page,'2026-11');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(30);
 await expect(page.locator('[data-p3-day] option').last()).toHaveAttribute('value','2026-11-30');
 await expect(page.locator('[data-p3-period]')).toContainText('1 nov – 30 nov 2026');
 expect(await page.locator('[data-p3-payments] time').evaluateAll(nodes=>nodes.every(n=>n.dateTime.startsWith('2026-11')))).toBe(true);
 await expect(page.locator('.p3-budget')).toContainText('november 2026');
 await expect(page.locator('.p3-allowance')).toContainText('november 2026');
 await expect(page.locator('.p3-goals')).toContainText('Huidige stand');
 const r=await page.evaluate(()=>FinizeUpdate3.scenarioResult());
 const eur=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n);
 await expect(page.locator('.p3-budget')).toContainText(eur(r.variabelBudgetTotaal));
 await expect(page.locator('.p3-allowance')).toContainText(eur(r.dion.zakgeld));
 await expect(page.locator('[data-p3-payments]').locator('..').locator('.p3-head button')).toHaveCount(0);
 await page.locator('[data-p3-context="persoonlijk"]').click();
 await expect(page.locator('[data-p3-period]')).toContainText('1 nov – 30 nov 2026');
 await page.locator('[data-p3-person]').selectOption('dara');
 await expect(page.locator('.p3-account-name')).toHaveText('Rekening: Dara betalen');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(30);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 fs.mkdirSync('.cache/dashboard-selected-month',{recursive:true});
 await page.screenshot({path:`.cache/dashboard-selected-month/november-${width}.png`,fullPage:true});
 expect(await snapshot(page)).toBe(before);expect(errors).toEqual([]);
});
test('jaar volgt maandwissel; handmatig jaar en filters blijven tot de volgende maandwissel',async({page})=>{
 await boot(page,1440);await page.locator('[data-p3-year]').selectOption('2025');
 await page.locator('[data-p3-filter="14"]').click();await expect(page.locator('[data-p3-year]')).toHaveValue('2025');
 await changeMonth(page,'2026-12');await expect(page.locator('[data-p3-year]')).toHaveValue('2026');
 await page.locator('[data-p3-filter="custom"]').click();await page.locator('[data-p3-custom]').fill('2026-12-15');await page.locator('[data-p3-custom]').dispatchEvent('change');
 await expect(page.locator('[data-p3-period]')).toContainText('15 dec 2026');
 await changeMonth(page,'2027-01');await expect(page.locator('[data-p3-year]')).toHaveValue('2027');
 await expect(page.locator('[data-p3-custom]')).toHaveValue('');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(31);
});
test('kort filter en eigen datum zijn begrensd; onbekende historische maand heeft geen lijn',async({page})=>{
 await boot(page,390);await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
 await page.locator('[data-p3-filter="14"]').click();await expect(page.locator('[data-p3-day] option')).toHaveCount(2);
 await changeMonth(page,'2026-11');await page.locator('[data-p3-filter="7"]').click();await expect(page.locator('[data-p3-day] option')).toHaveCount(7);
 await page.locator('[data-p3-filter="custom"]').click();await expect(page.locator('[data-p3-custom]')).toHaveAttribute('min','2026-11-01');await expect(page.locator('[data-p3-custom]')).toHaveAttribute('max','2026-11-30');
 await page.locator('[data-p3-custom]').fill('2026-12-01');await page.locator('[data-p3-custom]').dispatchEvent('change');
 await expect(page.locator('[data-p3-outlook]')).toContainText('binnen de geselecteerde maand');
 await expect(page.locator('.p3-line')).toHaveCount(0);
 await changeMonth(page,'2026-09');await expect(page.locator('[data-p3-day] option')).toHaveCount(30);
 await expect(page.locator('.p3-line')).toHaveCount(0);await expect(page.locator('[data-p3-point-detail]')).toContainText('Saldo onbekend');
 await page.screenshot({path:'.cache/dashboard-selected-month/september-onbekend-390.png',fullPage:true});
});
test('late oktoberrespons kan november niet overschrijven',async({page})=>{
 await boot(page,390);
 await page.evaluate(()=>{const original=FinizeLiquidity;window.__monthDelayed=[];window.FinizeLiquidity={...original,project:async options=>{const result=await original.project(options);if(options.startDate==='2026-10-14')await new Promise(resolve=>window.__monthDelayed.push(resolve));return result;}};});
 await page.locator('[data-p3-filter="7"]').click();await page.waitForFunction(()=>__monthDelayed.length===1);
 await changeMonth(page,'2026-11');await page.evaluate(()=>__monthDelayed.forEach(resolve=>resolve()));
 await expect(page.locator('[data-p3-period]')).toContainText('1 nov – 30 nov 2026');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(30);
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await expect(page.locator('[data-p3-filter="month"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-p3-period]')).toContainText('1 nov – 30 nov 2026');
});
test('historisch salarisfilter en toekomstige korte horizon blijven bij hun geselecteerde maand',async({page})=>{
 await boot(page,390);await changeMonth(page,'2026-09');await page.locator('[data-p3-filter="salary"]').click();
 await expect(page.locator('[data-p3-period]')).toContainText('1 sep – 24 sep 2026');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(24);await expect(page.locator('.p3-line')).toHaveCount(0);
 await changeMonth(page,'2026-11');await page.locator('[data-p3-filter="7"]').click();
 await expect(page.locator('[data-p3-period]')).toContainText('1 nov – 7 nov 2026');
 await expect(page.locator('[data-p3-day] option')).toHaveCount(7);
 await page.locator('[data-p3-context="persoonlijk"]').click();await page.locator('[data-p3-filter="salary"]').click();
 await expect(page.locator('[data-p3-period]')).toContainText('onbekend');
 await expect(page.locator('[data-p3-chart]')).toContainText('betrouwbare volgende salarisdatum ontbreekt');
});


for(const width of [390,430,1440])test('betalingskaart toont toekomstige vaste planning en scrollt compact '+width+'px',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await boot(page,width);
 const before=await snapshot(page);
 const paths=await page.locator('.p3-line').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
 await page.evaluate(()=>{
  const original=FinizeLiquidity.project;
  window.FinizeLiquidity={...FinizeLiquidity,project:async options=>{
   const p=await original(options);
   const base={accountProfileId:p.accountProfileId,type:'fixed',status:'planned',date:'2026-10-20',amountCents:-12345,warnings:[]};
   return {...p,events:[
    ...Array.from({length:10},(_,i)=>({...base,id:'test-future-'+i})),
    ...[{id:'test-past',date:'2026-10-13'},{id:'test-today',date:'2026-10-14'},
     {id:'test-bank',type:'bank',status:'actual'},{id:'test-provisional',type:'bank',status:'provisional'},
     {id:'test-transfer',type:'internal-transfer'},{id:'test-replaced',status:'replaced'},
     {id:'test-outside',date:'2026-11-01'},
     {id:'test-salary',type:'salary',date:'2026-10-25',amountCents:250000}
    ].map(extra=>({...base,...extra}))
   ]};
  }};
 });
 await navigate(page,'dashboard');
 const list=page.locator('[data-p3-payments]');
 await expect(list.locator('time')).toHaveCount(11);
 expect(await list.locator('time').evaluateAll(nodes=>nodes.map(n=>n.dateTime))).toEqual([...Array(10).fill('2026-10-20'),'2026-10-25']);
 await expect(list).not.toContainText('Werkelijk');
 await expect(list).not.toContainText('Voorlopig');
 expect(await page.locator('.p3-line').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')))).toEqual(paths);

 await expect(list.locator('..').locator('.p3-head button')).toHaveCount(0);
 const scroll=await list.evaluate(el=>{el.scrollTop=el.scrollHeight;return {height:el.clientHeight,content:el.scrollHeight,top:el.scrollTop,overflow:getComputedStyle(el).overflowY};});
 expect(scroll.height).toBeLessThanOrEqual(360);expect(scroll.content).toBeGreaterThan(scroll.height);expect(scroll.top).toBeGreaterThan(0);expect(scroll.overflow).toBe('auto');
 fs.mkdirSync('.cache/upcoming-payments',{recursive:true});
 await page.screenshot({path:'.cache/upcoming-payments/dashboard-'+width+'.png',fullPage:true});
 await page.locator('[data-p3-filter="7"]').click();
 await expect(list.locator('time')).toHaveCount(10);
 await page.locator('[data-p3-filter="custom"]').click();
 await page.locator('[data-p3-custom]').fill('2026-10-19');
 await page.locator('[data-p3-custom]').dispatchEvent('change');
 await expect(list).toContainText('Geen toekomstige vaste betalingen of inkomsten');
 expect(await snapshot(page)).toEqual(before);expect(errors).toEqual([]);
});
