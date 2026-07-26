import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(path.join(root, "index.html"), "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const temp = await mkdtemp(path.join(os.tmpdir(), "finize-syntax-"));

try {
  const files = ["app.js", "src/import/update4-runtime.cjs", "service-worker.js"];
  for (let index = 0; index < inlineScripts.length; index += 1) {
    const name = `inline-${index}.js`;
    await writeFile(path.join(temp, name), inlineScripts[index], "utf8");
    files.push(path.join(temp, name));
  }
  for (const file of files) {
    const target = path.isAbsolute(file) ? file : path.join(root, file);
    const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || `Syntaxfout in ${file}`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(`JavaScript-syntax geldig, inclusief ${inlineScripts.length} inline scripts.`);
