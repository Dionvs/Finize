const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const product=await import(pathToFileURL(path.resolve(__dirname,'../src/goals/product-link.mjs')).href);

  assert.equal(product.normalizeProductUrl('javascript:alert(1)'),'');
  assert.equal(product.normalizeProductUrl('http://localhost/product'),'');
  assert.equal(product.normalizeProductUrl('https://shop.example/product#reviews'),'https://shop.example/product');

  assert.deepEqual(product.parseProductPrice('€ 1.299,95'),{amount:1299.95,currency:'EUR',raw:'€ 1.299,95'});
  assert.deepEqual(product.parseProductPrice('Van € 899,00 voor € 749,50'),{amount:749.5,currency:'EUR',raw:'Van € 899,00 voor € 749,50'});
  assert.deepEqual(product.parseProductPrice('£63.00'),{amount:63,currency:'GBP',raw:'£63.00'});
  assert.equal(product.parseProductPrice(null),null);

  const request=new URL(product.buildProductMetadataRequest('https://shop.example/product'));
  assert.equal(request.origin,'https://api.microlink.io');
  assert.equal(request.searchParams.get('url'),'https://shop.example/product');
  assert.ok(request.searchParams.get('data').includes('product:price:amount'));
  assert.ok(request.searchParams.get('data').includes('corePriceDisplay_desktop_feature_div'),'Amazon-prijsvelden ontbreken');

  let requests=0;
  const snapshot=await product.fetchProductSnapshot('https://shop.example/product',{
    now:()=> '2026-08-23T12:00:00.000Z',
    fetchImpl:async()=>{
      requests+=1;
      return {ok:true,json:async()=>({status:'success',data:{title:'Espressomachine',url:'https://shop.example/product',price:'€ 749,50',image:{url:'https://shop.example/product.jpg'}}})};
    }
  });
  assert.equal(requests,1);
  assert.equal(snapshot.title,'Espressomachine');
  assert.equal(snapshot.price,749.5);
  assert.equal(snapshot.currency,'EUR');
  assert.equal(snapshot.fetchedAt,'2026-08-23T12:00:00.000Z');

  const child={id:'child',naam:'Nieuw subdoel',doelbedrag:0,link:'https://shop.example/product'};
  product.applyProductSnapshot(child,snapshot);
  assert.equal(child.naam,'Espressomachine');
  assert.equal(child.doelbedrag,749.5);
  assert.equal(product.shouldFetchProductSnapshot(child,child.link),false,'dezelfde link gebruikt de opgeslagen prijsmomentopname');

  const manual={naam:'Zelf gekozen naam',doelbedrag:500,link:'https://shop.example/foreign'};
  product.applyProductSnapshot(manual,{...snapshot,url:manual.link,resolvedUrl:manual.link,title:'Foreign product',price:63,currency:'GBP'});
  assert.equal(manual.naam,'Zelf gekozen naam','een handmatige naam blijft behouden');
  assert.equal(manual.doelbedrag,500,'een vreemde valuta overschrijft geen eurodoel');

  await assert.rejects(
    product.fetchProductSnapshot('https://shop.example/missing',{fetchImpl:async()=>({ok:false,status:429})}),
    /Daglimiet/
  );

  console.log('SUBGOAL_PRODUCT_LINK_OK');
})().catch(error=>{console.error(error);process.exit(1);});
