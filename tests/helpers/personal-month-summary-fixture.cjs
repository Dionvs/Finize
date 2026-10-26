const {state,row,materialize}=require('./package5-fixture.cjs');
function fixture(owner='dion',{expense=195,refund=20,withdrawal=300}={}){
 const s=state();s.meta.selectedMonth='2026-10';s.planning.spaarpotDezeMaand=0;s.budgetDefaultsHistory={gezamenlijk:[],dion:[],dara:[]};s.budgetDefaultsHistory[owner]=[{effectiveFrom:'0000-01',rows:[{id:'personal-budget',post:'Kleding',bedrag:200}]}];
 s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:owner==='dion'?600:0}],dara:[{effectiveFrom:'0000-01',salary:owner==='dara'?600:0}]};
 s.accountProfiles=[{id:'joint',name:'Synthetisch gezamenlijk',accountOwner:'gezamenlijk',identifier:'NL01JOINT',accountType:'payment',status:'active'},{id:'personal',name:'Synthetisch persoonlijk',accountOwner:owner,identifier:'NL01PERSONAL',accountType:'payment',status:'active'}];
 s.recurringFixedExpenses=[{id:'personal-fixed',naam:'Synthetische vaste last',categorie:'Overig',bedrag:50,amountHistory:[{effectiveFrom:'2026-01-01',amount:50}],financialFor:owner,rekening:owner,accountProfileId:'personal',begindatum:'2026-01-01',afschrijfdag:3,actief:true,frequentieAantal:1,frequentieEenheid:'maanden'}];
 s.spaardoelen[owner]=[{id:'personal-goal',naam:'Synthetische buffer',algespaard:1000,doelbedrag:2000,doeldatum:'2027-10-31',vasteInleg:0,rendement:0}];s.savingsGoalLedger.push({id:'personal-opening',goalId:'personal-goal',source:'legacy-opening',effectiveAmount:1000,active:true});
 const rows=[row('personal-expense','uitgave',-expense,{budgetOwner:owner,budgetItemId:'personal-budget'})];if(refund)rows.push(row('personal-refund','terugbetaling',refund,{budgetOwner:owner,refundMonth:'2026-10',refundCategory:'Kleding'}));if(withdrawal)rows.push(row('personal-withdrawal','van-spaarrekening',withdrawal,{budgetOwner:owner,savingsGoalId:'personal-goal'}));
 rows.forEach(r=>{r.accountProfileId='personal';r.accountOwner=owner;r.bankOriginal.accountIdentifier='NL01PERSONAL';r.bankOriginal.currency='EUR';});materialize(s,rows,'personal-summary-import',{accountProfileId:'personal',accountOwner:owner});
 s.monthlySavingOverrides={'2026-09':{[owner]:11},'2026-10':{[owner]:42.5}};return s;
}
module.exports={fixture};
