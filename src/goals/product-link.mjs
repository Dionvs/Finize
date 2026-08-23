const PRODUCT_METADATA_ENDPOINT = 'https://api.microlink.io/';
const PRODUCT_PRICE_RULES = {
  price: [
    {selector:'meta[property="product:price:amount"]',attr:'content',type:'string'},
    {selector:'meta[property="og:price:amount"]',attr:'content',type:'string'},
    {selector:'meta[itemprop="price"]',attr:'content',type:'string'},
    {selector:'[itemprop="price"]',attr:'content',type:'string'},
    {selector:'.price ins .woocommerce-Price-amount',attr:'text',type:'string'},
    {selector:'.price .woocommerce-Price-amount',attr:'text',type:'string'},
    {selector:'[data-testid="price"]',attr:'text',type:'string'},
    {selector:'[class*="product-price"]',attr:'text',type:'string'}
  ]
};

function isPrivateHostname(hostname){
  const host=String(hostname||'').toLowerCase().replace(/^\[|\]$/g,'');
  if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='::1')return true;
  if(/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host))return true;
  const match=host.match(/^172\.(\d{1,3})\./);
  return Boolean(match&&Number(match[1])>=16&&Number(match[1])<=31);
}

export function normalizeProductUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  let parsed;
  try{parsed=new URL(raw);}catch{return '';}
  if(!['http:','https:'].includes(parsed.protocol)||isPrivateHostname(parsed.hostname))return '';
  parsed.hash='';
  return parsed.toString();
}

function parseLocalizedNumber(value){
  const compact=String(value||'').replace(/[\s\u00a0'’]/g,'').replace(/[^0-9.,-]/g,'');
  if(!/\d/.test(compact))return null;
  const lastComma=compact.lastIndexOf(',');
  const lastDot=compact.lastIndexOf('.');
  const decimalIndex=Math.max(lastComma,lastDot);
  let normalized=compact;
  if(lastComma>=0&&lastDot>=0){
    const decimal=decimalIndex===lastComma?',':'.';
    const thousands=decimal===','?'.':',';
    normalized=compact.split(thousands).join('').replace(decimal,'.');
  }else if(decimalIndex>=0){
    const separator=compact[decimalIndex];
    const decimals=compact.length-decimalIndex-1;
    const occurrences=compact.split(separator).length-1;
    normalized=decimals>=1&&decimals<=2
      ? compact.slice(0,decimalIndex).split(separator).join('')+'.'+compact.slice(decimalIndex+1)
      : compact.split(separator).join('');
    if(occurrences>1&&decimals===3)normalized=compact.split(separator).join('');
  }
  const number=Number(normalized);
  return Number.isFinite(number)?Math.round((number+Number.EPSILON)*100)/100:null;
}

export function parseProductPrice(value){
  if(Number.isFinite(Number(value))&&String(value).trim()!=='')return {amount:Math.round(Number(value)*100)/100,currency:'',raw:String(value)};
  const raw=typeof value==='object'&&value!==null
    ? String(value.amount??value.value??value.price??'')
    : String(value||'');
  const candidates=raw.match(/\d[\d\s\u00a0.,'’]*/g)||[];
  const amount=[...candidates].reverse().map(parseLocalizedNumber).find(number=>number!==null&&number>=0);
  if(amount===undefined)return null;
  const upper=raw.toUpperCase();
  const currency=/€|\bEUR\b/.test(upper)?'EUR':/£|\bGBP\b/.test(upper)?'GBP':/\$|\bUSD\b/.test(upper)?'USD':'';
  return {amount,currency,raw:raw.trim()};
}

export function buildProductMetadataRequest(value){
  const url=normalizeProductUrl(value);
  if(!url)throw new Error('Ongeldige openbare productlink.');
  const request=new URL(PRODUCT_METADATA_ENDPOINT);
  request.searchParams.set('url',url);
  request.searchParams.set('data',JSON.stringify(PRODUCT_PRICE_RULES));
  request.searchParams.set('filter','title,image,url,price');
  return request.toString();
}

function safeRemoteImage(value){
  const raw=typeof value==='object'&&value!==null?value.url:value;
  return normalizeProductUrl(raw);
}

export function normalizeProductSnapshot(value){
  if(!value||typeof value!=='object')return null;
  const price=Number(value.price);
  const url=normalizeProductUrl(value.url);
  if(!url)return null;
  return {
    url,
    resolvedUrl:normalizeProductUrl(value.resolvedUrl)||url,
    title:String(value.title||'').trim().slice(0,300),
    price:Number.isFinite(price)&&price>=0?Math.round(price*100)/100:null,
    currency:['EUR','GBP','USD'].includes(value.currency)?value.currency:'',
    priceText:String(value.priceText||'').trim().slice(0,100),
    image:safeRemoteImage(value.image),
    source:'microlink',
    fetchedAt:String(value.fetchedAt||'')
  };
}

export function shouldFetchProductSnapshot(child,value){
  const url=normalizeProductUrl(value);
  if(!url)return false;
  return normalizeProductSnapshot(child?.productInfo)?.url!==url;
}

export function applyProductSnapshot(child,value){
  const snapshot=normalizeProductSnapshot(value);
  if(!child||!snapshot)return child;
  const previous=normalizeProductSnapshot(child.productInfo);
  const currentName=String(child.naam||'').trim();
  const generatedName=!currentName||/^nieuw subdoel$/i.test(currentName)||/^subdoel\s+\d+$/i.test(currentName)||currentName===previous?.title;
  if(snapshot.title&&generatedName)child.naam=snapshot.title;
  if(snapshot.price!==null&&(!snapshot.currency||snapshot.currency==='EUR'))child.doelbedrag=snapshot.price;
  child.productInfo=snapshot;
  return child;
}

export async function fetchProductSnapshot(value,{fetchImpl=globalThis.fetch,timeoutMs=12000,now=()=>new Date().toISOString()}={}){
  if(typeof fetchImpl!=='function')throw new Error('Productinformatie ophalen wordt niet ondersteund.');
  const url=normalizeProductUrl(value);
  const request=buildProductMetadataRequest(url);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(request,{headers:{accept:'application/json'},signal:controller.signal});
    if(!response?.ok)throw new Error(response?.status===429?'Daglimiet voor productinformatie bereikt.':'Productinformatie is tijdelijk niet beschikbaar.');
    const payload=await response.json();
    if(payload?.status!=='success'||!payload?.data)throw new Error('Productinformatie kon niet worden gelezen.');
    const price=parseProductPrice(payload.data.price);
    const snapshot=normalizeProductSnapshot({
      url,
      resolvedUrl:payload.data.url||url,
      title:payload.data.title||'',
      price:price?.amount,
      currency:price?.currency||'',
      priceText:price?.raw||'',
      image:payload.data.image,
      fetchedAt:now()
    });
    if(!snapshot?.title&&snapshot?.price===null)throw new Error('Deze winkel geeft geen herkenbare productinformatie door.');
    return snapshot;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Productinformatie ophalen duurde te lang.');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}
