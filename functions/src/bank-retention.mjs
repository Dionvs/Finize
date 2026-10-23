const DAY = 86400000;
export const BANK_TTL_FIELD = 'finizeBankExpiresAt';
const time = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 - 7 * DAY ? value : null;
const sessionEnd = value => typeof value === 'string' ? time(Date.parse(value)) : null;
const temporaryKey = key => key === 'connection' || key === 'sync-lock' || /^(state|retired)-[a-f0-9]{64}$/.test(key);

// Deadlines depend on original validity, never on status reads or retry time.
export function bankMetadataExpiry(key, value, now) {
  if (!temporaryKey(key)) return null;
  if (value === null) return time(now) === null ? null : now + DAY;
  if (key.startsWith('state-')) return time(value?.expiresAt) === null ? null : value.expiresAt + DAY;
  if (key === 'sync-lock') return time(value?.expiresAt) === null ? null : value.expiresAt + DAY;
  if (key === 'connection' && value?.retentionVersion !== 1) return null; // Preserve unmigrated legacy identity.
  const end = sessionEnd(value?.validUntil);
  return end === null ? null : end + 7 * DAY;
}

export function bankMetadataDocument(key, value, { now, timestamp }) {
  const expiresAt = bankMetadataExpiry(key, value, now);
  return { value, ...(expiresAt === null ? {} : { [BANK_TTL_FIELD]: timestamp(expiresAt) }) };
}

// Native Firestore operations. No delete permission, scheduler, or financial path.
export function createBankMetadataStore({ db, Timestamp, FieldPath, now = Date.now }) {
  const collection = db.collection('finizeBankPrivate/ing/metadata');
  const ref = key => {
    if (!/^(?:connection|account-binding|connection-control|sync-lock|(?:state|retired)-[a-f0-9]{64})$/.test(key)) throw new Error('invalid-bank-metadata-key');
    return collection.doc(key);
  };
  const document = (key, value) => bankMetadataDocument(key, value, { now: now(), timestamp: value => Timestamp.fromMillis(value) });
  const store = {
    async get(key) { return (await ref(key).get()).data()?.value ?? null; },
    async set(key, value) { await ref(key).set(document(key, value)); },
    async transaction(action) {
      return db.runTransaction(tx => action({
        get: async key => (await tx.get(ref(key))).data()?.value ?? null,
        set: (key, value) => tx.set(ref(key), document(key, value))
      }));
    },
    async update(key, updater) {
      return store.transaction(async tx => {
        const value = updater(await tx.get(key));
        tx.set(key, value);
        return value;
      });
    },
    async listRetired(limit = 6) {
      const snapshot = await collection.where('value.revokePending', '==', true).orderBy(FieldPath.documentId())
        .startAt('retired-').endAt('retired-\uf8ff').limit(limit).get();
      return snapshot.docs.map(doc => ({ key: doc.id, value: doc.data().value }));
    }
  };
  return store;
}
