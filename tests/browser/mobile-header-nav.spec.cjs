const {test,expect}=require('@playwright/test');
const {boot,navigate}=require('./helpers/v118-ux-fixture.cjs');

for(const width of [195,320,390,430])test(`header en enkele navigatierij blijven bruikbaar op ${width}px`,async({page},info)=>{
 await boot(page,width,false,test.info().project.use.baseURL+'/');
 await page.evaluate(()=>{
  CloudAdapter.statusText=()=> 'Offline — wijzigingen lokaal bewaard; synchronisatie volgt zodra de verbinding terug is';
  state.meta.selectedMonth='2026-09';
 });
 await navigate(page,'dion');
 const header=page.locator('#tab-dion .mobile-header-top');
 await expect(header.locator('.mobile-status-pill')).toContainText('synchronisatie volgt');
 const boxes=await header.evaluate(h=>Object.fromEntries(['mobile-tab-title','mobile-month-slot','mobile-status-pill'].map(cls=>[cls,h.querySelector('.'+cls).getBoundingClientRect().toJSON()])));
 const brand=boxes['mobile-tab-title'],month=boxes['mobile-month-slot'],status=boxes['mobile-status-pill'];
 expect(month.x).toBeGreaterThanOrEqual(brand.right);
 await expect(header.getByRole('heading',{name:'Dion',exact:true})).toHaveCount(1);
 await expect(page.locator('#tab-dion .mobile-dashboard-header')).toHaveCount(0);
 expect(await header.locator('.mobile-tab-title').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 expect(await header.locator('.mobile-tab-title').evaluate(e=>e.clientHeight-parseFloat(getComputedStyle(e).lineHeight))).toBeLessThanOrEqual(1);
 expect(Math.abs((brand.top+brand.bottom)/2-(month.top+month.bottom)/2)).toBeLessThanOrEqual(1);
 expect(status.top).toBeGreaterThanOrEqual(Math.max(brand.bottom,month.bottom));
 expect(await header.locator('.mobile-status-pill').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 expect(await header.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 const navigation=page.locator('#bottomNav');
 const metrics=await navigation.locator('button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),label=e.querySelector('span:last-child');return {top:r.top,left:r.left,right:r.right,width:r.width,height:r.height,overflow:label.scrollWidth-label.clientWidth};}));
 expect(metrics).toHaveLength(6);
 for(let i=0;i<metrics.length;i++){
  expect(metrics[i].width).toBeGreaterThanOrEqual(44);expect(metrics[i].height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(metrics[i].top-metrics[0].top)).toBeLessThanOrEqual(1);
  expect(metrics[i].overflow).toBeLessThanOrEqual(1);
  if(i)expect(metrics[i].left).toBeGreaterThanOrEqual(metrics[i-1].right);
 }
 await page.screenshot({path:info.outputPath(`header-nav-${width}.png`)});
 const before=await page.evaluate(()=>JSON.stringify(state));
 for(const button of await navigation.locator('button:visible').all()){
  const tab=await button.getAttribute('data-tab');await button.click();
  await expect(page.locator('#tab-'+tab)).toBeVisible();
 }
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 // Focus must reveal a button outside the horizontal viewport as well.
 const first=navigation.locator('button:visible').first();await first.focus();await expect(first).toBeInViewport();
 const last=navigation.locator('button:visible').last();await last.focus();await expect(last).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

for(const width of [320,390])test(`compacte header en maandpil op ${width}px`,async({page},info)=>{
 await boot(page,width,false,test.info().project.use.baseURL+'/');await navigate(page,'gezamenlijk');
 const header=page.locator('#tab-gezamenlijk .mobile-header-top');
 const sizes=await header.evaluate(h=>{
  const title=h.querySelector('.mobile-tab-title').getBoundingClientRect(),pill=h.querySelector('.month-picker-btn').getBoundingClientRect();
  return {height:h.getBoundingClientRect().height,pillHeight:pill.height,titleCenter:title.top+title.height/2,pillCenter:pill.top+pill.height/2};
 });
 expect(sizes.height).toBeLessThanOrEqual(60);expect(sizes.pillHeight).toBe(30);
 expect(Math.abs(sizes.titleCenter-sizes.pillCenter)).toBeLessThanOrEqual(1);
 await header.screenshot({path:info.outputPath(`compact-header-${width}.png`)});
});
