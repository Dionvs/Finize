const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');
const {state}=require('../helpers/package5-fixture.cjs');

function fixture(){
  const s={...visual,...state()};s.meta.selectedMonth='2026-10';s.monthRecords={};s.transactions=[];
  const fixed=(id,naam,owner,amount,day,start='2026-01-01',unit='maanden')=>({id,naam,categorie:'Wonen',bedrag:amount,amountHistory:[{effectiveFrom:'2026-01-01',amount}],financialFor:owner,rekening:owner,begindatum:start,afschrijfdag:day,actief:true,frequentieAantal:1,frequentieEenheid:unit});
  s.recurringFixedExpenses=[fixed('open','Voorbeeld open','gezamenlijk',100,10),fixed('paid','Voorbeeld betaald','gezamenlijk',200,15),fixed('annual','Voorbeeld jaarlijks','gezamenlijk',300,20,'2026-01-01','jaren'),fixed('personal','Voorbeeld persoonlijk','dion',50,8)];
  s.transactions.push({id:'partial',source:'manual',accountOwner:'gezamenlijk',financialFor:'gezamenlijk',date:'2026-10-15',amount:25,accountDelta:-25,transactionType:'vaste-last',category:'Wonen',fixedExpenseId:'paid',fixedOccurrenceId:'paid:2026-10-01',fixedOccurrenceMonth:'2026-10'});
  return s;
}
for(const width of [320,390,1440])test(`gezamenlijk overzicht behoudt gegevens en bediening ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());
  await page.addInitScript(s=>localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s)),fixture());
  await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await page.locator('[data-tab="gezamenlijk"]:visible').first().click();
  const before=await page.evaluate(()=>({state:JSON.stringify(state),actual:FinizeUpdate3.fixedActuals('2026-10')}));
  await page.locator('#tab-gezamenlijk [data-u3-planning-owner="gezamenlijk"]:visible').first().click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Gezamenlijk vaste lasten'})).toBeVisible();
  const sections=dialog.locator('.joint-fixed-section');
  await expect(sections.nth(0)).toContainText('Voorbeeld open');await expect(sections.nth(1)).toContainText('Voorbeeld betaald');await expect(sections.nth(1)).toContainText('Betaald');await expect(dialog).not.toContainText('werkelijk € 25,00');
  await expect(dialog.locator('.joint-fixed-other')).not.toHaveAttribute('open');await dialog.getByText('Overige vaste lasten (1)').click();await expect(dialog.locator('.joint-fixed-other')).toContainText('Voorbeeld jaarlijks');await dialog.getByText('Overige vaste lasten (1)').click();
  await expect(dialog.locator('.joint-fixed-summary')).toContainText('€ 275,00');await expect(dialog.locator('.joint-fixed-summary')).toContainText('€ 25,00');await expect(dialog.locator('.joint-fixed-summary')).toContainText('€ 300,00');
  await expect(dialog).not.toContainText('Voorbeeld persoonlijk');await expect(dialog).not.toContainText('Inkomstenbronnen');
  expect(await page.evaluate(()=>({state:JSON.stringify(state),actual:FinizeUpdate3.fixedActuals('2026-10')}))).toEqual(before);
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('gezamenlijk-'+width+'.png')});
  await dialog.getByRole('button',{name:'Voorbeeld open bewerken'}).click();await expect(page.locator('#u3RecName')).toHaveValue('Voorbeeld open');await page.getByRole('button',{name:'Terug'}).click();
  await page.getByRole('button',{name:'Vaste last toevoegen'}).click();await expect(page.locator('#u3RecName')).toBeVisible();await page.getByRole('button',{name:'Terug'}).click();
  await page.getByRole('button',{name:'Sluiten'}).click();expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);
});

