import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = (await readdir(path.join(root, "tests")))
  .filter(file => /\.test\.(cjs|mjs)$/.test(file) && !file.includes('-emulator.test.'))
  .sort();

// Pure backend tests import the same generated shared modules as the deployment.
await import('../functions/build.mjs');
console.log(`${tests.length} Node-testbestanden; bankretentie-emulatortest afzonderlijk (vereist loopback-emulator 8189).`);
const result = spawnSync(process.execPath, ['--test','--test-concurrency=1',...tests.map(test=>path.join('tests',test))], {cwd:root,stdio:'inherit'});
process.exit(result.status ?? 1);
