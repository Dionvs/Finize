const {fixture,options}=require('./month-end-savings.cjs');
const {row,materialize}=require('./package5-fixture.cjs');
function timingFixture(){
 const s=fixture({balance:1000000});
 s.budgetDefaultsHistory.gezamenlijk=[{effectiveFrom:'0000-01',rows:[{id:'timing-budget',post:'Variabel',bedrag:1150}]}];
 return s;
}
function purchase(s,{amount=100,date='2026-11-02',accountProfileId='joint',owner='gezamenlijk'}={}){
 const r=row('timing-purchase-'+s.importSummaries.length,'uitgave',-amount,{category:'Variabel',budgetItemId:'timing-budget',budgetOwner:owner});
 Object.assign(r.bankOriginal,{bankDate:date,currency:'EUR',accountIdentifier:accountProfileId==='joint'?'NL01JOINT':'NL02SECOND'});r.processing.processingDate=date;
 materialize(s,[r],r.id,{accountProfileId,accountOwner:owner});
}
// Independent integer-cent oracle for the fixed A/F fixture; no production
// projection, reservation or financial selector is used to calculate this line.
function oracle(){
 const rows=[];let balance=1000000,cumulative=0;
 for(let n=0;n<40;n++){
  const date=new Date(Date.UTC(2026,9,27+n)).toISOString().slice(0,10),day=Number(date.slice(-2)),month=date.slice(0,7);
  const days=month==='2026-11'?30:month==='2026-10'?5:31,index=month==='2026-10'?day-27:day-1;
  const budget=Math.floor(115000/days)+(index<115000%days?1:0);
  const income=month==='2026-10'?0:day===5?200000:day===24?100000:0;
  const expense=month==='2026-10'?0:day===1?180000:day===25?10000:0;
  const opening=balance;balance+=income-expense-budget;cumulative+=budget;
  rows.push({date,openingBalanceCents:opening,incomeCents:income,expenseCents:expense,budgetCents:budget,cumulativeBudgetCents:cumulative,balanceCents:balance});
 }
 return rows;
}
module.exports={timingFixture,purchase,oracle,options};
