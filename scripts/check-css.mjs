import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let postcss;
try {
  ({ default: postcss } = await import("postcss"));
} catch (error) {
  const localModules = process.env.FINIZE_TOOLING_NODE_MODULES;
  if (!localModules) throw error;
  ({ default: postcss } = await import(pathToFileURL(path.join(localModules, "postcss", "lib", "postcss.mjs")).href));
}
const css = await readFile(path.join(root, "app.css"), "utf8");
const ast = postcss.parse(css, { from: "app.css" });
const defined = new Set();
const used = new Set();
const runtimeTokens = new Set(["--pct", "--used-pct"]);

ast.walkDecls(decl => {
  if (decl.prop.startsWith("--")) defined.add(decl.prop);
  for (const match of decl.value.matchAll(/var\((--[\w-]+)/g)) used.add(match[1]);
});

const undefinedTokens = [...used].filter(token => !defined.has(token) && !runtimeTokens.has(token)).sort();
if (undefinedTokens.length) {
  console.warn(`Bekende v50-tokens zonder definitie: ${undefinedTokens.join(", ")}`);
}
console.log(`CSS geldig: ${ast.nodes.length} hoofdnodes, ${undefinedTokens.length} bekende ongedefinieerde tokens.`);
