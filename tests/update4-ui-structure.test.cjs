const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const markup=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=require('./helpers/runtime-source.cjs');
const css=fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8');
const html=markup+js;

assert.match(markup,/app\.css/);
assert.match(markup,/app\.js/);
assert.doesNotMatch(html,/renderManageSection\('Bank import & uitgaven'/);
for(const marker of ['Bankimport controleren','Nakijken','Zeker','Meer opties','Alles verwerken','Herkenningsregels','Alle imports bekijken','Import uit cloud ophalen','Opnieuw proberen']){
  assert.match(js,new RegExp(marker),`UI-marker ontbreekt: ${marker}`);
}
assert.doesNotMatch(html,/section-kicker">Update 3/);
assert.doesNotMatch(js,/section-kicker">Update 4/);
assert.match(html,/function openTransactionEntryMenu\(owner\)/,'Keuzemenu voor handmatige invoer en bankimport ontbreekt');
assert.match(js,/openBankImportForOwner/,'Eigenaargebonden bankimport ontbreekt');
assert.match(html,/function bindDashboardAccordionKeyboard\(root\)/,'Centrale toetsenbordbediening voor dashboardaccordeons ontbreekt');
assert.match(html,/\['Enter',' ','Spacebar'\]\.includes\(event\.key\)/,'Enter- en spatiebediening voor dashboardaccordeons ontbreekt');
assert.doesNotMatch(html,/\$\{renderU3AdminPanel\(\)\}/,'Maandadministratie staat nog op het dashboard');
assert.doesNotMatch(js,/accordion\.dataset\.dashboardAccordion='settlement'/,'Onderling te verrekenen staat nog op het dashboard');
assert.match(html,/class="card dashboard-year-overview"/,'Direct jaaroverzicht ontbreekt');
assert.match(html,/class="dashboard-year-table"/,'Jaaroverzicht is geen tabel');
assert.match(css,/#u4ImportModalRoot/);
assert.match(css,/u4-cloud-spinner/);
assert.match(css,/min-height:calc\(100dvh - 150px\)/);
assert.match(css,/@media\(max-width:390px\)/);
console.log('UPDATE4_UI_STRUCTURE_OK');
