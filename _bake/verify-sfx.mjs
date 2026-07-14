// verify-sfx.mjs — vérifie le câblage du module SFX dans un vrai navigateur.
// On ne peut pas "entendre" en headless, mais on instrumente AudioContext pour
// compter les oscillateurs réellement démarrés → preuve que chaque son génère du signal.
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
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.addInitScript(() => {
  // instrumente AudioContext : compte instances + oscillateurs démarrés
  const RealAC = window.AudioContext || window.webkitAudioContext;
  window.__acCount = 0; window.__oscStarts = 0;
  function Wrapped() {
    window.__acCount++;
    const c = new RealAC();
    const co = c.createOscillator.bind(c);
    c.createOscillator = () => { const o = co(); const s = o.start.bind(o); o.start = (...x) => { window.__oscStarts++; return s(...x); }; return o; };
    return c;
  }
  window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
  // seed état (cf. skill verify)
  const orig = Object.getOwnPropertyDescriptor(window, "FA_TALENTS_UI");
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try {
      const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qsfxverify000000000000000000000", options: { sound: true, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1");
    } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

const api = await page.evaluate(() => ({ hasSfx: !!window.FA_SFX, hasPlay: !!(window.FA_SFX && window.FA_SFX.play), hasEnable: !!(window.FA_SFX && window.FA_SFX.setEnabled) }));
console.log("FA_SFX présent:", api.hasSfx, "| play:", api.hasPlay, "| setEnabled:", api.hasEnable);

// clic réel sur un onglet nav = geste utilisateur (débloque l'audio) + son "tab"
await page.locator(".nav-tab").nth(1).evaluate((el) => el.click());
await page.waitForTimeout(200);

// joue chaque son, compte les oscillateurs
const res = await page.evaluate(async () => {
  const names = ["click","tab","open","close","success","error","victory","defeat"];
  const out = {};
  for (const n of names) {
    const before = window.__oscStarts;
    let err = null;
    try { window.FA_SFX.play(n); } catch (e) { err = String(e); }
    await new Promise((r) => setTimeout(r, 30));
    out[n] = { osc: window.__oscStarts - before, err };
  }
  // test du toggle : coupé → aucun oscillateur
  window.FA_SFX.setEnabled(false);
  const b = window.__oscStarts; window.FA_SFX.play("victory");
  await new Promise((r) => setTimeout(r, 20));
  const mutedOsc = window.__oscStarts - b;
  window.FA_SFX.setEnabled(true);
  return { out, mutedOsc, acCount: window.__acCount };
});

console.log("AudioContext instanciés:", res.acCount);
let bad = 0;
for (const [n, v] of Object.entries(res.out)) {
  const ok = v.osc > 0 && !v.err;
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${n}: ${v.osc} oscillateur(s)${v.err ? " ERR=" + v.err : ""}`);
}
console.log(`toggle OFF → ${res.mutedOsc} oscillateur (attendu 0)`);
const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log("erreurs console pertinentes:", realErrors.length, realErrors.slice(0, 5));
console.log((bad === 0 && res.mutedOsc === 0 && api.hasSfx) ? "RESULTAT: OK" : "RESULTAT: ECHEC");

await browser.close(); server.close();
