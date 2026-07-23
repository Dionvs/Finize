const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const progress=fs.readFileSync(path.join(root,'UPDATE-4-PROGRESS.md'),'utf8');

assert.match(html,/schemaVersion:\s*5/);
assert.match(html,/Werkelijk inkomen aanpassen/);
assert.match(html,/Correctie nodig/);
assert.match(sw,/finize-v15-update4-bankimport/);
assert.match(sw,/\.\/update4\.js/);
assert.match(sw,/\.\/update4\.css/);
for(const file of ['update-4-datamodel.md','update-4-changelog.md','update-4-handmatig-testverslag.md']){
  assert.equal(fs.existsSync(path.join(root,'docs',file)),true,`${file} ontbreekt`);
}
assert.match(progress,/Fase 7/);
console.log('UPDATE4_FINAL_REGRESSION_OK');
