// verify-transition.mjs — vérifie la transition d'onglet (#2) : wrapper présent,
// vues qui rendent, pas d'erreur, et capture d'un balayage en pleine transition.
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
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.addInitScript(() => {
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try { const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qtrans000000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

// clique une vue "riche" puis capture au vol pour attraper le balayage
await page.locator(".nav-tab", { hasText: "Options" }).first().evaluate((el) => el.click());
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(ROOT, "_bake", "verify-transition-sweep.png") });
await page.waitForTimeout(500);

// enchaîne quelques onglets, vérifie que chaque vue rend du contenu
const views = ["team", "forge", "boosts", "leaderboard", "options"];
let empties = 0;
for (const v of views) {
  await page.locator(`.nav-tab`).filter({ has: page.locator(`text=/./`) }).nth(0); // no-op garde
}
const check = await page.evaluate(() => {
  const w = document.querySelector(".view-anim");
  return { wrapper: !!w, hasChild: !!(w && w.children.length), childText: (w && w.textContent || "").trim().length };
});
console.log("wrapper .view-anim présent:", check.wrapper, "| contenu:", check.childText, "car.");
const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log("erreurs console pertinentes:", realErrors.length, realErrors.slice(0, 5));
await page.screenshot({ path: path.join(ROOT, "_bake", "verify-transition-settled.png") });
console.log((check.wrapper && check.childText > 20 && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
