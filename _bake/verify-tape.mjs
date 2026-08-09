// verify-tape.mjs — vérifie la tape boursière + la pluie d'or (#7 header vivant)
// dans un vrai navigateur, /buyback/status intercepté (fixture pilotée) :
//   1. desktop : tape visible, défilement actif, items en vraies données ;
//   2. rachat simulé (buyback_count +1 au relevé suivant) : pluie d'or, jauge
//      qui pulse, ka-ching demandé à FA_SFX ;
//   3. mobile 390px : tape repliée par défaut, dépliée après le rachat.
// Ce qu'il ne vérifie pas : le rendu du son (FA_SFX est espionné, pas écouté)
// ni la fluidité GPU (téléphone seul juge).
// Lancement : NODE_PATH="$(npm root -g)" node _bake/verify-tape.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".jsx":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".glb":"model/gltf-binary", ".wasm":"application/wasm", ".svg":"image/svg+xml", ".webp":"image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// Fixture pilotée : `phase` bascule de A (état de base) à B (rachat exécuté sur
// le pool 10k : count +1, pool vidé, last_buyback frais).
let phase = "A";
const fixture = () => ({
  status: "ok",
  buyback: {
    buyback_wallet: "bc1qtape0000000000000000000000000",
    countdown_hours: 24,
    pools: [
      { tier: 5000, total: 2600, threshold: 5000, buyback_count: 2, total_bought: 10000,
        last_buyback: { at: new Date(Date.now() - 3 * 86400000).toISOString(), amount: 5000, txid: "c".repeat(64) } },
      { tier: 10000,
        total: phase === "A" ? 9800 : 300,
        threshold: 10000,
        buyback_count: phase === "A" ? 1 : 2,
        total_bought: phase === "A" ? 10000 : 20000,
        last_buyback: { at: phase === "A" ? new Date(Date.now() - 86400000).toISOString() : new Date().toISOString(),
                        amount: 10000, txid: "d".repeat(64) } },
      { tier: 25000, total: 4100, threshold: 25000, buyback_count: 0, total_bought: 0, last_buyback: null },
      { tier: 50000, total: 900, threshold: 50000, buyback_count: 0, total_bought: 0, last_buyback: null },
    ],
  },
});

let ko = 0;
const dire = (ok, msg) => { console.log((ok ? "OK  " : "ECHEC ") + msg); if (!ok) ko++; };

// Servi sur localhost, data.js aiguille l'API vers localhost:3000 — que la CSP
// (connect-src 'self' + prod) refuse : le fetch ne part jamais, ticker absent.
// On sert donc un data.js dont l'API locale est l'origine de la page elle-même
// (« self »), et la fixture répond en same-origin via page.route.
const DATA_JS_PATCHE = fs.readFileSync(path.join(ROOT, "data.js"), "utf8")
  .replace('? "http://localhost:3000"', '? ""');

async function ouvrir(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.route("**/data.js*", (route) => route.fulfill({ contentType: "text/javascript", body: DATA_JS_PATCHE }));
  await page.route("**/buyback/status", (route) => route.fulfill({ json: fixture() }));
  // Toute autre requête API locale échoue proprement (le jeu sait vivre sans).
  await page.addInitScript(() => {
    Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
      try { const roster = window.FA_DATA.starterRoster();
        localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qtape0000000000000000000000000", options: { sound: true, speed: 1 } }));
        localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
      Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
    } });
  });
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bb-ticker", { timeout: 20000 });
  await page.keyboard.press("Escape").catch(() => {});
  // Espionne le son : on veut la preuve de l'appel, pas du bruit.
  await page.evaluate(() => {
    window.__sons = [];
    if (window.FA_SFX) { const p = window.FA_SFX.play; window.FA_SFX.play = (n, a) => { window.__sons.push(n); return p(n, a); }; }
  });
  return { ctx, page, erreurs };
}

const browser = await chromium.launch();

// ——— 1. Desktop : tape visible, animée, en vraies données. ———
{
  phase = "A";
  const { ctx, page, erreurs } = await ouvrir({ width: 1280, height: 800 });
  const tape = await page.evaluate(() => {
    const el = document.querySelector(".fa-tape");
    if (!el) return null;
    const track = el.querySelector(".fa-tape-track");
    return {
      visible: getComputedStyle(el).display !== "none",
      anim: getComputedStyle(track).animationName,
      texte: track.textContent,
      items: track.querySelectorAll(".fa-tape-item").length,
    };
  });
  dire(!!tape, "desktop : la tape est rendue");
  dire(tape && tape.visible, "desktop : la tape est visible");
  dire(tape && tape.anim === "faTapeDefile", `desktop : le defilement est actif (${tape && tape.anim})`);
  dire(tape && /RACHAT/.test(tape.texte) && /POOL/.test(tape.texte) && /CUMUL/.test(tape.texte),
    "desktop : rachats, pools et cumul sont dans la tape");
  dire(tape && tape.items >= 12, `desktop : piste dupliquee (${tape && tape.items} items pour 7 reels)`);

  // ——— 2. Rachat simulé : pluie + pulse + ka-ching. ———
  phase = "B";
  await page.evaluate(() => window.dispatchEvent(new Event("fa:buyback-refresh")));
  await page.waitForSelector(".fa-pluie", { timeout: 5000 }).catch(() => {});
  const rachat = await page.evaluate(() => ({
    pluie: document.querySelectorAll(".fa-pluie .fa-or").length,
    pulse: !!document.querySelector(".bb-rachat"),
    sons: window.__sons || [],
  }));
  dire(rachat.pluie === 30, `rachat : ${rachat.pluie}/30 particules d'or`);
  dire(rachat.pulse, "rachat : la jauge du pool rachete pulse (.bb-rachat)");
  dire(rachat.sons.includes("kaching"), `rachat : ka-ching demande a FA_SFX (${rachat.sons.join(",") || "aucun son"})`);
  await page.waitForTimeout(2600);
  const apres = await page.evaluate(() => document.querySelectorAll(".fa-pluie").length);
  dire(apres === 0, "rachat : la pluie se retire apres l'animation");
  dire(erreurs.length === 0, `desktop : aucune erreur page (${erreurs.slice(0, 2).join(" | ") || "—"})`);
  await ctx.close();
}

// ——— 3. Mobile 390px : repliée par défaut, dépliée par le neuf. ———
{
  phase = "A";
  const { ctx, page, erreurs } = await ouvrir({ width: 390, height: 800 });
  const avant = await page.evaluate(() => {
    const el = document.querySelector(".fa-tape");
    return el ? getComputedStyle(el).display : "absent";
  });
  dire(avant === "none", `mobile : tape repliee par defaut (display: ${avant})`);
  phase = "B";
  await page.evaluate(() => window.dispatchEvent(new Event("fa:buyback-refresh")));
  await page.waitForTimeout(600);
  const pendant = await page.evaluate(() => {
    const el = document.querySelector(".fa-tape");
    return el ? { display: getComputedStyle(el).display, fraiche: el.classList.contains("fraiche") } : null;
  });
  dire(pendant && pendant.fraiche && pendant.display === "block",
    `mobile : le rachat deplie la tape (display: ${pendant && pendant.display})`);
  dire(erreurs.length === 0, `mobile : aucune erreur page (${erreurs.slice(0, 2).join(" | ") || "—"})`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(ko === 0 ? "\nVERIFICATION COMPLETE : 13/13" : `\n${ko} VERIFICATION(S) EN ECHEC`);
process.exit(ko === 0 ? 0 : 1);
