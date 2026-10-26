const {setup}=require('./income-outlook-fixture.cjs'),{stageProviderSnapshot}=require('../../src/import/enable-banking-adapter.mjs'),{ensureImportBankSources}=require('../../src/core/bank-sources.mjs'),u=require('../../src/import/update4-runtime.cjs');
function fixture({pastSalary=true,budget=false}={}){
 const s=setup(pastSalary?'2026-10-14':'2026-10-26');s.accountProfiles=s.accountProfiles.filter(p=>p.id==='joint');s.accountProfiles[0].liquidity.salaryDays={dion:25,dara:5};
 s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:1000}],dara:[{effectiveFrom:'0000-01',salary:500}]};
 s.recurringFixedExpenses=budget?[]:[{id:'future-fixed',naam:'Synthetische last',bedrag:100,amountHistory:[{effectiveFrom:'2026-01-01',amount:100}],financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-11-04',afschrijfdag:4,actief:true,frequentieAantal:1,frequentieEenheid:'maanden'}];
 if(budget)s.monthlyBudgets={'2026-11':{gezamenlijkVariabel:[{id:'nov-budget',post:'Overig',bedrag:100}]}};
 if(pastSalary){const snapshot={version:1,runId:'synthetic-past-salary',householdId:'legacy',accountProfileId:'joint',account:{iban:s.accountProfiles[0].identifier,identificationHash:'synthetic-joint'},fromDate:'2026-10-14',toDate:'2026-10-26',fetchedAt:'2026-10-26T12:00:00Z',transactions:[{entry_reference:'synthetic-income',status:'BOOK',booking_date:'2026-10-25',transaction_amount:{amount:'1000.00',currency:'EUR'},credit_debit_indicator:'CRDT',remittance_information:['Synthetic salary']}],balances:[]};const batch=stageProviderSnapshot(snapshot,s,null,[],u.classifyOriginal);s.importSummaries=[u.compactSummary(batch)];ensureImportBankSources(s,batch);}
 return s;
}
module.exports={fixture};
