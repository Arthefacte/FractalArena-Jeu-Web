/* FRACTAL ARENA — Préparation des modèles 3D pour le web.
 *
 * Les .glb sortis de Meshy sont des assets de production 3D : maillage dense, textures 2048².
 * Envoyés tels quels au navigateur, ils tiennent en mémoire GPU dix à vingt fois ce qu'affiche
 * l'écran. Sur mobile, le gestionnaire de mémoire d'Android tue l'onglet avant que le joueur
 * ait vu quoi que ce soit — c'est ce qui arrivait sur la cinématique d'ouverture.
 *
 * Ce script ramène chaque modèle à ce que sa taille d'affichage justifie. Les cibles ci-dessous
 * ne sont pas arbitraires : elles viennent du nombre de pixels que le modèle occupe réellement.
 *
 *   node tools/optimize-assets.mjs          # optimise et écrit
 *   node tools/optimize-assets.mjs --check  # mesure seulement, n'écrit rien
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplify, weld, dedup, prune, meshopt } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");

/* Cibles par modèle.
 *
 * `triangles` : l'emblème occupe ~800 px de large en cinématique, les reliques 220 px (660 px
 * sur un écran à DPR 3). À 50 000 triangles pour 800 px, on a déjà un triangle pour 13 pixels —
 * bien en deçà de ce que l'œil distingue sur une forme lisse.
 *
 * `textures` : une texture ne sert à rien au-delà de la surface qu'elle couvre à l'écran.
 * baseColor et normal portent le détail visible ; emissive et metallicRoughness décrivent des
 * variations douces et supportent la moitié de la résolution sans différence perceptible.
 */
const CIBLES = [
  {
    src: "assets/Emblem_optimise_12Mo.glb",
    out: "assets/emblem.glb",
    triangles: 60000,
    textures: { "(baseColor|normal)": 1024, "(emissive|metallicRoughness)": 512 },
    // Pas de compression meshopt en sortie : le GLTFLoader de cinematique.jsx n'installe pas
    // le décodeur correspondant, il ne saurait pas relire le fichier.
    meshopt: false,
    note: "cinématique d'ouverture + écran de connexion, ~800 px",
  },
  {
    src: "assets/logo3d.glb",
    out: "assets/logo3d.glb",
    triangles: 40000,
    textures: { ".*": 512 },
    meshopt: false, // idem pour totem-cine.js
    note: "cinématique du totem",
  },
  ...fs
    .readdirSync(path.join(ROOT, "assets/relics"))
    .filter((f) => f.endsWith(".glb"))
    .map((f) => ({
      src: `assets/relics/${f}`,
      out: `assets/relics/${f}`,
      triangles: 30000,
      textures: { ".*": 512 },
      meshopt: true, // relic-models.js installe MeshoptDecoder : on garde la compression
      note: "viewer de relique, 220 px",
    })),
  ...fs
    .readdirSync(path.join(ROOT, "assets/cores"))
    .filter((f) => f.endsWith(".glb"))
    .map((f) => ({
      src: `assets/cores/${f}`,
      out: `assets/cores/${f}`,
      triangles: 30000,
      textures: { "(baseColor|normal)": 1024, "(emissive|metallicRoughness)": 512 },
      meshopt: true, // le branchement cores (Claude Code) installera MeshoptDecoder, pattern relic-models.js
      note: "core d'équipement, ~220 px",
    })),
];

// Les .glb des reliques sont déjà compressés en EXT_meshopt_compression : sans ces dépendances,
// l'IO ne sait même pas les lire.
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const MB = 1024 * 1024;
const mb = (n) => (n / MB).toFixed(2) + " Mo";

/** Associe chaque texture au rôle qu'elle joue dans son matériau (baseColor, normal, …).
 *  Une texture peut servir plusieurs rôles : on garde le plus exigeant en résolution. */
function slotsDesTextures(doc) {
  const roles = new Map();
  const marquer = (tex, role) => {
    if (!tex) return;
    if (!roles.has(tex)) roles.set(tex, new Set());
    roles.get(tex).add(role);
  };
  for (const mat of doc.getRoot().listMaterials()) {
    marquer(mat.getBaseColorTexture(), "baseColor");
    marquer(mat.getNormalTexture(), "normal");
    marquer(mat.getEmissiveTexture(), "emissive");
    marquer(mat.getMetallicRoughnessTexture(), "metallicRoughness");
    marquer(mat.getOcclusionTexture(), "occlusion");
  }
  return roles;
}

/** Redimensionne les textures selon les motifs de rôle donnés.
 *  Fait à la main plutôt qu'avec textureCompress() : ce dernier transmet à sharp un espace
 *  colorimétrique que libvips refuse ("parameter space not set") sur ces WebP pourtant sains. */
async function redimensionnerTextures(doc, motifs) {
  const roles = slotsDesTextures(doc);
  for (const tex of doc.getRoot().listTextures()) {
    const taille = tailleVoulue(roles.get(tex), motifs);
    if (!taille) continue;
    const size = tex.getSize();
    if (size && Math.max(size[0], size[1]) <= taille) continue; // déjà sous la cible
    const buf = Buffer.from(tex.getImage());
    const out = await sharp(buf)
      .resize(taille, taille, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toBuffer();
    tex.setImage(new Uint8Array(out));
    tex.setMimeType("image/webp");
  }
}

/** Première taille dont le motif correspond à l'un des rôles de la texture. */
function tailleVoulue(rolesTexture, motifs) {
  const liste = rolesTexture ? [...rolesTexture] : ["inconnu"];
  for (const [motif, taille] of Object.entries(motifs)) {
    const re = new RegExp(motif);
    if (liste.some((r) => re.test(r))) return taille;
  }
  return null;
}

/** Compte triangles et sommets d'un document, et la VRAM des textures. */
function mesurer(doc, bytes) {
  let triangles = 0;
  let vertices = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) triangles += Math.floor(idx.getCount() / 3);
      const pos = prim.getAttribute("POSITION");
      if (pos) vertices += pos.getCount();
    }
  }
  let textureVram = 0;
  const dims = [];
  for (const tex of doc.getRoot().listTextures()) {
    const size = tex.getSize();
    if (!size) continue;
    dims.push(`${size[0]}×${size[1]}`);
    textureVram += Math.round(size[0] * size[1] * 4 * (4 / 3));
  }
  const geometryVram = vertices * (12 + 12 + 8 + 16) + triangles * 3 * 4;
  return { bytes, triangles, vertices, textureVram, geometryVram, vram: textureVram + geometryVram, dims };
}

function ligne(label, m) {
  console.log(
    `  ${label.padEnd(8)} ${mb(m.bytes).padStart(9)}  ${String(m.triangles).padStart(9)} tri  ` +
      `VRAM ${mb(m.vram).padStart(9)}  [${m.dims.join(" ") || "—"}]`
  );
}

let echecs = 0;

for (const cible of CIBLES) {
  const src = path.join(ROOT, cible.src);
  if (!fs.existsSync(src)) {
    console.log(`\n${cible.src} — ABSENT, ignoré`);
    continue;
  }

  console.log(`\n${cible.src}  (${cible.note})`);
  const doc = await io.read(src);
  const avant = mesurer(doc, fs.statSync(src).size);
  ligne("avant", avant);

  if (CHECK_ONLY) continue;

  // Nettoyage préalable : `weld` fusionne les sommets identiques, sans quoi la simplification
  // ne peut pas replier le maillage (elle ne voit que des triangles isolés).
  await doc.transform(dedup(), weld());

  const ratio = Math.min(1, cible.triangles / Math.max(avant.triangles, 1));
  if (ratio < 1) {
    // `error` est la déviation maximale tolérée, en fraction de la taille du modèle. 0,5 % est
    // invisible à l'écran et laisse assez de latitude pour atteindre la cible.
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005 }));
  }

  await redimensionnerTextures(doc, cible.textures);

  await doc.transform(prune());
  if (cible.meshopt) await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));

  const out = path.join(ROOT, cible.out);
  await io.write(out, doc);

  const apres = mesurer(await io.read(out), fs.statSync(out).size);
  ligne("après", apres);
  console.log(
    `  → fichier ÷${(avant.bytes / apres.bytes).toFixed(1)}   VRAM ÷${(avant.vram / apres.vram).toFixed(1)}`
  );

  if (apres.vram > 24 * MB) {
    console.log(`  ⚠ VRAM encore au-dessus du budget de 24 Mo`);
    echecs++;
  }
}

if (CHECK_ONLY) console.log("\n(--check : aucun fichier écrit)");
process.exit(echecs ? 1 : 0);
