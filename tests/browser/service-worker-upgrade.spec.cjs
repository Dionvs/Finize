const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'allow'});
test('Offline herladen kiest actuele release ook wanneer oude cache eerder staat',async({page,context})=>{
 await page.route('https://www.gstatic.com/**',r=>r.abort());await page.route('https://firestore.googleapis.com/**',r=>r.abort());await page.setViewportSize({width:360,height:900});
 await page.goto('/');await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&r.active===navigator.serviceWorker.controller;});
 const before=await page.evaluate(async()=>{
  if(!commitChange(()=>{state.meta.cacheUpgradeCheck='behouden';},{render:false}))throw new Error('Testgegevens opslaan is mislukt.');
  const name=(await caches.keys()).find(key=>key.startsWith('finize-v')),cache=await caches.open(name),keys=await cache.keys(),entries=await Promise.all(keys.map(async key=>[key,await cache.match(key)]));
  const stale=await caches.open('finize-obsolete-late');await stale.put('./index.html',new Response('<html><body>Verouderde Finize-pagina</body></html>',{headers:{'content-type':'text/html'}}));
  // Simulate an old cache preceding the current cache, without changing application data.
  await caches.delete(name);const current=await caches.open(name);for(const [key,value] of entries)await current.put(key,value);
  return {state:JSON.stringify(state),script:document.querySelector('script[src*="app.js"]').getAttribute('src')};
 });
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
 expect(await page.locator('script[src*="app.js"]').getAttribute('src')).toBe(before.script);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before.state);await expect(page.locator('#tab-dashboard')).not.toBeEmpty();
});
