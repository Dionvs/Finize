import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createBankMetadataStore } from '../functions/src/bank-retention.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8189') throw new Error('Deze test vereist uitsluitend de lokale Firestore-emulator op 127.0.0.1:8189.');
const installed = createRequire(process.env.FINIZE_BANK_DEPENDENCIES ? resolve(process.env.FINIZE_BANK_DEPENDENCIES, 'package.json') : new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = installed('firebase-admin/app');
const { getFirestore, Timestamp, FieldPath } = installed('firebase-admin/firestore');
const app = initializeApp({ projectId: 'demo-finize-bank-retention' }, randomUUID());
const db = getFirestore(app), clock = Date.parse('2026-10-23T12:00:00Z');
const store = createBankMetadataStore({ db, Timestamp, FieldPath, now: () => clock });
const ref = key => db.doc('finizeBankPrivate/ing/metadata/' + key);
const key = (prefix, id) => prefix + '-' + createHash('sha256').update(id).digest('hex');

test('native Firestore timestamps apply only to temporary bank documents', async () => {
  await store.set(key('state', 'emulator-state'), { expiresAt: clock + 600000, used: false });
  const stored = (await ref(key('state', 'emulator-state')).get()).data();
  assert(stored.finizeBankExpiresAt instanceof Timestamp);
  assert.equal(stored.finizeBankExpiresAt.toMillis(), clock + 600000 + 86400000);
  await store.set('account-binding', { accountHash: 'synthetic-binding' });
  assert.equal((await ref('account-binding').get()).data().finizeBankExpiresAt, undefined);
  await assert.rejects(store.set('../financial-record', {}), /invalid-bank-metadata-key/);
});

test('Firestore transaction abort keeps binding and connection unchanged', async () => {
  await store.set('connection', { synthetic: 'before' });
  await assert.rejects(store.transaction(async tx => {
    await tx.get('account-binding'); await tx.get('connection');
    tx.set('account-binding', { accountHash: 'should-not-commit' });
    tx.set('connection', { synthetic: 'should-not-commit' });
    throw new Error('synthetic-abort');
  }), /synthetic-abort/);
  assert.equal((await store.get('account-binding')).accountHash, 'synthetic-binding');
  assert.deepEqual(await store.get('connection'), { synthetic: 'before' });
});

test('concurrent native transactions retain every revocation barrier increment', async () => {
  await store.set('connection-control', { generation: 0 });
  await Promise.all(Array.from({ length: 5 }, () => store.transaction(async tx => {
    const current = await tx.get('connection-control');
    tx.set('connection-control', { generation: current.generation + 1 });
  })));
  assert.equal((await store.get('connection-control')).generation, 5);
  assert.equal((await ref('connection-control').get()).data().finizeBankExpiresAt, undefined);
});

test('pending-revocation query ignores cleared documents and respects the batch limit', async () => {
  for (let i = 0; i < 7; i++) await store.set(key('retired', 'session-' + i), { sessionId: 'synthetic-' + i, revokePending: true, validUntil: '2026-10-24T12:00:00Z' });
  await store.set(key('retired', 'cleared'), null);
  const pending = await store.listRetired(6);
  assert.equal(pending.length, 6);
  assert(pending.every(row => row.key.startsWith('retired-') && row.value.revokePending));
  await store.update(pending[0].key, old => ({ ...old, revokePending: false }));
  assert(!(await store.listRetired(20)).some(row => row.key === pending[0].key));
});

test.after(async () => { await db.terminate(); await deleteApp(app); });
