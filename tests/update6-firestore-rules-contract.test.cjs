const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs.readFileSync(path.resolve(__dirname,'../firestore.rules'),'utf8');

assert.match(rules,/request\.auth\.token\.email_verified == true/);
assert.match(rules,/match \/accountLinks\/\{email\}/);
assert.match(rules,/allow get: if verifiedAccount\(\) && email == request\.auth\.token\.email\.lower\(\)/);
assert.match(rules,/allow list, create, update, delete: if false/);
assert.match(rules,/match \/households\/\{householdId\}/);
assert.match(rules,/request\.resource\.data\.role == accountLink\(\)\.role/);
assert.match(rules,/uid == request\.auth\.uid/);
assert.match(rules,/match \/budgetState\/current/);
assert.match(rules,/match \/imports\/\{importId\}/);
assert.match(rules,/request\.resource\.data\.syncVersion == resource\.data\.syncVersion \+ 1/);
assert.match(rules,/allow delete: if false/);
assert.match(rules,/match \/budgetPlanners\/finize \{\s*allow read, create, update, delete: if false;/);

assert.doesNotMatch(rules,/@|gmail\.com|hotmail\.com/i,'Publieke regels mogen geen concrete e-mailadressen bevatten');

console.log('UPDATE6_FIRESTORE_RULES_CONTRACT_OK');
