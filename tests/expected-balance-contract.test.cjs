const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeProviderBalances}=require('../src/import/enable-banking-adapter.mjs');
const {normalizeBankInput}=require('../src/import/bank-input-contract.mjs');
const {providerBalanceAnchor}=require('../src/core/provider-balances.mjs');
const scope={householdId:'synthetic',accountProfiles:[{id:'joint',accountOwner:'gezamenlijk'}]};
const snapshot={householdId:'synthetic',accountProfileId:'joint',account:{identificationHash:'synthetic-bank'},fetchedAt:'2026-11-01T20:16:44.499Z',balances:[{balance_type:'XPCD',name:'Expected balance',balance_amount:{amount:'2364.89',currency:'EUR'},reference_date:null,last_committed_transaction:null,last_change_date_time:'2026-11-01T20:16:43.891000Z'}]};
test('XPCD retains amount, provider evidence and expected classification; never becomes a booked anchor',()=>{
 const before=JSON.stringify(snapshot),rows=normalizeProviderBalances(snapshot,scope);
 assert.equal(rows[0].unusable,undefined);assert.equal(rows[0].facts.amountCents,236489);assert.equal(rows[0].facts.balanceType,'expected');
 assert.deepEqual(rows[0].provenance.payload,snapshot.balances[0]);assert.equal(rows[0].provenance.providerType,'XPCD');
 assert.equal(normalizeBankInput(rows[0],scope).disposition,'deferred');
 assert.equal(providerBalanceAnchor({bankBalanceObservations:rows},'joint','2026-11-01',scope),null);
 assert.equal(JSON.stringify(snapshot),before);
});
test('XPCD without a bank observation timestamp remains unusable',()=>{
 const input=structuredClone(snapshot);input.balances[0].last_change_date_time=null;
 assert.equal(normalizeProviderBalances(input,scope)[0].unusable,true);
});
