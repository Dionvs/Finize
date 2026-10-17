const {test}=require('node:test');
const assert=require('node:assert/strict');
const {state,copy}=require('./helpers/package5-fixture.cjs');
const {prepareBalanceCheckpoint,applyBalanceCheckpoint}=require('../src/core/balance-checkpoints.mjs');
const {selectDailyLiquidity,liquidityRequiredMonths}=require('../src/core/daily-liquidity.mjs');
const {dashboardPeriod,chartDays,paymentEvents}=require('../src/ui/dashboard.mjs');
function fixture(date='2026-10-14',amountCents=43478){
  const s=state();s.planning.spaarpotDezeMaand=0;s.budgetDefaultsHistory.gezamenlijk=[];
  s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:0}],dara:[{effectiveFrom:'0000-01',salary:0}]};
  s.accountProfiles[0]={...s.accountProfiles[0],name:'Gezamenlijk',accountType:'payment',liquidity:{version:1,primaryForOwner:true,bufferCents:5000,salaryDays:{},allowanceDays:{}}};
  s.recurringFixedExpenses=[{id:'monthly',naam:'Maandelijkse last',bedrag:100,begindatum:'2024-01-03',afschrijfdag:3,rekening:'gezamenlijk',financialFor:'gezamenlijk',frequentieEenheid:'maanden',frequentieAantal:1}];
  checkpoint(s,date,amountCents);return s;
}
const scope=s=>({householdId:'legacy',accountProfiles:s.accountProfiles});
function checkpoint(s,date,amountCents){
 const command={operationId:'cp-'+date,createdAt:'2026-10-14T12:00:00Z',accountProfileId:'joint',amountCents,asOfDate:date,note:''};
 const options={scope:scope(s),today:'2028-12-31'},preview=prepareBalanceCheckpoint(s,command,options);
 applyBalanceCheckpoint(s,{...command,confirmed:true,previewSignature:preview.previewSignature},options);
}
const project=(s,month,today='2026-10-14',filter='month',custom='')=>selectDailyLiquidity(s,{accountProfileId:'joint',asOfDate:today,scope:scope(s),...dashboardPeriod({month,today,filter,custom})});

test('november rolt oktober vooruit zonder oktoberbetalingen of mutatie van de bron',()=>{
 const s=fixture(),before=copy(s),p=project(s,'2026-11');
 assert.equal(p.asOfDate,'2026-10-14');assert.equal(p.days.length,30);
 assert.equal(p.days[0].date,'2026-11-01');assert.equal(p.days[0].openingBalanceCents,43478);
 assert.equal(p.days.at(-1).date,'2026-11-30');assert.equal(p.days.at(-1).expectedBalanceCents,33478);
 assert.equal(p.minimumDate,'2026-11-03');assert.equal(p.minimumBalanceCents,33478);
 assert(paymentEvents(p).every(e=>e.date.startsWith('2026-11')));assert.deepEqual(s,before);
});
test('tussenliggende maandmutaties tellen eenmaal in de toekomstige opening',()=>{
 const p=project(fixture(),'2026-12');assert.equal(p.days[0].openingBalanceCents,33478);assert.equal(p.days.at(-1).expectedBalanceCents,23478);
 assert.equal(p.reservations.filter(r=>r.reserveForDisplay!==false&&r.type==='budget').length,0);
});
test('historische maand gebruikt nooit een ijkpunt na het geselecteerde maandeinde',()=>{
 const s=fixture('2026-09-30',50000);checkpoint(s,'2026-10-10',20000);const p=project(s,'2026-09');
 assert.equal(p.days.length,1);assert.equal(p.days[0].date,'2026-09-30');assert.equal(p.days[0].expectedBalanceCents,50000);
 assert.equal(p.currentBalance.checkpoint.asOfDate,'2026-09-30');assert.equal(chartDays(p).length,30);
 assert(chartDays(p).slice(0,-1).every(day=>day.expectedBalanceCents===null));
});
test('ontbrekend historisch beginsaldo blijft onbekend en tekent toch de gehele kalenderas',()=>{
 const p=project(fixture(),'2026-09');assert.equal(p.days.length,0);assert.equal(p.minimumBalanceCents,null);
 assert.equal(chartDays(p).length,30);assert(chartDays(p).every(d=>d.expectedBalanceCents===null));
});
test('latere saldowaarneming verzint geen eerste dertien oktoberdagen',()=>{
 const p=project(fixture(),'2026-10'),days=chartDays(p);
 assert.equal(days.length,31);assert(days.slice(0,13).every(d=>d.expectedBalanceCents===null));
 assert.equal(days[13].expectedBalanceCents,43478);assert.equal(days[13].openingBalanceCents,null);
 assert.equal(p.minimumBalanceCents,43478);assert.equal(p.historyComplete,false);
});
test('waarneming na vandaag wordt niet gebruikt als opening voor een toekomstige maand',()=>{
 const s=fixture();checkpoint(s,'2026-10-20',999999);const p=project(s,'2026-11');
 assert.equal(p.days[0].openingBalanceCents,43478);assert.equal(p.currentBalance.checkpoint.asOfDate,'2026-10-14');
});
for(const [month,count] of [['2024-02',29],['2025-02',28],['2026-11',30],['2026-12',31],['2027-01',31]])test('volledige kalendermaand '+month,()=>{
 const today=month+'-14',s=fixture(month+'-01');s.recurringFixedExpenses=[];const p=project(s,month,today);
 assert.equal(chartDays(p).length,count);assert.equal(chartDays(p)[0].date,month+'-01');assert.equal(chartDays(p).at(-1).date,month+'-'+count);
});
test('korte filters blijven binnen de maand; andere maanden beginnen op de eerste',()=>{
 assert.equal(dashboardPeriod({month:'2026-10',today:'2026-10-30',filter:'14'}).endDate,'2026-10-31');
 assert.equal(dashboardPeriod({month:'2026-11',today:'2026-10-14',filter:'7'}).startDate,'2026-11-01');
 assert.equal(dashboardPeriod({month:'2026-11',today:'2026-10-14',filter:'7'}).endDate,'2026-11-07');
 assert.equal(dashboardPeriod({month:'2024-02',today:'2026-10-14',filter:'14'}).endDate,'2024-02-14');
 assert.throws(()=>dashboardPeriod({month:'2026-11',today:'2026-10-14',filter:'custom',custom:'2026-12-01'}),/geselecteerde maand/);
 assert.throws(()=>dashboardPeriod({month:'2026-10',today:'2026-10-14',filter:'custom',custom:'2026-10-13'}),/geselecteerde maand/);
});
test('volgend salaris blijft rekeninggebonden, eerlijk bij ontbreken en begrensd op de maand',()=>{
 const s=fixture();assert.equal(project(s,'2026-11','2026-10-14','salary').horizon.endDate,null);
 s.incomeDefaultsHistory.dion[0].salary=1000;s.accountProfiles[0].liquidity.salaryDays={dion:25};
 const p=project(s,'2026-11','2026-10-14','salary');assert.equal(p.horizon.endDate,'2026-11-24');assert.equal(p.days[0].date,'2026-11-01');
 const late=project(s,'2026-10','2026-10-30','salary');assert.equal(late.horizon.endDate,'2026-10-31');assert.equal(late.horizon.kind,'month-limit');
});
test('vereiste historische opslagperioden negeren een later ijkpunt',()=>{
 const s=fixture();assert.deepEqual(liquidityRequiredMonths(s,{accountProfileId:'joint',asOfDate:'2026-10-14',startDate:'2026-09-01',endDate:'2026-09-30',scope:scope(s)}),['2026-09']);
});
test('historisch salarisfilter gebruikt geen ijkpunt na zijn kortere horizon',()=>{
 const s=fixture('2026-09-30',50000);s.incomeDefaultsHistory.dion[0].salary=1000;s.accountProfiles[0].liquidity.salaryDays={dion:25};
 const p=project(s,'2026-09','2026-10-14','salary');assert.equal(p.horizon.endDate,'2026-09-24');assert.equal(p.days.length,0);
 assert.equal(p.currentBalance.balanceCents,null);assert.equal(chartDays(p).length,24);
});
test('salarisfilter laadt alle tussenmaanden tot de gekozen toekomstige maand',()=>{
 const s=fixture();assert.deepEqual(liquidityRequiredMonths(s,{accountProfileId:'joint',asOfDate:'2026-10-14',scope:scope(s),...dashboardPeriod({month:'2027-02',today:'2026-10-14',filter:'salary'})}),['2026-10','2026-11','2026-12','2027-01','2027-02']);
});
test('eerdere tekorten en ijkpuntcorrecties komen niet in het minimum of de footer van november',()=>{
 const s=fixture('2026-09-30',5000);checkpoint(s,'2026-10-14',43478);const p=project(s,'2026-11');
 assert.equal(p.minimumBalanceCents,33478);assert.equal(p.minimumDate,'2026-11-03');assert.deepEqual(p.reconciliations,[]);
 assert.throws(()=>selectDailyLiquidity(s,{accountProfileId:'joint',startDate:'2026-11-01',asOfDate:'2026-10-14',endDate:'2026-11-30',horizonLimitDate:'2026-10-31',scope:scope(s)}),/maandgrens/);
});
