import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(path.join(root, "index.html"), "utf8");
const normalize = value => value.replace(/\r\n/g, "\n").trim() + "\n";
const inlineStyles = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map(match => normalize(match[1]));
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => normalize(match[1]));

if (inlineStyles.length !== 2 || inlineScripts.length !== 3) {
  throw new Error(`Onverwachte v50-bron: ${inlineStyles.length} styleblokken en ${inlineScripts.length} scriptblokken.`);
}

const styleDir = path.join(root, "src", "legacy", "styles");
const scriptDir = path.join(root, "src", "legacy", "scripts");
await mkdir(styleDir, { recursive: true });
await mkdir(scriptDir, { recursive: true });

const styleSources = [
  ["00-core.css", inlineStyles[0]],
  ["10-late.css", inlineStyles[1]],
  ["20-update4.css", normalize(await readFile(path.join(root, "update4.css"), "utf8"))],
  ["30-update5.css", normalize(await readFile(path.join(root, "update5.css"), "utf8"))]
];
const scriptSources = [
  ["00-bootstrap.js", inlineScripts[0]],
  ["10-core.js", inlineScripts[1]],
  ["20-update4.js", normalize(await readFile(path.join(root, "update4.js"), "utf8"))],
  ["30-update5.js", normalize(await readFile(path.join(root, "update5.js"), "utf8"))],
  ["40-service-worker-registration.js", inlineScripts[2]]
];

await Promise.all([
  ...styleSources.map(([name, content]) => writeFile(path.join(styleDir, name), content, "utf8")),
  ...scriptSources.map(([name, content]) => writeFile(path.join(scriptDir, name), content, "utf8"))
]);

console.log(`V50-runtime uitgepakt: ${styleSources.length} stijl- en ${scriptSources.length} scriptfragmenten.`);
