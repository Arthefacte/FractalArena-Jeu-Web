/* Favicon et aperçus de lien — le volet « mon logo n'apparaît pas ».
 *
 * Vécu (15/10/2026) : la fenêtre de signature d'UniSat affichait un carré VIDE
 * devant https://fractalarena.com. La balise <link rel="icon"> était pourtant
 * correcte et `assets/favicon.png` répondait bien 200 — mais les outils qui ne
 * lisent pas le <head> (wallets, crawlers, générateurs d'aperçu) demandent
 * /favicon.ico À LA RACINE. Absent, il rendait un 404 que le CDN garde en
 * cache, et le logo restait un placeholder — sans la moindre erreur visible
 * côté site.
 *
 * Même cause pour les aperçus de lien : sans og:image, une carte partagée sur
 * X, Telegram ou Discord ne porte aucun visuel.
 *
 * Ces règles verrouillent les DEUX chemins demandés en dur, la présence réelle
 * des fichiers, et les métadonnées (URL ABSOLUE, 1200x630, format que tous les
 * aperçus affichent).
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { imageInfo } = require("../tools/asset-budget");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/** Entrées d'un .ico : { taille, octets, offset }, lues dans l'annuaire. */
function entreesIco(buf) {
  assert.strictEqual(buf.readUInt16LE(0), 0, "réservé : doit valoir 0");
  assert.strictEqual(buf.readUInt16LE(2), 1, "type 1 = icône");
  const n = buf.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    const taille = buf.readUInt8(o) || 256;
    out.push({ taille, octets: buf.readUInt32LE(o + 8), offset: buf.readUInt32LE(o + 12), bpp: buf.readUInt16LE(o + 6) });
  }
  return out;
}

test("les icônes de repli existent à la RACINE du site", () => {
  // Ce sont les chemins que les outils demandent en dur, sans lire le <head>.
  for (const f of ["favicon.ico", "favicon.png", "apple-touch-icon.png"]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)),
      `/${f} absent : le demandeur reçoit un 404 (que le CDN garde) et affiche un carré vide`);
  }
});

test("favicon.ico porte les trois tailles, dans une structure valide", () => {
  const buf = fs.readFileSync(path.join(ROOT, "favicon.ico"));
  const entrees = entreesIco(buf);
  const tailles = entrees.map((e) => e.taille).sort((a, b) => a - b);
  // 16 = onglet, 32 = barre des tâches et la plupart des popups de wallet,
  // 48 = raccourcis et listes. Une seule taille obligerait le décodeur à rééchantillonner.
  assert.deepStrictEqual(tailles, [16, 32, 48], "tailles présentes : " + tailles.join(", "));
  // Chaque entrée déclare sa longueur ET sa position : si l'offset oublie l'entête
  // DIB (40 octets), le décodeur lit les pixels de l'entrée précédente. Vérifié ici
  // plutôt qu'à l'œil : une icône mal alignée reste un carré vide, en silence.
  let attendu = 6 + 16 * entrees.length;
  for (const e of entrees) {
    assert.strictEqual(e.offset, attendu, `${e.taille}px : offset ${e.offset} au lieu de ${attendu}`);
    const masque = Math.ceil(e.taille / 8 / 4) * 4 * e.taille; // 1 bit/pixel, lignes alignées sur 4
    assert.strictEqual(e.octets, 40 + e.taille * e.taille * 4 + masque,
      `${e.taille}px : longueur déclarée incohérente (entête DIB comprise ?)`);
    attendu += e.octets;
  }
  assert.strictEqual(attendu, buf.length, "des octets traînent après la dernière entrée");
});

test("index.html déclare les replis à la racine", () => {
  assert.match(HTML, /<link[^>]+rel="icon"[^>]+href="favicon\.ico\?v=\d+"/,
    "sans balise, /favicon.ico reste une devinette et n'est pas versionné");
  assert.match(HTML, /<link[^>]+rel="icon"[^>]+href="favicon\.png\?v=\d+"/,
    "repli PNG de la racine non déclaré");
  assert.match(HTML, /rel="apple-touch-icon"[^>]+href="apple-touch-icon\.png"/,
    "repli iOS de la racine non déclaré");
});

test("l'aperçu de lien est déclaré en URL ABSOLUE et sur un fichier réel", () => {
  const m = HTML.match(/property="og:image"[^>]+content="([^"]+)"/);
  assert.ok(m, "aucun og:image : une carte partagée part sans visuel");
  const url = m[1];
  // Un crawler lit la balise hors de tout contexte de page : un chemin relatif
  // ne lui dit pas sur quel hôte le prendre.
  assert.match(url, /^https:\/\/fractalarena\.com\//, "og:image doit être une URL absolue : " + url);
  assert.match(url, /\?v=\d+/, "l'image d'aperçu doit porter le cache-bust du déploiement");
  const rel = url.replace("https://fractalarena.com/", "").split("?")[0];
  const file = path.join(ROOT, rel);
  assert.ok(fs.existsSync(file), "og:image déclarée mais absente : " + rel);
  const info = imageInfo(fs.readFileSync(file));
  assert.ok(info, "format de l'image d'aperçu illisible : " + rel);
  // 1200x630 = le rapport que X et Facebook recadrent le moins ; les autres
  // formats sont rognés ou affichés en vignette carrée.
  assert.strictEqual(info.width + "x" + info.height, "1200x630",
    `l'image d'aperçu mesure ${info.width}x${info.height}, attendu 1200x630`);
  // Le PNG et le WebP sont refusés ou mal rendus par une partie des aperçus
  // (WhatsApp notamment) : le JPEG est le seul format sans réserve.
  assert.strictEqual(info.format, "jpeg", "l'image d'aperçu doit être un JPEG : " + info.format);
});

test("le manifeste parle d'entités, jamais de créatures", () => {
  // Vocabulaire du jeu, arbitré par le propriétaire : ce sont des ENTITÉS.
  const manifeste = fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8");
  const m = JSON.parse(manifeste);
  assert.doesNotMatch(String(m.description || ""), /créature/i,
    "la description du manifeste reprend un mot banni du jeu");
});
