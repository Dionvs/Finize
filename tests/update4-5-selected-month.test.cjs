const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function extract(name){
  const start=html.indexOf(`function ${name}`);
  assert.ok(start>=0,`${name} ontbreekt`);
  const brace=html.indexOf('{',start);let depth=0;
  for(let index=brace;index<html.length;index++){
    if(html[index]==='{')depth++;
    if(html[index]==='}'&&--depth===0)return html.slice(start,index+1);
  }
}
const state={spaardoelGeschiedenis:{},monthRecords:{}};
const context={
  state,Date,Number,String,Math,TODAY:new Date('2026-07-24T12:00:00'),
  getSelectedMonth:()=> '2026-07',
  u2HistoryKey:(owner,month)=>`${owner}:${month}`,
  u2IsProcessed:(owner,month)=>!!state.spaardoelGeschiedenis[`${owner}:${month}`]
};
vm.createContext(context);
vm.runInContext(extract('monthsRemaining'),context);
vm.runInContext(extract('getCalculationDateForSelectedMonth'),context);

const july=context.getCalculationDateForSelectedMonth('2026-07','gezamenlijk');
assert.equal(july.toISOString().slice(0,10),'2026-07-01');
assert.equal(context.monthsRemaining('2026-12-31',july),6);
state.spaardoelGeschiedenis['gezamenlijk:2026-07']={maand:'2026-07'};
const august=context.getCalculationDateForSelectedMonth('2026-07','gezamenlijk');
assert.equal(august.toISOString().slice(0,10),'2026-08-01');
assert.equal(context.monthsRemaining('2026-12-31',august),5);
delete state.spaardoelGeschiedenis['gezamenlijk:2026-07'];
assert.equal(context.monthsRemaining('2026-11-30',context.getCalculationDateForSelectedMonth('2026-11','gezamenlijk')),1);
state.monthRecords['2026-11']={status:'afgesloten'};
assert.equal(context.monthsRemaining('2026-11-30',context.getCalculationDateForSelectedMonth('2026-11','gezamenlijk')),0);
assert.equal(context.monthsRemaining('',july),null);
console.log('UPDATE4_5_SELECTED_MONTH_OK');
