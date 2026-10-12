// Test-only native request observer. Event listeners leave application handlers intact.
async function installPerformanceMeter(page){
  await page.addInitScript(()=>{
    let phase='startup',nextTx=0;
    const reports=new Map(),txIds=new WeakMap();
    const report=()=>{if(!reports.has(phase))reports.set(phase,{spans:{},stores:{},transactions:0,transactionWallMs:0,aborted:0,partReads:0,partHashes:new Set(),partPerTx:new Set(),fetches:0,fetchWallMs:0,stringifySamples:{}});return reports.get(phase);};
    window.__finizePerformance=(name,ms,detail)=>{if(phase==='idle')return;const span=report().spans[name]??={calls:0,ms:0};span.calls++;span.ms+=ms;if(detail)span.count=(span.count||0)+detail.count;};
    for(const [object,key,label]of [[JSON,'stringify','all.stringify'],[JSON,'parse','all.parse'],[window,'structuredClone','all.clone']]){
      const original=object[key];object[key]=function(...args){if(phase==='idle')return original.apply(this,args);const start=performance.now();try{return original.apply(this,args);}finally{window.__finizePerformance(label,performance.now()-start);if(label==='all.stringify'&&report().spans[label].calls%1000===0){const stack=new Error().stack.split('\n').slice(2,6).join('\n');report().stringifySamples[stack]=(report().stringifySamples[stack]||0)+1;}}};
    }
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args){
      const tx=transaction.apply(this,args);txIds.set(tx,++nextTx);
      if(phase!=='idle'){const r=report(),start=performance.now();r.transactions++;tx.addEventListener('complete',()=>r.transactionWallMs+=performance.now()-start);tx.addEventListener('abort',()=>{r.aborted++;r.transactionWallMs+=performance.now()-start;});}return tx;
    };
    for(const prototype of [IDBObjectStore.prototype,IDBIndex.prototype])for(const method of ['get','getAll','getKey','getAllKeys','count','put','add','delete','openCursor']){
      if(!prototype[method])continue;const original=prototype[method];prototype[method]=function(...args){
        if(phase==='idle')return original.apply(this,args);
        const r=report(),name=this.objectStore?.name||this.name,stats=r.stores[name]??={requests:0,succeeded:0,errors:0,requestWallMs:0,methods:{}};
        stats.requests++;stats.methods[method]=(stats.methods[method]||0)+1;
        if(name==='payloadParts'&&method==='get'){r.partReads++;r.partHashes.add(args[0]);r.partPerTx.add(txIds.get(this.transaction||this.objectStore.transaction)+'|'+args[0]);}
        const start=performance.now(),request=original.apply(this,args);
        request.addEventListener('success',()=>{stats.succeeded++;stats.requestWallMs+=performance.now()-start;});request.addEventListener('error',()=>{stats.errors++;stats.requestWallMs+=performance.now()-start;});return request;
      };
    }
    const fetch=window.fetch;
    window.fetch=async function(...args){if(phase==='idle'||!String(args[0]).includes('127.0.0.1:8181'))return fetch.apply(this,args);const r=report(),start=performance.now();r.fetches++;try{return await fetch.apply(this,args);}finally{r.fetchWallMs+=performance.now()-start;}};
    window.idbPerformanceMeter={checkpoint(){if(phase==='idle')return null;const r=report();return {transactions:r.transactions,partReads:r.partReads,spans:Object.fromEntries(Object.entries(r.spans).filter(([name])=>/all.stringify|payload.sha256$|payload.encodeRoot|preparation.records|commit.records|commit.financialValidation|financial.projectionCalls|financial.cumulativeCalls/.test(name)).map(([name,value])=>[name,{...value}]))};},start(label){phase=label;},stop(){phase='idle';},report(label){const r=reports.get(label);return r?{...r,partHashes:undefined,partPerTx:undefined,uniqueParts:r.partHashes.size,duplicatePartReads:r.partReads-r.partHashes.size,duplicateWithinTransaction:r.partReads-r.partPerTx.size}:null;}};
  });
}
module.exports={installPerformanceMeter};
