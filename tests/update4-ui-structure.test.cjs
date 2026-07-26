const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','update4.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','update4.css'),'utf8');

assert.match(html,/update4\.css/);
assert.match(html,/update4\.js/);
assert.doesNotMatch(html,/v4-mobile-only-block">\$\{renderManageSection\('Bank import & uitgaven'/);
for(const marker of ['Bankimport controleren','Nakijken','Zeker','Meer opties','Alles verwerken','Herkenningsregels','Alle imports bekijken','Import uit cloud ophalen','Opnieuw proberen']){
  assert.match(js,new RegExp(marker),`UI-marker ontbreekt: ${marker}`);
}
assert.doesNotMatch(html,/section-kicker">Update 3/);
assert.doesNotMatch(js,/section-kicker">Update 4/);
assert.match(html,/data-dashboard-accordion="bank-import"/,'Bankimport mist een stabiele accordeonidentificatie');
assert.match(html,/querySelector\('\[data-dashboard-accordion="bank-import"\]'\)/,'Bankimportstatus gebruikt geen stabiele accordeonselectie');
assert.match(html,/function bindDashboardAccordionKeyboard\(root\)/,'Centrale toetsenbordbediening voor dashboardaccordeons ontbreekt');
assert.match(html,/\['Enter',' ','Spacebar'\]\.includes\(event\.key\)/,'Enter- en spatiebediening voor dashboardaccordeons ontbreekt');
assert.match(html,/renderManageSection\('Maandadministratie',body,false,'data-dashboard-accordion="month-admin"'\)/,'Maandadministratie start niet als gesloten accordeon');
assert.match(js,/accordion\.dataset\.dashboardAccordion='settlement'/,'Onderling te verrekenen is geen dashboardaccordeon');
assert.doesNotMatch(js,/accordion\.open\s*=\s*true/,'Onderling te verrekenen start niet gesloten');
assert.match(js,/class="manage-title">Onderling te verrekenen/,'Titel van verrekenaccordeon ontbreekt');
assert.match(js,/data-u4-open-settlement/,'Detailsactie voor verrekenen ontbreekt');
assert.match(css,/#u4ImportModalRoot/);
assert.match(css,/u4-cloud-spinner/);
assert.match(css,/min-height:calc\(100dvh - 150px\)/);
assert.match(css,/@media\(max-width:390px\)/);
console.log('UPDATE4_UI_STRUCTURE_OK');
