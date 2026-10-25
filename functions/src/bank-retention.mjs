const DAY = 86400000;
export const BANK_TTL_FIELD = 'finizeBankExpiresAt';
const time = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 - 7 * DAY ? value : null;
const sessionEnd = value => typeof value === 'string' ? time(Date.parse(value)) : null;
const baseKey = key => key.replace(/^account-[a-f0-9]{64}-/, '');
const temporaryKey = key => ['connection', 'sync-lock', 'bootstrap-candidate', 'bootstrap-lock'].includes(key) || /^(state|retired|bootstrap-retired|session-owner)-[a-f0-9]{64}$/.test(key);

// Deadlines depend on original validity, never on status reads or retry time.
export function bankMetadataExpiry(key, value, now) {
  key = baseKey(key);
  if (!temporaryKey(key)) return null;
  if (value === null) return time(now) === null ? null : now + DAY;
  if (key.startsWith('state-')) return time(value?.expiresAt) === null ? null : value.expiresAt + DAY;
  if (['sync-lock', 'bootstrap-lock'].includes(key)) return time(value?.expiresAt) === null ? null : value.expiresAt + DAY;
  if (['connection','bootstrap-candidate'].includes(key) && value?.retentionVersion !== 1) return null; // Preserve unmigrated legacy identity.
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
    if (!/^(?:(?:account-[a-f0-9]{64}-)?(?:connection|account-binding|connection-control|sync-lock|sync-status|retired-[a-f0-9]{64}|bootstrap-(?:candidate|identity|control|lock|promotion|retired-[a-f0-9]{64}))|state-[a-f0-9]{64}|session-owner-[a-f0-9]{64}|registry-control)$/.test(key)) throw new Error('invalid-bank-metadata-key');
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
    async listRetired(limit = 6, prefix = 'retired-') {
      if (!/^(?:account-[a-f0-9]{64}-)?(?:bootstrap-)?retired-$/.test(prefix)) throw new Error('invalid-bank-metadata-key');
      const snapshot = await collection.where('value.revokePending', '==', true).orderBy(FieldPath.documentId())
        .startAt(prefix).endAt(prefix+'\uf8ff').limit(limit).get();
      return snapshot.docs.map(doc => ({ key: doc.id, value: doc.data().value }));
    }
  };
  return store;
}
