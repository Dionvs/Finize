import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "index.html");
let html = await readFile(file, "utf8");

if (html.includes('href="./app.css') || html.includes('src="./app.js')) {
  throw new Error("index.html gebruikt de app-runtime al.");
}

html = html
  .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>\s*/gi, "")
  .replace(/<link rel="stylesheet" href="\.\/update[45]\.css[^"]*">\s*/gi, "")
  .replace(/<script src="\.\/update[45]\.js[^"]*"><\/script>\s*/gi, "")
  .replace(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>[\s\S]*?<\/script>\s*/gi, "");

html = html
  .replace("</head>", '<link rel="stylesheet" href="./app.css?v=53-code-cleanup">\n</head>')
  .replace("</body>", '<script src="./app.js?v=53-code-cleanup"></script>\n</body>')
  .replace(/\r\n/g, "\n");

await writeFile(file, html, "utf8");
console.log("index.html gebruikt nu uitsluitend app.css en app.js.");
