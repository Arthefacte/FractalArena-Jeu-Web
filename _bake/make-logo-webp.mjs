import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const sharp = require("../.design-sync/_tools/node_modules/sharp");

const SRC = path.join(import.meta.dirname, "emblem-nobg.png");
const OUT = path.join(import.meta.dirname, "LOGO_cut.webp");

// Détouré + transparence : webp lossless pour garder le logo net (pas de compression dégradante)
await sharp(SRC).webp({ lossless: true, quality: 100, effort: 6 }).toFile(OUT);

const { size, width, height, format, hasAlpha } = await sharp(OUT).metadata();
console.log("OK:", OUT);
console.log(`${width}x${height}`, format, "alpha=" + hasAlpha, (size / 1024).toFixed(0) + " Ko");
