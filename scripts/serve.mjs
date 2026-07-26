import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.FINIZE_TEST_PORT || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = path.resolve(root, `.${relative}`);
  if (!target.startsWith(root + path.sep)) {
    response.writeHead(403).end("Verboden");
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Geen bestand");
    response.writeHead(200, { "Content-Type": mime.get(path.extname(target)) || "application/octet-stream" });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404).end("Niet gevonden");
  }
}).listen(port, "127.0.0.1", () => console.log(`Finize testserver op http://127.0.0.1:${port}`));
