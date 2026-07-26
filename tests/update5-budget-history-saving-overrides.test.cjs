const assert = require('node:assert/strict');
const vm = require('node:vm');
const runtime = require('./helpers/runtime-source.cjs');

const start = runtime.indexOf('function normalizeBudgetDefaults(target)');
const end = runtime.indexOf('/* ---------- Update 3:', start);
assert.ok(start >= 0 && end > start, 'De budgethistoriefuncties zijn niet gevonden');

let id = 0;
const state = {
  voor: {
    gezamenlijk: { variabel: [{ id: 'joint', categorie: 'Variabel', post: 'Boodschappen', bedrag: 500 }] },
    dion: { variabel: [{ id: 'dion', categorie: 'Variabel', post: 'Overig', bedrag: 100 }] },
    dara: { variabel: [{ id: 'dara', categorie: 'Variabel', post: 'Overig', bedrag: 80 }] }
  },
  na: {
    gezamenlijk: { variabel: [] },
    dion: { variabel: [] },
    dara: { variabel: [] }
  },
  monthlyBudgets: {
    '2026-06': { voor: { dionVariabel: [{ id: 'june', post: 'Overig', bedrag: 100 }] } },
    '2026-07': { voor: { dionVariabel: [{ id: 'july', post: 'Overig', bedrag: 100 }] } },
    '2026-08': { voor: { dionVariabel: [{ id: 'august', post: 'Overig', bedrag: 100 }] } }
  }
};

const context = {
  state,
  Date,
  String,
  Array,
  Object,
  Number,
  isPlainObject: value => !!value && typeof value === 'object' && !Array.isArray(value),
  uid: () => `test-${++id}`,
  clone: value => JSON.parse(JSON.stringify(value)),
  getSelectedMonth: () => '2026-07'
};
vm.createContext(context);
vm.runInContext(runtime.slice(start, end), context);

context.normalizeBudgetDefaults(state);
assert.equal(context.getVariableBudgetDefaultsAt('voor', 'dion', '2026-06')[0].bedrag, 100);

const changed = [{ id: 'new', categorie: 'Variabel', post: 'Overig', bedrag: 150 }];
context.setVariableBudgetDefaultsFromMonth('voor', 'dion', '2026-07', changed);

assert.equal(state.monthlyBudgets['2026-06'].voor.dionVariabel[0].bedrag, 100, 'Een eerdere maand moet ongewijzigd blijven');
assert.equal('dionVariabel' in state.monthlyBudgets['2026-07'].voor, false, 'De gekozen maand moet opnieuw uit de historie worden afgeleid');
assert.equal('dionVariabel' in state.monthlyBudgets['2026-08'].voor, false, 'Toekomstige maanden moeten opnieuw uit de historie worden afgeleid');
assert.equal(context.getVariableBudgetDefaultsAt('voor', 'dion', '2026-06')[0].bedrag, 100);
assert.equal(context.getVariableBudgetDefaultsAt('voor', 'dion', '2026-07')[0].bedrag, 150);
assert.equal(context.getVariableBudgetDefaultsAt('voor', 'dion', '2027-01')[0].bedrag, 150);
assert.equal(state.voor.dion.variabel[0].bedrag, 150, 'De compatibiliteitsprojectie moet het nieuwste standaardbudget volgen');

state.monthlyBudgets['2026-07'].voor.dionVariabel = [{ id: 'once', post: 'Overig', bedrag: 175 }];
assert.equal(state.monthlyBudgets['2026-07'].voor.dionVariabel[0].bedrag, 175, 'Een uitzondering voor alleen deze maand moet mogelijk blijven');
assert.equal(context.getVariableBudgetDefaultsAt('voor', 'dion', '2026-08')[0].bedrag, 150, 'Een maanduitzondering mag volgende maanden niet wijzigen');

console.log('UPDATE5_BUDGET_HISTORY_SAVING_OVERRIDES_OK');
