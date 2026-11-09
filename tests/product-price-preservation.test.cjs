const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeProductSnapshot,applyProductSnapshot,fetchProductSnapshot}=require('../src/goals/product-link.mjs');
const url='https://winkel.example/product';

for(const [label,price] of [['ontbrekend',undefined],['null',null],['leeg',''],['witruimte','  '],['ongeldig','geen prijs'],['NaN',NaN],['oneindig',Infinity],['negatief',-1],['false',false],['true',true],['array',[]],['object',{}]]){
 test(`B1 ${label}: behoud handmatig doelbedrag bij herhaald normaliseren`,()=>{
  const child={id:'child',naam:'Handmatige naam',doelbedrag:150,gespaard:25};
  const snapshot=normalizeProductSnapshot({url,title:'Product',price});
  assert.equal(snapshot.price,null);
  assert.deepEqual(normalizeProductSnapshot(snapshot),snapshot);
  applyProductSnapshot(child,snapshot);
  assert.equal(child.doelbedrag,150);assert.equal(child.gespaard,25);assert.equal(child.naam,'Handmatige naam');
  assert.equal(child.productInfo.price,null);
 });
}
for(const price of [0,'0',49.95,'49.95']){
 test(`B1 expliciete prijs ${JSON.stringify(price)} volgt bestaande automatische aanvulling`,()=>{
  const child={naam:'Nieuw subdoel',doelbedrag:150};
  applyProductSnapshot(child,{url,title:'Product',price,currency:'EUR'});
  assert.equal(child.doelbedrag,Number(price));assert.equal(child.naam,'Product');
  assert.equal(normalizeProductSnapshot(child.productInfo).price,Number(price));
 });
}
for(const [label,price,expected] of [['null',null,150],['leeg','',150],['ongeldig','geen prijs',150],['geldig','€ 49,95',49.95],['nul',0,0]]){
 test(`B1 ophalen, toepassen en JSON-opslag met ${label}`,async()=>{
  const child={naam:'Mijn doel',doelbedrag:150};
  const snapshot=await fetchProductSnapshot(url,{fetchImpl:async()=>({ok:true,json:async()=>({status:'success',data:{url,title:'Product',price}})})});
  applyProductSnapshot(child,snapshot);
  const reopened=JSON.parse(JSON.stringify(child));
  applyProductSnapshot(reopened,reopened.productInfo);
  assert.equal(reopened.doelbedrag,expected);
 });
}
test('B1 ontbrekende link en buitenlandse valuta veranderen geen handmatig eurobedrag',()=>{
 const child={naam:'Mijn doel',doelbedrag:150};
 applyProductSnapshot(child,{url:'',price:49});assert.equal(child.doelbedrag,150);
 applyProductSnapshot(child,{url,price:49,currency:'GBP'});assert.equal(child.doelbedrag,150);
});
