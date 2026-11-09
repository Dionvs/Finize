const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.use({serviceWorkers:'allow'});
test('Offline herladen kiest actuele release ook wanneer oude cache eerder staat',async({page,context})=>{
 await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());await page.setViewportSize({width:360,height:900});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&r.active===navigator.serviceWorker.controller;});
 const before=await page.evaluate(async()=>{
  if(!await commitChange(()=>{state.meta.cacheUpgradeCheck='behouden';},{render:false}))throw new Error('Testgegevens opslaan is mislukt.');
  const name=(await caches.keys()).find(key=>key.startsWith('finize-v')),cache=await caches.open(name),keys=await cache.keys(),entries=await Promise.all(keys.map(async key=>[key,await cache.match(key)]));
  const stale=await caches.open('finize-obsolete-late');await stale.put('./index.html',new Response('<html><body>Verouderde Finize-pagina</body></html>',{headers:{'content-type':'text/html'}}));
  // Simulate an old cache preceding the current cache, without changing application data.
  await caches.delete(name);const current=await caches.open(name);for(const [key,value] of entries)await current.put(key,value.clone());
  const sizes=await Promise.all(entries.map(async([key,value])=>({url:new URL(key.url).pathname+new URL(key.url).search,bytes:(await value.clone().arrayBuffer()).byteLength})));
  return {state:JSON.stringify(state),script:document.querySelector('meta[name="finize-inline-release"]').getAttribute('content'),sizes};
 });
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.locator('meta[name="finize-inline-release"]').getAttribute('content')).toBe(before.script);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);await expect(page.locator('#tab-dashboard')).not.toBeEmpty();
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);
 if(process.env.FINIZE_P3_EVIDENCE)fs.writeFileSync(process.env.FINIZE_P3_EVIDENCE,JSON.stringify(before.sizes,null,2));
});
