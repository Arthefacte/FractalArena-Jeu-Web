/* Icônes PWA — dérivées de l'emblème RÉEL, pas redessinées.
 *
 * Source : assets/boot-emblem.png (920x920, opaque, fond navy) — le même
 * emblème gravé que l'écran de démarrage, pour que l'icône d'accueil et le
 * premier écran du jeu soient la même image.
 *
 * Contrainte du propriétaire : qualité avant le poids. Donc PNG (pas de webp
 * ici : iOS ne prend pas le webp en apple-touch-icon), rééchantillonnage
 * Lanczos3, compression sans perte.
 *
 * Deux familles d'icônes, et c'est important :
 *   - « any »      : l'emblème pleine bordure, tel quel. Android l'affiche
 *                    sans le toucher, iOS lui applique son propre arrondi.
 *   - « maskable » : Android l'insère dans SON gabarit (cercle, goutte,
 *                    squircle selon le constructeur) et peut rogner jusqu'à
 *                    20 % de chaque bord. L'emblème est donc réduit à 72 %
 *                    et centré sur le fond, pour que les pointes de
 *                    l'hexagone survivent au rognage le plus agressif.
 *
 * Lancer :  node .design-sync/_tools/node_modules/.bin/.. -- non :
 *           node _bake/gen-pwa-icons.mjs        (depuis fractal-arena-web/)
 */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const sharp = require("../.design-sync/_tools/node_modules/sharp");

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets", "boot-emblem.png");
const OUT = path.join(ROOT, "assets", "pwa");
fs.mkdirSync(OUT, { recursive: true });

// palette:true = quantification 256 couleurs. `quality: 100` garde le meilleur
// rendu que la palette permet : sur cet embleme (metal texture, peu de degrades
// lisses continus) la perte est invisible, et le 512 tombe de 338 Ko a 117 Ko —
// sous le plafond de 150 Ko que test/asset-budget.test.js impose aux PNG.
// Sans palette, l embleme detaille de 2026-08-21 depassait le budget.
const png = { compressionLevel: 9, effort: 10, palette: true, quality: 100 };

async function any(size, file) {
  await sharp(SRC).resize(size, size, { kernel: "lanczos3" }).png(png).toFile(path.join(OUT, file));
  return file;
}

/* Le fond de la source est uniforme sur tout son pourtour, donc l'emblème réduit
   se pose sur ce même aplat : la marge prolonge le fond au lieu de dessiner un
   carré. La couture est vérifiée au pixel plus bas, l'écart doit rester nul. */
// Le pixel du coin, lu en BRUT. `stats()` opère sur l'image d'ENTRÉE et ignore
// l'`extract` du pipeline : l'ancien code croyait échantillonner le coin, il
// prenait en fait la moyenne de tout l'emblème. Ça passait inaperçu tant que le
// fond était brun comme la moyenne ; le jour où l'emblème est passé sur fond
// navy (#05070f), la marge est ressortie brune autour d'un carré navy.
const { data: rawCorner, info: rawInfo } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const BG = { r: rawCorner[0], g: rawCorner[1], b: rawCorner[2], alpha: 1 };
if (rawInfo.channels === 4 && rawCorner[3] < 250) {
  console.warn(`⚠ coin de l'emblème translucide (alpha ${rawCorner[3]}) — la marge des maskable risque de jurer.`);
}

async function maskable(size, file, ratio = 0.72) {
  const inner = Math.round(size * ratio);
  const emblem = await sharp(SRC).resize(inner, inner, { kernel: "lanczos3" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: emblem, gravity: "center" }])
    .png(png)
    .toFile(path.join(OUT, file));
  return file;
}

const made = [
  await any(192, "icon-192.png"),
  await any(512, "icon-512.png"),
  await maskable(512, "icon-maskable-512.png"),
  await maskable(192, "icon-maskable-192.png"),
  // iOS ne lit pas le manifeste pour l'icône d'accueil et n'applique pas de
  // fond : il lui faut un carré opaque de 180 px, qu'il arrondira lui-même.
  await any(180, "apple-touch-icon-180.png"),
];

for (const f of made) {
  const p = path.join(OUT, f);
  const b = fs.readFileSync(p);
  console.log(f.padEnd(26), b.readUInt32BE(16) + "x" + b.readUInt32BE(20), (b.length / 1024).toFixed(1) + " Ko");
}

/* Contrôle de couture : de part et d'autre de la frontière marge/emblème, à
   mi-hauteur. Les deux côtés sont du fond, l'écart doit être nul. */
for (const [f, size] of [["icon-maskable-512.png", 512], ["icon-maskable-192.png", 192]]) {
  const edge = Math.round((size * (1 - 0.72)) / 2);
  const px = async (x) => (await sharp(path.join(OUT, f))
    .extract({ left: x, top: Math.round(size / 2) - 2, width: 4, height: 4 }).stats())
    .channels.slice(0, 3).map((c) => Math.round(c.mean));
  const dehors = await px(Math.max(0, edge - 8));
  const dedans = await px(edge + 4);
  const ecart = Math.max(...dehors.map((v, i) => Math.abs(v - dedans[i])));
  console.log(f.padEnd(26), "couture : marge", dehors.join(","), "| emblème", dedans.join(","), "→ écart", ecart);
  if (ecart > 2) throw new Error("couture visible sur " + f + " (écart " + ecart + ")");
}
