const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const u4=require('../update4.js');

const html=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=html.indexOf('function normalizedTransactionType');
const end=html.indexOf('function sumTransactions',start);
const context={Number,String,Math,round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);

const transactions=[
  {kind:'inkomen',transactionType:'salaris',amount:2450},
  {kind:'inkomen',transactionType:'salaris',amount:3010},
  {kind:'uitgave',amount:180},
  {kind:'uitgave',amount:50},
  {kind:'uitgave',amount:80},
  {kind:'uitgave',transactionType:'terugbetaling',amount:20},
  {kind:'interne-overboeking',transactionType:'interne-overboeking',amount:500,accountDelta:-500},
  {kind:'interne-overboeking',transactionType:'sparen',amount:250},
  {kind:'uitgave',amount:75,processing:{include:false}}
];
assert.equal(transactions.reduce((sum,tx)=>sum+context.getTransactionExpenseImpact(tx),0),310);

const incomeShare=2450/(2450+3010);
assert.equal(Math.round(Math.max(.40,incomeShare)*10000)/100,44.87);
assert.equal(Math.max(.40,.30),.40);
assert.equal(1-Math.max(.40,.30),.60);

const retained=u4.normalizeCore({
  meta:{schemaVersion:5},transactions:[{id:'tx-1',date:'2026-01-01',amount:10}],
  importSummaries:[{id:'import-1',status:'verwerkt'}],
  spaardoelen:{gezamenlijk:[{id:'goal-1',algespaard:100}],dion:[],dara:[]},
  savingsGoalLedger:[],advanceLedger:[{id:'advance-1'}],monthRecords:{'2026-01':{status:'afgesloten',closureHistory:[]}}
});
assert.equal(retained.meta.schemaVersion,9);
assert.equal(retained.transactions.length,1);
assert.equal(retained.importSummaries.length,1);
assert.equal(retained.spaardoelen.gezamenlijk.length,1);
assert.equal(retained.advanceLedger.length,1);
assert.ok(retained.monthRecords['2026-01']);
console.log('UPDATE4_STABILIZATION_REGRESSION_OK');
