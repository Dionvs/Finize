const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function u3ConfirmedTransactions');
const end = html.indexOf('const u3LegacyMonthlyScenarioData', start);
assert.ok(start >= 0 && end > start, 'Update 3 administratierekenlaag is niet gevonden');

const state = {
  meta: { scenario: 'voor' },
  transactions: [
    {id:'joint-groceries',date:'2026-07-05',kind:'uitgave',amount:100,account:'dion',financialFor:'gezamenlijk',owner:'gezamenlijk',category:'Boodschappen',reviewStatus:'bevestigd'},
    {id:'personal',date:'2026-07-06',kind:'uitgave',amount:25,account:'dion',financialFor:'dion',owner:'dion',category:'Overig',reviewStatus:'bevestigd'}
  ],
  monthlyBudgets: {'2026-07':{voor:{gezamenlijkVariabel:[{post:'Boodschappen',bedrag:150}],dionVariabel:[],daraVariabel:[]}}},
  recurringIncomeSources: [],
  recurringFixedExpenses: {voor:[],na:[]},
  transactionReviewQueue: [],
  recognitionRules: [],
  reserveLedger: [],
  advanceLedger: [],
  internalTransfers: [],
  monthCorrections: [],
  monthRecords: {},
  accountSettings: {
    gezamenlijk:{openingBalance:500,effectiveMonth:'2026-07',openingBalanceSet:true},
    dion:{openingBalance:300,effectiveMonth:'2026-07',openingBalanceSet:true},
    dara:{openingBalance:200,effectiveMonth:'2026-07',openingBalanceSet:true}
  }
};

const context = {
  console, Date, Math, Number, String, Array, Object, Map, Set,
  state,
  U3_ACCOUNTS:['gezamenlijk','dion','dara'],
  round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
  getSelectedMonth:()=> '2026-07',
  transactionMonth:tx=>String(tx.date||'').slice(0,7),
  u3PlannedOccurrences:()=>[],
  ensureMonthData:()=>{},
  isPlainObject:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
  calcScenario:()=>({dion:{zakgeld:10},dara:{zakgeld:20},spaarpotDezeMaand:30}),
  clone:value=>JSON.parse(JSON.stringify(value)),
  ownerLabel:value=>value,
  getDeviceId:()=> 'test-device',
  monthKey:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,
  u3IsoDate:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
  bankText:value=>String(value||'').toLowerCase()
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context,{filename:'update3-administration-inline.js'});

const budget = context.u3BudgetSummary('gezamenlijk','2026-07','voor');
assert.equal(budget[0].actual,100);
assert.equal(budget[0].difference,50);

const accounts = context.u3AccountControl('2026-07');
assert.equal(accounts.dion.calculatedEnd,175);
assert.equal(accounts.gezamenlijk.calculatedEnd,500);

const advance = context.u3CreateAdvanceForTransaction(state.transactions[0]);
assert.deepEqual({debtor:advance.debtor,creditor:advance.creditor,amount:advance.originalAmount},{debtor:'gezamenlijk',creditor:'dion',amount:100});
state.advanceLedger.push({id:'reverse',month:'2026-07',debtor:'dion',creditor:'gezamenlijk',originalAmount:40,outstandingAmount:40,status:'open',createdAt:'2026-07-02',settlementTransferIds:[]});
assert.deepEqual(JSON.parse(JSON.stringify(context.u3NetAdvances('2026-07'))),[
  {debtor:'gezamenlijk',creditor:'dion',amount:100},
  {debtor:'dion',creditor:'gezamenlijk',amount:40}
]);

state.transactionReviewQueue.push({id:'pending',date:'2026-07-08',reviewStatus:'te-controleren'});
assert.equal(context.u3CloseMonth('2026-07').requiresWarning,true);
state.transactionReviewQueue[0].reviewStatus='genegeerd';
const firstClose=context.u3CloseMonth('2026-07',{gezamenlijk:500,dion:175,dara:200},[]);
assert.equal(state.monthRecords['2026-07'].status,'afgesloten');
assert.equal(context.u3CloseMonth('2026-07').id,firstClose.id);
assert.equal(state.monthRecords['2026-07'].closureHistory.length,1);
assert.equal(context.u3ReopenMonth('2026-07'),true);
const secondClose=context.u3CloseMonth('2026-07',{gezamenlijk:500,dion:175,dara:200},[]);
assert.notEqual(secondClose.id,firstClose.id);
assert.equal(state.monthRecords['2026-07'].closureHistory.length,2);

const settlement=state.internalTransfers.find(row=>String(row.type).includes('voorschot'));
assert.equal(settlement,undefined,'Maandafsluiting mag voorschotten niet automatisch aflossen');
assert.equal(context.u3ActualIncome('2026-07'),0);
assert.equal(context.u3ActualExpenses('2026-07'),125);

console.log('UPDATE3_ADMINISTRATION_OK');
