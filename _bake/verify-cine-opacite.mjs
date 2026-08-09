// verify-cine-opacite.mjs — le canvas 3D de la cinematique est compose des la
// premiere image (opacite jamais 0), et le bake garde son fondu 0 -> 1.
//
// Pourquoi ce verrou : verdict du banc #114 (09/08, Mali-G68) — la bascule
// d'opacite 0 -> 1 du canvas a t = 8,2 s gele le compositeur 6 a 13 s. Le
// correctif est un plancher a 0.015 sur la voie 3D. Ce script le verifie dans
// un VRAI navigateur (styles calcules, pas le source) : un refactor React qui
// re-monterait le conteneur ou ecraserait le style serait invisible aux tests
// de source, pas ici.
//
// Ce qu'il ne verifie PAS : la fluidite sur GPU mobile (le bac Playwright n'a
// pas de GPU — seule la sonde ?diag=1 sur telephone fait foi), ni le rendu
// WebGL lui-meme.
//
// Usage : NODE_PATH="$(npm root -g)" node _bake/verify-cine-opacite.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary",
  ".json": "application/json", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "index.html" : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ channel: "chrome" }); }

// Echantillonne l'opacite calculee du conteneur de l'embleme pendant `duree` ms.
// `cible` : selecteur de l'element porte par le conteneur (canvas ou img bakee).
async function echantillonner(url, cible, duree) {
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector(`[data-screen-label="cinematique-ouverture"] ${cible}`, { timeout: 20000 });
  const rel = await page.evaluate(async ([sel, ms]) => {
    const el = document.querySelector(`[data-screen-label="cinematique-ouverture"] ${sel}`);
    const conteneur = el.parentElement;
    const rels = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      rels.push(Number(getComputedStyle(conteneur).opacity));
      await new Promise((r) => setTimeout(r, 200));
    }
    return rels;
  }, [cible, duree]);
  await page.close();
  return { rel, erreurs };
}

const base = `http://localhost:${port}/index.html`;
let ko = 0;
const dire = (ok, msg) => { console.log((ok ? "OK  " : "ECHEC ") + msg); if (!ok) ko++; };

// ——— Voie 3D : l'opacite ne touche jamais 0 pendant la phase critique.
// On ne verifie PAS la rampe vers 1 ici : `dt` est plafonne a 50 ms par tick
// (une chute de framerate ALLONGE la cinematique au lieu de sauter des images),
// et le rendu logiciel du bac tourne a ~2 rAF/s -> la timeline 3D y avance 25x
// plus lentement que l'horloge murale ; atteindre t = 9,7 s prendrait ~90 s de
// rendu logiciel. Or la rampe est `opP`, LE MEME code que la voie bake verifiee
// ci-dessous jusqu'a 1 ; et le plancher est verrouille au source par
// test/cine-init.test.js. Ce bloc verifie donc ce que lui seul peut voir : le
// style CALCULE du conteneur reel pendant les premieres secondes — la ou
// l'ancienne version affichait 0 et laissait le compositeur ignorer la couche.
{
  const { rel, erreurs } = await echantillonner(base, "canvas", 8000);
  const min = Math.min(...rel), max = Math.max(...rel);
  dire(rel.length >= 10, `3D : ${rel.length} echantillons`);
  dire(min > 0, `3D : opacite minimale ${min} — jamais 0, le canvas est compose des la premiere image`);
  dire(max <= 0.02 || max > 0.9, `3D : plancher discret ou fondu entame (max ${max}), pas d'etat intermediaire fige`);
  dire(erreurs.length === 0, `3D : aucune erreur page (${erreurs.slice(0, 2).join(" | ") || "—"})`);
}

// ——— Voie bake (?cine=bake, repli) : le fondu 0 -> 1 reste entier, pas de plancher.
{
  const { rel, erreurs } = await echantillonner(base + "?cine=bake", 'img[src*="emblem-spin"]', 12000);
  const min = Math.min(...rel), max = Math.max(...rel);
  dire(min === 0, `bake : opacite minimale ${min} — l'<img> garde son fondu complet depuis 0`);
  dire(max > 0.9, `bake : le fondu atteint ${max}`);
  dire(erreurs.length === 0, `bake : aucune erreur page (${erreurs.slice(0, 2).join(" | ") || "—"})`);
}

await browser.close();
server.close();
console.log(ko === 0 ? "\nVERIFICATION COMPLETE : 7/7" : `\n${ko} VERIFICATION(S) EN ECHEC`);
process.exit(ko === 0 ? 0 : 1);
