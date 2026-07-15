// bake-assemble.mjs — capture l'animation d'assemblage 3D (7 pièces) en sprite-sheet WebP.
// Sortie : _bake/_assemble-sheet.txt (data URI) + meta imprimée.
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
const page = await (await browser.newContext({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
await page.goto(`http://localhost:${port}/_bake/bake-fragments.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log("ERREUR chargement:", err); await browser.close(); server.close(); process.exit(1); }
console.log("pièces détectées:", await page.evaluate(() => window.__parts));

const F = 32, CELL = 220;
const canvasEl = await page.$("#stage canvas");
const pngs = [];
for (let f = 0; f < F; f++) {
  await page.evaluate((t) => window.__setT(t), f / (F - 1));   // rend + gl.finish()
  const buf = await canvasEl.screenshot({ omitBackground: true }); // méthode éprouvée
  pngs.push("data:image/png;base64," + buf.toString("base64"));
}
// convertit chaque PNG → WebP via <img>.decode()+drawImage (fiable, pas de readback WebGL)
const frames = await page.evaluate(async ({ pngs, CELL }) => {
  const c = document.createElement("canvas"); c.width = CELL; c.height = CELL;
  const ctx = c.getContext("2d");
  const out = [];
  for (const p of pngs) {
    const img = new Image(); img.src = p; await img.decode();
    ctx.clearRect(0, 0, CELL, CELL); ctx.drawImage(img, 0, 0, CELL, CELL);
    out.push(c.toDataURL("image/webp", 0.82));
  }
  return out;
}, { pngs, CELL });

const total = frames.reduce((s, d) => s + d.length, 0);
fs.writeFileSync(path.join(ROOT, "_bake", "_assemble-frag-frames.json"), JSON.stringify({ F, CELL, frames }));
fs.writeFileSync(path.join(ROOT, "_bake", "_assemble-frag-last.webp"), Buffer.from(frames[F-1].split(",")[1], "base64"));
fs.writeFileSync(path.join(ROOT, "_bake", "_assemble-frag-mid.webp"), Buffer.from(frames[Math.floor(F*0.4)].split(",")[1], "base64"));
console.log(`${F} frames @ ${CELL}px | total ${Math.round(total/1024)} Ko | moy ${Math.round(total/F/1024*10)/10} Ko/frame`);
await browser.close(); server.close();
