// bake-boot-emblem.mjs — rend l'emblème texturé (boot #5) face frontale, léger tilt,
// fond TRANSPARENT (screenshot du canvas, omitBackground) → assets/boot-emblem.png
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".glb":"model/gltf-binary", ".json":"application/json", ".wasm":"application/wasm" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 460, height: 460 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`http://localhost:${port}/_bake/bake-boot.html?ry=0&rx=0.05`, { waitUntil: "load" });
await page.waitForFunction(() => window.__baked === true, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__bakeError);
if (err) { console.log("ERREUR:", err); await browser.close(); server.close(); process.exit(1); }
const canvas = await page.$("#stage canvas");
const out = path.join(ROOT, "assets", "boot-emblem.png");
await canvas.screenshot({ path: out, omitBackground: true });
console.log("écrit:", out, "(" + Math.round(fs.statSync(out).size / 1024) + " Ko)");
await browser.close(); server.close();
