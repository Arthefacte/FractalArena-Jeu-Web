/* Fabrique la bande de l'écran de démarrage : `assets/boot-strip.webp`.

   POURQUOI une bande plutôt que 32 images échangées par JS.

   L'assemblage de l'emblème était piloté par des `setTimeout` dans
   `assets/boot-anim.js` : chaque image était posée en changeant le `src` d'un
   <img>. Or ce même fil principal est occupé, pendant l'écran de chargement, par
   l'import de Three.js, le chargement du GLB et la première compilation GPU —
   mesuré : 4,5 s de tâches longues, dont un bloc de 2,8 s. Résultat sur
   téléphone : l'emblème se fige pendant des secondes (mesuré : zone de l'emblème
   identique pendant 2 645 ms d'affilée, soit 82 % du temps de blocage).

   Une bande verticale + une animation CSS `steps()` ne dépend plus du fil
   principal : les transformations sont animées par le COMPOSITEUR, qui continue
   d'avancer pendant qu'un script bloque. L'emblème s'assemble donc sans à-coup,
   même quand le jeu se prépare derrière.

   Le dessin ne change pas : la source est l'ARTWORK existant (les 32 images de
   `assets/boot-anim.js`), extrait tel quel. Ce script ne redessine rien.

   Usage : node _bake/make-boot-strip.mjs [--lossless|--qualite 92]
*/
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// L'artwork vit dans _bake/ (jamais servi) : la bande livrée est générée ici.
const SOURCE = join(ROOT, "_bake", "boot-frames.js");
const CIBLE = join(ROOT, "assets", "boot-strip.webp");
const META = join(ROOT, "assets", "boot-strip.json");

// sharp est une dépendance de développement du dépôt ; le script doit aussi
// pouvoir tourner depuis un worktree (pas de node_modules) en pointant le clone
// voisin, comme le fait déjà le dépôt de l'app pour playwright.
function chargerSharp() {
  const essais = [
    () => require("sharp"),
    () => createRequire(join(ROOT, "package.json"))("sharp"),
    () => createRequire("C:/Users/PC/Documents/Arthefacte Games/Fractal Arena/fractal-arena-web/package.json")("sharp"),
  ];
  for (const e of essais) { try { return e(); } catch (err) { /* suivant */ } }
  throw new Error("sharp introuvable : npm ci dans le dépôt, ou installer sharp");
}
const require = createRequire(import.meta.url);
const sharp = chargerSharp();

const args = process.argv.slice(2);
const iQualite = args.indexOf("--qualite");
const iNear = args.indexOf("--near");
const iPerte = args.indexOf("--perte-max");
const PERTE_MAX = iPerte >= 0 ? Number(args[iPerte + 1]) : 2;
const QUALITE = args.includes("--lossless") ? null
  : Number(iQualite >= 0 ? args[iQualite + 1] : iNear >= 0 ? args[iNear + 1] : 92);
if (!args.includes("--lossless") && !(QUALITE >= 1 && QUALITE <= 100)) throw new Error(`qualité invalide : ${QUALITE}`);

const src = readFileSync(SOURCE, "utf8");
const urls = [...src.matchAll(/"(data:image\/webp;base64,[A-Za-z0-9+/=]+)"/g)].map((m) => m[1]);
if (urls.length < 8) throw new Error(`artwork source illisible : ${urls.length} image(s) dans assets/boot-anim.js`);
const brut = urls.map((u) => Buffer.from(u.split(",")[1], "base64"));

const meta0 = await sharp(brut[0]).metadata();
for (const [i, b] of brut.entries()) {
  const m = await sharp(b).metadata();
  if (m.width !== meta0.width || m.height !== meta0.height) {
    throw new Error(`image ${i} de taille ${m.width}x${m.height}, attendue ${meta0.width}x${meta0.height}`);
  }
}
const C = meta0.width;
const H = meta0.height;
console.log(`${brut.length} images de ${C}x${H} (${Math.round(brut.reduce((s, b) => s + b.length, 0) / 1024)} Ko au total)`);

const bande = sharp({
  create: { width: C, height: H * brut.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(brut.map((b, i) => ({ input: b, left: 0, top: i * H })));

const encodage = QUALITE === null ? { lossless: true }
  : args.includes("--near") ? { nearLossless: true, quality: QUALITE, alphaQuality: 100, effort: 6 }
  : { quality: QUALITE, alphaQuality: 100, effort: 6 };
await bande.clone().webp(encodage).toFile(CIBLE);

// Contrôle : on relit la bande, on découpe chaque cellule et on la compare à son
// image d'origine, pixel par pixel. Une bande mal alignée (une ligne de décalage)
// donnerait un emblème qui saute d'une image à l'autre — invisible à l'œil sur
// une capture, visible ici. Seuls les pixels VISIBLES comptent : sous un alpha
// nul, la couleur n'est pas affichée et peut légitimement changer.
const relue = sharp(readFileSync(CIBLE)).ensureAlpha();
const brutCellule = await relue.raw().toBuffer({ resolveWithObject: true });
let perteMax = 0, pixelsVus = 0, pixelsEcartes = 0, auDessus8 = 0;
const ecarts = [];
for (const [i, b] of brut.entries()) {
  const attendu = await sharp(b).ensureAlpha().raw().toBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < C; x++) {
      const p = ((i * H + y) * C + x) * 4;
      const q = (y * C + x) * 4;
      const alpha = attendu[q + 3];
      if (alpha < 8) { pixelsEcartes++; continue; }
      pixelsVus++;
      let pire = 0;
      for (let c = 0; c < 4; c++) {
        const d = Math.abs(brutCellule.data[p + c] - attendu[q + c]);
        if (d > pire) pire = d;
      }
      if (pire > perteMax) perteMax = pire;
      if (pire > 8) auDessus8++;
      ecarts.push(pire);
    }
  }
}
ecarts.sort((a, b) => a - b);
const centile = (p) => ecarts[Math.min(ecarts.length - 1, Math.floor(p * (ecarts.length - 1)))] || 0;
const partAuDessus8 = pixelsVus ? auDessus8 / pixelsVus : 0;

const octets = readFileSync(CIBLE);
const sha = createHash("sha256").update(octets).digest("hex");
writeFileSync(META, JSON.stringify({
  images: brut.length, cellule: C, largeur: C, hauteur: H * brut.length,
  octets: octets.length, sha256: sha, perteMax,
  centile999: centile(0.999), partAuDessus8: Number(partAuDessus8.toFixed(6)), pixelsVus,
  encodage: QUALITE === null ? "webp sans perte" : args.includes("--near") ? `webp quasi sans perte q${QUALITE}` : `webp q${QUALITE}`,
  source: "_bake/boot-frames.js (32 images d'origine, non redessinées)",
}, null, 2) + "\n");

console.log(`-> assets/boot-strip.webp : ${C}x${H * brut.length}, ${Math.round(octets.length / 1024)} Ko, écart max ${perteMax}/255, p99.9 ${centile(0.999)}, ${(partAuDessus8 * 100).toFixed(3)} % des pixels au-delà de 8/255`);
if (partAuDessus8 > 0.005) throw new Error(`${(partAuDessus8 * 100).toFixed(2)} % des pixels diffèrent de plus de 8/255 : l'image se dégrade visiblement`);
// Plafond de l'exception déclarée dans test/asset-budget.test.js (700 Ko) : une
// bande de 220x7040 décodée coûte exactement ce que coûtaient les 32 images
// séparées (mêmes pixels), mais elle tient en un fichier — et se re-encode sans
// perte visible, ce que le WebP avec perte ne permet pas ici.
if (octets.length > 700 * 1024) throw new Error(`${Math.round(octets.length / 1024)} Ko > 700 Ko : plafond de l'exception (test/asset-budget.test.js)`);
