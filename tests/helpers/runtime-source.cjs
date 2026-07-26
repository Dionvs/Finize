const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const files = [
  'src/core/runtime.js',
  'src/import/runtime.js',
  'src/ui/presentation.js',
  'src/storage/service-worker-registration.js'
];

module.exports = files
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
