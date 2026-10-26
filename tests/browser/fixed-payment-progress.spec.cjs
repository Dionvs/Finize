const {test,expect}=require('@playwright/test'),visual=require('../fixtures/v50-visual-state.json'),{state}=require('../helpers/package5-fixture.cjs');
function fixture(){
 const s={...visual,...state()};s.meta.selectedMonth='2026-10';s.monthRecords={};s.recurringFixedExpenses=[];s.transactions=[];
 for(const [owner,index]of ['gezamenlijk','dion','dara'].map((o,i)=>[o,i])){
  for(const category of ['Wonen','Entertainment'])s.recurringFixedExpenses.push({id:owner+'-'+category,naam:'Synthetisch '+category,categorie:category,bedrag:100,amountHistory:[{effectiveFrom:'2026-01-01',amount:100}],financialFor:owner,rekening:owner,begindatum:'2026-01-03',actief:true,frequentieAantal:1,frequentieEenheid:'maanden'});
  for(const [part,amount]of [25+index*5,25].entries())s.transactions.push({id:owner+'-paid-'+part,source:'manual',accountOwner:owner,financialFor:owner,date:part?'2026-10-03':'2026-09-30',amount,accountDelta:-amount,transactionType:'vaste-last',category:'Wonen',fixedExpenseId:owner+'-Wonen',fixedOccurrenceId:owner+'-Wonen:2026-10-03',fixedOccurrenceMonth:'2026-10'});
 }
 s.transactions.push({...s.transactions[0],id:'pending-fixed',source:'csv',processingStatus:'nakijken',reviewStatus:'te-controleren',approvalSource:'',amount:999});return s;
}
async function boot(page,width){await page.setViewportSize({width,height:1100});await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.route('https://**',r=>r.abort());await page.addInitScript(s=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(s));},fixture());await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);}
for(const width of [320,390,430,1440])test('fixed paid/planned stays visual and owner scoped '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,width);const before=await page.evaluate(()=>JSON.stringify(state));
 for(const [owner,paid]of [['gezamenlijk',50],['dion',55],['dara',60]]){
  await page.locator(`[data-tab="${owner}"]:visible`).first().click();const tab=page.locator('#tab-'+owner),row=tab.locator('[data-fixed-payment-category="Wonen"]:visible');await expect(row).toHaveCount(1);await expect(row).toContainText(paid+',00');await expect(row).toContainText('100,00');await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(paid));await expect(row.locator('.fixed-payment-percent')).toHaveText(paid+'%');await expect(tab.locator('[data-fixed-payment-category="Entertainment"]:visible .fixed-payment-percent')).toHaveText('0%');
  await expect(tab.locator('.fixed-payment-legend:visible')).toHaveText('Betaald / gepland');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);await page.screenshot({path:info.outputPath(owner+'-'+width+'.png')});
 }
 await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);expect(errors).toEqual([]);
});
test('overpayment caps the bar but retains actual amount; zero plan is not NaN',async({page})=>{
 await boot(page,390);await page.evaluate(()=>{state.transactions[0].amount=125;state.transactions[0].accountDelta=-125;state.recurringFixedExpenses.find(r=>r.id==='gezamenlijk-Entertainment').amountHistory[0].amount=0;renderActiveTab();});await page.locator('[data-tab="gezamenlijk"]:visible').first().click();const row=page.locator('#tab-gezamenlijk [data-fixed-payment-category="Wonen"]:visible');await expect(row).toContainText('150,00');await expect(row.locator('.fixed-payment-percent')).toHaveText('150%');await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');await expect(page.locator('#tab-gezamenlijk [data-fixed-payment-category="Entertainment"]:visible .fixed-payment-percent')).toHaveText('—');
});
