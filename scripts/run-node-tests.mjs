import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = (await readdir(path.join(root, "tests")))
  .filter(file => file.endsWith(".test.cjs"))
  .sort();

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join("tests", test)], {
    cwd: root,
    encoding: "utf8"
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`${tests.length} Node-tests geslaagd.`);
