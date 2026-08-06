/* FRACTAL ARENA — Préparation des images servies au client.
 *
 * Le jeu est passé au WebP depuis longtemps, mais une poignée de PNG d'origine sont restés :
 * les six bêtes de base, le filigrane de fond, le logo. Ensemble, ils pèsent 15 Mo au
 * téléchargement et ~30 Mo de RAM une fois décodés — sur un onglet mobile qui doit déjà loger
 * React, Three.js et l'UI, c'est ce qui reste à récupérer après les modèles 3D.
 *
 * Le PNG n'apporte rien ici : aucune de ces images n'a besoin de son sans-perte, et le format
 * du reste du jeu est déjà le WebP.
 *
 *   node tools/optimize-images.mjs
 *
 * Les références dans le code sont mises à jour séparément (les fichiers changent d'extension).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Servies au client : converties en WebP. La qualité 88 est visuellement sans perte sur ces
// visuels (aplats, dégradés doux) ; les dimensions sont conservées, rien n'est recadré.
const A_CONVERTIR = [
  // Le filigrane n'est jamais montré net : 0,16 d'opacité en mode luminosity sur les écrans de
  // jeu, et sous un voile noir à 40-80 % dans la cinématique. 1280 px de large suffisent.
  { src: "assets/BACKGROUND.png", largeur: 1280, qualite: 80 },
  "assets/MINER.png",
  "assets/LEDGER.png",
  "assets/NETWORK.png",
  "assets/BLOCK.png",
  "assets/HASHBYTE.png",
  "assets/GENESIS.png",
  "assets/LOGO_cut.png",
];

// Icônes de la PWA : le manifeste les déclare en image/png et les lanceurs Android s'y fient.
// On les garde en PNG, simplement recompressées.
const A_RECOMPRESSER = [
  "assets/pwa/icon-192.png",
  "assets/pwa/icon-512.png",
  "assets/pwa/icon-maskable-192.png",
  "assets/pwa/icon-maskable-512.png",
  "assets/pwa/apple-touch-icon-180.png",
];

// Sources de génération, jamais servies : elles n'ont rien à faire dans assets/.
const A_DEPLACER = [["assets/boot-emblem.png", "_bake/boot-emblem.png"]];

// Plus référencée nulle part dans le client (vérifié : aucun .js/.jsx/.css/.html ne la cite).
const A_SUPPRIMER = ["assets/LOGO.png"];

const ko = (n) => (n / 1024).toFixed(0) + " Ko";
let gagne = 0;

for (const entree of A_CONVERTIR) {
  const rel = typeof entree === "string" ? entree : entree.src;
  const largeur = typeof entree === "string" ? null : entree.largeur;
  const qualite = (typeof entree === "string" ? null : entree.qualite) || 88;
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) continue;
  const dst = src.replace(/\.png$/i, ".webp");
  const avant = fs.statSync(src).size;
  const meta = await sharp(src).metadata();
  let pipeline = sharp(src);
  if (largeur) pipeline = pipeline.resize(largeur, null, { withoutEnlargement: true });
  await pipeline.webp({ quality: qualite, effort: 6 }).toFile(dst);
  const apres = fs.statSync(dst).size;
  fs.unlinkSync(src);
  gagne += avant - apres;
  console.log(`  ${rel.padEnd(28)} ${meta.width}×${meta.height}  ${ko(avant).padStart(9)} → ${ko(apres).padStart(8)}  ÷${(avant / apres).toFixed(1)}`);
}

for (const rel of A_RECOMPRESSER) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) continue;
  const avant = fs.statSync(src).size;
  const buf = await sharp(src).png({ compressionLevel: 9, effort: 10, palette: true }).toBuffer();
  if (buf.length < avant) {
    fs.writeFileSync(src, buf);
    gagne += avant - buf.length;
    console.log(`  ${rel.padEnd(28)} ${ko(avant).padStart(9)} → ${ko(buf.length).padStart(8)}  (PNG conservé)`);
  }
}

for (const [de, vers] of A_DEPLACER) {
  const src = path.join(ROOT, de);
  if (!fs.existsSync(src)) continue;
  fs.renameSync(src, path.join(ROOT, vers));
  console.log(`  ${de} → ${vers}  (source de bake, pas un asset servi)`);
}

for (const rel of A_SUPPRIMER) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) continue;
  const n = fs.statSync(src).size;
  fs.unlinkSync(src);
  gagne += n;
  console.log(`  ${rel} supprimée (${ko(n)}, plus aucune référence)`);
}

console.log(`\n  Total récupéré au téléchargement : ${(gagne / 1024 / 1024).toFixed(1)} Mo`);
