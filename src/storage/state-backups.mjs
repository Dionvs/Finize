import { backupDigest } from './migration-backups.mjs';

// Ordinary last-good snapshots. Never shares or deletes migration originals.
export const STATE_BACKUP_DB = 'finize-state-backups';
export function createStateBackupStore({ indexedDB = globalThis.indexedDB, crypto = globalThis.crypto, now = () => new Date().toISOString() } = {}) {
  let opening;
  async function operation(mode, action) {
    if (!indexedDB) throw new Error('IndexedDB is niet beschikbaar; noodback-up niet bevestigd.');
    opening ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(STATE_BACKUP_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('scope', 'scope');
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Noodback-upopslag is geblokkeerd.'));
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = undefined; }; resolve(db); };
    }).catch(error => { opening = undefined; throw error; });
    const db = await opening;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', mode), request = action(tx.objectStore('snapshots'));
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || request.error || new Error('Noodback-uptransactie mislukt.'));
    });
  }
  async function verify(record, scope, expected) {
    if (!record || record.scope !== scope || record.type !== 'last-good' || record.storageVersion !== 1 || typeof record.payload !== 'string'
      || record.byteLength !== new TextEncoder().encode(record.payload).length || record.sha256 !== await backupDigest(record.payload, crypto)
      || (expected !== undefined && record.payload !== expected)) throw new Error('Noodback-upintegriteit klopt niet; vervanging geblokkeerd.');
    const envelope = JSON.parse(record.payload);
    if (!envelope.state || Number(envelope.state.meta?.schemaVersion || 0) !== record.schema) throw new Error('Noodback-upmetadata klopt niet.');
    return record;
  }
  async function persist(scope, envelope, metadata = {}) {
    if (!scope) throw new Error('Noodback-upcontext ontbreekt.');
    const payload = JSON.stringify(envelope), sha256 = await backupDigest(payload, crypto), createdAt = now();
    const record = { ...metadata, scope, type: 'last-good', storageVersion: 1, createdAt, schema: Number(envelope.state?.meta?.schemaVersion || 0),
      revision: envelope.state?.meta?.revision ?? null, payload, byteLength: new TextEncoder().encode(payload).length, sha256,
      id: `${scope}:${createdAt}:${sha256}` };
    const previous = await operation('readonly', store => store.get(record.id));
    if (!previous) { try { await operation('readwrite', store => store.add(record)); } catch (error) { if (error?.name !== 'ConstraintError') throw error; } }
    return verify(await operation('readonly', store => store.get(record.id)), scope, payload);
  }
  async function latest(scope) {
    if (!scope) return null;
    const records = await operation('readonly', store => store.index('scope').getAll(scope));
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return records.length ? verify(records[0], scope) : null;
  }
  return Object.freeze({ persist, latest });
}

export function readLegacyStateBackup(storage, key) {
  const raw = key && storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
