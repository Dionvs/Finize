import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styleSources = [
  ["styles", "tokens.css"],
  ["styles", "base.css"],
  ["styles", "goals.css"],
  ["styles", "dashboard.css"],
  ["styles", "import.css"],
  ["styles", "desktop.css"]
];
const scriptFiles = ["00-bootstrap.js", "10-core.js", "20-update4.js", "30-update5.js", "40-service-worker-registration.js"];
const normalize = value => value.replace(/\r\n/g, "\n").trim() + "\n";

async function bundleSources(sources, label) {
  const parts = await Promise.all(sources.map(async ([folder, file]) => {
    const source = normalize(await readFile(path.join(root, "src", folder, file), "utf8"));
    return `/* ${label}: ${file} */\n${source}`;
  }));
  return parts.join("\n");
}

async function bundleLegacy(folder, files, label) {
  return bundleSources(files.map(file => [`legacy/${folder}`, file]), label);
}

const outputs = new Map([
  ["app.css", await bundleSources(styleSources, "Finize bron")],
  ["app.js", await bundleLegacy("scripts", scriptFiles, "Finize v50 bron")]
]);

if (process.argv.includes("--check")) {
  const mismatches = [];
  for (const [file, expected] of outputs) {
    const actual = await readFile(path.join(root, file), "utf8").catch(() => "");
    if (actual.replace(/\r\n/g, "\n") !== expected) mismatches.push(file);
  }
  if (mismatches.length) {
    throw new Error(`Gegenereerde runtime is niet actueel: ${mismatches.join(", ")}`);
  }
  console.log("Gegenereerde runtime is byte-reproduceerbaar.");
} else {
  await Promise.all([...outputs].map(([file, content]) => writeFile(path.join(root, file), content, "utf8")));
  console.log("app.js en app.css reproduceerbaar gebouwd.");
}
