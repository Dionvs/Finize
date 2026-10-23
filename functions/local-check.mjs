// Local SDK boundary check. No server, bank request, deployment or production reads.
import { registerHooks, createRequire } from 'node:module';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dependencyRoot = process.env.FINIZE_BANK_DEPENDENCIES;
if (dependencyRoot) {
  if (!isAbsolute(dependencyRoot)) throw new Error('Gebruik een absolute lokale dependencylocatie.');
  const installed = createRequire(resolve(dependencyRoot, 'package.json'));
  const modules = new Map(['firebase-functions/v2/https','firebase-functions/v2/core','firebase-functions/params','firebase-admin/app','firebase-admin/auth','firebase-admin/firestore']
    .map(name => [name, pathToFileURL(installed.resolve(name)).href]));
  const entryUrl = new URL('./src/index.mjs',import.meta.url).href;
  registerHooks({ resolve(specifier, context, next) {
    if(context.parentURL===entryUrl&&modules.has(specifier))return {url:modules.get(specifier),shortCircuit:true};
    return next(specifier, context);
  } });
}
process.env.GCLOUD_PROJECT = 'demo-finize-p5b';
const { enableBanking } = await import('./src/index.mjs');
assert.equal(enableBanking.__endpoint.platform, 'gcfv2');
assert.equal(enableBanking.__endpoint.serviceAccountEmail, 'finize-bank@financien-7dd43.iam.gserviceaccount.com');
assert.deepEqual(enableBanking.__endpoint.region, ['europe-west4']);
assert.deepEqual(enableBanking.__endpoint.secretEnvironmentVariables.map(item => item.key), ['ENABLE_BANKING_PRIVATE_KEY']);
for (const [label, method, path, origin, expected] of [
  ['origin', 'POST', '/sync', 'https://untrusted.invalid', 403],
  ['preflight', 'OPTIONS', '/sync', 'https://dionvs.github.io', 204],
  ['token', 'POST', '/status', 'https://dionvs.github.io', 401]
]) {
  let status;
  const req = { method, path, body: {}, get: name => name === 'Origin' ? origin : undefined, is: () => true };
  const res = { set() { return this; }, status(value) { status = value; return this; }, json() { return this; }, end() { return this; } };
  await enableBanking(req, res);
  assert.equal(status, expected, label);
}
console.log('Functions v2-entry en 3 HTTP-grenscontroles geslaagd; geen netwerkverzoeken.');
