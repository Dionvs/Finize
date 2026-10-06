const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const data = require('../../src/core/data-normalization.mjs');
const source = fs.readFileSync(path.join(__dirname, '../../src/core/runtime.js'), 'utf8');

module.exports = function migrationRuntime(options = {}) {
  const logs = [];
  const context = {
    ...data,
    ...require('../../src/core/planning-timeline.mjs'),
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    Date, Math, Number, String, Array, Object, JSON,
    clone: value => JSON.parse(JSON.stringify(value)),
    round2: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    sumBedrag: rows => rows.reduce((sum,row)=>sum+(Number(row.bedrag)||0),0),
    bankText: value => String(value || '').trim().toLowerCase(),
    monthKey: () => { throw new Error('Wall clock used by pure migration'); },
    uid: () => { throw new Error('Random ID used by pure migration'); },
    getDeviceId: () => { throw new Error('Device used by pure migration'); },
    state: { sentinel: 'active state must not change' },
    window: {},
    ...options
  };
  vm.createContext(context);
  for (const [start,end] of [
    ['function normalizeGoalDefaults','function getMonthlyBaseIncome'],
    ['function ensureRowIds','function isPlainObject'],
    ['function isPlainObject','function backupLabel']
  ]) vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),context);
  context.logs = logs;
  return context;
};
