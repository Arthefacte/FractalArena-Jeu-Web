// bake.mjs — rend chaque GLB de nav en PNG transparent via Playwright.
// Sert la racine du repo (pour vendor/ + _bake/raw/), navigue sur _bake/bake.html?key=…,
// attend le rendu, capture le canvas en PNG (fond transparent), écrit assets/nav-icons/{key}.png
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "nav-icons");
fs.mkdirSync(OUT, { recursive: true });

const KEYS = ["team","fosse","arene","campaign","tour","quests","forge","market","wallet","boosts","perso","leaderboard","options"];

const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".glb":"model/gltf-binary", ".json":"application/json", ".wasm":"application/wasm" };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
console.log("serveur bake sur :" + port);

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 320, height: 320 } });
const page = await ctx.newPage();

for (const key of KEYS) {
  await page.goto(`http://localhost:${port}/_bake/bake.html?key=${key}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__baked === true, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__bakeError);
  if (err) { console.error(`  ✗ ${key}: ${err}`); continue; }
  const canvas = await page.$("#stage canvas");
  await canvas.screenshot({ path: path.join(OUT, `${key}.png`), omitBackground: true });
  const bytes = fs.statSync(path.join(OUT, `${key}.png`)).size;
  console.log(`  ✓ ${key}.png (${(bytes/1024).toFixed(0)} Ko)`);
}

await browser.close();
server.close();
console.log("terminé.");
