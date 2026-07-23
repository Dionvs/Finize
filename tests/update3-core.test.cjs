const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function u3IsoDate');
const end = html.indexOf('function u3RecognitionFromLegacy', start);
assert.ok(start >= 0 && end > start, 'Update 3 recurrence core is niet gevonden');

const context = {
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  U3_FREQUENCY_UNITS: ['weken', 'maanden', 'jaren'],
  round2: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
  getSelectedMonth: () => '2026-07'
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context, { filename: 'update3-recurrence-inline.js' });

const monthly = {
  id: 'monthly',
  bedrag: 10,
  begindatum: '2026-01-31',
  actief: true,
  frequentieAantal: 1,
  frequentieEenheid: 'maanden',
  amountHistory: [{ effectiveFrom: '2026-01-01', amount: 10 }],
  monthOverrides: {}
};
assert.deepEqual(Array.from(context.u3OccurrenceDates(monthly, '2026-02')), ['2026-02-28']);
assert.deepEqual(Array.from(context.u3OccurrenceDates(monthly, '2026-03')), ['2026-03-31']);

const leap = {
  ...monthly,
  id: 'leap',
  begindatum: '2024-02-29',
  frequentieEenheid: 'jaren'
};
assert.deepEqual(Array.from(context.u3OccurrenceDates(leap, '2025-02')), ['2025-02-28']);
assert.deepEqual(Array.from(context.u3OccurrenceDates(leap, '2028-02')), ['2028-02-29']);

const weekly = {
  ...monthly,
  id: 'weekly',
  begindatum: '2026-01-01',
  frequentieAantal: 11,
  frequentieEenheid: 'weken'
};
assert.deepEqual(Array.from(context.u3OccurrenceDates(weekly, '2026-03')), ['2026-03-19']);

const quarterly = {
  ...monthly,
  id: 'quarterly',
  begindatum: '2026-01-15',
  frequentieAantal: 3,
  frequentieEenheid: 'maanden'
};
assert.deepEqual(Array.from(context.u3OccurrenceDates(quarterly, '2026-04')), ['2026-04-15']);
assert.deepEqual(Array.from(context.u3OccurrenceDates(quarterly, '2026-05')), []);

const history = {
  ...monthly,
  amountHistory: [
    { effectiveFrom: '2026-01-01', amount: 10 },
    { effectiveFrom: '2026-07-01', amount: 12.34 }
  ],
  monthOverrides: { '2026-08': 15.67 }
};
assert.equal(context.u3AmountAt(history, '2026-06-30'), 10);
assert.equal(context.u3AmountAt(history, '2026-07-01'), 12.34);
assert.equal(context.u3AmountAt(history, '2026-08-15'), 15.67);

const ended = { ...monthly, einddatum: '2026-02-15' };
assert.deepEqual(Array.from(context.u3OccurrenceDates(ended, '2026-03')), []);

assert.equal(context.u3MonthlyAverage({ ...monthly, bedrag: 600, frequentieEenheid: 'jaren', amountHistory: [{ effectiveFrom: '2026-01-01', amount: 600 }] }), 50);
assert.equal(context.u3MonthlyAverage({ ...monthly, bedrag: 300, frequentieAantal: 3, amountHistory: [{ effectiveFrom: '2026-01-01', amount: 300 }] }), 100);

console.log('UPDATE3_CORE_OK');
