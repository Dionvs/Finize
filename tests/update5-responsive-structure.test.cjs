const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const markup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
const js = require('./helpers/runtime-source.cjs');
const html = markup + js;
const presentationJs = fs.readFileSync(path.join(root, 'src', 'ui', 'presentation.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(markup, /app\.css/);
assert.match(markup, /app\.js/);
assert.match(sw, /finize-v93-responsive-function-parity/);
assert.match(js, /const dashboardTotalIncome = r\.totaalSalaris;/);
assert.match(sw, /\.\/app\.css/);
assert.match(sw, /\.\/app\.js/);
assert.doesNotMatch(html, /data-month-copy-previous|Kopieer vorige maand/);
assert.match(html, /data-variable-scope/);
assert.match(html, /setVariableBudgetDefaultsFromMonth\(scenario,owner,month,cleaned\)/);
assert.match(html, /data-personal-saving-edit/);
assert.match(html, /Spaargeld deze maand <strong>\$\{eur\(pot\)\}<\/strong>/);
assert.match(html, /'Over deze maand'/);
assert.match(html, /jointVisibleIncome - r\.vasteLastenTotaal - variableUsed - spaarpotVoorGroep - jointAllowance/);
assert.match(html, /dashboardIncomeBreakdown\(getSelectedMonth\(\)\)\.total/);
assert.doesNotMatch(html, /renderManageSection\('Sparen'/);
assert.match(html, /function openPersonalSavingEditModal\(owner\)/);
assert.match(html, /Automatisch gebruiken/);
assert.match(html, /data-income-edit="dion" data-income-label="Dion" aria-label="Inkomen van Dion aanpassen"/);
assert.match(html, /data-income-edit="dara" data-income-label="Dara" aria-label="Inkomen van Dara aanpassen"/);
assert.match(html, /data-u3-open="planning" data-u3-planning-owner="\$\{(?:owner|opts\.openFixedOwner)\}" aria-label="Vaste lasten van/);
assert.match(html, /function u3OpenPlanning\(owner=''\)/);
assert.doesNotMatch(js, /data-open-owner-fixed/);
assert.match(js, /if\(field\)field\.hidden=!isJoint/);
assert.match(js, /else delete item\.distributionMode/);
assert.match(html, /function openTotalIncomeEditModal\(\)/);
assert.match(html, /Werkelijk inkomen aanpassen/);
assert.match(html, /u5-fixed-costs-overview/);
assert.match(html, /function placeDesktopPageHeading\(root=/);
assert.match(html, /Samen houden jullie grip op deze maand/);
assert.match(html, /Jouw maand, jouw keuzes/);
assert.match(html + js, /Elke maand een stap dichter bij wat jullie belangrijk vinden/);
assert.match(html, /Alles veilig op .* plek/);
assert.match(js, /reuseMobileNavigationIcons/);
assert.match(js, /function markNegativeValues\(root=document\)/);
assert.match(html, /FinizeUpdate5\?\.markNegativeValues\(root\)/);

for (const marker of [
  '@media (min-width:768px)',
  '@media (min-width:1024px)',
  '@media (min-width:768px) and (max-width:1023px)',
  'grid-template-columns:80px minmax(0,1fr)',
  'grid-template-columns:240px minmax(0,1fr)'
]) {
  assert.ok(css.includes(marker), `Responsieve v50-marker ontbreekt: ${marker}`);
}
assert.match(css, /\.v4-bottom-nav\{display:none !important\}/);

const presentationClasses = [
  'dashboard-summary-row',
  'dashboard-preview-row',
  'budget-preview-card',
  'savings-preview-card',
  'mobile-kpi-card--editable',
  'mobile-kpi-card--joint-total',
  'mobile-kpi-card--budget'
];
for (const className of presentationClasses) {
  assert.match(html, new RegExp(`class="[^"]*${className}`), `Presentatieklasse ontbreekt: ${className}`);
}

for (const marker of ['Inkomen Dion','Inkomen Dara','Totaal gezamenlijke rekening','Variabel gebruikt','Geplande verdeling','Verdeling Dion / Dara']) {
  assert.match(html, new RegExp(marker), `Dashboardmarker ontbreekt: ${marker}`);
}
assert.match(html, /getMonthFinancialResult\(key\)/);
assert.doesNotMatch(html, /Werkelijk maandresultaat|Deze realisatie verandert het vooraf berekende zakgeld niet/);
assert.match(html, /class="card span-6 u5-planned-flow"/);
assert.match(html, /class="card span-6 u5-allowance-split"/);
assert.match(html, /function renderRecurringFixedManage\(owner\)/);
assert.match(html, /state\.recurringFixedExpenses\?\.\[scenario\]/);

for (const marker of ['u5-goal-master','Tabelweergave','goalImageSource','renderGoalGroup','renderDataTab','Gevarenzone']) {
  assert.match(js, new RegExp(marker), `Update 5-marker ontbreekt: ${marker}`);
}
assert.match(js, /let selectedGoalRef = ''/);
assert.match(js, /let goalOwnerFilter = 'alle'/);
assert.match(js, /function goalListContent\(items\)/);
assert.match(js, /class="u5-goal-owner-group"/);
assert.match(css, /\.u5-goal-owner-group\+\.u5-goal-owner-group/);
assert.doesNotMatch(presentationJs, /localStorage\.setItem|DataAdapter\.save|CloudAdapter\.saveNow/, 'Tijdelijke weergavestatus mag niet worden opgeslagen');

for (const mobileMarker of [
  'id="bottomNav"',
  'function renderMobileSpaardoelen()',
  'function openMobileGoalEditor(owner,id)',
  'data-open-joint-transaction',
  'data-open-personal-transaction',
  'id="mobileMonthSlot"'
]) {
  assert.ok(html.includes(mobileMarker), `Mobiele marker ontbreekt: ${mobileMarker}`);
}

console.log('UPDATE5_RESPONSIVE_STRUCTURE_OK');
