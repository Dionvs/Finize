const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold}=require('../helpers/v117-p4-browser.cjs');
const {state,row,materialize}=require('../helpers/package5-fixture.cjs');
const {savingsSourceProof,assertSavingsSourceProof}=require('../helpers/v117-source-proof.cjs');
const fs=require('node:fs');
const active=['2026-10','2026-09','2026-08','2026-07'];
async function scope(page){
  return page.evaluate(()=>{
    const p=state.__finizePeriodContext,needed=new Set([...p.settings.dependencies,...p.periods.flatMap(r=>r.dependencies)].map(r=>r.id));
    return {verifiedPeriods:state.verifiedPeriods,transactions:state.transactions.length,recordCount:p.records.length,records:p.records.map(r=>({id:r.id,collection:r.collection,periods:r.periods})),onlyRequired:p.records.every(r=>needed.has(r.id)),totals:Object.fromEntries(Object.entries(p.summaries).map(([m,v])=>[m,v.totalsCents])),revision:p.revision,epoch:p.epoch,metrics:{...p4.transport.metrics}};
  });
}
test('P4 release: equal active worksets stay equal with 20 and 100 total sources; pins do not expand queries',async({browser})=>{
  test.setTimeout(180000);const results=[];
  for(const count of [20,100]){
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
    try{
      const page=await context.newPage(),f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
      const current=[],history=[];
      for(let i=0;i<count;i++){const r=row('window-'+i,'uitgave',-12.34),month=i<10?'2026-10':'2024-01';r.bankOriginal.bankDate=month+'-03';r.processing.processingDate=month+'-03';(i<10?current:history).push(r);}
      materialize(s,current,'window-current');materialize(s,history,'window-history');
      const initialAt=performance.now();await boot(page,f,s);await attach(page,f,{initialize:true});const initializationMs=performance.now()-initialAt;
      const before=await page.evaluate(()=>({...p4.transport.metrics})),normalAt=performance.now();
      await page.evaluate(()=>p4.openMonth('2026-10'));
      const normalMs=performance.now()-normalAt,start=await scope(page);
      start.normalMetrics=Object.fromEntries(Object.entries(start.metrics).map(([key,value])=>[key,value-(before[key]||0)]));
      expect(start.verifiedPeriods).toEqual(active);expect(start.transactions).toBe(20);expect(start.onlyRequired).toBe(true);
      expect((await page.evaluate(()=>p4.openMonth('2024-01'))).outcome).toBe('committed');
      const historical=await scope(page);expect(historical.verifiedPeriods).toEqual(['2024-01']);expect(historical.onlyRequired).toBe(true);expect(historical.transactions).toBe((count-10)*2);
      await page.evaluate(()=>DataAdapter.store().cache.pin('2024-01',true));
      expect((await page.evaluate(()=>p4.openMonth('2026-10'))).outcome).toBe('committed');
      const returned=await scope(page);expect(returned.verifiedPeriods).toEqual(active);expect(returned.transactions).toBe(start.transactions);
      expect(await page.evaluate(()=>DataAdapter.store().cache.pinnedPeriods())).toContain('2024-01');
      const eviction=await page.evaluate(()=>DataAdapter.store().cache.evict({selectedMonth:'2026-10',targetBytes:0}));
      expect(eviction.removed).not.toContain('2024-01');
      if(count===20){
        await page.evaluate(()=>p4.openMonth('2024-01'));
        await page.evaluate(()=>commitChange(()=>state.meta.calendarCacheRevisionProof=true,{render:false}));
        expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
        expect((await scope(page)).verifiedPeriods).toEqual(['2024-01']);
        expect(await page.evaluate(async active=>{
          const base=(await p4.readLocal()).cloudBase;
          return (await Promise.all(active.map(m=>DataAdapter.store().cache.read(m,{epoch:base.epoch,revision:base.revision})))).every(Boolean);
        },active)).toBe(true);
        await page.route(require('../helpers/isolated-emulator.cjs').browserPattern,r=>r.abort());
        expect((await page.evaluate(()=>p4.openMonth('2026-10'))).outcome).toBe('committed');
        expect(await page.evaluate(()=>FinizeTransactions.total('budgetImpact',{month:'2026-10'}))).toBeCloseTo(123.40,2);
        await page.unroute(require('../helpers/isolated-emulator.cjs').browserPattern);
      }
      results.push({count,initializationMs,normalMs,start,historical,returned});
    }finally{await context.close();}
  }
  expect(results[0].start.recordCount).toBe(results[1].start.recordCount);
  expect(results[0].start.normalMetrics.reads).toBe(results[1].start.normalMetrics.reads);
  expect(results[0].start.totals).toEqual(results[1].start.totals);
  fs.writeFileSync('backups/v117-stabilisatie/p44-period-window-small.json',JSON.stringify(results,null,2));
});

test('P4 release: existing 500 and 5400 histories use bounded verified windows on final build',async({browser})=>{
  test.setTimeout(420000);const results=[];
  for(const months of [3,36]){
    const prior=JSON.parse(fs.readFileSync('backups/v117-stabilisatie/p44-scale-'+months+'.json','utf8'));
    expect(prior.financiallyVerified).toBe(true);
    const f={householdId:prior.householdId,email:prior.householdId+'@example.invalid'},context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
    try{
      const page=await context.newPage(),startMs=performance.now();await boot(page,f);await attach(page,f);
      const start=await scope(page),startupMs=performance.now()-startMs;
      expect(start.verifiedPeriods).toEqual(active);expect(start.onlyRequired).toBe(true);
      expect(start.transactions).toBeLessThan(months===36?2000:1200);
      const ids=prior.sourceProof.sources.map(r=>r.id),originals=prior.sourceProof.sources.map(r=>({id:r.id,bankOriginal:r.bankOriginal}));
      const before=await savingsSourceProof(page,ids);assertSavingsSourceProof(before,months===36?33:11,originals);expect(before).toEqual(prior.sourceProof);
      const historic=months===36?'2024-02':'2026-08',loadedAt=performance.now();
      expect((await page.evaluate(m=>p4.openMonth(m),historic)).outcome).toBe('committed');
      const historical=await scope(page),historyMs=performance.now()-loadedAt;
      expect(historical.onlyRequired).toBe(true);expect(historical.verifiedPeriods).toEqual(months===36?[historic]:active);
      const expected=await page.evaluate(async m=>(await p4.loadPeriod(m)).financials.totalsCents,historic);
      expect(historical.totals[historic]).toEqual(expected);expect(historical.revision).toBe(start.revision);
      expect((await page.evaluate(()=>p4.openMonth('2026-10'))).outcome).toBe('committed');
      const returned=await scope(page);expect(returned.totals).toEqual(start.totals);expect(returned.revision).toBe(start.revision);
      expect(await savingsSourceProof(page,ids)).toEqual(before);
      await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);
      expect(await savingsSourceProof(page,ids)).toEqual(before);
      expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
      results.push({months,householdId:f.householdId,startupMs,historyMs,start,historical,returned,verifiedSourceCount:before.sources.length});
    }finally{await context.close();}
  }
  fs.writeFileSync('backups/v117-stabilisatie/p44-final-period-window.json',JSON.stringify(results,null,2));
});

