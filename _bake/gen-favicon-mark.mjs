#!/usr/bin/env node
/* ============================================================
   FRACTAL ARENA — marque PETIT FORMAT (favicon / tuile de wallet)

   Pourquoi ce fichier existe : la fenêtre « Demande de signature » du wallet
   (extension UniSat, navigateur in-app de l'app mobile) affiche l'icône du
   site dans un carré d'une trentaine de pixels, sur un panneau SOMBRE. La
   version précédente posait l'emblème sur un fond BLANC, sans tuile : le
   pourtour métallique de l'hexagone se confondait avec le blanc et, dans un
   panneau sombre, la vignette lisait comme un carré vide. Vécu et signalé par
   le fondateur, alors même que /favicon.ico répondait 200 en
   image/vnd.microsoft.icon.

   La marque livrée ici est l'EMBLÈME RÉEL du jeu (_bake/emblem-nobg.png) —
   aucun dessin inventé — composé sur une tuile sombre à liseré clair :
     - la tuile donne une silhouette franche sur fond clair comme sombre ;
     - le fond sombre laisse respirer les éclairs feu/glace, qui portent la
       reconnaissance à petite taille (mesuré : à 32 px on lit « FA », à 16 px
       on reconnaît le badge ; le même emblème sur fond blanc disparaît) ;
     - l'emblème est rogné de ses marges et occupe ~84 % de la tuile, donc un
       maximum de pixels utiles à 16 px.
   L'emblème détaillé en grand reste la référence pour l'art du jeu, les icônes
   PWA installées et les aperçus de lien (assets/og-image.jpg,
   _bake/gen-pwa-icons.mjs).

   Sortie (chemins FIXES, un wallet demande /favicon.ico en dur) :
     favicon.ico          16 + 32 + 48, frames BMP 32bpp (compat maximale)
     favicon.png          96
     apple-touch-icon.png 180  (carré plein : iOS masque lui-même)
     assets/favicon.png   256  (balise <link rel="icon"> du document)

   Usage : node _bake/gen-favicon-mark.mjs
   ============================================================ */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TILE = "#101724";
const RIM = "#61708c";

/* L'emblème, rogné de ses marges transparentes puis normalisé. */
const base = await sharp(path.join(ROOT, "_bake", "emblem-nobg.png"))
  .trim({ threshold: 10 })
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

/* Tuile arrondie à liseré (favicons) ou carré plein (iOS, qui masque lui-même
   et remplit la transparence en noir). */
const svg = ({ radius, inset }) => {
  const box = 128;
  const size = box - inset * 2;
  const fond = radius > 0
    ? `<rect x="1.5" y="1.5" width="${box - 3}" height="${box - 3}" rx="${radius}" fill="${TILE}" stroke="${RIM}" stroke-width="3"/>`
    : `<rect width="${box}" height="${box}" fill="${TILE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">
    ${fond}
    <image href="data:image/png;base64,${base.toString("base64")}" x="${inset}" y="${inset}" width="${size}" height="${size}"/>
  </svg>`;
};

const render = (px, shape) =>
  sharp(Buffer.from(svg(shape)), { density: 900 })
    .resize(px, px, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();

/* ICO à frames BMP : universellement décodé (pas de PNG encapsulé, que
   certains lecteurs de wallet refusent). 32 bpp BGRA + masque AND nul. */
async function ico(frames, shape) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  const entries = [];
  const datas = [];
  let offset = 6 + 16 * frames.length;
  for (const size of frames) {
    const rgba = await sharp(await render(size, shape)).raw().toBuffer();
    const bgra = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      const src = y * size * 4;
      const dst = (size - 1 - y) * size * 4; // BMP : lignes de bas en haut
      for (let x = 0; x < size * 4; x += 4) {
        bgra[dst + x] = rgba[src + x + 2];
        bgra[dst + x + 1] = rgba[src + x + 1];
        bgra[dst + x + 2] = rgba[src + x];
        bgra[dst + x + 3] = rgba[src + x + 3];
      }
    }
    const maskRow = Math.ceil(size / 8 / 4) * 4;
    const mask = Buffer.alloc(maskRow * size); // tout à 0 : l'alpha fait foi
    const bih = Buffer.alloc(40);
    bih.writeUInt32LE(40, 0);
    bih.writeInt32LE(size, 4);
    bih.writeInt32LE(size * 2, 8);
    bih.writeUInt16LE(1, 12);
    bih.writeUInt16LE(32, 14);
    bih.writeUInt32LE(0, 16);
    bih.writeUInt32LE(size * size * 4, 20);
    const data = Buffer.concat([bih, bgra, mask]);
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
    datas.push(data);
  }
  return Buffer.concat([head, ...entries, ...datas]);
}

const TUILE = { radius: 26, inset: 8 };  // favicon : tuile arrondie, emblème large
const PLEIN = { radius: 0, inset: 14 };  // écran d'accueil : carré plein, marges

const out = async (rel, buf) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  console.log(rel.padEnd(24), String(buf.length).padStart(7) + " o");
};

await out("favicon.ico", await ico([16, 32, 48], TUILE));
await out("favicon.png", await render(96, TUILE));
await out("apple-touch-icon.png", await render(180, PLEIN));
await out("assets/favicon.png", await render(256, TUILE));
console.log("marque petit format régénérée (emblème réel sur tuile sombre)");
