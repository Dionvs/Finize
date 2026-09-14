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
assert.match(source, /\.catch\(\(\) => caches\.match\("\.\/index\.html"\)\)/);
assert.match(source, /return cached \|\| fetch\(event\.request\);/);
assert.doesNotMatch(
  source.slice(source.indexOf('event.respondWith(\n    caches.match(event.request)')),
  /caches\.match\("\.\/index\.html"\)/
);

const htmlCss = html.match(/href="(\.\/app\.css\?v=[^"]+)"/)?.[1];
const htmlJs = html.match(/src="(\.\/app\.js\?v=[^"]+)"/)?.[1];
assert.ok(htmlCss && htmlJs, 'index.html moet versiegebonden app-assets laden');
assert.ok(source.includes(`"${htmlCss}"`), 'serviceworker moet dezelfde CSS-versie cachen als index.html');
assert.ok(source.includes(`"${htmlJs}"`), 'serviceworker moet dezelfde JavaScript-versie cachen als index.html');
assert.match(source, /const CACHE_NAME = "finize-v94-fixed-cost-delete"/);

console.log('SERVICE_WORKER_CACHE_OK');
