// verify-finisher.mjs — vérifie le finisher (#6) : le canvas apparaît, peint l'accent
// de l'écran, se retire, et appelle onDone. Pilotage à horloge virtuelle (override de
// performance.now()/requestAnimationFrame CÔTÉ PAGE, pas dans finisher.js) : on force
// la frame() réelle à des instants t exacts, indépendamment du taux de rafraîchissement
// réel — le bac à sable Playwright tombe parfois à ~1 img/s (WebGL non accéléré du
// RelicViewer si jamais monté) et un waitForTimeout() ne garantit rien. Capture au-dessus
// du VRAI écran de jeu (fond navy #05070f), pas une page blanche.
// Lancement : NODE_PATH="$(npm root -g)" node _bake/verify-finisher.mjs
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
await page.waitForTimeout(8000);   // boot (≥2400 ms) + montage React (horloge réelle, one-off)
await page.keyboard.press("Escape").catch(() => {});

let ok = 0, ko = 0;
const check = (label, pass, info) => { console.log(`${pass ? "OK " : "KO "} ${label}${info ? " — " + info : ""}`); pass ? ok++ : ko++; };

// L'API est-elle là ?
check("API exposée", await page.evaluate(() => !!(window.FA_FINISHER && window.FA_FINISHER.play)));

// Horloge virtuelle installée dans la PAGE (pas dans finisher.js/finisher-ui.js) :
// performance.now() renvoie un instant figé qu'on avance à la main, requestAnimationFrame
// stocke le callback au lieu de le planifier — window.__fin_tickTo(ms) l'exécute avec le
// "now" voulu, donc frame() peint exactement l'état de la timeline à t=ms/1000.
await page.evaluate(() => {
  window.__fin_installVClock = () => {
    let vt = 0, cb = null;
    window.__fin_realNow = performance.now.bind(performance);
    window.__fin_realRAF = window.requestAnimationFrame.bind(window);
    window.__fin_realCAF = window.cancelAnimationFrame.bind(window);
    performance.now = () => vt;
    window.requestAnimationFrame = (fn) => { cb = fn; return 1; };
    window.cancelAnimationFrame = () => { cb = null; };
    window.__fin_tickTo = (ms) => { vt = ms; const fn = cb; cb = null; if (fn) fn(vt); };
    window.__fin_pendingRAF = () => cb !== null;
  };
  window.__fin_restore = () => {
    performance.now = window.__fin_realNow;
    window.requestAnimationFrame = window.__fin_realRAF;
    window.cancelAnimationFrame = window.__fin_realCAF;
  };
});

// Cas : {victoire, défaite} × {fosse (orange), arene (magenta)}. Beats capturés :
// 0 (départ), 150 (dispersion initiale), 300, 520 (impact victoire), 600 (post-flash),
// 750 (juste avant la fin).
const BEATS = [0, 150, 300, 520, 600, 750];
for (const view of ["fosse", "arene"]) {
  for (const win of [true, false]) {
    const tag = `${win ? "win" : "lose"}-${view}`;
    await page.evaluate((v) => { document.body.dataset.view = v; }, view);
    await page.waitForTimeout(450);   // laisse la transition --accent .35s se poser (horloge réelle)

    await page.evaluate(() => window.__fin_installVClock());
    await page.evaluate((w) => {
      window.__finDoneCount = 0;
      window.FA_FINISHER.play({ win: w, onDone: () => { window.__finDoneCount++; } });
    }, win);

    for (const ms of BEATS) {
      await page.evaluate((t) => window.__fin_tickTo(t), ms);
      await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-${String(ms).padStart(3, "0")}.png`) });
    }

    const mid = await page.evaluate(() => {
      const c = document.getElementById("fa-finisher");
      return !!c && getComputedStyle(c).display === "block";
    });
    check(`${tag} canvas visible pendant`, mid);

    // Passe la fin réelle de la durée (FIN_DUR=0.8s) : stop() + flush() doivent avoir tourné.
    await page.evaluate(() => window.__fin_tickTo(850));
    const after = await page.evaluate(() => ({
      hidden: getComputedStyle(document.getElementById("fa-finisher")).display === "none",
      doneCount: window.__finDoneCount,
      pending: window.__fin_pendingRAF(),
    }));
    check(`${tag} canvas retiré à la fin`, after.hidden);
    check(`${tag} onDone appelé exactement une fois`, after.doneCount === 1, `doneCount=${after.doneCount}`);
    check(`${tag} plus aucune frame planifiée`, after.pending === false);

    await page.evaluate(() => window.__fin_restore());
  }
}

// prefers-reduced-motion : aucune animation peinte, mais onDone rendu la main quand même —
// horloge réelle ici, le chemin reduced ne passe jamais par requestAnimationFrame.
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
await ctxR.close();

const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log(`\nchecks OK: ${ok}/${ok + ko} | erreurs console: ${realErrors.length}`, realErrors.slice(0, 5));
console.log((ko === 0 && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
process.exit(ko === 0 && realErrors.length === 0 ? 0 : 1);
