const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = require('./helpers/runtime-source.cjs');
const start = html.indexOf('function calcScenario(state)');
const end = html.indexOf('/* ---------- default data', start);
assert.ok(start >= 0 && end > start, 'calcScenario is niet gevonden');

const source = html.slice(start, end);
assert.doesNotMatch(
  source,
  /Math\.max\s*\(\s*variabelBudgetTotaal\s*,\s*variabelTotaal\s*\)/,
  'Werkelijke gezamenlijke uitgaven mogen de geplande kostenpot niet beïnvloeden'
);

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function runScenario(scenario, jointActual, personalActual = {}, savingOverrides = {}) {
  const monthly = {
    verdeling: {
      minimumDion: 0.4,
      hypotheekDion: 0.5
    },
    spaarpotDezeMaand: 500,
    gezamenlijk: {
      vasteLasten: [{ bedrag: 1000 }],
      variabel: [{ bedrag: 750 }],
      hypotheek: [{ bedrag: 1200 }]
    },
    dion: {
      vasteLasten: [{ bedrag: 200 }],
      variabel: []
    },
    dara: {
      vasteLasten: [{ bedrag: 150 }],
      variabel: []
    }
  };
  const actuals = {
    gezamenlijk: jointActual,
    dion: personalActual.dion || 0,
    dara: personalActual.dara || 0
  };
  const context = {
    Number,
    Math,
    round2,
    isPlainObject: value => !!value && typeof value === 'object' && !Array.isArray(value),
    getSelectedMonth: () => '2026-07',
    getDistributionIncomeParts: owner => ({
      salary: owner === 'dion' ? 3000 : 2000,
      refund: 0
    }),
    getMonthlyScenarioData: () => monthly,
    sumEffective: rows => round2(rows.reduce((sum, row) => sum + Number(row.bedrag || 0), 0)),
    sumBedrag: rows => round2(rows.reduce((sum, row) => sum + Number(row.bedrag || 0), 0)),
    sumTransactions: owner => actuals[owner] || 0
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return JSON.parse(JSON.stringify(context.calcScenario({
    meta: { scenario },
    monthlySavingOverrides: { '2026-07': savingOverrides }
  })));
}

for (const scenario of ['voor', 'na']) {
  const under = runScenario(scenario, 520);
  const exact = runScenario(scenario, 750);
  const over = runScenario(scenario, 900);

  for (const result of [under, exact, over]) {
    assert.equal(result.variabelBudgetTotaal, 750);
    assert.equal(result.variabelVoorVerdelingTotaal, 750);
  }
  assert.equal(under.variabelTotaal, 520);
  assert.equal(exact.variabelTotaal, 750);
  assert.equal(over.variabelTotaal, 900);

  assert.equal(under.dion.zakgeld, exact.dion.zakgeld);
  assert.equal(exact.dion.zakgeld, over.dion.zakgeld);
  assert.equal(under.dara.zakgeld, exact.dara.zakgeld);
  assert.equal(exact.dara.zakgeld, over.dara.zakgeld);
  assert.equal(under.inkomenRatioDion, over.inkomenRatioDion);
  assert.equal(under.inkomenRatioDara, over.inkomenRatioDara);
  assert.equal(under.effDion, over.effDion);
  assert.equal(under.effDara, over.effDara);
}

const dionBefore = runScenario('voor', 750, { dion: 100 });
const dionAfter = runScenario('voor', 750, { dion: 350 });
assert.equal(dionBefore.dion.zakgeld, dionAfter.dion.zakgeld);
assert.notEqual(dionBefore.dion.variabeleUitgaven, dionAfter.dion.variabeleUitgaven);
assert.equal(dionBefore.dion.beschikbaarVoorSparen, dionAfter.dion.beschikbaarVoorSparen);
assert.equal(dionBefore.dara.zakgeld, dionAfter.dara.zakgeld);

const daraBefore = runScenario('na', 750, { dara: 80 });
const daraAfter = runScenario('na', 750, { dara: 280 });
assert.equal(daraBefore.dara.zakgeld, daraAfter.dara.zakgeld);
assert.notEqual(daraBefore.dara.variabeleUitgaven, daraAfter.dara.variabeleUitgaven);
assert.equal(daraBefore.dara.beschikbaarVoorSparen, daraAfter.dara.beschikbaarVoorSparen);
assert.equal(daraBefore.dion.zakgeld, daraAfter.dion.zakgeld);

const automaticSaving = runScenario('voor', 750);
const manualSaving = runScenario('voor', 750, {}, { dion: 125, dara: 0 });
assert.equal(manualSaving.dion.automatischBeschikbaarVoorSparen, automaticSaving.dion.beschikbaarVoorSparen);
assert.equal(manualSaving.dion.beschikbaarVoorSparen, 125);
assert.equal(manualSaving.dion.savingsSource, 'handmatig');
assert.equal(manualSaving.dara.beschikbaarVoorSparen, 0, 'Een expliciete nul moet als handmatige spaarwaarde blijven gelden');
assert.equal(manualSaving.dara.savingsSource, 'handmatig');
assert.equal(manualSaving.dion.zakgeld, automaticSaving.dion.zakgeld, 'Een spaaroverride mag de zakgeldverdeling niet wijzigen');

console.log('UPDATE5_ALLOWANCE_BUDGET_REGRESSION_OK');
