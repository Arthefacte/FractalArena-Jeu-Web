// verify-nav.mjs — vérifie le rendu des icônes de nav bakées dans un vrai navigateur.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".jsx":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".glb":"model/gltf-binary", ".wasm":"application/wasm", ".svg":"image/svg+xml" };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

// Seed : wallet factice + roster de test + pas de tuto (cf. skill verify).
await page.addInitScript(() => {
  const orig = Object.getOwnPropertyDescriptor(window, "FA_TALENTS_UI");
  Object.defineProperty(window, "FA_TALENTS_UI", {
    configurable: true,
    set(v) {
      try {
        const roster = window.FA_DATA.starterRoster();
        localStorage.setItem("fractal_arena_v1", JSON.stringify({
          roster, view: "team", lang: "FR", wallet: "bc1qverifynavicons000000000000000000",
          options: { sound: false, speed: 1 },
        }));
        localStorage.setItem("fractal_arena_tutorial_v1", "1");
      } catch (e) {}
      Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
    },
  });
});

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {}); // ferme la modale cadeau si présente

// Vérifie les 13 icônes.
const report = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll(".nav-icon")];
  return imgs.map((im) => ({
    src: im.getAttribute("src"),
    loaded: im.complete && im.naturalWidth > 0,
    w: im.naturalWidth,
  }));
});
console.log("icônes trouvées:", report.length);
let bad = 0;
for (const r of report) { const key = (r.src||"").split("/").pop(); if (!r.loaded) { bad++; console.log("  ✗ NON CHARGÉE:", key); } else { console.log("  ✓", key, `(${r.w}px)`); } }
const labels = await page.evaluate(() => [...document.querySelectorAll(".nav-label")].map((s) => s.textContent));
console.log("labels:", JSON.stringify(labels));

const nav = await page.$(".nav");
if (nav) await nav.screenshot({ path: path.join(ROOT, "_bake", "verify-nav.png") });
await page.screenshot({ path: path.join(ROOT, "_bake", "verify-full.png") });
console.log(bad === 0 ? "RESULTAT: OK (13/13 chargées)" : `RESULTAT: ECHEC (${bad} non chargées)`);

await browser.close(); server.close();
