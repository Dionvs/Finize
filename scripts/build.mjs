import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styleSources = [
  ["styles", "tokens.css"],
  ["styles", "base.css"],
  ["styles", "auth.css"],
  ["styles", "settings.css"],
  ["styles", "goals.css"],
  ["styles", "dashboard.css"],
  ["styles", "import.css"],
  ["styles", "tablet.css"],
  ["styles", "desktop.css"],
  ["styles", "iphone.css"]
];
const normalize = value => value.replace(/\r\n/g, "\n").trim() + "\n";

async function bundleSources(sources, label) {
  const parts = await Promise.all(sources.map(async ([folder, file]) => {
    const source = normalize(await readFile(path.join(root, "src", folder, file), "utf8"));
    return `/* ${label}: ${file} */\n${source}`;
  }));
  return parts.join("\n");
}

async function buildJavaScript() {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch (error) {
    const localModules = process.env.FINIZE_TOOLING_NODE_MODULES;
    if (!localModules) throw error;
    esbuild = await import(pathToFileURL(path.join(localModules, "esbuild", "lib", "main.js")).href);
  }
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ["src/app-entry.js"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    sourcemap: false,
    minify: false,
    legalComments: "none",
    treeShaking: false,
    charset: "utf8",
    logLevel: "silent"
  });
  return normalize(result.outputFiles[0].text);
}

const outputs = new Map([
  ["app.css", await bundleSources(styleSources, "Finize bron")],
  ["app.js", await buildJavaScript()]
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
