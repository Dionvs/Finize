const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','update4.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','update4.css'),'utf8');

assert.match(html,/update4\.css/);
assert.match(html,/update4\.js/);
assert.doesNotMatch(html,/v4-mobile-only-block">\$\{renderManageSection\('Bank import & uitgaven'/);
for(const marker of ['Bankimport controleren','Nakijken','Zeker','Meer opties','Alles verwerken','Herkenningsregels','Alle imports bekijken']){
  assert.match(js,new RegExp(marker),`UI-marker ontbreekt: ${marker}`);
}
assert.match(css,/#u4ImportModalRoot/);
assert.match(css,/height:100dvh/);
assert.match(css,/@media\(max-width:390px\)/);
console.log('UPDATE4_UI_STRUCTURE_OK');
