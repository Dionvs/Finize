import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/styles/tokens.css",
  "src/styles/base.css",
  "src/styles/goals.css",
  "src/styles/dashboard.css",
  "src/styles/import.css",
  "src/styles/desktop.css"
];

let postcss;
try {
  ({ default: postcss } = await import("postcss"));
} catch (error) {
  const localModules = process.env.FINIZE_TOOLING_NODE_MODULES;
  if (!localModules) throw error;
  ({ default: postcss } = await import(pathToFileURL(path.join(localModules, "postcss", "lib", "postcss.mjs")).href));
}

const sources = await Promise.all(files.map(file => readFile(path.join(root, file), "utf8")));
const roots = sources.map((source, index) => postcss.parse(source, { from: files[index] }));
const seen = new Map();
let removable = 0;

const contextKey = node => {
  const ancestors = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule") ancestors.unshift(`@${parent.name} ${parent.params}`);
  }
  return ancestors.join(" > ");
};

roots.forEach((ast, fileIndex) => {
  ast.walkRules(rule => {
    const context = contextKey(rule);
    rule.walkDecls(decl => {
      const key = [
        context,
        rule.selector,
        decl.prop.toLowerCase(),
        decl.value.trim(),
        decl.important ? "important" : "normal"
      ].join("\u0000");
      const previous = seen.get(key);
      if (previous) {
        previous.decl.remove();
        removable += 1;
      }
      seen.set(key, { decl, fileIndex });
    });
  });
});

if (process.argv.includes("--write")) {
  await Promise.all(roots.map((ast, index) => writeFile(path.join(root, files[index]), ast.toString(), "utf8")));
}

console.log(`${removable} identieke, later herhaalde CSS-declaraties ${process.argv.includes("--write") ? "verwijderd" : "gevonden"}.`);
