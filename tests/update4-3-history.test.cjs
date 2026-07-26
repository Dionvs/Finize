const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=require('./helpers/runtime-source.cjs');
function extractFunction(name){
  const start=html.indexOf(`function ${name}`);
  assert.ok(start>=0,`${name} ontbreekt`);
  const brace=html.indexOf('{',start);
  let depth=0;
  for(let index=brace;index<html.length;index++){
    if(html[index]==='{')depth++;
    if(html[index]==='}'&&--depth===0)return html.slice(start,index+1);
  }
  throw new Error(`${name} is niet volledig`);
}

const januarySnapshot={
  month:'2026-01',version:2,status:'afgesloten',legacy:false,
  income:{dion:2450,dara:3010,joint:0,total:5460},
  fixedExpenses:1800,variableExpenses:{dion:50,dara:80,joint:160,total:290},
  refunds:20,savings:250,allowance:{dion:0,dara:0},
  contributions:{dion:0,dara:0,joint:250,total:250},remaining:3120,goalAllocations:[],closedAt:'2026-02-01'
};
const state={
  meta:{selectedMonth:'2026-07'},
  personen:{dion:{salaris:9999},dara:{salaris:9999}},
  monthRecords:{'2026-01':{
    month:'2026-01',status:'afgesloten',activeClosureId:'closure-2026-01-1',
    lateImportTransactionIds:[],closureHistory:[{id:'closure-2026-01-1',closingId:'closure-2026-01-1',financialSnapshot:januarySnapshot}]
  }}
};
const context={
  state,Number,String,Math,
  clone:value=>JSON.parse(JSON.stringify(value)),
  round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
  isPlainObject:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
  u3LiveFinancialSnapshot:()=>{throw new Error('Afgesloten maand mag niet live worden herberekend');}
};
vm.createContext(context);
vm.runInContext(extractFunction('u3LegacyFinancialSnapshot'),context);
vm.runInContext(extractFunction('getMonthFinancialResult'),context);

assert.deepEqual(JSON.parse(JSON.stringify(context.getMonthFinancialResult('2026-01').income)),januarySnapshot.income);
state.personen.dion.salaris=12000;
assert.equal(context.getMonthFinancialResult('2026-01').income.total,5460);
state.monthRecords['2026-01'].status='correctie-nodig';
state.monthRecords['2026-01'].lateImportTransactionIds=['late-1'];
const corrected=context.getMonthFinancialResult('2026-01');
assert.equal(corrected.income.total,5460);
assert.deepEqual(JSON.parse(JSON.stringify(corrected.pendingCorrectionTransactionIds)),['late-1']);

const months=Array.from({length:12},(_,index)=>({income:{total:index+1},fixedExpenses:0,variableExpenses:{total:0},savings:0}));
assert.equal(months.reduce((sum,month)=>sum+month.income.total,0),78);
console.log('UPDATE4_3_HISTORY_OK');
