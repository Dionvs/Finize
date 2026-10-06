// Separate from CSV storage: append-only, account-scoped pre-migration originals.
export const MIGRATION_BACKUP_DB = 'finize-migration-backups';
const STORE = 'originals';
const bytes = text => new TextEncoder().encode(text);
export async function backupDigest(text, cryptoApi = globalThis.crypto) {
  const hash = await cryptoApi.subtle.digest('SHA-256', bytes(text));
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function createMigrationBackupStore({ indexedDB = globalThis.indexedDB, crypto = globalThis.crypto, now = () => new Date().toISOString() } = {}) {
  let database;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('IndexedDB is niet beschikbaar; migratie gestopt.'));
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open(MIGRATION_BACKUP_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Migratieback-upopslag is geblokkeerd.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
    }).catch(error => { database = undefined; throw error; });
    return database;
  }
  async function operation(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      let result;
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () => reject(transaction.error || request.error || new Error('Migratieback-uptransactie mislukt.'));
    });
  }
  async function verify(record, scope, expectedPayload) {
    if (!record || record.scope !== scope || record.id !== `${scope}:${record.sha256}` || record.migrationId !== 'finize-schema-v11' || record.storageVersion !== 1 || typeof record.payload !== 'string' || record.byteLength !== bytes(record.payload).length || record.sha256 !== await backupDigest(record.payload, crypto) || (expectedPayload !== undefined && record.payload !== expectedPayload)) {
      throw new Error('Migratieback-up is niet volledig teruggelezen; migratie gestopt.');
    }
    const envelope = JSON.parse(record.payload);
    const original = envelope.package2Original || envelope.package2CloudOriginal;
    if (!original?.state || original.fromVersion !== record.sourceSchema || record.targetSchema !== 11) throw new Error('Migratieback-upmetadata is ongeldig.');
    return record;
  }
  async function get(scope, id) {
    if (!scope || !id) throw new Error('Migratieback-upcontext ontbreekt.');
    return verify(await operation('readonly', store => store.get(id)), scope);
  }
  async function list(scope) {
    if (!scope) return [];
    const records = await operation('readonly', store => store.getAll());
    return Promise.all(records.filter(record => record.scope === scope).map(record => verify(record, scope)));
  }
  async function persist(scope, envelope, metadata) {
    if (!scope) throw new Error('Migratieback-upcontext ontbreekt.');
    const payload = JSON.stringify(envelope);
    const sha256 = await backupDigest(payload, crypto);
    const id = `${scope}:${sha256}`;
    const previous = await operation('readonly', store => store.get(id));
    if (previous) return { record: await verify(previous, scope, payload), created: false };
    const record = { ...metadata, id, scope, storageVersion: 1, migrationId: 'finize-schema-v11', targetSchema: 11, createdAt: now(), payload, sha256, byteLength: bytes(payload).length };
    try { await operation('readwrite', store => store.add(record)); }
    catch (error) { if (error?.name !== 'ConstraintError') throw error; } // Concurrent identical load: verify winner.
    return { record: await verify(await operation('readonly', store => store.get(id)), scope, payload), created: true };
  }
  return Object.freeze({ persist, get, list });
}

// No migration or deletion of historical localStorage backups.
export function readLegacyMigrationBackup(storage, key) {
  const text = key && storage.getItem(key);
  return text ? JSON.parse(text) : null;
}
