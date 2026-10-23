import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { stageProviderSnapshot, applyProviderObservations, providerAmountCents } from '../src/import/enable-banking-adapter.mjs';
import { ensureImportBankSources, selectBankTransactions } from '../src/core/bank-sources.mjs';
import { selectAccountBalance } from '../src/core/balance-checkpoints.mjs';
import { selectDailyLiquidity, projectDailyLiquidity } from '../src/core/daily-liquidity.mjs';
import { sumTransactionEffects } from '../src/core/transaction-engine.mjs';
import { classifyCsvDuplicate } from '../src/import/import-identity.mjs';
import { rebaseLocalChanges } from '../src/storage/sync-protocol.mjs';
const require = createRequire(import.meta.url), u = require('../src/import/update4-runtime.cjs');
const { state: initial } = require('./helpers/package5-fixture.cjs');
export function fixture() {
  const state = initial();
  state.accountProfiles = [{ id: 'joint', accountOwner: 'gezamenlijk', identifier: 'NL20INGB0001234567', name: 'ING test', accountType: 'payment', status: 'active' }];
  state.balanceCheckpoints = [{ version: 1, id: 'opening', operationId: 'opening', householdId: 'test-house', accountProfileId: 'joint',
    amountCents: 100000, currency: 'EUR', asOfDate: '2026-10-20', boundary: 'end-of-bank-day', source: 'manual-observation',
    createdAt: '2026-10-20T20:00:00Z', actor: 'synthetic', note: '', revision: 1, supersedesId: null }];
  const snapshot = { version: 1, runId: 'run-one', householdId: 'test-house', accountProfileId: 'joint', fetchedAt: '2026-10-23T12:00:00Z',
    account: { iban: state.accountProfiles[0].identifier, identificationHash: 'synthetic-hash' },
    fromDate: '2026-10-21', toDate: '2026-10-23', complete: true, balances: [],
    transactions: [{ entry_reference: 'entry-one', status: 'BOOK', booking_date: '2026-10-23', value_date: '2026-10-23',
      transaction_amount: { amount: '10.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Boodschappen'] }] };
  const scope = { householdId: 'test-house', accountProfiles: state.accountProfiles };
  return { state, snapshot, scope };
}
function stage(f, previous, imports = []) {
  const batch = stageProviderSnapshot(f.snapshot, f.state, previous, imports, u.classifyOriginal);
  const summary = u.compactSummary(batch); f.state.importSummaries = [...f.state.importSummaries.filter(row => row.id !== batch.id), summary];
  ensureImportBankSources(f.state, batch); applyProviderObservations(f.state, batch);
  return batch;
}
const balance = f => selectAccountBalance(f.state, { accountProfileId: 'joint', toDate: '2026-10-23', scope: f.scope });

test('unapproved booked movement immediately changes P1 and P2, but has no financial effect', () => {
  const f = fixture(), batch = stage(f);
  assert.equal(balance(f).balanceCents, 99000);
  assert.equal(selectBankTransactions(f.state).length, 1);
  assert.equal(sumTransactionEffects(f.state, 'realExpense', { month: '2026-10' }), 0);
  assert.equal(batch.rows[0].source, 'bank-api'); assert.equal(batch.originalCsv, undefined);
  const projection = selectDailyLiquidity(f.state, { accountProfileId: 'joint', asOfDate: '2026-10-23', endDate: '2026-10-25', scope: f.scope });
  assert.equal(projection.opening.balanceCents, 99000);
});
test('shared approval engine posts financial effect once and never repeats physical movement', () => {
  const f = fixture(), batch = stage(f), row = batch.rows[0];
  Object.assign(row.processing, { category: 'Kleding', budgetItemId: 'food', budgetOwner: 'gezamenlijk', advanceMode: 'none' });
  u.markExplicitlyApproved(row);
  const plan = u.planImportEffects(batch, f.state); assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  u.applyImportPlan(f.state, plan);
  assert.equal(balance(f).balanceCents, 99000);
  assert.equal(sumTransactionEffects(f.state, 'realExpense', { month: '2026-10' }), 10);
  const next = stage(f, batch, [batch]);
  assert.equal(next.rows.length, 1); assert.equal(next.rows[0].approvalSource, 'manual');
  assert.equal(balance(f).balanceCents, 99000);
});
test('repeated snapshots preserve approval, absent rows and source identity; changed facts conflict', () => {
  const f = fixture(), batch = stage(f);
  const second = stage(f, batch, [batch]); assert.equal(second.rows.length, 1);
  f.snapshot.transactions = []; assert.equal(stage(f, second, [second]).rows.length, 1);
  f.snapshot.transactions = [structuredClone(batch.rows[0].providerInput.provenance.payload)];
  f.snapshot.transactions[0].transaction_amount.amount = '11.00';
  assert.throws(() => stage(f, second, [second]), { code: 'provider-identity-conflict' });
  assert.equal(balance(f).balanceCents, 99000);
});
test('current timestamp balance anchors P1 without adding already included transactions', () => {
  const f = fixture(); f.snapshot.balances = [{ balance_type: 'ITBD', balance_amount: { amount: '990.00', currency: 'EUR' }, last_change_date_time: '2026-10-23T11:59:00Z' }];
  stage(f); const value = balance(f);
  assert.equal(value.balanceCents, 99000); assert.equal(value.boundary, 'timestamp');
  assert.equal(value.checkpoint.source, 'provider-observation'); assert.equal(f.state.balanceCheckpoints.length, 1);
  assert.equal(value.mutations.length, 0);
});
test('unknown timestamp and available balances do not become end-of-day checkpoints', () => {
  const f = fixture(); f.snapshot.balances = [{ balance_type: 'ITBD', balance_amount: { amount: '1.00', currency: 'EUR' } },
    { balance_type: 'ITAV', balance_amount: { amount: '2.00', currency: 'EUR' }, last_change_date_time: '2026-10-23T11:59:00Z' }];
  stage(f); assert.equal(balance(f).balanceCents, 99000); assert.equal(balance(f).checkpoint.id, 'opening');
});
test('CSV/API overlap without shared identity remains a question and never double counts', () => {
  const f = fixture();
  const csv = u.createImportDraft({ id: 'csv-real', text: 'Datum;Omschrijving;Rekening;Bedrag\n2026-10-23;Boodschappen;NL20INGB0001234567;-10.00', profiles: f.state.accountProfiles, entryOwner: 'gezamenlijk', today: '2026-10-23' });
  f.state.importSummaries.push(u.compactSummary(csv)); ensureImportBankSources(f.state, csv);
  const batch = stage(f, null, [csv]);
  assert(batch.rows[0].possibleDuplicate); assert.equal(batch.rows[0].duplicate, false);
  assert.equal(selectBankTransactions(f.state).length, 1); assert.equal(balance(f).balanceCents, 99000);
});
test('reverse order: CSV arriving after API raises overlap without inventing a shared identity', () => {
  const f = fixture(), batch = stage(f);
  const csv = u.createImportDraft({ id: 'later-csv', text: 'Datum;Omschrijving;Rekening;Bedrag\n2026-10-23;Boodschappen;NL20INGB0001234567;-10.00',
    profiles: f.state.accountProfiles, entryOwner: 'gezamenlijk', existingImports: [batch], today: '2026-10-23' });
  assert(csv.rows[0].possibleDuplicate);
  f.state.importSummaries.push(u.compactSummary(csv)); ensureImportBankSources(f.state, csv);
  assert.equal(selectBankTransactions(f.state).length, 1);
  const row = structuredClone(batch.rows[0]); row.bankOriginal.rawCells = ['actual csv cells'];
  const result = classifyCsvDuplicate(row, { accountProfileId: 'joint', accountOwner: 'gezamenlijk' }, [batch]);
  assert(result.possibleDuplicate || result.duplicate);
});
test('same proven identity keeps both source proofs and one physical source', () => {
  const f = fixture(), first = stage(f);
  const csv = structuredClone(first); csv.id = 'proved-csv'; csv.channel = 'csv';
  csv.rows[0].id = 'csv-row'; csv.rows[0].source = 'csv'; delete csv.rows[0].bankSourceId;
  // The shared bank identity must be explicit, never inferred from a reference string.
  const fresh = fixture(); fresh.state.importSummaries.push(u.compactSummary(csv)); ensureImportBankSources(fresh.state, csv);
  const api = stage(fresh, null, [csv]); assert.equal(api.rows[0].duplicate, true);
  assert.equal(selectBankTransactions(fresh.state).length, 1);
  assert.equal(fresh.state.transactions[0].importReferences.length, 2);
});
test('missing identity is retained as original evidence, never posted, and exact cents reject rounding', () => {
  const f = fixture(); delete f.snapshot.transactions[0].entry_reference;
  const batch = stage(f); assert.equal(batch.rows[0].sourceIdentityProof, null);
  assert.equal(batch.rows[0].importError.code, 'unproven-provider-identity');
  assert.equal(selectBankTransactions(f.state).length, 0);
  assert.throws(() => providerAmountCents('1.001')); assert.equal(providerAmountCents('0.01'), 1);
});
test('provider observations survive old-client omission and conflict on altered evidence', () => {
  const f=fixture();f.snapshot.balances=[{balance_type:'CLBD',reference_date:'2026-10-22',balance_amount:{amount:'1000.00',currency:'EUR'}}];
  const batch=stage(f), base=structuredClone(f.state), local=structuredClone(base);
  delete local.bankBalanceObservations;delete local.bankCoverage;
  const merged=rebaseLocalChanges(base,local,base);
  assert.deepEqual(merged.bankBalanceObservations,base.bankBalanceObservations);
  assert.deepEqual(merged.bankCoverage,base.bankCoverage);
  const wrong=structuredClone(base);wrong.bankBalanceObservations[0].facts.amountCents++;
  assert.throws(()=>rebaseLocalChanges(base,wrong,base));
  const envelope=u.buildCloudImportEnvelope(batch), restored=u.assembleCloudImport(envelope.header,envelope.chunks,batch.id);
  assert.equal(restored.channel,'bank-api');assert.deepEqual(restored.rows,batch.rows);
  assert.deepEqual(restored.balanceObservations,batch.balanceObservations);
});
test('P3 month graph uses the provider observation, even without a manual checkpoint', () => {
  for(const manual of [true,false]) {
    const f=fixture();if(!manual)f.state.balanceCheckpoints=[];
    f.snapshot.balances=[{balance_type:'ITBD',balance_amount:{amount:'990.00',currency:'EUR'},last_change_date_time:'2026-10-23T11:59:00Z'}];
    stage(f);
    const p=selectDailyLiquidity(f.state,{accountProfileId:'joint',asOfDate:'2026-10-23',startDate:'2026-10-01',endDate:'2026-10-25',scope:f.scope});
    assert.equal(p.currentBalance.balanceCents,99000);
    assert.equal(p.days.find(row=>row.date==='2026-10-23').cashBalanceCents,99000);
  }
});
test('intraday observation retains still-planned same-day cash obligations', () => {
  const p=projectDailyLiquidity({accountProfileId:'joint',asOfDate:'2026-10-23',opening:{balanceCents:99000,boundary:'timestamp'},
    horizon:{endDate:'2026-10-24'},bufferCents:0,reasons:[],reservations:[],savingsPlans:[],
    events:[{id:'planned-today',accountProfileId:'joint',date:'2026-10-23',amountCents:-20000,status:'planned'}]});
  assert.equal(p.days[0].expectedBalanceCents,79000);
  const withObservation=projectDailyLiquidity({accountProfileId:'joint',asOfDate:'2026-10-22',opening:{balanceCents:100000,boundary:'end-of-bank-day'},
    horizon:{endDate:'2026-10-24'},bufferCents:0,reasons:[],reservations:[],savingsPlans:[],
    observations:[{id:'provider-now',asOfDate:'2026-10-23',boundary:'timestamp',amountCents:99000}],
    events:[{id:'bank',accountProfileId:'joint',date:'2026-10-23',amountCents:-1000,status:'actual'},
      {id:'planned-today',accountProfileId:'joint',date:'2026-10-23',amountCents:-20000,status:'planned'}]});
  assert.equal(withObservation.days.find(row=>row.date==='2026-10-23').expectedBalanceCents,79000);
});
