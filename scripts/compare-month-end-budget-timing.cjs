// Reproduce the same synthetic input against the exact r19 source and current
// calculation. Only Git objects/local files are read; no cloud or bank access.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {timingFixture,options,oracle}=require('../tests/helpers/budget-timing.cjs');
const root=path.resolve(__dirname,'..'),baseline='7fc20db19cd0ed9638bbd3c669946d973cc84bb8';
const baselineRoot=path.join(root,'.cache','budgettiming-r19-source');
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:16000000});
const files=git(['ls-tree','-r','--name-only',baseline,'src']).toString().trim().split('\n');
for(const file of files){const target=path.join(baselineRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,git(['show',baseline+':'+file]));}
const versions=[['r19',require(path.join(baselineRoot,'src/core/daily-liquidity.mjs'))],['r22',require('../src/core/daily-liquidity.mjs')]];
const input=timingFixture(),unchanged=JSON.stringify(input),results={},rows=[];
for(const [version,module] of versions){
 const p=module.selectMonthEndSavings(input,options(input));
 const q=module.projectDailyLiquidity(module.buildLiquidityInput(input,{...options(input),endDate:p.assessmentEndDate}));
 results[version]={transferDate:p.transferDate,assessmentEndDate:p.assessmentEndDate,expectedEndBalanceCents:p.expectedEndBalanceCents,requiredOpeningCents:p.requiredOpeningCents,safeCents:p.safeCents,bufferCents:p.bufferCents};
 let cumulative=0,previous=input.balanceCheckpoints[0].amountCents,previousReserved=0;
 for(const d of q.days){
  const protection=p.protectionDays.find(r=>r.date===d.date);
  const events=q.events.filter(e=>d.eventIds.includes(e.id));cumulative+=d.estimatedBudgetCents;
  rows.push({version,date:d.date,openingBalanceCents:previous,concreteIncomeCents:events.filter(e=>e.amountCents>0).reduce((n,e)=>n+e.amountCents,0),concreteExpenseCents:0-events.filter(e=>e.amountCents<0).reduce((n,e)=>n+e.amountCents,0),dailyBudgetEstimateCents:d.estimatedBudgetCents,cumulativeBudgetEstimatesCents:cumulative,budgetProtectionDebitCents:protection.budgetReservedCents-previousReserved,cumulativeBudgetProtectionCents:protection.budgetReservedCents,cashBalanceCents:d.cashBalanceCents,dailyGraphBalanceCents:d.expectedBalanceCents,projectedProtectedBalanceCents:protection.protectedBalanceCents,protectedBufferCents:p.bufferCents,dailySavingsRoomCents:Math.max(0,protection.protectedBalanceCents-p.bufferCents),maximumSafeTransferCents:d.date>=p.transferDate?p.safeCents:null,balanceAfterSafeTransferCents:d.date>=p.transferDate?protection.protectedBalanceCents-p.safeCents:null});
  previous=protection.protectedBalanceCents;previousReserved=protection.budgetReservedCents;
 }
 assert.equal(JSON.stringify(input),unchanged);
}
assert.equal(results.r19.safeCents,565000);assert.equal(results.r22.safeCents,665160);
for(const d of oracle()){
 const r=rows.find(r=>r.version==='r22'&&r.date===d.date);assert.equal(r.projectedProtectedBalanceCents,d.balanceCents,d.date);assert.equal(r.openingBalanceCents,d.openingBalanceCents,d.date);
 assert.equal(r.dailyBudgetEstimateCents,d.budgetCents,d.date);assert.equal(r.concreteIncomeCents,d.incomeCents,d.date);assert.equal(r.concreteExpenseCents,d.expenseCents,d.date);
 if(r.balanceAfterSafeTransferCents!==null)assert(r.balanceAfterSafeTransferCents>=20000,d.date);
 const old=rows.find(r=>r.version==='r19'&&r.date===d.date);assert.equal(old.dailyGraphBalanceCents,r.dailyGraphBalanceCents,d.date+' graph unchanged');
}
for(const date of ['2026-11-01','2026-12-01'])assert.equal(rows.find(r=>r.version==='r19'&&r.date===date).budgetProtectionDebitCents,115000);
const result={baselineCommit:baseline,currentSourceSha256:createHash('sha256').update(fs.readFileSync(path.join(root,'src/core/daily-liquidity.mjs'))).digest('hex'),syntheticOnly:true,financialCorrectionName:'r20 budget timing, delivered after r21 as r22',productionWrites:0,bankApiCalls:0,fullNextMonthThrough:'2026-11-30',partialGuardThrough:'2026-12-05',restOfDecemberCoverageEstablished:false,results,rows};
const prefix=path.join(root,'docs/audit/finize-budgettiming-r19-r22-20261027');
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n');
const columns=Object.keys(rows[0]);fs.writeFileSync(prefix+'.csv',columns.join(',')+'\n'+rows.map(r=>columns.map(k=>r[k]??'').join(',')).join('\n')+'\n');
console.log(JSON.stringify({results,rows:rows.length,allOracleDaysMatch:true,restOfDecemberCoverageEstablished:false,productionWrites:0,bankApiCalls:0},null,2));
