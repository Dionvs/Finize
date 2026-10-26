const {state,row,materialize}=require('./package5-fixture.cjs');
const {prepareBalanceCheckpoint,applyBalanceCheckpoint}=require('../../src/core/balance-checkpoints.mjs');
function setup(asOfDate='2026-10-10'){
 const s=state();s.meta.selectedMonth=asOfDate.slice(0,7);s.monthRecords={};s.planning.spaarpotDezeMaand=0;
 s.budgetDefaultsHistory={gezamenlijk:[],dion:[],dara:[]};
 s.accountProfiles=[{id:'joint',name:'Synthetisch gezamenlijk',identifier:'NL01JOINT',accountOwner:'gezamenlijk',accountType:'payment',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:10000,salaryDays:{dion:25,dara:27}}},
 {id:'personal',name:'Synthetisch persoonlijk',identifier:'NL01PERSONAL',accountOwner:'dion',accountType:'payment',status:'active',liquidity:{version:1,primaryForOwner:true,bufferCents:10000,salaryDays:{},allowanceDays:{dion:'last'}}}];
 s.recurringFixedExpenses=[{id:'fixed',naam:'Synthetische vaste last',categorie:'Wonen',bedrag:200,amountHistory:[{effectiveFrom:'2026-01-01',amount:200}],financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-01-01',afschrijfdag:20,actief:true,frequentieAantal:1,frequentieEenheid:'maanden'}];
 const scope={householdId:'legacy',accountProfiles:s.accountProfiles};
 for(const profile of s.accountProfiles){const command={operationId:'income-opening-'+profile.id,createdAt:asOfDate+'T12:00:00Z',accountProfileId:profile.id,amountCents:100000,asOfDate,note:''},options={scope,today:'2028-12-31'},preview=prepareBalanceCheckpoint(s,command,options);applyBalanceCheckpoint(s,{...command,confirmed:true,previewSignature:preview.previewSignature},options);}
 return s;
}
function receivedAllowance(s,date='2026-10-31'){
 const r=row('received-allowance','maandelijkse-bijdrage',300,{budgetOwner:'dion',advanceMode:'none'});
 r.accountOwner='dion';r.accountProfileId='personal';Object.assign(r.bankOriginal,{bankDate:date,currency:'EUR',accountIdentifier:'NL01PERSONAL'});r.processing.processingDate=date;
 return materialize(s,[r],'received-allowance-batch',{accountProfileId:'personal',accountOwner:'dion'});
}
module.exports={setup,receivedAllowance};
