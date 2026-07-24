const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'update5.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'update5.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(html, /update5\.css/);
assert.match(html, /update5\.js/);
assert.match(sw, /finize-v29-csv-cloudherstel/);
assert.match(sw, /\.\/update5\.css/);
assert.match(sw, /\.\/update5\.js/);
assert.doesNotMatch(html, /class="u5-page-context"/);
assert.doesNotMatch(html, /id="btnCopyPreviousMonth"/);
assert.doesNotMatch(html, /class="[^"]*v4-dashboard-add-btn/);
assert.doesNotMatch(html, /class="footer-note"/);
assert.doesNotMatch(html, /class="v4-sidebar-sub"/);
assert.match(html, /data-month-copy-previous/);
assert.match(html, /class="card u5-primary-kpi u5-income-kpi tone-income" data-open-total-income/);
assert.match(html, /function openTotalIncomeEditModal\(\)/);
assert.match(html, /Een bevestigd salaris uit een CSV-bankimport krijgt voor deze maand automatisch voorrang/);
assert.match(html, /id="btnCloseTotalIncomeEdit" aria-label="Sluiten">&times;<\/button>/);
assert.doesNotMatch(html, /Persoonlijke ruimte|personalFlow|flow-card/);
assert.match(html, /class="card metric-card income-metric span-12"/);
assert.match(html, /function placeDesktopPageHeading\(root=/);
assert.match(html, /placeDesktopPageHeading\(root\)/);
assert.match(html, /Samen houden jullie grip op deze maand/);
assert.match(html, /Jouw maand, jouw keuzes/);
assert.match(html + js, /Elke maand een stap dichter bij wat jullie belangrijk vinden/);
assert.match(html, /Alles veilig op één plek/);
assert.match(js, /reuseMobileNavigationIcons/);
assert.match(css, /body\.v4-app \.value\.is-negative\{color:var\(--red\) !important\}/);
assert.match(js, /function markNegativeValues\(root=document\)/);
assert.match(html, /FinizeUpdate5\?\.markNegativeValues\(root\)/);
assert.match(css, /\.dashboard-goals-preview\.v4-desktop-only-block \.scroll-area\{padding-bottom:6px\}/);
assert.match(css, /#tab-gezamenlijk>\.overview-kpi-row,[\s\S]*#tab-dara>\.dashboard-grid\{margin-bottom:16px\}/);
assert.match(css, /\.dashboard-preview-row\{margin-bottom:16px\}/);
assert.match(css, /\.u5-data-sections\{[^}]*margin-bottom:16px\}/);
assert.match(css, /#tab-gezamenlijk \.dashboard-grid>\.span-5 \.goal-card-grid,[\s\S]*#tab-dara \.dashboard-grid>\.span-5 \.goal-card-grid\{[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
assert.match(css, /#tab-dion>\.dashboard-grid,[\s\S]*#tab-dara>\.dashboard-grid\{margin-bottom:16px\}/);

assert.match(css, /@media \(min-width:768px\)/);
assert.match(css, /@media \(min-width:1024px\)/);
assert.match(css, /@media \(min-width:768px\) and \(max-width:1023px\)/);
assert.match(css, /grid-template-columns:80px minmax\(0,1fr\)/);
assert.match(css, /grid-template-columns:240px minmax\(0,1fr\)/);
assert.match(css, /\.v4-bottom-nav\{display:none !important\}/);
assert.doesNotMatch(css, /@media\s*\(max-width:767px\)/, 'Update 5 mag de mobiele CSS niet overschrijven');
assert.doesNotMatch(html, /(?:min|max)-width\s*:\s*(?:900|901)px/, 'De oude desktopgrens mag niet terugkomen');
assert.doesNotMatch(html, /\/\*\s*(?:v\d+|build\s+\d+|clean-start):/i, 'Tijdelijke versie- en reparatiecommentaren moeten verwijderd zijn');
assert.ok((html.match(/!important/g) || []).length < 2000, 'De geconsolideerde cascade bevat opnieuw te veel !important-regels');
assert.equal((html.match(/@media \(max-width:767px\)/g) || []).length, 2, 'Alle V4-mobielregels horen in één blok; alleen het aparte Update 2/3-blok mag daarnaast blijven');
assert.equal((html.match(/@media \(max-width:374px\)/g) || []).length, 1, 'Er mag maar één aantoonbaar nodig klein breakpoint blijven');
assert.equal((html.match(/@media \(max-width:640px\)/g) || []).length, 1, 'Het gedocumenteerde generieke niet-V4-blok moet één keer aanwezig blijven');
assert.doesNotMatch(html, /@media\s*\((?:max-width:(?:359|370|380|430)px|min-width:(?:375|600)px)/);
assert.doesNotMatch(html + css, /@media[^{]+\{\s*\}/, 'Lege mediaqueries zijn niet toegestaan');
assert.doesNotMatch(html, /mobile-kpi-grid\s*\+\s*\.dashboard-grid/, 'De complexe mobiele siblingselector mag niet terugkomen');
assert.doesNotMatch(html + css, /--(?:finize-uniform-chevron|chevron-down-icon)/);
assert.equal((html.match(/--finize-chevron\s*:/g) || []).length, 1, 'Er hoort één chevronvariabele te zijn');
assert.doesNotMatch(html, /;\s*;/, 'CSS mag geen lege of dubbel geschreven declaraties bevatten');
assert.doesNotMatch(html + css, /\/\*[^*]*(?:final override|repair block|reparatieblok)[^*]*\*\//i);

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
  assert.doesNotMatch(
    html + js,
    new RegExp(`(?:querySelector|querySelectorAll|closest)\\([^)]*\\.${className}`),
    `Presentatieklasse mag geen JavaScript-hook zijn: ${className}`
  );
}

const targetedSelectors = [
  '.mobile-header-top', '.mobile-brand', '.mobile-brand-icon',
  '.mobile-status-pill', '.mobile-month-slot', '.month-picker-btn',
  '.mobile-dashboard-header', '.mobile-title-scenario-row',
  '.mobile-scenario-toggle', '.mobile-kpi-grid', '.mobile-kpi-card',
  '.mobile-kpi-label', '.mobile-kpi-value', '.dashboard-grid',
  '.joint-account-card', '.allowance-return-card', '.v4-bottom-nav',
  '.bottom-nav-btn', '.bn-icon', '.manage-section', '.expand-chevron'
];
function mediaRanges(source) {
  const result = [];
  for (const match of source.matchAll(/@media\s*([^{]+)\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    for (; index < source.length && depth; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') depth -= 1;
    }
    result.push({ start: match.index, end: index, query: match[1].trim() });
  }
  return result;
}
function targetedDuplicateDeclarations(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const media = mediaRanges(clean);
  const seen = new Set();
  const duplicates = new Set();
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorText = match[1].trim();
    if (selectorText.startsWith('@')) continue;
    const context = media
      .filter(item => item.start < match.index && item.end > match.index)
      .map(item => item.query)
      .join(' && ') || 'root';
    const properties = [...match[2].matchAll(/(?:^|;)\s*(--[\w-]+|[\w-]+)\s*:/g)]
      .map(item => item[1]);
    for (const selector of selectorText.split(',').map(item => item.trim())) {
      if (!targetedSelectors.some(target => selector.includes(target))) continue;
      for (const property of properties) {
        const key = `${context}|${selector}|${property}`;
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
      }
    }
  }
  return [...duplicates];
}
assert.deepEqual(
  targetedDuplicateDeclarations(`${html.match(/<style>([\s\S]*?)<\/style>/)[1]}\n${css}`),
  [],
  'De geconsolideerde componenten mogen dezelfde property niet opnieuw overschrijven binnen hetzelfde breakpoint'
);

for (const marker of ['Totaal inkomen','Gezamenlijk budget','Gezamenlijk sparen','Zakgeld totaal','Geplande verdeling','Werkelijk maandresultaat']) {
  assert.match(html, new RegExp(marker), `Dashboardmarker ontbreekt: ${marker}`);
}
assert.match(html, /getMonthFinancialResult\(getSelectedMonth\(\)\)/);
assert.match(html, /Deze realisatie verandert het vooraf berekende zakgeld niet/);
assert.match(html, /window\.innerWidth >= 768 \? renderPersonOrJoint/);
assert.match(html, /window\.innerWidth >= 768 && window\.FinizeUpdate5\?\.renderGoals/);
assert.match(html, /window\.innerWidth >= 768 && window\.FinizeUpdate5\?\.renderData/);
assert.match(html, /function renderRecurringFixedManage\(owner\)/);
assert.match(html, /state\.recurringFixedExpenses\?\.\[scenario\]/);
assert.match(html, /data-u3-edit-recurring="fixed:/);
assert.match(html, /data-u3-recurring-owner="\$\{owner\}"/);
assert.match(html, /renderManageSection\('Beheer vaste lasten', renderRecurringFixedManage\(key\)/);
assert.match(html, /renderManageSection\('Eigen vaste lasten', renderRecurringFixedManage\(key\)/);
assert.doesNotMatch(html, /renderManageSection\('(?:Beheer vaste lasten|Eigen vaste lasten)', `<div class="card">`\s*\+\s*renderRowsTable/);

for (const marker of ['u5-goal-master','Tabelweergave','goalImageSource','renderGoalGroup','renderDataTab','Gevarenzone']) {
  assert.match(js, new RegExp(marker), `Update 5-marker ontbreekt: ${marker}`);
}
assert.match(js, /let selectedGoalRef = ''/);
assert.match(js, /let goalOwnerFilter = 'alle'/);
assert.match(js, /function goalListContent\(items\)/);
assert.match(js, /class="u5-goal-owner-group"/);
assert.match(css, /\.u5-goal-owner-group\+\.u5-goal-owner-group/);
assert.doesNotMatch(js, /localStorage\.setItem|DataAdapter\.save|CloudAdapter\.saveNow/, 'Tijdelijke weergavestatus mag niet worden opgeslagen');

for (const mobileMarker of [
  'id="bottomNav"',
  'function renderMobileSpaardoelen()',
  'function openMobileGoalEditor(owner,id)',
  'class="primary mobile-add-expense"',
  'id="mobileMonthSlot"'
]) {
  assert.match(html, new RegExp(mobileMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Mobiele marker ontbreekt: ${mobileMarker}`);
}

console.log('UPDATE5_RESPONSIVE_STRUCTURE_OK');
