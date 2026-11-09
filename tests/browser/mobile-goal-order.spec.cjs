const {test,expect}=require('@playwright/test');
const {boot,navigate}=require('./helpers/v118-ux-fixture.cjs');

for(const width of [360,390,430])test(`directe mobiele doelvolgorde blijft duurzaam en behoudt bedragen (${width}px)`,async({page},info)=>{
  await boot(page,width,false,test.info().project.use.baseURL+'/');
  await page.evaluate(()=>commitChange(()=>{
    state.spaardoelen.dion=[
      {id:'order-a',naam:'Eerste testdoel',doelbedrag:150,algespaard:25,eigenaar:'dion',subdoelen:[]},
      {id:'order-b',naam:'Tweede testdoel',doelbedrag:300,algespaard:50,eigenaar:'dion',subdoelen:[]}
    ];
  },{render:false}));
  await navigate(page,'spaardoelen');
  const section=page.locator('.mobile-goal-section[data-goal-owner="dion"]');
  await expect(section.getByRole('button',{name:'Eerste testdoel omhoog',exact:true})).toBeDisabled();
  await expect(section.getByRole('button',{name:'Tweede testdoel omlaag',exact:true})).toBeDisabled();
  await section.getByRole('button',{name:'Tweede testdoel omhoog',exact:true}).click();
  const goals=()=>page.evaluate(async()=>{const durable=await DataAdapter.readDurableState();return durable.spaardoelen.dion.map(({id,doelbedrag,algespaard})=>({id,doelbedrag,algespaard}));});
  const expected=[{id:'order-b',doelbedrag:300,algespaard:50},{id:'order-a',doelbedrag:150,algespaard:25}];
  await expect.poll(goals).toEqual(expected);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  await navigate(page,'spaardoelen');
  await expect.poll(goals).toEqual(expected);
  await expect(section.locator('[data-reorder-goal]').first()).toHaveAttribute('data-goal-id','order-b');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath(`goal-order-${width}.png`),fullPage:true});
  await section.locator('[data-open-goal-editor="dion:order-b"]').click();
  await expect(page.getByRole('heading',{name:'Spaardoel bewerken'})).toBeVisible();
});
