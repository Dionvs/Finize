const {setup}=require('./income-outlook-fixture.cjs');
const weekly=(extra={})=>({id:'weekly',naam:'Wekelijkse testlast',categorie:'Overig',bedrag:10,amountHistory:[{effectiveFrom:'2020-01-01',amount:10}],financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2026-10-18',afschrijfdag:1,actief:true,frequentieAantal:1,frequentieEenheid:'weken',...extra});
const cases=[
 ['25 oktober en volgende zondag','2026-10-25','2026-11',['2026-11-01','2026-11-08','2026-11-15','2026-11-22','2026-11-29']],
 ['anker vóór wintertijd','2026-10-18','2026-11',['2026-11-01','2026-11-08','2026-11-15','2026-11-22','2026-11-29']],
 ['zomertijd maart 2027','2027-03-03','2027-03',['2027-03-03','2027-03-10','2027-03-17','2027-03-24','2027-03-31']],
 ['wintertijd oktober 2027','2027-10-17','2027-10',['2027-10-17','2027-10-24','2027-10-31']],
 ['maandag na wintertijd 2027','2027-10-18','2027-11',['2027-11-01','2027-11-08','2027-11-15','2027-11-22','2027-11-29']],
 ['december naar januari','2026-12-27','2027-01',['2027-01-03','2027-01-10','2027-01-17','2027-01-24','2027-01-31']],
 ['28 dagen','2027-02-07','2027-02',['2027-02-07','2027-02-14','2027-02-21','2027-02-28']],
 ['29 dagen','2028-02-01','2028-02',['2028-02-01','2028-02-08','2028-02-15','2028-02-22','2028-02-29']],
 ['30 dagen','2027-04-02','2027-04',['2027-04-02','2027-04-09','2027-04-16','2027-04-23','2027-04-30']],
 ['31 dagen','2027-01-03','2027-01',['2027-01-03','2027-01-10','2027-01-17','2027-01-24','2027-01-31']]
];
// Independent oracle: walk UTC calendar days and count seven-day groups.
function calendarDates(start,month,interval=1){
 const date=new Date(start+'T12:00:00Z'),result=[];let days=0;
 while(date.toISOString().slice(0,7)<=month){
  const iso=date.toISOString().slice(0,10);
  if(iso.startsWith(month)&&days%(interval*7)===0)result.push(iso);
  date.setUTCDate(date.getUTCDate()+1);days++;
 }
 return result;
}
function financialFixture(){
 const s=setup('2026-10-31');s.accountProfiles=s.accountProfiles.filter(p=>p.id==='joint');s.balanceCheckpoints=s.balanceCheckpoints.filter(c=>c.accountProfileId==='joint');
 s.accountProfiles[0].liquidity={version:1,primaryForOwner:true,bufferCents:20000,salaryDays:{}};
 s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:0}],dara:[{effectiveFrom:'0000-01',salary:0}]};
 s.planning.spaarpotDezeMaand=0;s.recurringFixedExpenses=[weekly({validFrom:'2026-11'})];
 return s;
}
module.exports={weekly,cases,calendarDates,financialFixture};
