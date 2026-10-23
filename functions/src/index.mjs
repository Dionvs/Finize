import { onRequest } from 'firebase-functions/v2/https';
import { onInit } from 'firebase-functions/v2/core';
import { defineSecret, defineString, defineBoolean } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
import { decodeCloudState } from '../shared/cloud-chunks.mjs';
import { createBankService, createProviderClient, checkProviderConfiguration, failure } from './enable-banking.mjs';
import { createBankMetadataStore } from './bank-retention.mjs';

initializeApp();
const db = getFirestore(), auth = getAuth();
const privateKey = defineSecret('ENABLE_BANKING_PRIVATE_KEY');
// Fixed runtime identity: an environment parameter must not select a broader account.
const serviceAccount = 'finize-bank@financien-7dd43.iam.gserviceaccount.com';
const enabled = defineBoolean('ENABLE_BANKING_ENABLED', { default: false });
const verifyProvider = defineBoolean('ENABLE_BANKING_VERIFY_CONFIGURATION', { default: false });
const parameters = Object.fromEntries(['APP_ID', 'UID', 'EMAIL', 'HOUSEHOLD_ID', 'ACCOUNT_PROFILE_ID', 'IBAN', 'ACCOUNT_HASH', 'ASPSP_NAME', 'REDIRECT_URL']
  .map(name => [name, defineString('ENABLE_BANKING_' + name, { default: '' })]));
const origin = 'https://dionvs.github.io';
const returnUrl = 'https://dionvs.github.io/Finize/?banklink=complete';
onInit(async () => {
  if (!verifyProvider.value()) return;
  try {
    const config = { applicationId: parameters.APP_ID.value(), redirectUrl: parameters.REDIRECT_URL.value(), aspspName: parameters.ASPSP_NAME.value() };
    const provider = createProviderClient({ applicationId: config.applicationId, privateKey: () => privateKey.value() });
    const result = await checkProviderConfiguration({ config, provider });
    console.info(JSON.stringify({ event: 'finize-bank-provider-configuration', ...result }));
  } catch {
    console.error(JSON.stringify({ event: 'finize-bank-provider-configuration', applicationVerified: false }));
    throw new Error('bank-provider-configuration-unavailable');
  }
});
const store = createBankMetadataStore({ db, Timestamp, FieldPath });
async function readProfile(householdId, profileId) {
  const current = db.doc('households/' + householdId + '/budgetState/current');
  const first = await current.get(), pointer = first.data();
  if (!pointer) throw failure('household-not-found', 403);
  let state = pointer.state;
  if (pointer.stateFormat === 'finize-json-chunks-v1') {
    const generation = current.collection('generations').doc(pointer.activeGeneration);
    const descriptor = (await generation.get()).data();
    if (!Number.isSafeInteger(descriptor?.chunkCount) || descriptor.chunkCount < 1 || descriptor.chunkCount > 10000) throw failure('storage-unavailable', 503);
    const chunks = await generation.collection('chunks').get();
    state = await decodeCloudState(pointer, descriptor, chunks.docs.map(doc => doc.data()).sort((a, b) => a.sequence - b.sequence));
  } else if (pointer.stateFormat) throw failure('storage-version-unsupported', 503);
  if ((await current.get()).updateTime?.toMillis() !== first.updateTime?.toMillis()) throw failure('storage-changed', 409);
  const matches = state?.accountProfiles?.filter(row => row.id === profileId) || [];
  return matches.length === 1 ? matches[0] : null;
}

export const enableBanking = onRequest({
  invoker: 'public', serviceAccount, region: 'europe-west4', minInstances: 0, maxInstances: 1, concurrency: 8,
  memory: '256MiB', timeoutSeconds: 180, secrets: [privateKey]
}, async (req, res) => {
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer').set('X-Content-Type-Options', 'nosniff');
  const callback = req.path === '/callback';
  if (!callback) {
    if (req.get('Origin') !== origin) return res.status(403).json({ error: 'forbidden-origin' });
    res.set('Access-Control-Allow-Origin', origin).set('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      .set('Access-Control-Allow-Methods', 'POST, OPTIONS').status(204).end();
    if (req.method !== 'POST' || !req.is('application/json')) return res.status(405).json({ error: 'unsupported-request' });
  } else if (req.method !== 'GET') return res.status(405).end();
  try {
    const values = Object.fromEntries(Object.entries(parameters).map(([name, parameter]) => [name, parameter.value()]));
    const config = { enabled: enabled.value(), applicationId: values.APP_ID, uid: values.UID, email: values.EMAIL,
      householdId: values.HOUSEHOLD_ID, accountProfileId: values.ACCOUNT_PROFILE_ID, iban: values.IBAN,
      accountHash: values.ACCOUNT_HASH, aspspName: values.ASPSP_NAME, redirectUrl: values.REDIRECT_URL };
    if (JSON.stringify(req.body || {}).length > 16384) throw failure('request-too-large', 413);
    const provider = createProviderClient({ applicationId: config.applicationId, privateKey: () => privateKey.value() });
    const service = createBankService({ config, store, provider, readProfile,
      verifyToken: token => auth.verifyIdToken(token, true).catch(() => { throw failure('invalid-token', 401); }),
      verifyIdentity: async uid => { const user = await auth.getUser(uid); return !user.disabled && user.emailVerified && user.email?.toLowerCase() === config.email.toLowerCase(); },
      readAssignment: async email => email ? (await db.doc('accountLinks/' + email.trim().toLowerCase()).get()).data() : null });
    if (callback) {
      await service.callback({ state: req.query.state, code: req.query.code, error: req.query.error });
      return res.redirect(303, returnUrl);
    }
    const token = /^Bearer (.+)$/.exec(req.get('Authorization') || '')?.[1];
    if (!token) throw failure('unauthenticated', 401);
    const body = req.body || {};
    const routes = {
      '/auth/start': () => service.start(token, body.accountProfileId),
      '/status': () => service.status(token, body.accountProfileId),
      '/sync': () => service.sync(token, body, { 'Psu-Ip-Address': req.ip, 'Psu-User-Agent': req.get('User-Agent') || '', 'Psu-Referer': req.get('Referer') || '',
        'Psu-Accept': req.get('Accept') || '', 'Psu-Accept-Charset': req.get('Accept-Charset') || '',
        'Psu-Accept-Encoding': req.get('Accept-Encoding') || '', 'Psu-Accept-language': req.get('Accept-Language') || '', 'Psu-Accept-Language': req.get('Accept-Language') || '' }),
      '/disconnect': () => service.disconnect(token, body.accountProfileId)
    };
    if (!routes[req.path]) throw failure('route-not-found', 404);
    return res.json(await routes[req.path]());
  } catch (error) {
    // No request URL, body, bank response, authorization code or token in application logs.
    const route = ['/auth/start', '/status', '/sync', '/disconnect', '/callback'].includes(req.path) ? req.path : 'unknown';
    const errorCode = typeof error.code === 'string' && /^[A-Za-z_-]{1,80}$/.test(error.code) ? error.code : 'bank-unavailable';
    console.warn(JSON.stringify({ event: 'finize-bank-request-failed', route, errorCode, status: error.status || 503 }));
    return res.status(error.status || 503).json({ error: error.code || 'bank-unavailable' });
  }
});
