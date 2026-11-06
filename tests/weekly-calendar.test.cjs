process.env.TZ='Europe/Amsterdam';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {weekly,cases,calendarDates,financialFixture}=require('./helpers/pakket1-weekly.cjs');
const {occurrenceDates,plannedOccurrences}=require('../src/core/recurring-occurrences.mjs');
const {financialForecastForMonth}=require('../src/core/transaction-engine.mjs');
const {selectDailyLiquidity,selectMonthEndSavings}=require('../src/core/daily-liquidity.mjs');
const {setRecurringFromMonth}=require('../src/core/planning-timeline.mjs');
test('B2 tests gebruiken aantoonbaar Amsterdamse zomer- en wintertijd',()=>{
 assert.equal(new Date(2026,9,18,12).getTimezoneOffset(),-120);assert.equal(new Date(2026,9,25,12).getTimezoneOffset(),-60);
});
for(const [label,start,month,expected]of cases)test(`B2 ${label}`,()=>assert.deepEqual(occurrenceDates(weekly({begindatum:start}),month),expected));
for(let weekday=12;weekday<=18;weekday++)for(const month of ['2026-10','2026-11','2027-02','2027-03','2027-04','2027-10','2027-11','2028-02']){
 const start=`2026-10-${weekday}`;
 test(`B2 kalenderoracle ${start} naar ${month}`,()=>{
  const result=occurrenceDates(weekly({begindatum:start}),month);
  assert.deepEqual(result,calendarDates(start,month));assert.equal(new Set(result).size,result.length);
 });
}
test('B2 tweewekelijkse ankerdag blijft behouden',()=>assert.deepEqual(occurrenceDates(weekly({frequentieAantal:2}),'2026-11'),['2026-11-01','2026-11-15','2026-11-29']));
test('B2 inclusieve einddatum op zomertijdzondag blijft meetellen',()=>assert.deepEqual(occurrenceDates(weekly({begindatum:'2027-03-07',einddatum:'2027-03-28'}),'2027-03'),['2027-03-07','2027-03-14','2027-03-21','2027-03-28']));
test('B2 maandelijkse en jaarlijkse frequenties blijven verankerd',()=>{
 const monthly=weekly({begindatum:'2027-01-31',frequentieEenheid:'maanden'});
 assert.deepEqual(occurrenceDates(monthly,'2027-02'),['2027-02-28']);assert.deepEqual(occurrenceDates(monthly,'2027-03'),['2027-03-31']);
 const annual=weekly({begindatum:'2024-02-29',frequentieEenheid:'jaren'});
 assert.deepEqual(occurrenceDates(annual,'2027-02'),['2027-02-28']);assert.deepEqual(occurrenceDates(annual,'2028-02'),['2028-02-29']);
});
test('B2 bedragwijziging vanaf november behoudt eerdere maanden en opgeslagen historie',()=>{
 const financialRows=rows=>rows.map(({source,...row})=>row);
 const item=weekly({begindatum:'2026-09-20'}),before=financialRows(plannedOccurrences([item],'2026-09'));
 setRecurringFromMonth(item,'2026-11',{bedrag:20});
 assert.deepEqual(financialRows(plannedOccurrences([item],'2026-09')),before);
 assert.equal(plannedOccurrences([item],'2026-11').reduce((n,o)=>n+o.amount,0),100);
});
test('B2 maandlasten, laagste saldo en Veilig te sparen bevatten alle vijf novemberlasten',()=>{
 const s=financialFixture();s.monthRecords['2026-09']={status:'afgesloten',snapshot:{income:500,expenses:120}};
 const before=JSON.stringify(s),scope={householdId:'legacy',accountProfiles:s.accountProfiles};
 const options={accountProfileId:'joint',asOfDate:'2026-10-31',scope};
 const forecast=financialForecastForMonth(s,'2026-11');assert.equal(forecast.owners.gezamenlijk.fixedBurden,50);
 const projection=selectDailyLiquidity(s,{...options,endDate:'2026-11-30'});
 const events=projection.events.filter(e=>e.type==='fixed'&&e.status==='planned');
 assert.deepEqual(events.map(e=>e.date),['2026-11-01','2026-11-08','2026-11-15','2026-11-22','2026-11-29']);
 assert.equal(events.reduce((n,e)=>n+e.amountCents,0),-5000);assert.equal(projection.minimumBalanceCents,95000);
 const savings=selectMonthEndSavings(s,{...options,month:'2026-10'});
 assert.equal(savings.expectedEndBalanceCents,100000);assert.equal(savings.requiredOpeningCents,25000);assert.equal(savings.safeCents??savings.indicativeCents,75000);
 assert.equal(JSON.stringify(s),before);
});
