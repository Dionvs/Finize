const {test,expect}=require('@playwright/test');
const {boot,navigate}=require('./helpers/v118-ux-fixture.cjs');
async function start(page,width){await boot(page,width,false,test.info().project.use.baseURL+'/');}

for(const width of [320,390,430])test(`mobiel herstel ${width}: header, geld, laatste actie en state`,async({page},info)=>{
 await start(page,width);
 const before=await page.evaluate(()=>JSON.stringify(state));
 for(const tab of ['dashboard','gezamenlijk','dion','dara','spaardoelen','data','settings']){
  await navigate(page,tab);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  // Read both boxes together: the dashboard may redraw its header asynchronously.
  const headers=await page.evaluate(()=>[...document.querySelectorAll('.wrap.active .mobile-header-top')].flatMap(h=>{
   const status=h.querySelector('.mobile-status-pill'),month=h.querySelector('.mobile-month-slot');
   if(!status?.getBoundingClientRect().height||!month?.getBoundingClientRect().height)return [];
   return [{status:status.getBoundingClientRect().toJSON(),month:month.getBoundingClientRect().toJSON(),brand:h.querySelector('.mobile-tab-title').getBoundingClientRect().toJSON()}];
  }));
  for(const {status,month,brand} of headers){
   expect(status.height).toBeGreaterThanOrEqual(20);
   expect(Math.abs(brand.y-month.y)).toBeLessThanOrEqual(1);
   expect(month.height).toBeLessThanOrEqual(brand.height+1);
   expect(month.x).toBeGreaterThanOrEqual(brand.x+brand.width);
   expect(status.y).toBeGreaterThanOrEqual(Math.max(brand.y+brand.height,month.y+month.height));
  }
  const inputSizes=await page.evaluate(()=>[...document.querySelectorAll('.wrap.active :is(input:not([type=checkbox]):not([type=radio]),select,textarea)')].filter(e=>e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden').map(e=>parseFloat(getComputedStyle(e).fontSize)));
  for(const size of inputSizes)expect(size).toBeGreaterThanOrEqual(16);
 }
 await navigate(page,'dion');
 await page.locator('#tab-dion .mt-extra').last().locator('summary').click();
 await expect(page.locator('#tab-dion .mt-extra').last()).toHaveAttribute('open','');
 const nav=page.locator('#bottomNav');
 for(const button of await nav.locator('button:visible').all()){
  const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 }
 const row=await nav.locator('button:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
 expect(Math.max(...row)-Math.min(...row)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 await page.screenshot({path:info.outputPath(`rekening-${width}.png`),fullPage:true});
});

for(const width of [320,390,430])test(`grote bedragen en lange namen blijven bereikbaar ${width}`,async({page},info)=>{
 await start(page,width);
 await page.evaluate(()=>{
  state.spaardoelen.gezamenlijk[0].naam='Verbouwing en verduurzaming van onze gezamenlijke woning';
  state.spaardoelen.gezamenlijk[0].algespaard=12345678.90;
  state.spaardoelen.gezamenlijk[0].doelbedrag=12345678.90;
 });
 await navigate(page,'spaardoelen');
 const total=page.locator('.mt-savings-hero>strong');
 await expect(total).toHaveText(/€\s12\.\d{3}\.\d{3},\d{2}/);
 await expect(page.locator('.mt-goal-copy').first()).toContainText('12.345.678,90');
 expect(await total.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 const name=page.locator('.mt-goal-copy>strong').first();
 await expect(name).toContainText('gezamenlijke woning');
 expect(await name.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath(`doelen-${width}.png`),fullPage:true});
});

test('doelbewerker: invoer, toetsenbordfocus, annuleren en liggend scrollen',async({page})=>{
 await start(page,390);await navigate(page,'spaardoelen');const before=await page.evaluate(()=>JSON.stringify(state));
 await page.locator('[data-open-goal-editor]:visible').first().click();
 const dialog=page.getByRole('dialog',{name:'Spaardoel bewerken'});
 for(const input of await dialog.locator('input:not([type=checkbox]):visible,select:visible').all())expect(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
 for(let i=0;i<25;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
 await page.setViewportSize({width:844,height:390});
 await dialog.getByRole('button',{name:'Opslaan',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Opslaan',exact:true})).toBeInViewport();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
});

test('reduced motion behoudt foutnadruk en laat een toast alleen vervagen',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page,390);await navigate(page,'spaardoelen');
 await page.locator('[data-open-goal-editor]:visible').first().click();await page.getByRole('dialog').getByRole('button',{name:'Opslaan',exact:true}).click();
 const toast=page.locator('.quick-toast.show');await expect(toast).toBeVisible();
 expect(await toast.evaluate(e=>getComputedStyle(e).transitionProperty)).toBe('opacity');
 expect(await page.locator('.progress-fill').first().evaluate(e=>getComputedStyle(e).transitionProperty)).toBe('none');
});

test('hybride tablet krijgt leesbare invoer zonder iPhone-identiteit',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:820,height:900},serviceWorkers:'block'});
 const page=await context.newPage();await start(page,820);await navigate(page,'spaardoelen');await page.locator('[data-open-goal-editor]:visible').first().click();
 expect(await page.locator('#goalEditName').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);await context.close();
});
