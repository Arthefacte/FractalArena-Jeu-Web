/* FRACTAL ARENA — Mesure du coût réel des assets pour le GPU.
 *
 * Pourquoi ce module : le poids d'un fichier ne dit RIEN de ce qu'il coûte une fois affiché.
 * Une texture 2048x2048 pèse 900 Ko en WebP et 21 Mo en VRAM, parce qu'un GPU ne stocke pas
 * du WebP : il décompresse tout en RGBA brut, mipmaps compris. C'est cet écart — invisible
 * dans un `ls -la` — qui a fait tuer l'onglet Chrome des joueurs mobiles par le gestionnaire
 * de mémoire d'Android (crash pendant la cinématique d'ouverture, août 2026).
 *
 * Ce module ne fait que MESURER. Les budgets et les seuils vivent dans test/asset-budget.test.js.
 * Fonctions pures sur des Buffer : testables sans toucher au disque.
 */
"use strict";

/** Octets occupés en VRAM par une texture non compressée, mipmaps inclus (~+33%). */
function vramBytes(width, height, { mipmaps = true } = {}) {
  const base = width * height * 4; // RGBA8
  return Math.round(mipmaps ? base * (4 / 3) : base);
}

/** Octets en VRAM d'une texture au format compressé GPU (KTX2/Basis), mipmaps inclus.
 *  Le GPU lit ces formats SANS les décompresser — c'est tout l'intérêt.
 *  UASTC ≈ 1 octet/pixel, ETC1S ≈ 0,25 octet/pixel. */
function vramBytesCompressed(width, height, bytesPerPixel = 1) {
  return Math.round(width * height * bytesPerPixel * (4 / 3));
}

/** Dimensions d'une image depuis ses premiers octets. Rend null si le format est inconnu. */
function imageInfo(buf) {
  if (!buf || buf.length < 32) return null;

  // PNG : signature 8 octets, puis IHDR (largeur/hauteur en big-endian).
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), compressedOnGpu: false };
  }

  // JPEG : parcours des segments jusqu'à un SOF.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { format: "jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), compressedOnGpu: false };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }

  // WebP : RIFF....WEBP, puis un chunk VP8 (lossy), VP8L (lossless) ou VP8X (étendu).
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") {
      return {
        format: "webp",
        width: buf.readUIntLE(24, 3) + 1,
        height: buf.readUIntLE(27, 3) + 1,
        compressedOnGpu: false,
      };
    }
    if (kind === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, compressedOnGpu: false };
    }
    if (kind === "VP8 ") {
      return {
        format: "webp",
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
        compressedOnGpu: false,
      };
    }
    return null;
  }

  // KTX2 : le seul format ici que le GPU garde compressé en mémoire.
  if (buf.length >= 24 && buf[0] === 0xab && buf.toString("ascii", 1, 4) === "KTX") {
    return { format: "ktx2", width: buf.readUInt32LE(20), height: buf.readUInt32LE(24), compressedOnGpu: true };
  }

  return null;
}

/** Coût VRAM d'une image décrite par imageInfo(). */
function imageVram(info) {
  if (!info) return 0;
  return info.compressedOnGpu ? vramBytesCompressed(info.width, info.height) : vramBytes(info.width, info.height);
}

/** Inspecte un .glb (glTF binaire) : géométrie, textures embarquées, coût VRAM total.
 *  Rend null si le buffer n'est pas un GLB valide. */
function inspectGlb(buf) {
  if (!buf || buf.length < 20 || buf.toString("ascii", 0, 4) !== "glTF") return null;

  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));

  // Le chunk binaire suit le chunk JSON (chacun précédé de 8 octets d'en-tête).
  const binStart = 20 + jsonLength + 8;
  const bufferViews = json.bufferViews || [];
  const accessors = json.accessors || [];

  let triangles = 0;
  let vertices = 0;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.indices != null && accessors[prim.indices]) triangles += Math.floor(accessors[prim.indices].count / 3);
      const pos = prim.attributes && prim.attributes.POSITION;
      if (pos != null && accessors[pos]) vertices += accessors[pos].count;
    }
  }

  const textures = [];
  for (const image of json.images || []) {
    if (image.bufferView == null) continue; // image externe : hors de portée de cette mesure
    const view = bufferViews[image.bufferView];
    if (!view) continue;
    const start = binStart + (view.byteOffset || 0);
    const info = imageInfo(buf.subarray(start, start + Math.min(view.byteLength, 64)));
    if (!info) continue;
    textures.push({ ...info, bytes: view.byteLength, vram: imageVram(info) });
  }

  // Géométrie en VRAM : position+normale+UV+tangente par sommet, plus les indices.
  // Approximation volontairement large — l'ordre de grandeur suffit à cadrer un budget.
  const geometryVram = vertices * (12 + 12 + 8 + 16) + triangles * 3 * 4;
  const textureVram = textures.reduce((sum, t) => sum + t.vram, 0);

  return {
    bytes: buf.length,
    triangles,
    vertices,
    textures,
    geometryVram,
    textureVram,
    vram: geometryVram + textureVram,
    extensions: json.extensionsUsed || [],
  };
}

const MB = 1024 * 1024;
/** Formatage lisible pour les messages d'échec de test. */
function mb(bytes) {
  return (bytes / MB).toFixed(1) + " Mo";
}

module.exports = { vramBytes, vramBytesCompressed, imageInfo, imageVram, inspectGlb, mb, MB };
