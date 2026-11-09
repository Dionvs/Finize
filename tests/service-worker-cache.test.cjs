const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(source, /const CACHE_PREFIX = "finize-"/);
assert.match(source, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
assert.match(source, /await cache\.addAll\(CRITICAL_SHELL\)/);
assert.match(source, /Promise\.allSettled\(OPTIONAL_SHELL\.map/);
assert.match(source, /event\.request\.mode === "navigate"/);
assert.match(source, /\.catch\(\(\) => caches\.match\("\.\/index\.html", \{cacheName:CACHE_NAME\}\)\)/);
assert.match(source, /caches\.match\(event\.request, \{cacheName:CACHE_NAME\}\)/);
assert.match(source, /return cached \|\| fetch\(event\.request\);/);
assert.doesNotMatch(
  source.slice(source.indexOf('event.respondWith(\n    caches.match(event.request,')),
  /caches\.match\("\.\/index\.html"\)/
);

require('./helpers/release-shell.cjs').assertReleaseShell(html,source);

console.log('SERVICE_WORKER_CACHE_OK');
