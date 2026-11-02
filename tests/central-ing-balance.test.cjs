const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,options}=require('./helpers/month-end-savings.cjs');
const {row,materialize}=require('./helpers/package5-fixture.cjs');
const {normalizeProviderBalances}=require('../src/import/enable-banking-adapter.mjs');
const {selectDailyLiquidity,selectMonthEndSavings}=require('../src/core/daily-liquidity.mjs');
const {selectCurrentAccountBalance}=require('../src/core/current-account-balance.mjs');
function setup(){
 const s=fixture({asOf:'2026-11-01',balance:479470});s.recurringFixedExpenses=[];s.planning.spaarpotDezeMaand=0;s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:0}],dara:[{effectiveFrom:'0000-01',salary:0}]};
 const opts={...options(s),endDate:'2026-11-30'};s.bankBalanceObservations=normalizeProviderBalances({householdId:'legacy',accountProfileId:'joint',account:{identificationHash:'test'},fetchedAt:'2026-11-01T20:16:44Z',balances:[{balance_type:'XPCD',balance_amount:{amount:'2364.89',currency:'EUR'},last_change_date_time:'2026-11-01T20:16:43Z'}]},opts.scope);return {s,opts};
}
test('one external cash basis feeds current balance, chart, minimum, buffer and savings without replaying bank rows',()=>{
 const {s,opts}=setup();const r=row('already-included','uitgave',-115.40,{processingDate:'2026-10-31'});Object.assign(r.bankOriginal,{bankDate:'2026-11-01',currency:'EUR'});materialize(s,[r]);
 const p=selectDailyLiquidity(s,opts),saving=selectMonthEndSavings(s,{...opts,month:'2026-11'});assert.equal(p.opening.balanceCents,236489);assert.equal(p.opening.providerType,'XPCD');assert.equal(p.days.at(-1).cashBalanceCents,236489);assert.equal(p.minimumBalanceCents,236489);assert.equal(p.events.filter(e=>e.type==='bank').length,0);assert.ok(p.bufferWarning);assert.equal(saving.expectedEndBalanceCents,236489);assert.equal(saving.safeCents??saving.indicativeCents,216489);
 const chart=selectDailyLiquidity(s,{...opts,startDate:'2026-11-01',currentCashBasis:true});assert.equal(chart.currentBalance.balanceCents,236489);assert.equal(chart.days.at(-1).cashBalanceCents,236489);
});
test('linked payment replaces the whole fixed plan and a second payment does not mutate external cash',()=>{
 const {s,opts}=setup();s.recurringFixedExpenses=[{id:'bill',naam:'Synthetic',bedrag:150,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-11-01',einddatum:'2026-11-30',afschrijfdag:5,frequentieAantal:1,frequentieEenheid:'maanden',actief:true}];
 const before=selectDailyLiquidity(s,opts),occurrence=before.events.find(e=>e.type==='fixed').occurrenceId;assert.equal(before.days.at(-1).cashBalanceCents,221489);
 for(const [id,amount]of [['first',120],['second',20]]){const r=row(id,'vaste-last',-amount,{processingDate:'2026-10-31',fixedExpenseId:'bill',fixedOccurrenceId:occurrence,fixedOccurrenceMonth:'2026-11'});Object.assign(r.bankOriginal,{bankDate:'2026-11-01',currency:'EUR'});materialize(s,[r],id);const after=selectDailyLiquidity(s,opts);assert.equal(after.opening.balanceCents,236489);assert.equal(after.days.at(-1).cashBalanceCents,236489);assert.equal(after.events.find(e=>e.type==='fixed').status,'replaced');}
});
test('a future-dated imported row is administrative and is not replayed against the latest external cash',()=>{
 const {s,opts}=setup();const r=row('later-booking','uitgave',-40,{processingDate:'2026-10-31'});Object.assign(r.bankOriginal,{bankDate:'2026-11-02',currency:'EUR'});materialize(s,[r]);assert.equal(selectDailyLiquidity(s,opts).days.at(-1).cashBalanceCents,236489);
});
test('missing external observation keeps manual reconstruction; accounts and historical ranges remain separate',()=>{
 const {s,opts}=setup();s.bankBalanceObservations=[];assert.equal(selectDailyLiquidity(s,opts).opening.balanceCents,479470);const {s:external,opts:e}=setup();assert.equal(selectCurrentAccountBalance(external,{...e,toDate:'2026-10-31'}).source,'reconstruction');assert.equal(selectDailyLiquidity(external,{...e,startDate:'2026-10-01',endDate:'2026-10-31'}).currentBalance.source,'reconstruction');
});

test('a review suggestion does not hide the forecast or remove the conservative fixed reservation',()=>{
 const {s,opts}=setup();s.recurringFixedExpenses=[{id:'bill',naam:'Synthetic',bedrag:150,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-11-01',einddatum:'2026-11-30',afschrijfdag:5,frequentieAantal:1,frequentieEenheid:'maanden',actief:true}];const occurrence=selectDailyLiquidity(s,opts).events.find(e=>e.type==='fixed').occurrenceId;
 const r=row('suggestion','vaste-last',-120,{processingDate:'2026-11-01',fixedExpenseId:'bill',fixedOccurrenceId:occurrence,fixedOccurrenceMonth:'2026-11'});Object.assign(r.bankOriginal,{bankDate:'2026-11-01',currency:'EUR'});materialize(s,[r]);s.transactions.forEach(tx=>{tx.processingStatus='nakijken';tx.approvalSource='';tx.certainty='nakijken';});
 const p=selectDailyLiquidity(s,opts);assert.equal(p.events.find(e=>e.type==='fixed').status,'planned');assert.equal(p.days.at(-1).cashBalanceCents,221489);assert(!p.reasons.some(r=>r.code==='possible-planning-overlap'));assert.equal(selectMonthEndSavings(s,{...opts,month:'2026-11'}).expectedEndBalanceCents,221489);
});
