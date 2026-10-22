const {test}=require('node:test'),assert=require('node:assert/strict');
const e=require('../src/core/transaction-engine.mjs');
const tx=(id,amount,type,extra={})=>({id,source:'manual',accountContext:'gezamenlijk',financialFor:'gezamenlijk',date:'2026-10-11',amount,kind:type,transactionType:type,category:'Overig',...extra});
const state=transactions=>({transactions,accountProfiles:[],savingsGoalLedger:[],spaardoelen:{dion:[],dara:[],gezamenlijk:[{id:'garden',algespaard:0}]},manualTransactionReplacements:[],internalTransferPairs:[],advanceLedger:[],advanceRepayments:[],planning:{verdeling:{minimumDion:.4}},monthlySavingOverrides:{},recurringFixedExpenses:[]});
const forecast=s=>e.financialForecastForMonth(s,'2026-10',{plannedIncome:{dion:{salary:2000},dara:{salary:2000}},fixedOccurrences:[]});
test('V117 variable budget details exclude fixed Overig without losing its realization',()=>{
 const gym=tx('gym',62.83,'vaste-last',{description:'Sportschool',fixedExpenseId:'gym',fixedOccurrenceId:'gym:2026-10-05',fixedOccurrenceMonth:'2026-10'}),variable=tx('variable',20,'uitgave'),s=state([gym,variable]),before=structuredClone(s);
 assert.deepEqual(e.categoryProcessingDetails(s,'2026-10','gezamenlijk',{budgetOnly:true}).map(t=>t.id),['variable']);
 assert.equal(e.budgetActual(s,'2026-10','gezamenlijk','Overig'),20);
 assert.equal(e.fixedOccurrenceActuals(s,{id:gym.fixedOccurrenceId,month:'2026-10',amount:62.83}).actual,62.83);
 assert.equal(e.categoryProcessingDetails(s,'2026-10','gezamenlijk').length,2);assert.deepEqual(s,before);
});
for(const type of ['sparen','naar-spaarrekening'])test('V117 existing capital '+type+' retains cash and goal, without reducing month availability',()=>{
 const deposit=tx('deposit',6100,type,{savingsGoalId:'garden',processing:{savingsContributionId:'transfer',savingsContributionAmount:6100}}),incoming=tx('transfer',6100,'interne-overboeking',{accountDelta:6100,processing:{contributionGoalId:'garden',contributionAmount:6100}}),s=state([incoming,deposit]),baseline=forecast(state([incoming])),before=structuredClone(s),actual=forecast(s),p=e.projectTransaction(deposit,{state:s});
 assert.equal(actual.owners.gezamenlijk.available,baseline.owners.gezamenlijk.available);assert.equal(actual.household.available,baseline.household.available);
 assert.equal(p.effects.savingsDeposit,6100);assert.equal(p.effects.goalDelta,6100);assert.equal(p.effects.existingCapitalDeposit,6100);assert.equal(p.effects.accountCashflow,-6100);assert.equal(p.effects.incomeImpact,0);
 const regular=structuredClone(s);delete regular.transactions[1].processing.savingsContributionId;assert.equal(forecast(regular).owners.gezamenlijk.available,actual.owners.gezamenlijk.available-6100);assert.deepEqual(s,before);
 const reloaded=JSON.parse(JSON.stringify(s));assert.deepEqual(forecast(reloaded),actual);
});
test('V117 capital flag cannot exclude normal expenses or create an extra withdrawal',()=>{
 for(const type of ['uitgave','van-spaarrekening','interne-overboeking']){const t=tx(type,100,type,{processing:{savingsFundingSource:'existing-capital'}});assert.equal(e.projectTransaction(t,{state:state([t])}).effects.existingCapitalDeposit||0,0);}
});
test('V117 duplicate funding claims fail closed and partial contribution leaves monthly savings intact',()=>{
 const source=tx('source',6100,'extra-bijdrage',{accountDelta:6100,processing:{contributionGoalId:'garden',contributionAmount:6100}});
 const deposit=tx('deposit',7000,'sparen',{savingsGoalId:'garden',processing:{savingsContributionId:'source',savingsContributionAmount:6100}}),s=state([source,deposit]);
 const base=forecast(state([source]));assert.equal(forecast(s).household.available,base.household.available-900);
 s.transactions.push({...structuredClone(deposit),id:'duplicate'});
 const rows=e.selectTransactionProjections(s).filter(p=>p.effects.savingsDeposit);assert(rows.every(p=>p.savingsContributionError));assert(rows.every(p=>!p.effects.existingCapitalDeposit));
});
test('V117 changed goal, month, owner, source approval or missing source never masks savings burden',()=>{
 const source=tx('source',6100,'interne-overboeking',{accountDelta:6100,processing:{contributionGoalId:'garden',contributionAmount:6100}}),deposit=tx('deposit',6100,'sparen',{savingsGoalId:'garden',processing:{savingsContributionId:'source',savingsContributionAmount:6100}});
 for(const change of [s=>s.transactions.shift(),s=>s.transactions[0].processing.contributionGoalId='other',s=>s.transactions[0].date='2026-09-01',s=>s.transactions[0].financialFor='dara',s=>s.transactions[0].processing.include=false]){const s=state(structuredClone([source,deposit]));change(s);const p=e.projectTransaction(s.transactions.at(-1),{state:s});assert(p.savingsContributionError);assert(!p.effects.existingCapitalDeposit);}
});
test('V117 removing an allocated contribution is blocked until its deposit is unlinked',()=>{
 const commands=require('../src/core/transaction-processing.mjs');
 const s=state([tx('source',6100,'interne-overboeking',{accountDelta:6100,processing:{contributionGoalId:'garden',contributionAmount:6100}}),tx('deposit',6100,'sparen',{savingsGoalId:'garden',processing:{savingsContributionId:'source',savingsContributionAmount:6100}})]);
 const next=structuredClone(s);next.transactions.shift();assert.throws(()=>commands.assertFinancialMutationSafe(s,next),/koppeling/);
 delete next.transactions[0].processing.savingsContributionId;assert.doesNotThrow(()=>commands.assertFinancialMutationSafe(s,next));
});


for(const type of ['belastingteruggave','vergoeding','vakantiegeld','nabetaling','overige-inkomsten'])test('inkomen '+type+' koppelen aan sparen is uitsluitend administratief',()=>{
 const source=tx('income',225,type),deposit=tx('saving',300,'sparen',{savingsGoalId:'garden',processing:{}});
 const s=state([source,deposit]),before=forecast(s),effects=e.selectTransactionProjections(s).map(p=>p.effects);
 deposit.processing={savingsContributionId:'income',savingsContributionAmount:225};
 const original=structuredClone(s),linked=e.projectTransaction(deposit,{state:s});
 assert.equal(linked.savingsContributionError,undefined);assert.deepEqual(linked.savingsContribution,{sourceId:'income',amountCents:22500,kind:'income'});
 assert.equal(linked.effects.existingCapitalDeposit||0,0);
 assert.deepEqual(e.selectTransactionProjections(s).map(p=>p.effects),effects);
 assert.deepEqual(forecast(s),before);assert.deepEqual(s,original);
 assert.deepEqual(forecast(JSON.parse(JSON.stringify(s))),before);
});

test('inkomenskoppeling bewaakt ontvangen bedrag, goedkeuring, maand en eigenaar',()=>{
 const source=tx('income',225,'belastingteruggave'),deposit=tx('saving',300,'sparen',{savingsGoalId:'garden',processing:{savingsContributionId:'income',savingsContributionAmount:225}});
 for(const change of [s=>s.transactions.shift(),s=>s.transactions[0].processing={include:false},s=>s.transactions[0].financialFor='dara',s=>s.transactions[0].date='2026-09-01',s=>s.transactions[1].processing.savingsContributionAmount=226]){
  const s=state(structuredClone([source,deposit]));change(s);const p=e.projectTransaction(s.transactions.at(-1),{state:s});assert(p.savingsContributionError);assert(!p.savingsContribution);assert(!p.effects.existingCapitalDeposit);
 }
 const s=state([source,deposit,{...structuredClone(deposit),id:'saving-again'}]);
 assert(e.selectTransactionProjections(s).filter(p=>p.effects.savingsDeposit>0).every(p=>p.savingsContributionError&&!p.savingsContribution));
});
