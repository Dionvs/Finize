const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Installatie bewaart één HTML-shell en weigert een ongeldige shell',async()=>{
 const source=fs.readFileSync('service-worker.js','utf8');
 const release=source.match(/finize-v(118-r\d+)/)[1];
 for(const valid of [true,false]){
  const handlers={},deleted=[],added=[];
  const cache={addAll:async assets=>added.push(...assets),match:async()=>new Response(valid?`<meta name="finize-inline-release" content="${release}">`:'oude release'),add:async()=>{throw new Error('optionele afbeelding ontbreekt');}};
  vm.runInNewContext(source,{self:{addEventListener:(key,fn)=>handlers[key]=fn,skipWaiting:()=>{}},caches:{open:async()=>cache,delete:async name=>deleted.push(name)}});
  let completion;handlers.install({waitUntil:promise=>completion=promise});
  if(valid){await completion;assert.equal(deleted.length,0);}else{await assert.rejects(completion,/andere assetversie/);assert.equal(deleted.length,1);}
  assert.equal(added.filter(asset=>asset==='./index.html').length,1);assert.equal(added.includes('./'),false);
 }
});
test('Late oude cache mag offline HTML of assets nooit terugzetten naar een oude release',async()=>{
 const source=fs.readFileSync('service-worker.js','utf8'),name=source.match(/const CACHE_NAME = "([^"]+)"/)[1],handlers={},reads=[];
 const caches={match:async(request,options)=>{reads.push(options);return new Response(options?.cacheName===name?'actueel':'verouderd');}};
 vm.runInNewContext(source,{self:{addEventListener:(key,fn)=>handlers[key]=fn,skipWaiting:()=>{},clients:{claim:()=>{}}},caches,fetch:async()=>{throw new Error('offline');}});
 for(const mode of ['navigate','cors']){let response;handlers.fetch({request:{method:'GET',mode,url:'https://example.test/Finize/'},respondWith:promise=>response=promise,waitUntil:()=>{}});assert.equal(await (await response).text(),'actueel');}
 assert.equal(reads.length,2);assert.ok(reads.every(options=>options.cacheName===name));
});
test('Navigatie wacht niet op het opslaan van de offline HTML',async()=>{
 const handlers={},source=fs.readFileSync('service-worker.js','utf8');
 const release=source.match(/finize-v(118-r\d+)/)[1];
 const html='<meta name="finize-inline-release" content="'+release+'">';
 const caches={open:async()=>({put:()=>new Promise(()=>{})})};
 vm.runInNewContext(source,{self:{addEventListener:(key,fn)=>handlers[key]=fn},caches,fetch:async()=>new Response(html)});
 let response,background;
 handlers.fetch({request:{method:'GET',mode:'navigate'},respondWith:promise=>response=promise,waitUntil:promise=>background=promise});
 assert.ok(background);
 const result=await Promise.race([response.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),100))]);
 assert.equal(result,true,'De HTML-respons mag niet op Cache Storage wachten.');
});
test('Cache-activatie wacht op verwijderen oude caches en op overnemen paginas',async()=>{
 const handlers={},steps=[];let deleted,claimed;
 const caches={keys:async()=>['finize-old','other-app'],delete:async name=>{assert.equal(name,'finize-old');await new Promise(resolve=>deleted=resolve);steps.push('deleted');}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self:{addEventListener:(key,fn)=>handlers[key]=fn,skipWaiting:()=>{},clients:{claim:async()=>{steps.push('claim');await new Promise(resolve=>claimed=resolve);steps.push('claimed');}}},caches});
 let completion,done=false;handlers.activate({waitUntil:promise=>completion=promise});completion.then(()=>done=true);await new Promise(setImmediate);assert.deepEqual(steps,[]);deleted();await new Promise(setImmediate);assert.deepEqual(steps,['deleted','claim']);assert.equal(done,false);claimed();await completion;assert.equal(done,true);
});
