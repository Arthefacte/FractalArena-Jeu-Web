// bake-boot-render.mjs — rend l'emblème texturé (boot #5) sous plusieurs angles
// sur fond navy, pour juger son allure avant de cadrer le splash. Screenshots dans _bake/.
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

// quelques angles : 3/4 gauche, face, 3/4 droite, léger plongée
const ANGLES = [
  { name: "a-troisquart-g", q: "ry=-0.6&rx=0.12" },
  { name: "b-face",         q: "ry=0&rx=0.05" },
  { name: "c-troisquart-d", q: "ry=0.6&rx=0.12" },
  { name: "d-plongee",      q: "ry=-0.4&rx=0.35" },
];
for (const a of ANGLES) {
  await page.goto(`http://localhost:${port}/_bake/bake-boot.html?${a.q}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__baked === true, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__bakeError);
  const dbg = await page.evaluate(() => window.__dbg);
  if (err) { console.log(`✗ ${a.name}: ${err}`); continue; }
  await page.screenshot({ path: path.join(ROOT, "_bake", `boot-emblem-${a.name}.png`) });
  console.log(`✔ ${a.name} | dims=${JSON.stringify(dbg.size)} meshes=${dbg.meshCount}`);
}
await browser.close(); server.close();
console.log("terminé.");
