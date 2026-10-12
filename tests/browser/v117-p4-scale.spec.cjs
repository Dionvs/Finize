const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold,importTen}=require('../helpers/v117-p4-browser.cjs');
const {administration}=require('../helpers/v117-p4-fixture.cjs');
const {token}=require('../helpers/v117-p3-emulator.cjs');
const {periodFinancials,cumulativeFinancials}=require('../../src/storage/period-projections.mjs');
const {row,materialize}=require('../helpers/package5-fixture.cjs');
const fs=require('node:fs');
const {savingsSourceProof,assertSavingsSourceProof}=require('../helpers/v117-source-proof.cjs');
const {installPerformanceMeter}=require('../helpers/indexeddb-performance-meter.cjs');
const evidencePrefix=process.env.FINIZE_EVIDENCE_PREFIX||'p4';
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {runs:values.length,median:(sorted[Math.floor((values.length-1)/2)]+sorted[Math.floor(values.length/2)])/2,maximum:Math.max(...values)};};
const metrics=page=>page.evaluate(()=>({...p4.transport.metrics}));
const difference=(after,before)=>Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-(before[key]||0)]));
const quotaBytes=384*1024*1024;
async function boundedOrigin(page){
  const session=await page.context().newCDPSession(page);
  await session.send('Storage.overrideQuotaForOrigin',{origin:'http://127.0.0.1:4173',quotaSize:quotaBytes});
  const proof=await session.send('Storage.getUsageAndQuota',{origin:'http://127.0.0.1:4173'});
  expect(proof.quota).toBe(quotaBytes);return proof;
}
for(const {months,bankMovements,rounds} of [{months:3,bankMovements:500,rounds:1},{months:36,bankMovements:5400,rounds:3}])test(`P4 real browser and rules: ${bankMovements} bank movements / ${months} months, ${rounds} measurements`,async({page,browser},testInfo)=>{
  test.setTimeout(1800000);
  await installPerformanceMeter(page);
  const f=await newHousehold(),fixture=administration(months,bankMovements,{rich:months===36});console.log('P4_SCALE_PREP '+JSON.stringify({months,bankMovements,bytes:JSON.stringify(fixture).length}));
  const sources=fixture.state.transactions.filter(row=>row.recordRole==='bank-source');
  expect(sources).toHaveLength(bankMovements);expect(new Set(sources.map(row=>row.id)).size).toBe(bankMovements);expect(new Set(sources.map(row=>row.bankOriginal.bankDate.slice(0,7))).size).toBe(months);
  const quotaProof=await boundedOrigin(page);await boot(page,f);
  const setupStart=performance.now();
  await page.evaluate(async({householdId,token,fixture})=>{
    window.p4=await FinizeCloudRecords.createEmulatorSession({householdId,token});
    await p4.cloudStore.initializeNew({state:fixture.state,imports:fixture.imports,epoch:'scale',approveTestCutover:true});await p4.attach({automatic:false});
  },{householdId:f.householdId,token:token(f.email),fixture});
  const setupMs=performance.now()-setupStart;console.log('P4_SCALE_READY '+JSON.stringify({months,setupMs}));
  const canonical=structuredClone(fixture.state),baseline=cumulativeFinancials(canonical);
  expect(await page.evaluate(()=>JSON.parse(state.__finizePeriodContext.global.payload))).toEqual(baseline);
  const initialUsage=await page.evaluate(()=>DataAdapter.store().cache.usage());
  const timings={coldStartup:[],warmStartup:[],monthLoad:[],csvImport:[],singleApproval:[],bulkTen:[],sync:[],bulkCloudConfirmation:[]},traffic=[],storageTimeline=[{stage:'initial',usage:initialUsage}];
  // Full-history integrity reads below are explicit acceptance checks, outside metrics.
  const audit=()=>{window.p4WholeReads=0;window.p4StorageErrors=[];const getAll=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args){if(this.name==='financialRecords')window.p4WholeReads++;return getAll.apply(this,args);};const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);tx.addEventListener('abort',()=>window.p4StorageErrors.push({database:this.name,stores:Array.from(tx.objectStoreNames),name:tx.error?.name,message:tx.error?.message}));return tx;};};
  await page.addInitScript(audit);await page.evaluate(audit);
  try{for(let i=0;i<rounds;i++){
    const round={};
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
    try{const cold=await context.newPage();await boundedOrigin(cold);const start=performance.now();await boot(cold,f);await attach(cold,f);timings.coldStartup.push(performance.now()-start);round.coldStartup=await metrics(cold);}finally{await context.close();}
    const warm=performance.now();await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);timings.warmStartup.push(performance.now()-warm);
    round.warmStartup=await metrics(page);
    const month=months===1?'2026-10':new Date(Date.UTC(2026,9-1-Math.floor(i*(months-2)/Math.max(1,rounds-1)),1)).toISOString().slice(0,7);
    let before=await metrics(page);const start=performance.now();
    expect((await page.evaluate(month=>p4.openMonth(month),month)).outcome).toBe('committed');timings.monthLoad.push(performance.now()-start);
    round.monthLoad={...difference(await metrics(page),before),month,loadedTransactions:await page.evaluate(()=>state.transactions.length)};
    const expected=periodFinancials(canonical,month);
    expect(await page.evaluate(month=>state.__finizePeriodContext.summaries[month].totalsCents,month)).toEqual(expected.totalsCents);
    await page.evaluate(()=>p4.openMonth('2026-10'));
    before=await metrics(page);
    const single=await importTen(page,{goalId:'goal',prefix:'P4 single '+i,amounts:[1]});timings.csvImport.push(single.importMs);timings.singleApproval.push(single.approvalMs);
    round.singleApproval=difference(await metrics(page),before);before=await metrics(page);
    const syncOne=performance.now();expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');timings.sync.push(performance.now()-syncOne);
    round.singleSync=difference(await metrics(page),before);before=await metrics(page);
    await page.evaluate(()=>idbPerformanceMeter.start('bulk-ten'));
    const bulk=await importTen(page,{goalId:'goal',prefix:'P4 bulk '+i,completionTimeoutMs:120000});timings.csvImport.push(bulk.importMs);timings.bulkTen.push(bulk.approvalMs);
    round.bulkPreparation=await page.evaluate(()=>{idbPerformanceMeter.stop();return idbPerformanceMeter.report('bulk-ten');});
    await expect(page.locator('[data-u4-group-result]')).toContainText('10 van 10 transacties goedgekeurd');
    round.bulkPerformanceGoalMs=20000;round.bulkPerformanceGoalMet=bulk.performanceGoalMet;round.bulkLocalDurableMs=bulk.localDurableMs;round.bulkUiResultMs=bulk.uiResultMs;round.bulkCommits=bulk.commits;round.sourceIds=[...single.sourceIds,...bulk.sourceIds];round.originals=[...single.originals,...bulk.originals];
    const bulkSyncStart=performance.now();expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
    round.bulkCloudConfirmationMs=performance.now()-bulkSyncStart;timings.bulkCloudConfirmation.push(round.bulkCloudConfirmationMs);
    round.bulkApprovalAndSync=difference(await metrics(page),before);traffic.push(round);
    materialize(canonical,[1,50,100,75,25,200,40,60,90,30,80].map((n,k)=>row(`benchmark-${i}-${k}`,'naar-spaarrekening',-n,{savingsGoalId:'goal'})),`benchmark-${i}`);
    expect(await page.evaluate(()=>window.p4WholeReads)).toBe(0);
    const loaded=await page.evaluate(()=>state.transactions.length);
    if(months<=4)expect(loaded).toBeLessThanOrEqual(fixture.state.transactions.length+220);
    else expect(loaded).toBeLessThan(fixture.state.transactions.length+220);
    storageTimeline.push({stage:'round-'+(i+1),usage:await page.evaluate(()=>DataAdapter.store().cache.usage())});
    fs.writeFileSync(`backups/v117-stabilisatie/${evidencePrefix}-scale-progress-${months}.json`,JSON.stringify({months,completed:i+1,setupMs,timings,traffic,storageTimeline},null,2));
    console.log('P4_SCALE_ITERATION '+JSON.stringify({months,iteration:i+1}));
  }}catch(error){
    const diagnostic=await page.evaluate(()=>{const measured=idbPerformanceMeter.report('bulk-ten');idbPerformanceMeter.stop();return {storageErrors:window.p4StorageErrors,head:DataAdapter.store().head,visibleSources:state.transactions.filter(row=>row.recordRole==='bank-source').length,approvalClock:window.p4ApprovalClock,performance:measured};}).catch(problem=>({diagnosticError:String(problem)}));
    // Diagnostic drain only: the original deadline remains a failed acceptance
    // criterion. Never turn a slow, later completion into a passing benchmark.
    if(bankMovements===500&&diagnostic.performance&&diagnostic.approvalClock?.commits.length<10){
      try{
        await page.waitForFunction(()=>window.p4ApprovalClock?.commits.length===10&&document.querySelector('[data-u4-group-result]')?.textContent.includes('10 van 10'),null,{timeout:30000});
        const local=await page.evaluate(async()=>{
          const durable=await DataAdapter.readDurableState(),sources=durable.transactions.filter(r=>r.recordRole==='bank-source'&&p4ApprovalClock.sourceIds.includes(r.id));
          return {sources,effects:durable.transactions.filter(r=>r.recordRole!=='bank-source'&&sources.some(s=>s.bankSourceId===r.bankSourceId)),clock:p4ApprovalClock,savings:FinizeTransactions.total('savingsDeposit',{month:'2026-10'})};
        });
        diagnostic.lateCompletion={financiallyVerified:false,localDurableMs:local.clock.commits.at(-1).ms,local,performanceGateStillFailed:true};
        expect(local.sources).toHaveLength(10);expect(local.effects).toHaveLength(10);
        expect(new Set(local.sources.map(r=>r.id)).size).toBe(10);expect(new Set(local.effects.map(r=>r.bankSourceId)).size).toBe(10);
        expect(local.sources.map(r=>r.bankOriginal.amount).sort((a,b)=>a-b)).toEqual([-50,-100,-75,-25,-200,-40,-60,-90,-30,-80].sort((a,b)=>a-b));
        for(const r of local.sources){expect(r.processingStatus).toBe('goedgekeurd');expect(r.approvedProcessing.savingsGoalId).toBe('goal');}
        const syncStarted=performance.now();expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');
        const cloudMs=performance.now()-syncStarted,cloud=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());
        expect(JSON.parse(cloud.global.payload).bankSourceCount).toBe(511);expect(JSON.parse(cloud.global.payload).totalsCents.savingsDeposit).toBe(baseline.totalsCents.savingsDeposit+75100);
        expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');expect((await page.evaluate(()=>p4.cloudStore.verifyIntegrity())).global).toEqual(cloud.global);
        await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);
        expect(await page.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(local.savings);
        const secondContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
        try{
          const second=await secondContext.newPage();await boundedOrigin(second);await boot(second,f);await attach(second,f);
          expect(await second.evaluate(()=>FinizeTransactions.total('savingsDeposit',{month:'2026-10'}))).toBe(local.savings);
          expect(await second.evaluate(ids=>state.transactions.filter(r=>r.recordRole==='bank-source'&&ids.includes(r.id)),local.clock.sourceIds)).toEqual(local.sources);
        }finally{await secondContext.close();}
        diagnostic.lateCompletion={financiallyVerified:true,localDurableMs:local.clock.commits.at(-1).ms,cloudMs,local,cloudGlobal:cloud.global,performanceGateStillFailed:true};
      }catch(problem){diagnostic.lateCompletion={...diagnostic.lateCompletion,financiallyVerified:false,error:String(problem)};}
    }
    diagnostic.usage=await page.evaluate(()=>DataAdapter.store().cache.usage()).catch(problem=>({error:String(problem)}));
    fs.writeFileSync(`backups/v117-stabilisatie/${evidencePrefix}-scale-failure-${months}.json`,JSON.stringify({error:String(error),stack:error.stack,completed:traffic.length,timings,traffic,storageTimeline,diagnostic},null,2));throw error;
  }
  const full=await page.evaluate(()=>p4.cloudStore.verifyIntegrity());expect(full.global.payload).toBeTruthy();
  expect(JSON.parse(full.global.payload).bankSourceCount).toBe(fixture.bankMovements+rounds*11);
  expect(JSON.parse(full.global.payload).totalsCents.savingsDeposit).toBe(baseline.totalsCents.savingsDeposit+rounds*75100);
  expect(JSON.parse(full.global.payload).totalsCents).toEqual(cumulativeFinancials(canonical).totalsCents);
  const approvedSourceIds=traffic.flatMap(round=>round.sourceIds);
  const proof=await savingsSourceProof(page,approvedSourceIds);assertSavingsSourceProof(proof,rounds*11,traffic.flatMap(round=>round.originals));
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);await attach(page,f);await page.evaluate(()=>p4.sync());
  const reloadedProof=await savingsSourceProof(page,approvedSourceIds);assertSavingsSourceProof(reloadedProof,rounds*11,traffic.flatMap(round=>round.originals));expect(reloadedProof).toEqual(proof);
  const secondContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{
    const second=await secondContext.newPage();await boundedOrigin(second);await boot(second,f);await attach(second,f);
    const secondProof=await savingsSourceProof(second,approvedSourceIds);assertSavingsSourceProof(secondProof,rounds*11,traffic.flatMap(round=>round.originals));expect(secondProof).toEqual(proof);
    expect((await second.evaluate(()=>p4.cloudStore.verifyIntegrity())).global).toEqual(full.global);
  }finally{await secondContext.close();}
  for(const document of full.periods){const actual=JSON.parse(document.payload),expected=periodFinancials(canonical,document.month);delete actual.application;delete expected.application;expect(actual).toEqual(expected);}
  await page.evaluate(()=>DataAdapter.store().cache.evict({selectedMonth:'2026-10',targetBytes:0}));
  const oldest=full.periods.map(row=>row.month).sort()[0];await page.evaluate(month=>p4.openMonth(month),oldest);
  expect(await page.evaluate(month=>state.__finizePeriodContext.summaries[month].totalsCents,oldest)).toEqual(periodFinancials(canonical,oldest).totalsCents);
  const finalUsage=await page.evaluate(()=>DataAdapter.store().cache.usage()),measurements={householdId:f.householdId,sourceProof:proof,financiallyVerified:true,performanceGoalMs:20000,performanceGoalMet:traffic.every(round=>round.bulkPerformanceGoalMet),months,bankMovements:fixture.bankMovements,quotaBytes,quotaProof,setupMs,initialUsage,finalUsage,storageTimeline,timings:Object.fromEntries(Object.entries(timings).map(([key,values])=>[key,summarize(values)])),rawTimings:timings,traffic};
  const output=`backups/v117-stabilisatie/${evidencePrefix}-scale-${months}.json`;fs.writeFileSync(output,JSON.stringify(measurements,null,2));await testInfo.attach('performance-and-storage',{path:output,contentType:'application/json'});console.log('P4_SCALE_RESULT '+JSON.stringify({months,financiallyVerified:true,performanceGoalMet:measurements.performanceGoalMet,timings:measurements.timings,totalBytes:finalUsage.totalBytes}));
  // Release priority: financial assertions above remain mandatory. Twenty
  // seconds is a reported aspiration, never a substitute for completion proof.
  testInfo.annotations.push({type:'performance-goal',description:
    JSON.stringify({targetMs:20000,met:measurements.performanceGoalMet,releaseBlocking:false})});
});
