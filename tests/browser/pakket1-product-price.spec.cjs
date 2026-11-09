const {test,expect}=require('@playwright/test');
const visual=require('../fixtures/v50-visual-state.json');

async function boot(page,width,price){
 await page.setViewportSize({width,height:1000});
 await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.route('https://api.microlink.io/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',data:{title:'Product',url:'https://winkel.example/product',price}})}));
 const seed=structuredClone(visual),goal=seed.spaardoelen.gezamenlijk[0];
 Object.assign(goal,{naam:'B1 testdoel',doelbedrag:150,doeldatum:'2027-12-31',rendement:0,subdoelen:[{id:'b1-child',naam:'Mijn product',doelbedrag:150,gespaard:goal.algespaard,link:'',voltooid:false}]});
 await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},seed);
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.locator('[data-tab="spaardoelen"]:visible').first().click();
 return goal.id;
}
test('B1 desktop tabelbewerker behoudt bedrag en verdeling bij ontbrekende prijs',async({page})=>{
 const id=await boot(page,1440,null),before=await financialState(page);
 await page.locator('[data-u5-goal-view="table"]').click();
 await page.locator(`[data-table-subgoal-toggle][data-goal-id="${id}"]`).click();
 const link=page.locator('[data-goal-subgoal-field="link"][data-subgoal-id="b1-child"]');
 await link.fill('https://winkel.example/product');await link.dispatchEvent('change');
 await expect(page.locator('.quick-toast')).toContainText('geen prijs');
 await expect.poll(()=>page.evaluate(()=>state.spaardoelen.gezamenlijk[0].subdoelen[0].productInfo?.price)).toBe(null);
 expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].doelbedrag)).toBe(150);
 expect(await financialState(page)).toEqual(before);
});
async function open(page,id){
 await page.locator(`[data-open-goal-editor="gezamenlijk:${id}"]:visible`).first().click();
 await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();
 return page.locator('[data-u2-child="0"]');
}
const financialState=page=>page.evaluate(()=>({
 history:JSON.stringify([state.spaardoelGeschiedenis,state.monthRecords,state.savingsGoalLedger,state.transactions]),
 distribution:FinizeUpdate2.calculateGroup(state.spaardoelen.gezamenlijk,500,'2026-11-06').map(x=>({id:x.doel.id,remaining:x.nogTeGaan,contribution:x.werkelijkeInleg,required:x.benodigdPerMaand}))
}));
for(const width of [390,1440]){
 test(`B1 ${width}px expliciete handmatige saldocorrectie blijft mogelijk`,async({page})=>{
  const id=await boot(page,width,null);await open(page,id);
  await page.locator('#goalEditSaved').fill('75');
  await page.locator('#goalEditSave').click();await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  const saved=await page.evaluate(id=>({balance:state.spaardoelen.gezamenlijk.find(g=>g.id===id).algespaard,corrections:state.savingsGoalLedger.filter(e=>e.goalId===id&&e.source==='manual-correction')}),id);
  expect(saved.balance).toBe(75);expect(saved.corrections).toHaveLength(1);expect(saved.corrections[0].effectiveAmount).toBe(-25);
 });
 for(const [label,price,expected] of [['ontbrekend',null,150],['leeg','',150],['ongeldig','geen prijs',150],['geldig','€ 49,95',49.95],['nul',0,0],['zonder link',undefined,150]]){
  test(`B1 ${width}px ${label}: bewaren, heropenen en opnieuw opslaan`,async({page})=>{
   const id=await boot(page,width,price),before=await financialState(page),row=await open(page,id);
   if(label!=='zonder link'){
    await row.locator('[data-u2-child-link]').fill('https://winkel.example/product');
    await row.locator('[data-u2-child-link]').dispatchEvent('change');
    if(['ontbrekend','leeg','ongeldig'].includes(label))await expect(page.locator('.quick-toast')).toContainText('geen prijs');
    await expect(row.locator('[data-u2-child-target]')).toHaveValue(String(expected));
   }
   await page.locator('#goalEditSave').click();await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
   expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].doelbedrag)).toBe(expected);
   expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].algespaard)).toBe(100);
   expect((await financialState(page)).history).toBe(before.history);
   if(expected===150)expect((await financialState(page)).distribution).toEqual(before.distribution);
   await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
   await page.locator('[data-tab="spaardoelen"]:visible').first().click();
   const reopened=await open(page,id);await expect(reopened.locator('[data-u2-child-target]')).toHaveValue(String(expected));
   await expect(page.locator('#goalEditSaved')).toHaveValue('100');
   await page.locator('#goalEditSave').click();await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
   expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].doelbedrag)).toBe(expected);
   expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].algespaard)).toBe(100);
   expect((await financialState(page)).history).toBe(before.history);
   if(expected===150)expect((await financialState(page)).distribution).toEqual(before.distribution);
  });
 }
 test(`B1 ${width}px nieuw doel met handmatig subdoelbedrag en product zonder prijs`,async({page})=>{
  await boot(page,width,null);
  await page.locator('[data-add-goal="gezamenlijk"]:visible').first().click();
  await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();
  await page.locator('[data-u2-add-child]').click();
  const row=page.locator('[data-u2-child="0"]');
  await row.locator('[data-u2-child-target]').fill('150');
  await row.locator('[data-u2-child-link]').fill('https://winkel.example/product');await row.locator('[data-u2-child-link]').dispatchEvent('change');
  await expect(page.locator('.quick-toast')).toContainText('geen prijs');
  await expect(row.locator('[data-u2-child-target]')).toHaveValue('150');
  await page.locator('#goalEditName').fill('Nieuw B1 doel');
  await page.locator('#goalEditSave').click();await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>state.spaardoelen.gezamenlijk.find(g=>g.naam==='Nieuw B1 doel').doelbedrag)).toBe(150);
 });
}
