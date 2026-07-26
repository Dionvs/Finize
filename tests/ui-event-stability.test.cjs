const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = require('./helpers/runtime-source.cjs');
const bindStart = html.indexOf('function bindInputs(root)');
const bindEnd = html.indexOf('/* ---------- tabel-editor', bindStart);
const bindings = html.slice(bindStart, bindEnd);

assert.doesNotMatch(bindings, /type === 'checkbox'\)\s*el\.addEventListener\('click'/);
assert.doesNotMatch(bindings, /el\.type !== 'checkbox'\)\s*el\.addEventListener\('blur'/);
assert.match(bindings, /JSON\.stringify\(getPath\(state,path\)\)===JSON\.stringify\(v\)/);
assert.match(bindings, /JSON\.stringify\(item\[field\]\)===JSON\.stringify\(value\)/);
assert.match(html, /function bindModalBackdrop\(modal,close\)/);
assert.doesNotMatch(html, /modal\.addEventListener\('click',[^\n]+\{once:true\}/);
assert.match(html, /JSON\.stringify\(before\)===JSON\.stringify\(state\)\)return true/);

console.log('UI_EVENT_STABILITY_OK');
