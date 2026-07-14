// verify-foil.mjs — vérifie le foil holographique des cartes (#3) : overlay présent,
// survol → foil visible + tilt appliqué, capture d'une carte survolée.
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.addInitScript(() => {
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try { const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qfoil0000000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

const nCards = await page.locator(".card").count();
const nFoil = await page.locator(".card .foil").count();
console.log("cartes:", nCards, "| overlays .foil:", nFoil);

const card = page.locator(".card").first();
const box = await card.boundingBox();
// survol + mouvement du curseur sur la carte (déclenche tilt + reflet)
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35);
await page.waitForTimeout(60);
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 5 });
await page.waitForTimeout(80);

const state = await card.evaluate((el) => {
  const cs = getComputedStyle(el);
  const foilOpacity = getComputedStyle(el.querySelector(".foil")).opacity;
  return { transform: cs.transform, rx: el.style.getPropertyValue("--rx"), ry: el.style.getPropertyValue("--ry"), mx: el.style.getPropertyValue("--mx"), foilOpacity };
});
console.log("transform (≠ none/identity attendu):", state.transform.slice(0, 60));
console.log("vars tilt:", { rx: state.rx, ry: state.ry, mx: state.mx });
console.log("foil opacity au survol (>0 attendu):", state.foilOpacity);

await card.screenshot({ path: path.join(ROOT, "_bake", "verify-foil.png") });

const tiltApplied = !!state.rx && state.rx !== "0deg";
const foilVisible = parseFloat(state.foilOpacity) > 0.05;
const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log("erreurs console pertinentes:", realErrors.length, realErrors.slice(0, 5));
console.log((nCards > 0 && nFoil === nCards && tiltApplied && foilVisible && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
