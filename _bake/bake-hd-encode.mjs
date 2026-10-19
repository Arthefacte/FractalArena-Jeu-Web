// bake-hd-encode.mjs — encode la bande HD en WebP et MESURE la perte, chiffres a
// l'appui.
//
// Le controle est le meme que celui de make-boot-strip.mjs, mais il ne fait pas
// confiance au decodeur qui a encode : on re-decode le WebP livre avec ffmpeg
// (`-pix_fmt rgba`), on re-decode aussi chacun des 32 PNG sources, et on compare
// pixel par pixel. Sous un alpha nul la couleur n'est pas affichee : ces pixels
// sont ecartes de la mesure (mais leur alpha, lui, est verifie).
//
// Usage :
//   node _bake/bake-hd-encode.mjs --essai 82 90 100      # tableau de mesures
//   node _bake/bake-hd-encode.mjs --q 90 --ecrire        # ecrit l'asset + le .json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(__dirname, "_hd-frames");
const STRIP = path.join(TMP, "strip.png");
const CIBLE = path.join(ROOT, "assets", "boot-strip-hd.webp");
const META = path.join(ROOT, "assets", "boot-strip-hd.json");
const CELL = 440;
const F = 32;

const arg = (nom, def) => {
  const i = process.argv.indexOf("--" + nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const ECRIRE = process.argv.includes("--ecrire");

if (!fs.existsSync(STRIP)) {
  console.log(`bande absente : ${STRIP} — lancer _bake/bake-hd.mjs d'abord`);
  process.exit(1);
}

const SIGNAUX = path.join(TMP, "_rgba");
fs.mkdirSync(SIGNAUX, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });

// Sources de reference : les 32 images reduites, en RGBA brut.
function brute(entree, sortie) {
  if (!fs.existsSync(sortie)) ff(["-i", entree, "-f", "rawvideo", "-pix_fmt", "rgba", sortie]);
  return fs.readFileSync(sortie);
}
const sources = [];
for (let i = 0; i < F; i++) {
  const p = path.join(TMP, `f-${String(i).padStart(2, "0")}.png`);
  if (!fs.existsSync(p)) { console.log(`image ${i} absente`); process.exit(1); }
  sources.push(brute(p, path.join(SIGNAUX, `f-${String(i).padStart(2, "0")}.rgba`)));
}
const attenduTaille = CELL * CELL * 4;
for (const [i, b] of sources.entries()) {
  if (b.length !== attenduTaille) { console.log(`image ${i} : ${b.length} octets de RGBA, attendu ${attenduTaille}`); process.exit(1); }
}

function mesurer(fichier) {
  const cache = path.join(SIGNAUX, "bande.rgba");
  fs.rmSync(cache, { force: true });          // la bande change a chaque essai
  const brut = brute(fichier, cache);
  const attendu = CELL * CELL * 4 * F;
  if (brut.length !== attendu) throw new Error(`${fichier} : ${brut.length} octets decodes, attendu ${attendu} (dimensions ?)`);
  const ecarts = [];
  let perteMax = 0, auDessus8 = 0, pixelsVus = 0, pixelsEcartes = 0, alphaPerdu = 0;
  for (let i = 0; i < F; i++) {
    const src = sources[i];
    const base = i * CELL * CELL * 4;
    for (let p = 0; p < CELL * CELL; p++) {
      const q = p * 4;
      const alphaSrc = src[q + 3];
      const alphaDst = brut[base + q + 3];
      if (Math.abs(alphaSrc - alphaDst) > 8) alphaPerdu++;
      if (alphaSrc < 8) { pixelsEcartes++; continue; }
      pixelsVus++;
      let pire = 0;
      for (let c = 0; c < 4; c++) {
        const d = Math.abs(brut[base + q + c] - src[q + c]);
        if (d > pire) pire = d;
      }
      if (pire > perteMax) perteMax = pire;
      if (pire > 8) auDessus8++;
      ecarts.push(pire);
    }
  }
  ecarts.sort((a, b) => a - b);
  const centile = (p) => ecarts[Math.min(ecarts.length - 1, Math.floor(p * (ecarts.length - 1)))] || 0;
  return {
    octets: fs.statSync(fichier).size, perteMax, centile999: centile(0.999), centile9999: centile(0.9999),
    partAuDessus8: pixelsVus ? auDessus8 / pixelsVus : 0, pixelsVus, pixelsEcartes, alphaPerdu,
  };
}

function encoder(q, sortie, pixFmt) {
  // Sans perte : RGBA direct. `yuva420p` force un passage RGB -> YUV 4:2:0, qui
  // n'a rien de sans perte (mesure : 9,4 % des pixels a plus de 8/255, alors
  // que le meme encodage en RGBA redonne exactement la source).
  const fmt = pixFmt || (q === null ? "rgba" : "yuva420p");
  const args = q === null
    ? ["-i", STRIP, "-c:v", "libwebp", "-lossless", "1", "-pix_fmt", fmt, sortie]
    : ["-i", STRIP, "-c:v", "libwebp", "-lossless", "0", "-q:v", String(q), "-pix_fmt", fmt, sortie];
  ff(args);
  return sortie;
}

const essais = process.argv.includes("--essai")
  ? process.argv.slice(process.argv.indexOf("--essai") + 1).filter((a) => /^\d+$|^lossless$/.test(a))
  : [];

if (essais.length) {
  console.log("qualite     poids      ecart max   p99.9  p99.99  >8/255   alpha perdu");
  for (const e of essais) {
    const q = e === "lossless" ? null : Number(e);
    const f = encoder(q, path.join(TMP, `essai-${e}.webp`));
    const m = mesurer(f);
    console.log(
      `${String(e).padEnd(9)} ${String(Math.round(m.octets / 1024) + " Ko").padEnd(10)} `
      + `${String(m.perteMax).padEnd(11)} ${String(m.centile999).padEnd(6)} ${String(m.centile9999).padEnd(7)} `
      + `${(m.partAuDessus8 * 100).toFixed(3).padStart(6)} % ${m.alphaPerdu}`
    );
    fs.rmSync(f, { force: true });
  }
  process.exit(0);
}

const qArg = arg("q", "90");
const q = qArg === "lossless" ? null : Number(qArg);
encoder(q, CIBLE);
const m = mesurer(CIBLE);
const octets = fs.readFileSync(CIBLE);
const sha = crypto.createHash("sha256").update(octets).digest("hex");

console.log(`-> assets/boot-strip-hd.webp : ${CELL}x${CELL * F}, ${Math.round(m.octets / 1024)} Ko, `
  + `ecart max ${m.perteMax}/255, p99.9 ${m.centile999}, ${(m.partAuDessus8 * 100).toFixed(3)} % des pixels au-dela de 8/255, `
  + `${m.alphaPerdu} alpha aberrants sur ${CELL * CELL * F} pixels`);

if (ECRIRE) {
  fs.writeFileSync(META, JSON.stringify({
    images: F, cellule: CELL, largeur: CELL, hauteur: CELL * F,
    octets: octets.length, sha256: sha, perteMax: m.perteMax,
    centile999: m.centile999, partAuDessus8: Number(m.partAuDessus8.toFixed(6)), pixelsVus: m.pixelsVus,
    encodage: q === null ? "webp sans perte" : `webp q${q} (alpha conserve, yuva420p)`,
    source: "re-rendu 3D depuis _bake/raw/boot-emblem.glb, 32 images 440x440 — voir RAPPORT_HD.md",
    usage: "app PC uniquement (?app=pc) : assets/boot-strip.webp reste la bande servie au web",
  }, null, 2) + "\n");
  console.log(`-> assets/boot-strip-hd.json`);
}
