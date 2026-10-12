// Test infrastructure only. Application bytes and offline failure routes stay unchanged.
const host=process.env.FINIZE_ISOLATED_EMULATOR_HOST;
if(host&&!/^127\.0\.0\.1:\d+$/.test(host))throw Error('Loopback emulator required');
const installed=new WeakSet();
async function isolateBrowser(page){
  if(!host||installed.has(page.context()))return;
  installed.add(page.context());
  // Send requests to the clean emulator before the service worker can handle
  // them. Page routing alone is bypassed by a controlling service worker.
  await page.context().addInitScript(host=>{
    window.__FINIZE_TEST_EMULATOR_HOST__=host;
    const original=window.fetch;
    window.fetch=function(input,options){
      if(typeof input==='string')input=input.replace('http://127.0.0.1:8181/','http://'+host+'/');
      return original.call(this,input,options);
    };
  },host);
}
module.exports={host,isolateBrowser,browserPattern:'http://'+(host||'127.0.0.1:8181')+'/**'};
