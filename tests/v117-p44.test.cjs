const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPayloadPreparation,advancePayloadPreparation,encodePayloadRow,decodePayloadRow}=require('../src/storage/payload-parts.mjs');
const {selectTransactionProjections}=require('../src/core/transaction-engine.mjs');
const {state,row,materialize}=require('./helpers/package5-fixture.cjs');
const {cumulativeFinancials}=require('../src/storage/period-projections.mjs');
const {sumTransactionEffects}=require('../src/core/transaction-engine.mjs');
const {administration}=require('./helpers/v117-p4-fixture.cjs');

test('P4.4 group artifacts require the exact committed operation, revision, epoch and scope',async()=>{
  const binding={scope:'household-a',sha256:'old',storageRevision:7,migration:'{"epoch":"one"}'};
  const previous=createPayloadPreparation(binding);
  const value={id:'journal',candidate:{transactions:Array.from({length:20},(_,i)=>({id:'source-'+i,bankOriginal:{amount:-10,date:'2026-10-01'}}))}};
  encodePayloadRow(value,previous.digests,previous);
  const head={operationId:'op-7',storageRevision:8,sha256:'new',migration:{epoch:'one'}};
  const advanced=advancePayloadPreparation(previous,head,'op-7');assert.ok(advanced);
  const next=createPayloadPreparation(advanced.binding,advanced);assert.ok(next.records.size>0);
  assert.equal(next.strings.size,0);assert.equal(next.digests.size,0);
  const changed=structuredClone(value);changed.candidate.transactions[0].bankOriginal.amount=-25;
  const reused=encodePayloadRow(changed,next.digests,next),full=encodePayloadRow(changed);
  assert.deepEqual(reused.stored,full.stored);assert.deepEqual(await decodePayloadRow(reused.stored,id=>reused.parts.get(id)),changed);
  for(const mismatch of [{scope:'household-b'},{sha256:'different'},{storageRevision:9},{migration:'{"epoch":"two"}'}])assert.equal(createPayloadPreparation({...advanced.binding,...mismatch},advanced).records.size,0);
  for(const mismatch of [{operationId:'other'},{storageRevision:9},{migration:{epoch:'two'}}])assert.equal(advancePayloadPreparation(previous,{...head,...mismatch},'op-7'),null);
  previous.invalid=true;assert.equal(advancePayloadPreparation(previous,head,'op-7'),null);
  assert.equal(createPayloadPreparation(advanced.binding,previous).records.size,0);
});

test('P4.4 cumulative preparation evaluates the canonical engine once and preserves every cent dimension',()=>{
  for(const count of [20,100]){
    const s=administration(count===20?1:3,count,{rich:count===100}).state;
    const counts={};globalThis.__finizePerformance=(name,ms,detail)=>{if(detail)counts[name]=(counts[name]||0)+detail.count;};
    let result;try{result=cumulativeFinancials(s);}finally{delete globalThis.__finizePerformance;}
    assert.equal(counts['financial.projectionCalls'],1);
    for(const [dimension,value]of Object.entries(result.totalsCents))assert.equal(value,Math.round(sumTransactionEffects(s,dimension)*100),dimension);
    assert.equal(result.approvedEffectCount,selectTransactionProjections(s).length);
    const before=result.totalsCents.budgetImpact;
    materialize(s,[row('new-expense','uitgave',-12.34)],'new');
    assert.equal(cumulativeFinancials(s).totalsCents.budgetImpact,before+1234);
  }
});

test('P4.4 each engine invocation resolves planning once per month/owner and never keeps stale financial choices',()=>{
  const s=state();s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'ov',post:'OV',bedrag:100},{id:'other',post:'Overig',bedrag:200}]}];
  materialize(s,Array.from({length:20},(_,i)=>row('source-'+i,'uitgave',-10,{category:'OV',budgetItemId:'ov'})),'batch');
  const counts={};globalThis.__finizePerformance=(name,ms,detail)=>{if(detail)counts[name]=(counts[name]||0)+detail.count;};
  let first;try{first=selectTransactionProjections(s);}finally{delete globalThis.__finizePerformance;}
  assert.equal(counts['financial.projectionCalls'],1);assert.equal(counts['financial.budgetPlanningReads'],1);
  assert.equal(first.length,20);assert.equal(first.reduce((n,p)=>n+p.effects.budgetImpact,0),200);
  assert.ok(first.every(p=>p.budgetItemId==='ov'&&p.category==='OV'));
  s.budgetDefaultsHistory.gezamenlijk[0].rows[0].post='Openbaar vervoer';
  const second=selectTransactionProjections(s);assert.ok(second.every(p=>p.category==='Openbaar vervoer'));
  assert.ok(first.every(p=>p.category==='OV'));
});
