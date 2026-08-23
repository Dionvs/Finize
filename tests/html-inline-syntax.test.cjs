const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
assert.equal(scripts.length,0,'index.html mag geen actieve inline JavaScript meer bevatten');
assert.match(html,/<script src="\.\/app\.js\?v=85-inkomen-per-persoon"><\/script>/);
assert.match(html,/<link rel="stylesheet" href="\.\/app\.css\?v=85-inkomen-per-persoon">/);
assert.doesNotMatch(html,/update[45]\.(?:js|css)/);
assert.equal((html.match(/<main\b/gi)||[]).length,1);
assert.equal((html.match(/<body\b/gi)||[]).length,1);
assert.equal((html.match(/<\/body>/gi)||[]).length,1);
console.log('HTML_RUNTIME_STRUCTURE_OK');
