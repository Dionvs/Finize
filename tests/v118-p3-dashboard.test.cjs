const {test}=require('node:test'),assert=require('node:assert/strict');
const {horizonEnd,primaryAccount,paymentEvents,liquidityView,yearView,money,allowanceShare,forecastPeriod,pointMeaning}=require('../src/ui/dashboard.mjs');
const {projectDailyLiquidity}=require('../src/core/daily-liquidity.mjs');
function projection(extra={}){return projectDailyLiquidity({accountProfileId:'joint',asOfDate:'2026-10-14',opening:{balanceCents:100000,status:'confirmed',quality:{}},horizon:{endDate:'2026-10-27'},events:[],reservations:[],savingsPlans:[{amountCents:45000}],bufferCents:20000,requiredMonths:[],reasons:[],...extra});}
test('P3 vrijwaarde exact P2, spaardoel informatief, saldo minimum datum buffer exact',()=>{const p=projection(),v=liquidityView(p);assert.equal(v.free,p.freeAfterObligationsCents);assert.equal(v.free,80000);assert.equal(v.savings,45000);assert.equal(v.balance,100000);assert.equal(v.minimum,p.minimumBalanceCents);assert.equal(v.minimumDate,p.minimumDate);assert.equal(v.buffer,20000);assert.equal(v.indicative,false);});
for(const [filter,expected] of [['salary',undefined],['7','2026-10-20'],['14','2026-10-27'],['month','2026-10-31'],['custom','2026-11-03']])test('P3 horizon '+filter,()=>assert.equal(horizonEnd(filter,'2026-10-14','2026-11-03'),expected));
test('P3 horizon kalenderdag over DST en jaargrens',()=>{assert.equal(horizonEnd('14','2026-10-24'),'2026-11-06');assert.equal(horizonEnd('month','2026-12-30'),'2026-12-31');});
test('P3 salaris binnen handmatige horizon en vervangen plan/reservering buiten lijst',()=>{const p=projection({events:[{id:'salary',type:'salary',status:'planned',date:'2026-10-25',amountCents:250000,accountProfileId:'joint'},{id:'old',status:'replaced',date:'2026-10-20',amountCents:250000,accountProfileId:'joint'},{id:'budget',status:'reservation',date:'2026-10-20',amountCents:-50000,accountProfileId:'joint'},{id:'other',status:'planned',date:'2026-10-20',amountCents:50,accountProfileId:'personal'}]});assert.deepEqual(paymentEvents(p).map(e=>e.id),['salary']);});
test('P3 onbekend is geen nul en voorlopige vrijwaarde krijgt indicatie',()=>{const p=projection({opening:{balanceCents:null,quality:{}}});assert.equal(liquidityView(p).balance,null);assert.equal(liquidityView(p).free,null);assert.equal(money(null),'—');const provisional=projection({reasons:[{code:'awaiting-review',severity:'provisional'}]});assert.equal(liquidityView(provisional).free,provisional.indicativeFreeAfterObligationsCents);assert.equal(liquidityView(provisional).indicative,true);});
test('P3 negatieve prognose blijft negatief en persoonlijke buffer nul blijft nul',()=>{const p=projection({opening:{balanceCents:-100,quality:{}},bufferCents:0});assert.equal(liquidityView(p).minimum,-100);assert.equal(liquidityView(p).buffer,0);assert.match(money(-100),/-/);});
test('P3 kiest alleen unieke actieve primaire rekening van juiste eigenaar',()=>{const profiles=[{id:'a',accountOwner:'gezamenlijk',accountType:'payment',liquidity:{primaryForOwner:true}},{id:'b',accountOwner:'dion',accountType:'payment',liquidity:{primaryForOwner:true}}];assert.equal(primaryAccount(profiles,'dion').id,'b');assert.equal(primaryAccount(profiles,'dara'),null);assert.equal(primaryAccount([...profiles,{...profiles[0],id:'c'}],'gezamenlijk'),null);assert.equal(primaryAccount([{...profiles[0],status:'archived'}],'gezamenlijk'),null);});
test('P3 jaarcijfers behouden bestaande bronbetekenis en gemiddeld besteed',()=>{const v=yearView(2026,()=>({income:{total:2500},fixedExpenses:1000,variableExpenses:{total:500},savings:200}));assert.deepEqual([v.income,v.spent,v.saving,v.average],[3000000,1800000,240000,150000]);assert.equal(v.count,12);});
test('P3 ontbrekende historische maand wordt niet nul en gemiddelde telt beschikbare maanden',()=>{const v=yearView(2026,key=>{if(key.endsWith('02'))throw Error('period-incomplete');return {income:{total:100},fixedExpenses:40,variableExpenses:{total:10},savings:5};});assert.equal(v.count,11);assert.equal(v.average,5000);assert.equal(v.months[1].missing,true);const unknown=yearView(2026,()=>({}));assert.equal(unknown.income,null);assert.equal(unknown.average,null);});
test('P3 presentatieselectors veranderen bronprojectie niet',()=>{const p=projection(),before=JSON.stringify(p);liquidityView(p);paymentEvents(p);assert.equal(JSON.stringify(p),before);});
test('P3 herstel gezamenlijke noemer houdt beide persoonlijke aandelen en bedragen intact',()=>{const amounts=[1166.58,1433.23],before=JSON.stringify(amounts);assert.equal(allowanceShare(amounts[0],amounts),amounts[0]/(amounts[0]+amounts[1])*100);assert.equal(allowanceShare(amounts[1],amounts),amounts[1]/(amounts[0]+amounts[1])*100);assert.equal(JSON.stringify(amounts),before);assert.equal(Math.round(allowanceShare(amounts[0],amounts)*10)/10,44.9);assert.equal(Math.round(allowanceShare(amounts[1],amounts)*10)/10,55.1);});
test('P3 herstel nul en tekort houden bestaande presentatiebehandeling',()=>{for(const values of [[0,0],[-5,10],[10,-5],[-5,-10]])for(const amount of values)assert.equal(allowanceShare(amount,values),null);assert.equal(allowanceShare(0,[0,100]),0);assert.equal(allowanceShare(100,[0,100]),100);});
test('P3 herstel periode uit P2, inclusieve handmatige grens en onbekende horizon',()=>{const p=projection();assert.match(forecastPeriod(p),/14 okt – 27 okt 2026/);assert.match(forecastPeriod(p),/vóór volgend salaris/);p.horizon.kind='manual';assert.match(forecastPeriod(p),/Einddatum inbegrepen/);p.horizon.endDate=null;assert.match(forecastPeriod(p),/onbekend/);assert.doesNotMatch(forecastPeriod(p),/27 okt/);p.asOfDate='2026-12-30';p.horizon.endDate='2027-01-03';assert.match(forecastPeriod(p),/30 dec 2026 – 3 jan 2027/);});
test('P3 herstel neutraal minimum inkomen en uitgave benoemen uitsluitend concrete gebeurtenissen',()=>{assert.equal(pointMeaning([],false).label,'Saldopunt zonder concrete betaling');assert.equal(pointMeaning([],true).label,'Laagste prognose · Saldopunt zonder concrete betaling');assert.equal(pointMeaning([{amountCents:-100}],true).label,'Laagste prognose · Uitgave');assert.equal(pointMeaning([{amountCents:200},{amountCents:-100}],false).label,'Inkomst · Uitgave');assert.equal(pointMeaning([],false).expense,false);});


test('betalingskaart toont uitsluitend toekomstige vaste plannen binnen rekening en periode',()=>{
 const row={id:'future-fixed',accountProfileId:'joint',type:'fixed',status:'planned',date:'2026-10-20',amountCents:-100};
 const p={accountProfileId:'joint',asOfDate:'2026-10-14',displayStartDate:'2026-10-01',horizon:{endDate:'2026-10-31'},events:[
  row,...[
   {id:'past',date:'2026-10-13'}, {id:'today',date:'2026-10-14'}, {id:'outside',date:'2026-11-01'},
   {id:'actual',type:'bank',status:'actual'}, {id:'provisional',type:'bank',status:'provisional'},
   {id:'replaced',status:'replaced'}, {id:'reservation',status:'reservation'}, {id:'undated',date:null},
   {id:'other-account',accountProfileId:'personal'}, {id:'transfer',type:'internal-transfer'},
   {id:'income',type:'income'}, {id:'salary',type:'salary'}, {id:'allowance',type:'allowance'}
  ].map(extra=>({...row,...extra}))
 ]};
 const before=JSON.stringify(p);
 assert.deepEqual(paymentEvents(p).map(e=>e.id),['allowance','future-fixed','income','salary']);
 assert.equal(JSON.stringify(p),before);
 assert.deepEqual(paymentEvents({...p,displayStartDate:'2026-10-21'}),[]);
 assert.deepEqual(paymentEvents({...p,asOfDate:'2026-11-01'}),[]);
 assert.deepEqual(paymentEvents({...p,horizon:{endDate:null}}),[]);
 assert.deepEqual(paymentEvents(null),[]);
});
