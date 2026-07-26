const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '..', 'app.css'), 'utf8');

assert.equal((html.match(/<script\b/g) || []).length, (html.match(/<\/script>/g) || []).length, 'Ongebalanceerde script-tags');
assert.equal((html.match(/<details\b/g) || []).length, (html.match(/<\/details>/g) || []).length, 'Ongebalanceerde details-tags');
assert.doesNotMatch(
  html,
  /<details[^>]*>\s*<summary>\s*<span>\s*<\/span>[\s\S]*?<\/summary>\s*<div[^>]*>\s*<\/div>\s*<\/details>/,
  'Leeg accordeonblok gevonden'
);

for (const tab of ['dashboard', 'gezamenlijk', 'dion', 'dara', 'spaardoelen']) {
  assert.match(html, new RegExp(`data-tab="${tab}"`), `Navigatietab ${tab} ontbreekt`);
}

for (const id of ['tab-dashboard', 'tab-gezamenlijk', 'tab-dion', 'tab-dara', 'tab-spaardoelen']) {
  assert.match(html, new RegExp(`id="${id}"`), `Tabpaneel ${id} ontbreekt`);
}

assert.match(html, /function renderJointFirstRow\(\)/, 'Gezamenlijke weergave ontbreekt');
assert.match(html, /function renderU3AdminPanel\(\)/, 'Maandadministratie ontbreekt');
assert.match(html, /renderManageSection\('Maandadministratie',body,false,'data-dashboard-accordion="month-admin"'\)/, 'Maandadministratie is geen dashboardaccordeon');
assert.match(html, /data-u3-open="planning"/, 'Maandadministratie-acties ontbreken');

console.log('UPDATE3_UI_STRUCTURE_OK');
