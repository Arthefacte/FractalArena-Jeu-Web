// capture-regen.mjs — one-off : rend le Regen Core (assets/cores/regen_core.glb) en rotation,
// capture 24 frames PNG → _bake/frames/regen_XX.png, pour assembler un GIF (ffmpeg).
// Usage : NODE_PATH="$(npm root -g)" node _bake/capture-regen.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "_bake", "frames");
fs.mkdirSync(OUT, { recursive: true });
const N_FRAMES = 24;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  let file = path.join(ROOT, p);
  // anti-traversal
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 384, height: 384 } });
console.log("ouverture spin-regen.html…");
await page.goto(`http://127.0.0.1:${port}/_bake/spin-regen.html`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction("window.__ready === true", { timeout: 120000 });
console.log("modèle chargé, capture de", N_FRAMES, "frames…");

const canvas = await page.$("canvas");
for (let i = 0; i < N_FRAMES; i++) {
  const a = (i / N_FRAMES) * Math.PI * 2;
  await page.evaluate((ang) => window.setSpin(ang), a);
  await new Promise((r) => setTimeout(r, 120));
  await canvas.screenshot({ path: path.join(OUT, `regen_${String(i).padStart(2, "0")}.png`) });
}
console.log("done —", N_FRAMES, "frames dans", OUT);
await browser.close();
server.close();
