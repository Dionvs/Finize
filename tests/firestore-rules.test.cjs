const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8'));

assert.equal(config.firestore.rules,'firestore.rules');
assert.match(rules,/match \/budgetPlanners\/dion-dara\s*\{/,'Bestaande budgetplannerregel ontbreekt');
assert.match(rules,/match \/budgetPlanners\/finize\s*\{/,'Finize-hoofddocumentregel ontbreekt');
assert.match(rules,/match \/imports\/\{importId\}\s*\{/,'Importheaderregel ontbreekt');
assert.match(rules,/match \/chunks\/\{chunkId\}\s*\{/,'Importchunkregel ontbreekt');
assert.equal((rules.match(/allow read, write: if true;/g)||[]).length,4,'Alleen de twee bestaande documenten en twee Finize-importniveaus mogen loginloos zijn');

console.log('FIRESTORE_RULES_OK');
