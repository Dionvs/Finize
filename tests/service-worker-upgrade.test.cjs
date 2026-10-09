const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Late oude cache mag offline HTML of assets nooit terugzetten naar een oude release',async()=>{
 const source=fs.readFileSync('service-worker.js','utf8'),name=source.match(/const CACHE_NAME = "([^"]+)"/)[1],handlers={},reads=[];
 const caches={match:async(request,options)=>{reads.push(options);return new Response(options?.cacheName===name?'actueel':'verouderd');}};
 vm.runInNewContext(source,{self:{addEventListener:(key,fn)=>handlers[key]=fn,skipWaiting:()=>{},clients:{claim:()=>{}}},caches,fetch:async()=>{throw new Error('offline');}});
 for(const mode of ['navigate','cors']){let response;handlers.fetch({request:{method:'GET',mode,url:'https://example.test/Finize/'},respondWith:promise=>response=promise});assert.equal(await (await response).text(),'actueel');}
 assert.equal(reads.length,2);assert.ok(reads.every(options=>options.cacheName===name));
});
test('Cache-activatie wacht op verwijderen oude caches en op overnemen paginas',async()=>{
 const handlers={},steps=[];let deleted,claimed;
 const caches={keys:async()=>['finize-old','other-app'],delete:async name=>{assert.equal(name,'finize-old');await new Promise(resolve=>deleted=resolve);steps.push('deleted');}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self:{addEventListener:(key,fn)=>handlers[key]=fn,skipWaiting:()=>{},clients:{claim:async()=>{steps.push('claim');await new Promise(resolve=>claimed=resolve);steps.push('claimed');}}},caches});
 let completion,done=false;handlers.activate({waitUntil:promise=>completion=promise});completion.then(()=>done=true);await new Promise(setImmediate);assert.deepEqual(steps,[]);deleted();await new Promise(setImmediate);assert.deepEqual(steps,['deleted','claim']);assert.equal(done,false);claimed();await completion;assert.equal(done,true);
});
