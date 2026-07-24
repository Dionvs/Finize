const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function assertMonthMutationAllowed');
const end=html.indexOf('function u3AssertMonthOpen',start);
assert.ok(start>=0&&end>start,'Centrale maandblokkade ontbreekt');
const state={monthRecords:{
  '2026-01':{status:'afgesloten'},
  '2026-02':{status:'correctie-nodig'},
  '2026-03':{status:'open'}
}};
const context={state,getSelectedMonth:()=> '2026-01'};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
const message='Deze maand is afgesloten. Heropen de maand of maak een correctie om financiële gegevens te wijzigen.';
assert.throws(()=>context.assertMonthMutationAllowed('2026-01'),error=>error.message===message);
assert.throws(()=>context.assertMonthMutationAllowed('2026-02'),error=>error.message===message);
assert.equal(context.assertMonthMutationAllowed('2026-03'),true);
assert.equal(context.assertMonthMutationAllowed('2026-01','reopen'),true);
assert.equal(context.assertMonthMutationAllowed('2026-01','correction'),true);
assert.equal(context.assertMonthMutationAllowed('2026-01','late-import'),true);
assert.match(html,/lateImportAllowed/);
assert.match(html,/savings:\(snapshot\.savingsGoalLedger/);
assert.match(html,/advances:\(snapshot\.advanceLedger/);
console.log('UPDATE4_7_CLOSED_MONTH_OK');
