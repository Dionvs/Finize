const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('/* ---------- Update 2: slimme spaardoelenplanner ---------- */');
const end = html.indexOf('function u2ActiveChild', start);
assert.ok(start >= 0 && end > start, 'Update 2 rekenmotor is niet gevonden');

const context = {
  console,
  Math,
  Date,
  Object,
  Array,
  Number,
  String,
  Map,
  Set,
  isPlainObject: value => value !== null && typeof value === 'object' && !Array.isArray(value),
  round2: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
  uid: (() => { let id = 0; return () => `test-${++id}`; })(),
  clone: value => JSON.parse(JSON.stringify(value)),
  state: { spaardoelGeschiedenis: {} },
  TODAY: new Date(2026, 6, 23),
  monthlyRateFromGoal: goal => {
    const rate = Number(goal.rendement) || 0;
    return goal.rendementPeriode === 'maandelijks' ? rate : (rate ? Math.pow(1 + rate, 1 / 12) - 1 : 0);
  },
  monthsRemaining: (target, today) => {
    if (!target) return null;
    const date = new Date(target);
    return Math.max(1, (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth());
  },
  futureValue: (current, monthly, rate, months) => {
    if (!rate) return current + monthly * months;
    const growth = Math.pow(1 + rate, months);
    return current * growth + monthly * ((growth - 1) / rate);
  },
  calcDoel: null,
  calcGroep: null
};
vm.createContext(context);

const tests = `
${html.slice(start, end)}
const goals = [
  {id:'k',naam:'Koffie',doelbedrag:500,algespaard:0,doeldatum:'2026-12-31',vasteInleg:0,rendement:0,rendementPeriode:'jaarlijks',ratoVerdeling:true,eigenaar:'gezamenlijk',subdoelen:[]},
  {id:'b',naam:'Buffer',doelbedrag:1500,algespaard:0,doeldatum:'2026-12-31',vasteInleg:200,rendement:0,rendementPeriode:'jaarlijks',ratoVerdeling:true,eigenaar:'gezamenlijk',subdoelen:[]},
  {id:'i',naam:'Belegging',doelbedrag:2000,algespaard:0,doeldatum:'2026-12-31',vasteInleg:250,rendement:0,rendementPeriode:'jaarlijks',ratoVerdeling:false,eigenaar:'gezamenlijk',subdoelen:[]}
];
globalThis.testNormal = calcGroep(goals, 1000, new Date(2026,6,23));
globalThis.testLow = calcGroep(goals, 300, new Date(2026,6,23));
const parent = {naam:'Koffie',doelbedrag:0,algespaard:320,subdoelen:[
  {id:'1',naam:'Maler',doelbedrag:300},
  {id:'2',naam:'Tamper',doelbedrag:50},
  {id:'3',naam:'Station',doelbedrag:80}
]};
u2NormalizeChildren(parent);
globalThis.testParent = parent;
`;
vm.runInContext(tests, context, { filename: 'update2-inline.js' });

assert.deepEqual(
  Array.from(context.testNormal, item => item.werkelijkeInleg),
  [137.5, 612.5, 250],
  'De normale vaste plus ratoverdeling wijkt af'
);
assert.equal(context.testNormal[0].berekendeExtraInleg, 137.5);
assert.equal(context.testNormal[1].berekendeExtraInleg, 412.5);
assert.equal(context.testNormal[2].berekendeExtraInleg, 0);
assert.equal(context.testNormal[0].onverdeeld, 0);

assert.ok(context.testLow.every(item => item.onvoldoendeVasteInleg));
assert.ok(context.testLow.every(item => item.werkelijkeInleg === 0));

assert.equal(context.testParent.doelbedrag, 430);
assert.equal(context.testParent.algespaard, 320);
assert.deepEqual(
  Array.from(context.testParent.subdoelen, child => [child.gespaard, child.voltooid]),
  [[300, true], [20, false], [0, false]],
  'Bestaand saldo is niet correct van boven naar beneden gemigreerd'
);

const accordionStart = html.indexOf('const u2OriginalMobileGoalRow=renderMobileGoalRow;');
const accordionEnd = html.indexOf('renderMobileSpaardoelen=function(){', accordionStart);
assert.ok(accordionStart >= 0 && accordionEnd > accordionStart, 'Subdoelaccordeon is niet gevonden');
const accordionContext = {
  renderMobileGoalRow: () => '<div class="mobile-goal-row"><div>Doel</div></div>',
  u2ActiveChild: goal => goal.subdoelen.find(child => !child.voltooid),
  textSafe: value => String(value),
  eur: value => `€${Number(value).toFixed(2)}`
};
vm.createContext(accordionContext);
vm.runInContext(`${html.slice(accordionStart, accordionEnd)}
globalThis.plainRow=renderMobileGoalRow({doel:{id:'plain',subdoelen:[]}},'dion');
globalThis.accordionRow=renderMobileGoalRow({doel:{id:'parent',subdoelen:[
  {id:'one',naam:'Eerste',doelbedrag:100,gespaard:100,voltooid:true},
  {id:'two',naam:'Tweede',doelbedrag:50,gespaard:20,voltooid:false}
]}},'dion');`, accordionContext);
assert.equal(accordionContext.plainRow.includes('u2-goal-accordion'), false, 'Gewoon doel werd onterecht een accordeon');
assert.equal(accordionContext.accordionRow.includes('u2-goal-accordion'), true, 'Hoofddoel met subdoelen mist de accordeon');
assert.equal(accordionContext.accordionRow.includes('Eerste'), true);
assert.equal(accordionContext.accordionRow.includes('Tweede'), true);
assert.equal(accordionContext.accordionRow.includes('Subdoelen beheren'), true);

console.log('UPDATE2_CALCULATIONS_OK');
