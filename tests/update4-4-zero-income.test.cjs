const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=require('./helpers/runtime-source.cjs');
const start=html.indexOf('function u3IncomeTransactionOwner');
const end=html.indexOf('function u3ActualExpenses',start);
assert.ok(start>=0&&end>start,'Inkomensresolver ontbreekt');

const state={
  personen:{dion:{salaris:2500},dara:{salaris:3010}},
  recurringIncomeSources:[
    {id:'salary-dion',eigenaar:'dion'},
    {id:'salary-dara',eigenaar:'dara'}
  ],
  monthlyIncomeOverrides:{},
  actualIncomeOverrides:{},
  transactions:[]
};
const context={
  state,Number,String,Math,
  getSelectedMonth:()=> '2026-07',
  round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
  isPlainObject:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
  u3ConfirmedTransactions:month=>state.transactions.filter(tx=>String(tx.date).slice(0,7)===month),
  u3IncomeOccurrences:()=>[
    {owner:'dion',amount:2500},
    {owner:'dara',amount:3010}
  ]
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);

assert.deepEqual(JSON.parse(JSON.stringify(context.resolveMonthlyIncome('dion','2026-07'))),{amount:2500,source:'expected'});
state.monthlyIncomeOverrides['2026-07']={dion:0};
assert.deepEqual(JSON.parse(JSON.stringify(context.resolveMonthlyIncome('dion','2026-07'))),{amount:0,source:'monthly-override'});
state.transactions.push({id:'actual',date:'2026-07-25',kind:'inkomen',amount:2430,incomeSourceId:'salary-dion'});
assert.deepEqual(JSON.parse(JSON.stringify(context.resolveMonthlyIncome('dion','2026-07'))),{amount:2430,source:'actual'});
state.transactions=[];
assert.equal(context.resolveMonthlyIncome('dion','2026-07').amount,0);
delete state.monthlyIncomeOverrides['2026-07'];
assert.equal(context.resolveMonthlyIncome('dion','2026-07').amount,2500);
state.actualIncomeOverrides['2026-07']={total:5000};
assert.deepEqual(JSON.parse(JSON.stringify(context.resolveMonthlyIncome('total','2026-07'))),{amount:5000,source:'actual'});
console.log('UPDATE4_4_ZERO_INCOME_OK');
