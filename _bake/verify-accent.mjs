// verify-accent.mjs — vérifie l'accent contextuel (#4) : pour chaque écran, le clic
// sur l'onglet pose body[data-view] et fait résoudre --accent à la couleur attendue.
// Capture un screenshot par écran pour contrôle visuel. Aucune erreur console tolérée.
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
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qaccent00000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

// normalise une couleur résolue en hex majuscule. getComputedStyle sur une custom
// property renvoie déjà l'hex authored (ex "#00F0FF") ; on gère aussi le cas rgb().
function toHex(v) {
  v = (v || "").trim();
  if (v.startsWith("#")) return v.toUpperCase();
  const m = v.match(/\d+/g); if (!m) return v;
  return "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
}
// accent attendu par écran (doit refléter styles.css). Utilitaires → cyan défaut.
const EXPECT = {
  team: "#00F0FF", fosse: "#F7931A", arene: "#FF2D78", campaign: "#27E08A",
  tour: "#3B82F6", forge: "#B026FF", market: "#FFE600", quests: "#FFE600",
  options: "#00F0FF", wallet: "#00F0FF",
};
// ordre des onglets = app.jsx Nav()
const ORDER = ["team","fosse","arene","campaign","tour","quests","forge","market","wallet","boosts","perso","leaderboard","options"];

let ok = 0, ko = 0;
for (const view of Object.keys(EXPECT)) {
  const idx = ORDER.indexOf(view);
  await page.locator(".nav-tab").nth(idx).evaluate((el) => el.click());
  await page.waitForTimeout(500); // laisse la transition .35s se poser
  const got = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { dataView: document.body.dataset.view, accent: cs.getPropertyValue("--accent").trim() };
  });
  const gotHex = toHex(got.accent);
  const want = EXPECT[view];
  const pass = got.dataView === view && gotHex === want;
  console.log(`${pass ? "OK " : "KO "} ${view.padEnd(10)} data-view=${(got.dataView||"?").padEnd(10)} --accent=${gotHex} (attendu ${want})`);
  if (pass) ok++; else ko++;
  await page.screenshot({ path: path.join(ROOT, "_bake", `verify-accent-${view}.png`) });
}
const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log(`\naccents OK: ${ok}/${ok + ko} | erreurs console: ${realErrors.length}`, realErrors.slice(0, 5));
console.log((ko === 0 && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
