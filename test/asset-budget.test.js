/* FRACTAL ARENA — Budget d'assets : ce qui est servi doit tenir dans la mémoire d'un mobile.
 *
 * Ce test existe à cause d'un crash réel : en août 2026, Chrome Android fermait l'onglet pendant
 * la cinématique d'ouverture. Cause mesurée — `Emblem_optimise_12Mo.glb` embarquait 466 014
 * triangles et 4 textures 2048x2048. Sur le disque : 12 Mo. Une fois envoyé au GPU : ~103 Mo,
 * parce qu'une texture ne reste pas compressée en VRAM. Le premier écran du jeu dépassait à lui
 * seul le budget d'un renderer Chrome sur mobile milieu de gamme.
 *
 * Les seuils ci-dessous ne sont pas des préférences esthétiques : ce sont les limites au-delà
 * desquelles on renvoie au GPU plus de pixels que l'écran ne peut en montrer. Les respecter ne
 * dégrade rien — ça cesse d'envoyer de l'invisible.
 *
 * Si un seuil doit bouger, il faut une raison écrite ici, pas un chiffre relevé en silence.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { vramBytes, vramBytesCompressed, imageInfo, inspectGlb, mb, MB } = require("../tools/asset-budget");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");

// ——— Budgets ———
// Cible : Chrome Android sur un mobile milieu de gamme, dont le renderer est tué bien avant
// 300 Mo. On veut que l'ensemble des assets vivants en même temps tienne largement dessous.
const MAX_GLB_FILE = 2 * MB; // un modèle web se livre sous 2 Mo ; au-delà, il n'a pas été préparé
const MAX_GLB_VRAM = 24 * MB; // coût GPU d'un modèle, géométrie + textures
const MAX_TEXTURE_DIM = 1024; // au-delà, la texture dépasse la surface où l'objet est affiché
const MAX_TRIANGLES = 80000; // un triangle par pixel est déjà du gaspillage ; 466k est absurde
const MAX_IMAGE_FILE = 400 * 1024; // toute image servie au client
const MAX_PNG_FILE = 150 * 1024; // le PNG n'a plus de raison d'être ici : le WebP est déjà partout

/** Tous les fichiers de assets/ (récursif), chemins relatifs à la racine du client. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = fs.existsSync(ASSETS) ? walk(ASSETS) : [];
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");

// ——————————————————————————————————————————————————————————————
// Mesure : fonctions pures
// ——————————————————————————————————————————————————————————————

test("vramBytes : une texture 2048² coûte 21 Mo au GPU, mipmaps compris", () => {
  assert.strictEqual(vramBytes(2048, 2048, { mipmaps: false }), 16 * MB);
  assert.strictEqual(vramBytes(2048, 2048), Math.round(16 * MB * (4 / 3)));
});

test("vramBytesCompressed : le KTX2 reste compressé en VRAM (~1 octet/pixel)", () => {
  const brut = vramBytes(1024, 1024);
  const ktx2 = vramBytesCompressed(1024, 1024);
  assert.ok(ktx2 * 3 < brut, `KTX2 (${mb(ktx2)}) doit coûter bien moins que RGBA (${mb(brut)})`);
});

test("imageInfo : lit les dimensions d'un PNG", () => {
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(1536, 16);
  png.writeUInt32BE(1024, 20);
  assert.deepStrictEqual(imageInfo(png), { format: "png", width: 1536, height: 1024, compressedOnGpu: false });
});

test("imageInfo : format inconnu → null, jamais d'exception", () => {
  assert.strictEqual(imageInfo(Buffer.alloc(64)), null);
  assert.strictEqual(imageInfo(Buffer.alloc(2)), null);
});

test("inspectGlb : un buffer qui n'est pas un GLB → null", () => {
  assert.strictEqual(inspectGlb(Buffer.from("pas un glb du tout, vraiment pas")), null);
});

// ——————————————————————————————————————————————————————————————
// Budget : les assets réellement servis
// ——————————————————————————————————————————————————————————————

test("aucun .glb ne dépasse le budget de fichier ni de VRAM", () => {
  const dep = [];
  for (const f of files.filter((f) => f.endsWith(".glb"))) {
    const info = inspectGlb(fs.readFileSync(f));
    if (!info) continue;
    if (info.bytes > MAX_GLB_FILE) dep.push(`${rel(f)} : fichier ${mb(info.bytes)} > ${mb(MAX_GLB_FILE)}`);
    if (info.vram > MAX_GLB_VRAM) {
      dep.push(
        `${rel(f)} : VRAM ${mb(info.vram)} > ${mb(MAX_GLB_VRAM)} ` +
          `(géométrie ${mb(info.geometryVram)} + textures ${mb(info.textureVram)})`
      );
    }
    if (info.triangles > MAX_TRIANGLES) {
      dep.push(`${rel(f)} : ${info.triangles.toLocaleString("fr-FR")} triangles > ${MAX_TRIANGLES.toLocaleString("fr-FR")}`);
    }
    for (const t of info.textures) {
      if (Math.max(t.width, t.height) > MAX_TEXTURE_DIM) {
        dep.push(`${rel(f)} : texture ${t.width}×${t.height} > ${MAX_TEXTURE_DIM}px (${mb(t.vram)} de VRAM)`);
      }
    }
  }
  assert.deepStrictEqual(dep, [], "\n  " + dep.join("\n  ") + "\n");
});

// Exceptions au budget image, chacune justifiée et plafonnée à part.
// emblem-spin.webp (v222) : repli de la cinématique CHARGÉ À LA DEMANDE
// uniquement (?cine=bake ou échec 3D — depuis #114/#115 la 3D est le rendu
// par défaut, ce fichier ne part plus au boot). Le jeton à deux faces impose
// un TOUR COMPLET (l'ancien demi-tour bouclable reposait sur la symétrie des
// deux copies identiques) : 132 images au lieu de 88, et la pierre gravée
// compresse moins bien que l'ancien emblème lisse (427 Ko même à q4).
const IMAGE_EXCEPTIONS = { "assets/emblem-spin.webp": 600 * 1024 };

test("aucune image servie ne dépasse le budget de poids", () => {
  const dep = [];
  for (const f of files) {
    if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
    const bytes = fs.statSync(f).size;
    const max = IMAGE_EXCEPTIONS[rel(f)] || MAX_IMAGE_FILE;
    if (bytes > max) dep.push(`${rel(f)} : ${(bytes / 1024).toFixed(0)} Ko > ${max / 1024} Ko`);
  }
  assert.deepStrictEqual(dep, [], "\n  " + dep.join("\n  ") + "\n");
});

test("plus de gros PNG : le WebP est déjà le format du jeu", () => {
  const dep = [];
  for (const f of files.filter((f) => /\.png$/i.test(f))) {
    const bytes = fs.statSync(f).size;
    if (bytes > MAX_PNG_FILE) dep.push(`${rel(f)} : PNG de ${(bytes / 1024).toFixed(0)} Ko — à convertir en WebP`);
  }
  assert.deepStrictEqual(dep, [], "\n  " + dep.join("\n  ") + "\n");
});

test("la cinématique d'ouverture tient dans le budget du premier écran", () => {
  // C'est l'écran que voit tout nouveau joueur, avant même de savoir si le jeu lui plaît.
  // Il partage la mémoire de l'onglet avec React, Three.js, le fond animé et l'UI :
  // 30 Mo est déjà généreux pour un emblème qui tourne.
  const MAX_PREMIER_ECRAN = 30 * MB;
  const emblem = path.join(ASSETS, "Emblem_optimise_12Mo.glb");
  if (!fs.existsSync(emblem)) return; // renommé par l'optimisation : les autres tests couvrent
  const info = inspectGlb(fs.readFileSync(emblem));
  assert.ok(
    info.vram <= MAX_PREMIER_ECRAN,
    `L'emblème coûte ${mb(info.vram)} de VRAM (budget ${mb(MAX_PREMIER_ECRAN)}) : ` +
      `${info.triangles.toLocaleString("fr-FR")} triangles, ` +
      info.textures.map((t) => `${t.width}×${t.height}`).join(" + ")
  );
});
