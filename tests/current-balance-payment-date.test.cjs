const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectCurrentAccountBalance,attachCurrentBalance}=require('../src/core/current-account-balance.mjs');
const {normalizeProviderBalances,stageProviderSnapshot}=require('../src/import/enable-banking-adapter.mjs');
const {getTransactionDate}=require('../src/core/transaction-model.mjs');
const {selectTransactionProjections,fixedOccurrenceActuals}=require('../src/core/transaction-engine.mjs');
const {selectBankTransactions}=require('../src/core/bank-sources.mjs');
const {state,row,materialize}=require('./helpers/package5-fixture.cjs');
const u=require('../src/import/update4-runtime.cjs');
function setup(){const s=state();s.accountProfiles.push({id:'other',accountOwner:'dion'});const scope={householdId:'synthetic',accountProfiles:s.accountProfiles};const snapshot={householdId:'synthetic',accountProfileId:'joint',account:{identificationHash:'test'},fetchedAt:'2026-11-01T20:16:44Z',balances:[{balance_type:'XPCD',balance_amount:{amount:'2364.89',currency:'EUR'},last_change_date_time:'2026-11-01T20:16:43Z'}]};s.bankBalanceObservations=normalizeProviderBalances(snapshot,scope);return {s,scope,snapshot,options:{accountProfileId:'joint',scope,toDate:'2026-11-01'}};}
test('external balance is direct, account scoped, newest, immutable and independent of dates/transactions',()=>{
 const {s,scope,snapshot,options}=setup();const before=JSON.stringify(s);assert.equal(selectCurrentAccountBalance(s,options).balanceCents,236489);assert.equal(JSON.stringify(s),before);
 const tx=row('included','uitgave',-115.40);tx.bankOriginal.bankDate='2026-11-01';materialize(s,[tx]);assert.equal(selectCurrentAccountBalance(s,options).balanceCents,236489);
 const old=structuredClone(snapshot);old.fetchedAt='2026-10-31T20:00:00Z';old.balances[0].last_change_date_time='2026-10-31T19:00:00Z';old.balances[0].balance_amount.amount='1.00';s.bankBalanceObservations.push(...normalizeProviderBalances(old,scope));assert.equal(selectCurrentAccountBalance(s,options).balanceCents,236489);
 assert.equal(selectCurrentAccountBalance(s,{...options,accountProfileId:'other'}).source,'reconstruction');s.bankBalanceObservations=[];assert.equal(selectCurrentAccountBalance(s,options).source,'reconstruction');
});
test('retained unusable XPCD response can be read without rewriting production records',()=>{
 const {s,scope,snapshot,options}=setup();s.bankBalanceObservations=[];const batch={id:'old',householdId:scope.householdId,channel:'bank-api',accountProfileId:'joint',lifecycle:'active',providerSync:{fetchedAt:snapshot.fetchedAt},rows:[{providerInput:{accountProfileId:'joint',provenance:{accountHash:'test'}}}],balanceObservations:[{unusable:true,raw:snapshot.balances[0]}]};s.importSummaries=[{id:'old'}];const before=JSON.stringify(batch);assert.equal(selectCurrentAccountBalance(s,{...options,imports:[batch]}).balanceCents,236489);assert.equal(JSON.stringify(batch),before);
});
test('two corrected paid dates shift 55.50 between budgets without changing bank sources or external balance',()=>{
 const {s,options}=setup();const rs=[row('forty','uitgave',-40),row('fifteen','uitgave',-15.5)];rs.forEach(r=>{r.bankOriginal.bankDate='2026-11-01';r.processing.processingDate='2026-11-01';});materialize(s,rs);
 const total=m=>selectTransactionProjections(s,{month:m}).reduce((sum,p)=>sum+p.effects.budgetImpact,0);assert.equal(total('2026-11'),55.5);const config=JSON.stringify(s.budgetDefaultsHistory),originals=JSON.stringify(s.transactions.map(t=>t.bankOriginal));
 s.transactions.filter(t=>t.recordRole!=='bank-source').forEach(t=>t.processing.processingDate='2026-10-31');assert.equal(total('2026-10'),55.5);assert.equal(total('2026-11'),0);assert.equal(selectBankTransactions(s,{month:'2026-11'}).length,2);assert.equal(selectCurrentAccountBalance(s,options).balanceCents,236489);assert.equal(JSON.stringify(s.budgetDefaultsHistory),config);assert.equal(JSON.stringify(s.transactions.map(t=>t.bankOriginal)),originals);
});
test('new CSV/API processing materializes paid date and flags closed destination month without changing its snapshot',()=>{
 for(const source of ['csv','bank-api']){const s=state();s.monthRecords['2026-10']={status:'afgesloten',snapshot:{budget:99}};const r=row('date-'+source,'uitgave',-40);r.source=source;r.bankOriginal.bankDate='2026-11-01';r.processing.processingDate='2026-10-31';materialize(s,[r]);const tx=s.transactions.find(t=>t.recordRole!=='bank-source');assert.equal(tx.date,'2026-10-31');assert.equal(tx.bankOriginal.bankDate,'2026-11-01');assert.equal(s.monthRecords['2026-10'].status,'correctie-nodig');assert.deepEqual(s.monthRecords['2026-10'].snapshot,{budget:99});}
});
test('explicit fixed occurrence remains bound across paid-date changes and sums multiple payments',()=>{
 const s=state();s.recurringFixedExpenses=[{id:'fixed',naam:'Test',bedrag:150,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden'}];const occurrence={id:'fixed:2026-11-01',itemId:'fixed',month:'2026-11',amount:150};const rs=[120,20].map((n,i)=>row('fixed-'+i,'vaste-last',-n,{fixedExpenseId:'fixed',fixedOccurrenceId:occurrence.id,fixedOccurrenceMonth:'2026-11',processingDate:'2026-10-31'}));materialize(s,rs);const actual=fixedOccurrenceActuals(s,occurrence);assert.equal(actual.actual,140);assert.equal(actual.paid,true);
});
test('expected-balance presentation retains projection and provides a conservative-forecast notice',()=>{
 const {s,options}=setup();const p={opening:{balanceCents:230892},events:[{type:'fixed',amountCents:-15000}],bufferCents:20000,minimumBalanceCents:10000,monthEndSavings:{safeCents:1000}};const before=JSON.stringify(p);const view=attachCurrentBalance(s,{...options,asOfDate:options.toDate},p);assert.equal(view.externalCurrentBalance.balanceCents,236489);assert.ok(view.forecastNotice);assert.equal(view.forecastUncertainty,undefined);assert.deepEqual(view.events,p.events);assert.equal(JSON.stringify(p),before);assert.equal(view.opening.balanceCents,230892);
});
test('invalid paid dates fall back; manual dates and refund month remain separate',()=>{
 assert.equal(getTransactionDate({date:'2026-10-31',processing:{processingDate:'2026-02-30'}}),'2026-10-31');const s=state();const r=row('refund','terugbetaling',40,{processingDate:'2026-10-31',refundMonth:'2026-09',refundCategory:'Kleding'});r.bankOriginal.bankDate='2026-11-01';materialize(s,[r]);const p=selectTransactionProjections(s)[0];assert.equal(p.calendarMonth,'2026-10');assert.equal(p.refundMonth,'2026-09');
});

test('repeated provider import retains paid date, approval, bank identity and payload',()=>{
 const {s,snapshot}=setup();Object.assign(snapshot,{version:1,fromDate:'2026-11-01',toDate:'2026-11-01',transactions:[{entry_reference:'stable-id',status:'BOOK',booking_date:'2026-11-01',transaction_amount:{amount:'40.00',currency:'EUR'},credit_debit_indicator:'DBIT'}]});snapshot.account.iban=s.accountProfiles[0].identifier;
 const batch=stageProviderSnapshot(snapshot,s,null,[],u.classifyOriginal);batch.rows[0].processing.processingDate='2026-10-31';u.markExplicitlyApproved(batch.rows[0]);const before=structuredClone(batch.rows[0]);const repeated=stageProviderSnapshot(snapshot,s,batch,[batch],u.classifyOriginal);assert.deepEqual(repeated.rows,[before]);
});
test('historical projections are not overwritten by a current external observation',()=>{
 const {s,options}=setup();const p={horizon:{endDate:'2026-10-31'},opening:{balanceCents:123}};assert.equal(attachCurrentBalance(s,{...options,asOfDate:options.toDate},p),p);
});

test('administrative overview follows paid date in full and partial windows; bank list remains physical',()=>{
 const {selectAdministrativeBankTransactions}=require('../src/core/bank-sources.mjs');const s=state();const r=row('overview','uitgave',-40,{processingDate:'2025-12-31'});r.bankOriginal.bankDate='2026-01-01';materialize(s,[r]);assert.equal(selectAdministrativeBankTransactions(s,{month:'2025-12'}).length,1);assert.equal(selectAdministrativeBankTransactions(s,{month:'2026-01'}).length,0);assert.equal(selectBankTransactions(s,{month:'2026-01'}).length,1);s.__finizePartialHistory=true;s.verifiedPeriods=['2025-12','2026-01'];assert.equal(selectAdministrativeBankTransactions(s,{month:'2025-12'}).length,1);
});
test('conflicting external evidence falls back rather than guessing a balance',()=>{
 const {s,options}=setup();const other=structuredClone(s.bankBalanceObservations[0]);other.facts.amountCents++;s.bankBalanceObservations.push(other);const balance=selectCurrentAccountBalance(s,options);assert.equal(balance.source,'reconstruction');assert.equal(balance.externalConflict,true);
});
