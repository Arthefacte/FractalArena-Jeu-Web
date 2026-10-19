// bake-hd.mjs — capture l'animation d'assemblage en HAUTE DEFINITION.
//
// Le plafond de 220 px de assets/boot-strip.webp est un budget d'octets pour le
// web mobile, pas une contrainte du rendu : la source 3D est bien plus fine que
// 220 px. Ce script rejoue la MEME scene que _bake/bake-fragments.html a
// 640x640 CSS / deviceScaleFactor 2, reduit chaque image a la taille livree,
// puis assemble la bande.
//
// Deux sorties :
//   _bake/_hd-frames/f-XX.png   les images reduites (source de controle)
//   _bake/_hd-frames/strip.png  la bande assemblee (avant encodage)
// L'encodage WebP et la mesure d'ecart sont faits par bake-hd-encode.mjs : la
// capture (Playwright) et l'encodage (ffmpeg) sont deux etapes separees pour
// pouvoir recalibrer le poids sans recapturer.
//
// Usage : node _bake/bake-hd.mjs [--glb chemin] [--cell 440] [--size 600] [--dpr 2] [--grid 3x3x1]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// playwright est installe pour la QA de l'app (desktop/qa/node_modules), pas a
// la racine du depot : on l'emprunte plutot que d'ajouter 150 Mo de dependance.
const requireQA = createRequire("C:/Users/PC/orca/workspaces/fractal-arena-web/app-pc-native/desktop/qa/x.js");
const { chromium } = requireQA("playwright");

const arg = (nom, def) => {
  const i = process.argv.indexOf("--" + nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const GLB = arg("glb", "_bake/raw/boot-emblem.glb");
const CELL = Number(arg("cell", 440));
const SIZE = Number(arg("size", 600));   // taille CSS du canvas
const DPR = Number(arg("dpr", 2));       // -> capture a SIZE*DPR pixels
const GRID = arg("grid", "3x3x1").split("x").map(Number);
const F = 32;

if (!fs.existsSync(path.join(ROOT, GLB))) {
  console.log(`source absente : ${GLB}`);
  process.exit(1);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".wasm": "application/wasm" };
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

let browser;
try { browser = await chromium.launch(); }
catch (e) { console.log("chromium Playwright absent -> Chrome du systeme :", e.message.split("\n")[0]); browser = await chromium.launch({ channel: "chrome" }); }

const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: DPR });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
const url = `http://localhost:${port}/_bake/bake-fragments-hd.html?size=${SIZE}&dpr=${DPR}`
  + `&glb=${encodeURIComponent("/" + GLB)}&nx=${GRID[0]}&ny=${GRID[1]}&nz=${GRID[2]}`;
console.log("ouverture :", url.replace(`http://localhost:${port}`, ""));
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log("ERREUR chargement :", err); await browser.close(); server.close(); process.exit(1); }
const parts = await page.evaluate(() => window.__parts);
console.log(`pieces : ${parts} (grille ${GRID.join("x")}) — source ${GLB}`);

const tmp = path.join(__dirname, "_hd-frames");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const canvasEl = await page.$("#stage canvas");
const boite = await canvasEl.boundingBox();
console.log(`canvas ${boite.width}x${boite.height} CSS, rendu ${Math.round(boite.width * DPR)}x${Math.round(boite.height * DPR)} px -> reduit a ${CELL}`);

for (let f = 0; f < F; f++) {
  await page.evaluate((t) => window.__setT(t), f / (F - 1));
  const reduit = await page.evaluate((c) => window.__shot(c, 1), CELL);
  fs.writeFileSync(path.join(tmp, `f-${String(f).padStart(2, "0")}.png`), Buffer.from(reduit.png.split(",")[1], "base64"));
  process.stdout.write(`\r${f + 1}/${F} images reduites`);
}
process.stdout.write("\n");

// Assemblage vertical : les 32 images, dans l'ordre, une par cellule.
const assembl = await page.evaluate(async ({ F, CELL }) => {
  const c = document.createElement("canvas");
  c.width = CELL; c.height = CELL * F;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < F; i++) {
    const img = new Image();
    img.src = `/_bake/_hd-frames/f-${String(i).padStart(2, "0")}.png?x=${i}`;
    await img.decode();
    ctx.drawImage(img, 0, i * CELL, CELL, CELL);
  }
  return c.toDataURL("image/png");
}, { F, CELL });
fs.writeFileSync(path.join(tmp, "strip.png"), Buffer.from(assembl.split(",")[1], "base64"));
console.log("bande assemblee : _bake/_hd-frames/strip.png");

await browser.close();
server.close();
