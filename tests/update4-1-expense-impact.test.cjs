const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = require('./helpers/runtime-source.cjs');
const start = html.indexOf('function normalizedTransactionType');
const end = html.indexOf('function budgetStatus', start);
assert.ok(start >= 0 && end > start, 'Centrale transactie-impact is niet gevonden');

const transactions = [
  {id:'salary',date:'2026-07-01',owner:'dion',kind:'inkomen',amount:2500},
  {id:'groceries',date:'2026-07-02',owner:'gezamenlijk',kind:'uitgave',amount:100,category:'Boodschappen'},
  {id:'refund',date:'2026-07-03',owner:'gezamenlijk',kind:'uitgave',transactionType:'terugbetaling',amount:30,category:'Boodschappen'},
  {id:'transfer',date:'2026-07-04',owner:'dion',kind:'interne-overboeking',transactionType:'interne-overboeking',amount:500,accountDelta:-500},
  {id:'saving',date:'2026-07-05',owner:'dion',kind:'interne-overboeking',transactionType:'sparen',amount:250},
  {id:'excluded',date:'2026-07-06',owner:'dion',kind:'uitgave',amount:75,processing:{include:false}},
  {id:'fixed',date:'2026-07-07',owner:'gezamenlijk',kind:'vaste-last',amount:900,expenseImpact:900},
  {id:'stored',date:'2026-07-08',owner:'dion',kind:'uitgave',amount:80,expenseImpact:12.34},
  {id:'legacy',date:'2026-07-09',owner:'dara',amount:42}
];
const context = {
  state:{transactions},
  Number, String, Math,
  round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
  transactionMonth:tx=>String(tx.date||'').slice(0,7),
  getSelectedMonth:()=> '2026-07',
  getMonthTransactions:(owner=null,month='2026-07')=>transactions.filter(tx=>String(tx.date).slice(0,7)===month&&(!owner||tx.owner===owner))
};
vm.createContext(context);
vm.runInContext(html.slice(start,end), context);

assert.equal(context.getTransactionExpenseImpact(transactions[0]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[1]),100);
assert.equal(context.getTransactionExpenseImpact(transactions[2]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[3]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[4]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[5]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[6]),0);
assert.equal(context.getTransactionExpenseImpact(transactions[7]),12.34);
assert.equal(context.getTransactionExpenseImpact(transactions[8]),42);
assert.equal(context.sumTransactions(),154.34);
assert.equal(context.sumTransactions('gezamenlijk'),100);
assert.equal(context.sumTransactions(null,'Boodschappen'),100);
console.log('UPDATE4_1_EXPENSE_IMPACT_OK');
