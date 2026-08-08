// bake-spin.mjs — bake la rotation de l'embleme de la cinematique en WebP anime.
//
// Pourquoi : mesure du 08/08 sur Mali-G68, la variante ?sans=3d passe de
// 14 083 ms hors JS (rendu/GPU) et 12 s d'ecran fige a 445 ms et zero image
// longue. Composer un canvas WebGL anime est hors budget sur ce GPU ; decoder
// un WebP anime ne l'est pas — c'est une <img>, decodee hors du thread principal.
//
// Calibrage retenu (mesure, pas intuition) : 384 px / 12 fps / q 25 = 355 Ko,
// sous le plafond de 400 Ko par image impose par test/asset-budget.test.js.
// Les etapes qui ont fait descendre le poids, dans l'ordre d'efficacite :
//   1. demi-tour au lieu du tour complet  : 1185 -> 573 Ko  (symetrie, cf. plus bas)
//   2. qualite 60 -> 25                   :  573 -> 355 Ko  (ecart invisible a l oeil)
// Le WebP anime compresse mal une rotation (chaque image change entierement) :
// VP9 descendait a 564 Ko pour la sequence longue, mais VP9-alpha n'existe pas
// sur Safari et exigeait un <video> avec repli. Une <img> marche partout.
//
// Usage : node _bake/bake-spin.mjs [--fps 12] [--size 384] [--q 25] [--extrait] [--garder]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const arg = (nom, def) => {
  const i = process.argv.indexOf("--" + nom);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
};
const FPS = arg("fps", 12);
const SIZE = arg("size", 384);
const Q = arg("q", 25);

// Deux modes :
//   --boucle (defaut) : un DEMI-tour, 5,5 s, bouclable a l'infini. L'embleme est
//     fait de deux copies placees symetriquement, son image se repete donc tous
//     les 180 deg — verifie par SSIM 0,9976 entre la premiere image et celle
//     d'un demi-tour plus tard (0,52 pour un quart de tour). Deux fois moins
//     d'images, et l'animation ne s'arrete jamais.
//   --extrait : les 11,6 s reellement vues dans la cinematique, teinte
//     prismatique comprise, mais sans boucle possible et deux fois plus lourd.
const BOUCLE = !process.argv.includes("--extrait");
const PERIODE = 11 / 2;                       // spin = 2*PI/11 : demi-tour en 5,5 s
const T0 = BOUCLE ? 0 : 8.4;                  // cinematique.jsx : l'embleme entre a 8,4 s
const T1 = BOUCLE ? PERIODE : 20.0;           // CINE_DUR
// En boucle, la derniere image ne doit PAS repeter la premiere : l'image
// suivante (N/FPS = 5,5 s) est deja la premiere du tour d'apres.
const NB = Math.round((T1 - T0) * FPS);
const TEINTE = BOUCLE ? 1 : null;             // 1 = cyan d'origine (0x00f0ff)

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".glb": "model/gltf-binary", ".json": "application/json", ".wasm": "application/wasm",
};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const tmp = path.join(__dirname, "_spin-frames");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

// Le Chromium livre avec Playwright n'est pas toujours telecharge sur la
// machine ; le Chrome du systeme rend le meme WebGL et evite 150 Mo de plus.
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.log("chromium Playwright indisponible, bascule sur le Chrome du systeme");
  browser = await chromium.launch({ channel: "chrome" });
}
const page = await browser.newPage({ viewport: { width: SIZE + 40, height: SIZE + 40 } });
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
await page.goto(`http://localhost:${port}/_bake/bake-spin.html?size=${SIZE}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready === true || window.__err, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log("ERREUR:", err); await browser.close(); server.close(); process.exit(1); }

console.log(`bake : ${NB} images, ${SIZE}px, ${FPS} fps, t=${T0}s -> ${T1}s` + (BOUCLE ? " (demi-tour bouclable, teinte figee)" : " (extrait, teinte animee)"));
for (let i = 0; i < NB; i++) {
  const t = T0 + (i / FPS);
  const dataUrl = await page.evaluate(([tt, te]) => window.__setT(tt, te), [t, TEINTE]);
  fs.writeFileSync(path.join(tmp, `f-${String(i).padStart(4, "0")}.png`),
    Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
server.close();

const sortie = path.join(ROOT, "assets", "emblem-spin.webp");
// -pix_fmt yuva420p : conserve l'alpha en compression avec pertes. Sans lui,
// libwebp_anim aplatit la transparence sur du noir et l'embleme apparait dans
// une boite opaque.
execFileSync("ffmpeg", [
  "-y", "-framerate", String(FPS),
  "-i", path.join(tmp, "f-%04d.png"),
  "-c:v", "libwebp_anim", "-pix_fmt", "yuva420p",
  "-lossless", "0", "-q:v", String(Q), "-compression_level", "6",
  "-loop", "0", "-an", "-fps_mode", "passthrough",
  sortie,
], { stdio: ["ignore", "ignore", "pipe"] });

const ko = fs.statSync(sortie).size / 1024;
console.log(`ecrit : assets/emblem-spin.webp — ${ko.toFixed(0)} Ko pour ${NB} images`);
console.log(`duree : ${((T1 - T0)).toFixed(1)} s a ${FPS} fps`);
// --garder : conserve les PNG pour re-encoder sans recapturer. Une capture
// complete prend une minute ; calibrer le poids en demande une dizaine.
if (!process.argv.includes("--garder")) fs.rmSync(tmp, { recursive: true, force: true });
else console.log(`images conservees dans ${tmp}`);
