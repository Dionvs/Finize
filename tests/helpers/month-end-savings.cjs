const {setup}=require('./income-outlook-fixture.cjs');
function fixture({asOf='2026-10-26',balance=275000,buffer=20000,first=1800,late=100}={}){
 const s=setup(asOf);s.accountProfiles=s.accountProfiles.filter(p=>p.id==='joint');
 s.accountProfiles[0].liquidity={version:1,primaryForOwner:true,bufferCents:buffer,salaryDays:{dion:5,dara:24}};
 s.balanceCheckpoints=s.balanceCheckpoints.filter(c=>c.accountProfileId==='joint');s.balanceCheckpoints[0].amountCents=balance;
 s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:2000}],dara:[{effectiveFrom:'0000-01',salary:1000}]};
 s.monthlyIncomeOverrides={[asOf.slice(0,7)]:{dion:0,dara:0}};s.planning.spaarpotDezeMaand=500;
 const fixed=(id,day,amount)=>({id,naam:'Synthetische last',categorie:'Wonen',bedrag:amount,amountHistory:[{effectiveFrom:'2020-01-01',amount}],financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:asOf.slice(0,7)+'-'+String(day).padStart(2,'0'),afschrijfdag:day,validFrom:require('../../src/core/planning-timeline.mjs').nextPlanningMonth(asOf.slice(0,7)),actief:true,frequentieAantal:1,frequentieEenheid:'maanden'});
 s.recurringFixedExpenses=[fixed('first',1,first),fixed('late',25,late)];return s;
}
const options=s=>({accountProfileId:'joint',asOfDate:s.balanceCheckpoints[0]?.asOfDate||s.meta.selectedMonth+'-26',month:s.meta.selectedMonth,scope:{householdId:'legacy',accountProfiles:s.accountProfiles}});
module.exports={fixture,options};
