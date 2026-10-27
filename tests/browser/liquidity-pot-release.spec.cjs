const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const visual=require('../fixtures/v50-visual-state.json'),{fixture}=require('../helpers/month-end-savings.cjs');
test.use({serviceWorkers:'allow'});
test('r22 to r23 upgrade, offline and rollback retain financial state and IndexedDB evidence',async({page,context})=>{
 test.setTimeout(90000);let previous=true;const old=path.resolve('.cache/r23-previous-shell');
 test.skip(!fs.existsSync(path.join(old,'index.html')),'Requires pinned r22 shell in .cache/r23-previous-shell for the release exercise.');
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name.includes('..')){res.writeHead(400);res.end();return;}
  const file=path.resolve(previous?old:process.cwd(),name);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 try{
  await page.route('https://**',r=>r.abort());await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.addInitScript(seed=>{if(!localStorage.getItem('finize-budget-planner-v1'))localStorage.setItem('finize-budget-planner-v1',JSON.stringify(seed));},{...visual,...fixture()});
  await page.goto(url);await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);
  const before=await page.evaluate(async()=>{await FinizeUpdate4Runtime.ImportStore.putImport({id:'r19-evidence',version:1,operationId:'synthetic',rows:[{id:'source',bankOriginal:{amount:-10,bankDate:'2026-10-03',description:'Synthetic evidence'}}]});return JSON.stringify(state);});
  expect(await page.evaluate(()=>caches.keys())).toContain('finize-v118-r22');previous=false;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain('finize-v118-r23');
  for(const offline of [false,true]){await context.setOffline(offline);await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);await expect(page.locator('script[src*="118-r23"]')).toHaveCount(1);expect(await page.evaluate(async()=>(await FinizeUpdate4Runtime.ImportStore.getImport('r19-evidence')).rows[0].bankOriginal.amount)).toBe(-10);}
  await context.setOffline(false);previous=true;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain('finize-v118-r22');await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);await expect(page.locator('script[src*="118-r22"]')).toHaveCount(1);expect(await page.evaluate(async()=>(await FinizeUpdate4Runtime.ImportStore.getImport('r19-evidence')).rows[0].id)).toBe('source');
 }finally{await context.setOffline(false);await context.close();await new Promise(r=>server.close(r));}
});
