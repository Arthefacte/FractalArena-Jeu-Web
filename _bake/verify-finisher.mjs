// verify-finisher.mjs — vérifie le finisher (#6) : le canvas apparaît, peint l'accent
// de l'écran, se retire, et appelle onDone. Capture 3 beats par cas pour contrôle
// visuel. Lancement : NODE_PATH="$(npm root -g)" node _bake/verify-finisher.mjs
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
// Même seed que verify-accent.mjs : roster starter + tuto vu, pour arriver sur le jeu.
await page.addInitScript(() => {
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try { const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qfinisher0000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_FINISHER).catch(() => {});
await page.waitForTimeout(8000);   // boot (≥2400 ms) + montage React
await page.keyboard.press("Escape").catch(() => {});

let ok = 0, ko = 0;
const check = (label, pass, info) => { console.log(`${pass ? "OK " : "KO "} ${label}${info ? " — " + info : ""}`); pass ? ok++ : ko++; };

// L'API est-elle là, et le canvas absent tant qu'on n'a rien joué ?
check("API exposée", await page.evaluate(() => !!(window.FA_FINISHER && window.FA_FINISHER.play)));

// Cas : {victoire, défaite} × {fosse (orange), arene (rouge-magenta)}.
for (const view of ["fosse", "arene"]) {
  for (const win of [true, false]) {
    const tag = `${win ? "win" : "lose"}-${view}`;
    await page.evaluate((v) => { document.body.dataset.view = v; }, view);
    await page.waitForTimeout(450);   // laisse la transition --accent .35s se poser
    await page.evaluate((w) => {
      window.__finDone = false;
      window.FA_FINISHER.play({ win: w, onDone: () => { window.__finDone = true; } });
    }, win);

    await page.waitForTimeout(150);   // beat 1 : mise en place
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-150.png`) });
    const shown = await page.evaluate(() => {
      const c = document.getElementById("fa-finisher");
      return !!c && getComputedStyle(c).display === "block";
    });
    check(`${tag} canvas visible pendant`, shown);

    await page.waitForTimeout(410);   // beat 2 : ~560 ms → flash de victoire (520→680 ms)
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-560.png`) });
    await page.waitForTimeout(190);   // beat 3 : ~750 ms, juste avant la fin
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-750.png`) });

    await page.waitForTimeout(250);   // ~1000 ms : le finisher doit s'être retiré
    const after = await page.evaluate(() => ({
      hidden: getComputedStyle(document.getElementById("fa-finisher")).display === "none",
      done: window.__finDone === true,
    }));
    check(`${tag} canvas retiré à la fin`, after.hidden);
    check(`${tag} onDone appelé`, after.done, "la modale de résultat en dépend");
  }
}

// prefers-reduced-motion : aucune animation, mais onDone quand même.
const ctxR = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const pageR = await ctxR.newPage();
await pageR.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await pageR.waitForFunction(() => window.FA_FINISHER).catch(() => {});
await pageR.waitForTimeout(6000);
const red = await pageR.evaluate(() => {
  window.__finDone = false;
  window.FA_FINISHER.play({ win: true, onDone: () => { window.__finDone = true; } });
  const c = document.getElementById("fa-finisher");
  return { done: window.__finDone, painted: !!c && getComputedStyle(c).display === "block" };
});
check("reduced-motion : onDone immédiat", red.done === true);
check("reduced-motion : aucun canvas peint", red.painted === false);

const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log(`\nchecks OK: ${ok}/${ok + ko} | erreurs console: ${realErrors.length}`, realErrors.slice(0, 5));
console.log((ko === 0 && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
process.exit(ko === 0 && realErrors.length === 0 ? 0 : 1);
