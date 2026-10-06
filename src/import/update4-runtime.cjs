const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const file = path.join(__dirname, 'runtime.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  .replace(/import \{ cloneState as clone \} from "..\/core\/state.js";/, 'const clone = value => JSON.parse(JSON.stringify(value));')
  .replace(/import \{([^}]+)\} from '([^']+)';/g, (_, names, file) => `const {${names}} = require('${file}');`)
  .replace('root.FinizeUpdate4Runtime=api;\n  api.install(root);', 'module.exports=api;')
  .replace(/const FinizeImportRuntime=globalThis.FinizeUpdate4Runtime;\s*export \{ FinizeImportRuntime \};\s*$/, '');
const runtime = new Module(file, module);
runtime.filename = file;
runtime.paths = module.paths;
runtime._compile(source, file);
module.exports = runtime.exports;
