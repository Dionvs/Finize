const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','src','core','runtime.js'),'utf8');
const presentation=fs.readFileSync(path.join(__dirname,'..','src','ui','presentation.js'),'utf8');

assert.match(runtime,/function createGoalRecord\(owner\)[\s\S]*?eigenaar:owner[\s\S]*?ratoVerdeling:true[\s\S]*?subdoelen:\[\]/,'iedere aanmaakroute moet een volledig doelobject gebruiken');
assert.match(runtime,/vastBedrag:false/,'nieuwe doelen moeten hun vaste-bedragmodus expliciet vastleggen');
assert.match(runtime,/function createGoalForOwner\(owner\)[\s\S]*?manageableGoalOwnerKeys\(\)\.includes\(owner\)/,'een niet-beheerbare eigenaar mag geen schrijfdoel zijn');
assert.doesNotMatch(runtime,/\['gezamenlijk','dion','dara'\]\[index\]/,'zichtbare groepen mogen niet meer via hun schermpositie aan een eigenaar worden gekoppeld');
assert.doesNotMatch(runtime,/querySelectorAll\('\[data-add(?:goal|refund)\]'\)|data-add(?:goal|refund)="\$\{/,'alternatieve legacy-aanmaakroutes mogen niet meer vanuit de UI bestaan');
assert.doesNotMatch(runtime,/renderTeruggavenTable/,'legacy-teruggaveregels mogen niet meer als actuele editor worden gerenderd');
assert.doesNotMatch(runtime,/data-month-income=/,'de persoonlijke desktopweergave moet de gedeelde inkomenseditor gebruiken');
assert.match(runtime,/data-income-edit="\$\{key\}"/,'desktop moet de gedeelde inkomenseditor openen');
assert.match(runtime,/data-income-edit="\$\{owner\}"/,'mobiel moet dezelfde gedeelde inkomenseditor openen');
assert.match(presentation,/data-u2-process-owner/,'tablet en desktop moeten de bestaande verwerking openen');
assert.match(presentation,/Spaargeschiedenis/,'tablet en desktop moeten de bestaande spaargeschiedenis tonen');
assert.match(runtime,/data-open-owner-variable/,'variabele budgetten blijven via de gedeelde handler lopen');
assert.match(runtime,/data-saving-edit/,'gezamenlijk sparen blijft via de gedeelde handler lopen');
assert.match(runtime,/data-open-personal-transaction/,'persoonlijke transacties blijven via de gedeelde handler lopen');

console.log('FUNCTIEPARITEIT_SPAARDOELEN_INKOMSTEN_OK');
