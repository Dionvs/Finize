import { backupDigest } from './migration-backups.mjs';

export const CLOUD_STATE_FORMAT = 'finize-json-chunks-v1';
export const CLOUD_CHUNK_BYTES = 240000;
const byteLength = value => new TextEncoder().encode(value).length;
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const fail = message => { throw new Error(`Cloudstate-integriteit: ${message}`); };

export async function encodeCloudState(state, generation, crypto = globalThis.crypto) {
  if (state?.meta?.schemaVersion !== 11 || !/^[a-zA-Z0-9_-]{1,160}$/.test(generation)) fail('schema/generation ongeldig');
  const payload = JSON.stringify(state), parts = [];
  let part = '', size = 0;
  // Iterate Unicode code points so a chunk never separates a surrogate pair.
  for (const char of payload) {
    const point = char.codePointAt(0), length = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (size + length > CLOUD_CHUNK_BYTES) { parts.push(part); part = ''; size = 0; }
    part += char; size += length;
  }
  if (part) parts.push(part);
  let cumulativeBytes = 0;
  const chunks = [];
  for (let sequence = 0; sequence < parts.length; sequence++) {
    const payload = parts[sequence], length = byteLength(payload);
    cumulativeBytes += length;
    chunks.push({ generation, sequence, chunkCount: parts.length, byteLength: length, cumulativeBytes, sha256: await backupDigest(payload, crypto), payload });
  }
  return { descriptor: { stateFormat: CLOUD_STATE_FORMAT, schema: 11, generation, chunkCount: chunks.length, totalByteLength: byteLength(payload), totalSha256: await backupDigest(payload, crypto), stateMeta: structuredClone(state.meta), complete: false }, chunks };
}

export async function decodeCloudState(manifest, descriptor, chunks, crypto = globalThis.crypto) {
  const id = manifest.activeGeneration;
  if (manifest.stateFormat !== CLOUD_STATE_FORMAT || !descriptor?.complete || descriptor.generation !== id || descriptor.schema !== 11
    || descriptor.stateFormat !== CLOUD_STATE_FORMAT || !Number.isSafeInteger(manifest.chunkCount) || manifest.chunkCount < 1
    || manifest.chunkCount !== descriptor.chunkCount || chunks.length !== descriptor.chunkCount
    || manifest.totalSha256 !== descriptor.totalSha256 || manifest.totalByteLength !== descriptor.totalByteLength
    || canonical(manifest.stateMeta) !== canonical(descriptor.stateMeta)) fail('generation/manifest niet compleet of onjuist');
  let total = 0;
  for (let sequence = 0; sequence < chunks.length; sequence++) {
    const chunk = chunks[sequence];
    if (!chunk || chunk.generation !== id || chunk.sequence !== sequence || chunk.chunkCount !== chunks.length || typeof chunk.payload !== 'string'
      || chunk.byteLength !== byteLength(chunk.payload) || chunk.byteLength > CLOUD_CHUNK_BYTES || chunk.sha256 !== await backupDigest(chunk.payload, crypto)) fail(`deel ${sequence} ontbreekt of is corrupt`);
    total += chunk.byteLength;
    if (chunk.cumulativeBytes !== total) fail(`deel ${sequence} volgorde/lengte ongeldig`);
  }
  const payload = chunks.map(chunk => chunk.payload).join('');
  if (total !== manifest.totalByteLength || await backupDigest(payload, crypto) !== manifest.totalSha256) fail('totale checksum/lengte ongeldig');
  const state = JSON.parse(payload);
  if (state?.meta?.schemaVersion !== 11 || canonical(state.meta) !== canonical(manifest.stateMeta)) fail('state/schema/metadata ongeldig');
  return state;
}

export function cloudStateManifest(descriptor, { syncVersion, commitId, updatedAt, updatedBy }) {
  const { complete, generation, ...metadata } = descriptor;
  if (!complete) fail('incomplete generation kan niet worden geactiveerd');
  return { ...metadata, activeGeneration: generation, app: 'finize', revision: Number(descriptor.stateMeta.revision) || 0, baseVersion: syncVersion - 1, syncVersion, commitId, updatedAt, updatedBy };
}

// Firebase SDK is injected; mocks exercise the same orchestration as production.
export function createChunkedCloudStore(firestore, db, currentRef) {
  const currentPath = typeof currentRef === 'string' ? currentRef : currentRef.path;
  const generationRef = id => firestore.doc(db, `${currentPath}/generations/${id}`);
  const chunkRef = (id, sequence) => firestore.doc(db, `${currentPath}/generations/${id}/chunks/${sequence}`);
  const read = ref => (firestore.getDocFromServer || firestore.getDoc)(ref);
  async function hydrate(documentData) {
    if (!documentData?.stateFormat) return documentData;
    if (documentData.stateFormat !== CLOUD_STATE_FORMAT) fail('onbekend opslagformaat');
    const descriptorSnapshot = await read(generationRef(documentData.activeGeneration));
    if (!descriptorSnapshot.exists()) fail('generation ontbreekt');
    const descriptor = descriptorSnapshot.data();
    if (!Number.isSafeInteger(descriptor.chunkCount) || descriptor.chunkCount < 1 || descriptor.chunkCount > 10000) fail('deelcount ongeldig');
    const chunks = [];
    for (let sequence = 0; sequence < descriptor.chunkCount; sequence++) {
      const snapshot = await read(chunkRef(documentData.activeGeneration, sequence));
      chunks.push(snapshot.exists() ? snapshot.data() : null);
    }
    return { ...documentData, state: await decodeCloudState(documentData, descriptor, chunks) };
  }
  async function prepare(state, generation) {
    const encoded = await encodeCloudState(state, generation);
    await firestore.setDoc(generationRef(generation), encoded.descriptor);
    for (const chunk of encoded.chunks) await firestore.setDoc(chunkRef(generation, chunk.sequence), chunk);
    // Verify every server-stored byte before sealing. No current write occurs here.
    const complete = { ...encoded.descriptor, complete: true };
    const manifest = cloudStateManifest(complete, { syncVersion: 0, commitId: generation, updatedAt: '', updatedBy: '' });
    const persisted = [];
    for (const chunk of encoded.chunks) {
      const snapshot = await read(chunkRef(generation, chunk.sequence));
      persisted.push(snapshot.exists() ? snapshot.data() : null);
    }
    const storedDescriptor = await read(generationRef(generation));
    if (!storedDescriptor.exists() || canonical({ ...storedDescriptor.data(), stateMeta: canonical(storedDescriptor.data().stateMeta) }) !== canonical({ ...encoded.descriptor, stateMeta: canonical(encoded.descriptor.stateMeta) })) fail('generationdescriptor gewijzigd');
    await decodeCloudState(manifest, complete, persisted);
    await firestore.updateDoc(generationRef(generation), { complete: true });
    const sealed = await read(generationRef(generation));
    await decodeCloudState(manifest, sealed.data(), persisted);
    return sealed.data();
  }
  return Object.freeze({ hydrate, prepare, generationRef });
}
