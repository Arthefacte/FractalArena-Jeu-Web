// bake-spin.mjs — bake la rotation de l'embleme de la cinematique en WebP anime.
//
// Pourquoi : mesure du 08/08 sur Mali-G68, la variante ?sans=3d passe de
// 14 083 ms hors JS (rendu/GPU) et 12 s d'ecran fige a 445 ms et zero image
// longue. Composer un canvas WebGL anime est hors budget sur ce GPU ; decoder
// un WebP anime ne l'est pas — c'est une <img>, decodee hors du thread principal.
//
// Calibrage retenu (mesure, pas intuition) : 384 px / 16 fps / q 16 = 397 Ko,
// sous le plafond de 400 Ko par image impose par test/asset-budget.test.js.
// Ce qui marche, et ce qui NE marche PAS — teste, pas suppose :
//   - demi-tour au lieu du tour complet : 1185 -> 573 Ko. Le seul gros levier.
//   - baisser la qualite : 60 -> 16 sans difference visible a l'ecran.
//   - RECADRER NE GAGNE RIEN : 39 % de l'image est transparente, mais WebP ne
//     paie deja presque rien pour ces pixels (710 Ko avec ou sans crop).
//   - REDUIRE LA TAILLE AUGMENTE le poids : 288 px = 770 Ko contre 710 a 384 px.
//     Le reechantillonnage ajoute du detail haute frequence a encoder.
//   - VP9 compresserait deux fois mieux (265 Ko a 24 fps) mais l'encodeur
//     libvpx-vp9 de ffmpeg NE SAIT PAS encoder l'alpha : il sort du yuv420p
//     silencieusement, et la video s'affiche sur fond noir. Il faudrait vpxenc
//     plus un muxage manuel — une dependance de plus pour un gain esthetique.
// Monter a 24 fps couterait 619 Ko : il faudrait relever le plafond du depot.
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
const FPS = arg("fps", 16);
const SIZE = arg("size", 384);
const Q = arg("q", 16);

// Deux modes :
//   --boucle (defaut) : un TOUR COMPLET, 11 s, bouclable a l'infini. Depuis le
//     jeton a deux faces (v217, avers FA / revers FB differents), le demi-tour
//     de l'ancien embleme symetrique ne boucle PLUS — l'image ne se repete
//     qu'apres 360 deg. Deux fois plus d'images qu'avant : compenser par fps/q
//     pour rester sous les 400 Ko de test/asset-budget.test.js.
//   --extrait : les 11,6 s reellement vues dans la cinematique, teinte
//     prismatique comprise, mais sans boucle possible.
const BOUCLE = !process.argv.includes("--extrait");
const PERIODE = 11;                           // spin = 2*PI/11 : tour complet en 11 s
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
