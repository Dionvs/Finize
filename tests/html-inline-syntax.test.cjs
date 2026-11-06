const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
require('./helpers/release-shell.cjs').assertReleaseShell(html);
assert(scripts.length>0,'De inline release moet uitvoerbare scripts bevatten');
for(const source of scripts)new (require('node:vm').Script)(source);
assert.doesNotMatch(html,/update[45]\.(?:js|css)/);
const shell=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
assert.equal((shell.match(/<main\b/gi)||[]).length,1);
assert.equal((shell.match(/<body\b/gi)||[]).length,1);
assert.equal((shell.match(/<\/body>/gi)||[]).length,1);
console.log('HTML_RUNTIME_STRUCTURE_OK');
