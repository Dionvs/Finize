const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=require('./helpers/runtime-source.cjs');
const start=html.indexOf('function u3DeactivateClosingEffects');
const end=html.indexOf('function u3CloseMonth',start);
assert.ok(start>=0&&end>start,'Afsluiteffectenfunctie ontbreekt');
const state={
  reserveLedger:[{id:'r1',sourceClosingId:'close-1',status:'actief'},{id:'r2',sourceClosingId:'close-2',status:'actief'}],
  internalTransfers:[{id:'t1',closureId:'close-1',status:'uitgevoerd'}],
  monthCorrections:[{id:'c1',sourceClosingId:'close-1',status:'actief'}],
  savingsGoalLedger:[{id:'s1',sourceClosingId:'close-1',status:'gepland',active:true}]
};
const context={state,Date,u2ReconcileSavingsGoals:()=>{}};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
context.u3DeactivateClosingEffects('close-1');
assert.equal(state.reserveLedger[0].status,'vervallen');
assert.equal(state.reserveLedger[1].status,'actief');
assert.equal(state.internalTransfers[0].status,'vervallen');
assert.equal(state.monthCorrections[0].status,'vervallen');
assert.equal(state.savingsGoalLedger[0].status,'teruggedraaid');
assert.equal(state.savingsGoalLedger[0].active,false);
assert.match(html,/supersedesClosingId/);
assert.match(html,/sourceClosingId/);
console.log('UPDATE4_6_CLOSING_OK');
