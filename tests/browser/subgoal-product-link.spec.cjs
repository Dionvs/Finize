const fs=require('node:fs');
const path=require('node:path');
const {expect,test}=require('@playwright/test');

const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'..','fixtures','v50-visual-state.json'),'utf8'));

test('een productlink vult bestaande subdoelvelden zonder nieuwe interface',async({page})=>{
  const state=structuredClone(fixture);
  const goal=state.spaardoelen.gezamenlijk[0];
  goal.subdoelen=[{id:'product-child',naam:'Nieuw subdoel',doelbedrag:0,gespaard:0,link:'',voltooid:false}];
  goal.doelbedrag=0;
  goal.algespaard=0;

  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());
  await page.route('https://firestore.googleapis.com/**',route=>route.abort());
  await page.route('https://api.microlink.io/**',route=>{
    const productUrl=new URL(route.request().url()).searchParams.get('url');
    const missingPrice=productUrl?.includes('zonder-prijs');
    return route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({status:'success',data:{
        title:missingPrice?'Product zonder prijs':'Automatische espressomachine',
        url:productUrl,
        price:missingPrice?null:'€ 749,50',
        image:{url:'https://winkel.example/espressomachine.jpg'}
      }})
    });
  });
  await page.addInitScript(value=>{
    localStorage.setItem('finize-budget-planner-v1',JSON.stringify(value));
    localStorage.setItem('finize-device-id','subgoal-product-test');
  },state);
  await page.setViewportSize({width:430,height:900});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="spaardoelen"]:visible').first().click();
  await page.locator(`[data-open-goal-editor="gezamenlijk:${goal.id}"]:visible`).first().click();
  await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();

  const row=page.locator('[data-u2-child="0"]');
  await expect(row.locator('input')).toHaveCount(3);
  await row.locator('[data-u2-child-link]').fill('https://winkel.example/espressomachine');
  await row.locator('[data-u2-child-link]').blur();
  await expect(row.locator('[data-u2-child-name]')).toHaveValue('Automatische espressomachine');
  await expect(row.locator('[data-u2-child-target]')).toHaveValue('749.5');
  await expect(row.locator('input')).toHaveCount(3);

  await page.locator('#goalEditSave').click();
  await expect(page.locator('#incomeEditModal')).not.toHaveClass(/open/);
  const saved=await page.evaluate(()=>state.spaardoelen.gezamenlijk[0].subdoelen[0]);
  expect(saved.naam).toBe('Automatische espressomachine');
  expect(saved.doelbedrag).toBe(749.5);
  expect(saved.productInfo.price).toBe(749.5);
  expect(saved.productInfo.currency).toBe('EUR');

  await page.locator(`[data-open-goal-editor="gezamenlijk:${goal.id}"]:visible`).first().click();
  await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();
  const reopened=page.locator('[data-u2-child="0"]');
  await reopened.locator('[data-u2-child-link]').fill('https://winkel.example/zonder-prijs');
  await reopened.locator('[data-u2-child-link]').dispatchEvent('change');
  await expect(page.locator('.quick-toast')).toContainText('Product gevonden, maar geen prijs');
});
