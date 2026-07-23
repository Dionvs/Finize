const assert=require('node:assert/strict');
const u4=require('../update4.js');

const state={
  meta:{schemaVersion:4},
  accountProfiles:[{id:'dion-ing',name:'Dion',iban:'nl01 ingb 0001',owner:'dion'}],
  recognitionRules:[{id:'old',text:'albert heijn',category:'Boodschappen',account:'dion',financialFor:'gezamenlijk'}],
  transactions:[{id:'legacy',date:'2026-07-01',account:'dion',financialFor:'gezamenlijk',owner:'gezamenlijk',amount:10}]
};
const migrated=u4.normalizeCore(state);
assert.equal(migrated.meta.schemaVersion,5);
assert.equal(migrated.accountProfiles[0].identifier,'NL01INGB0001');
assert.equal(migrated.transactions[0].accountOwner,'dion');
assert.equal(migrated.transactions[0].budgetOwner,'gezamenlijk');
assert.equal('account' in migrated.recognitionRules[0],false);
assert.equal('financialFor' in migrated.recognitionRules[0],false);
assert.equal(u4.validateCore(migrated).ok,true);

const rows=Array.from({length:450},(_,index)=>({index,text:'x'.repeat(5000)}));
const chunks=u4.chunkRows(rows,700000);
assert.ok(chunks.length>3);
assert.ok(chunks.every(chunk=>chunk.length<=200));
assert.equal(chunks.reduce((sum,chunk)=>sum+chunk.length,0),450);

const second=u4.normalizeCore(migrated);
assert.equal(second.accountProfiles.length,1);
assert.equal(second.recognitionRules.length,1);
console.log('UPDATE4_MIGRATION_STORAGE_OK');

