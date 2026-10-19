// probe-parts.mjs — quel GLB, découpé en blocs, donne les 7 morceaux de l'animation ?
// Sert uniquement à choisir la source : n'écrit aucun asset.
// Usage : node _bake/probe-parts.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// playwright vit dans desktop/qa/node_modules (dependance de QA), pas a la racine.
const requireQA = createRequire("C:/Users/PC/orca/workspaces/fractal-arena-web/app-pc-native/desktop/qa/x.js");
const { chromium } = requireQA("playwright");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser;
try { browser = await chromium.launch(); }
catch (e) { console.log("chromium Playwright indisponible -> Chrome systeme :", e.message.split("\n")[0]); browser = await chromium.launch({ channel: "chrome" }); }

const candidats = ["_bake/raw/emblem-12mo.glb", "_bake/raw/emblem-web.glb", "_bake/raw/logo3d.glb"];
const grilles = [[3, 3, 1], [2, 2, 2], [7, 1, 1], [3, 2, 1], [4, 2, 1], [2, 2, 1]];

for (const glb of candidats) {
  for (const [nx, ny, nz] of grilles) {
    const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
    let err = null;
    page.on("pageerror", (e) => { err = e.message; });
    await page.goto(`http://localhost:${port}/_bake/bake-fragments-probe.html?glb=${encodeURIComponent("/" + glb)}&nx=${nx}&ny=${ny}&nz=${nz}`, { waitUntil: "load" });
    try {
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    } catch (e) { console.log(glb, `${nx}x${ny}x${nz}`, "TIMEOUT"); await page.close(); continue; }
    const pageErr = await page.evaluate(() => window.__err);
    const parts = await page.evaluate(() => window.__parts);
    const tri = await page.evaluate(() => (window.__dbg ? window.__dbg().parts : -1));
    console.log(`${glb.padEnd(28)} ${nx}x${ny}x${nz}  parts=${parts}  dbg=${tri}${pageErr ? "  ERR=" + pageErr.split("\n")[0] : ""}${err ? "  PAGEERR=" + err : ""}`);
    await page.close();
  }
}
await browser.close();
server.close();
