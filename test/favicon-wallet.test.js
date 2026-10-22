// test/favicon-wallet.test.js
// La vignette d'identité du site (carré de la demande de signature d'un wallet)
// lit l'icône du site. Deux conditions pour qu'elle affiche quelque chose :
//   1. les fichiers à la RACINE existent et sont décodables — un wallet demande
//      /favicon.ico en dur, sans lire le <head> ;
//   2. ils portent la marque PETIT FORMAT, pas l'emblème détaillé réduit à une
//      tache (voir _bake/gen-favicon-mark.mjs).
// Ces tests tiennent les deux, plus le cache-bust qui fait que le wallet
// redemande l'icône au lieu de garder l'ancienne indéfiniment.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f));
const code = (f) => read(f).toString("utf8");

const version = () => {
  const m = code("data.js").match(/FA_ASSET_V\s*=\s*"(\d+)"/);
  assert.ok(m, "data.js doit exposer FA_ASSET_V");
  return m[1];
};

test("les icônes à la racine existent (un wallet les demande en dur)", () => {
  for (const f of ["favicon.ico", "favicon.png", "apple-touch-icon.png"]) {
    assert.ok(fs.existsSync(path.join(root, f)), f + " manque à la racine");
    assert.ok(read(f).length > 200, f + " est suspicieusement vide");
  }
});

test("favicon.ico porte les trois tailles attendues, en frames BMP non compressées", () => {
  const buf = read("favicon.ico");
  assert.strictEqual(buf.readUInt16LE(0), 0, "en-tête ICO : réservé");
  assert.strictEqual(buf.readUInt16LE(2), 1, "en-tête ICO : type 1 = icône");
  const n = buf.readUInt16LE(4);
  assert.ok(n >= 3, "au moins 3 frames, trouvé " + n);
  const tailles = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + 16 * i;
    const w = buf.readUInt8(o) || 256;
    const h = buf.readUInt8(o + 1) || 256;
    const bpp = buf.readUInt16LE(o + 6);
    const ofs = buf.readUInt32LE(o + 12);
    tailles.push(w);
    assert.strictEqual(w, h, "frame non carrée à l'index " + i);
    assert.strictEqual(bpp, 32, "frame " + w + " en " + bpp + " bpp : 32 attendu");
    // PNG encapsulé : des lecteurs anciens (et certains webviews de wallet) le
    // refusent et retombent sur une vignette vide. On veut du BMP.
    const png = buf.slice(ofs, ofs + 8);
    assert.ok(!png.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "frame " + w + " est un PNG encapsulé : préférer une frame BMP 32bpp");
  }
  for (const attendu of [16, 32, 48]) {
    assert.ok(tailles.includes(attendu), "frame " + attendu + "x" + attendu + " absente : " + tailles.join(","));
  }
});

test("les PNG d'icône ont la taille annoncée par leur nom d'usage", () => {
  const dims = (f) => {
    const b = read(f);
    assert.strictEqual(b.toString("ascii", 1, 4), "PNG", f + " n'est pas un PNG");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  assert.deepStrictEqual(dims("favicon.png"), [96, 96], "favicon.png doit être 96x96");
  assert.deepStrictEqual(dims("apple-touch-icon.png"), [180, 180], "apple-touch-icon.png doit être 180x180");
  assert.deepStrictEqual(dims("assets/favicon.png"), [256, 256], "assets/favicon.png doit être 256x256");
});

test("index.html déclare les icônes à la racine ET le rel « shortcut icon »", () => {
  const html = code("index.html");
  assert.match(html, /<link rel="icon"[^>]*href="favicon\.ico\?v=\d+"/,
    "favicon.ico doit être déclaré avec son cache-bust");
  assert.match(html, /<link rel="shortcut icon"[^>]*href="favicon\.ico\?v=\d+"/,
    "shortcut icon manquant : certains wallets ne lisent que ce rel");
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon\.png"/,
    "le repli apple-touch-icon à la racine manque (navigateur in-app)");
});

test("chaque balise d'icône porte la version courante (sinon le wallet garde l'ancienne)", () => {
  const html = code("index.html");
  const v = version();
  const balises = [...html.matchAll(/<link rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/g)].map((m) => m[0]);
  assert.ok(balises.length >= 3, "trop peu de balises d'icône : " + balises.length);
  for (const b of balises) {
    // apple-touch-icon : icônes de plateforme, servies à un chemin fixe et sans
    // cache-bust par contrat (test/favicon-og.test.js) — hors du champ de ce test.
    if (/rel="apple-touch-icon"/.test(b)) continue;
    const m = b.match(/\?v=(\d+)/);
    assert.ok(m, "balise sans cache-bust : " + b);
    assert.strictEqual(m[1], v, "icône à la version " + m[1] + " alors que le déploiement est " + v);
  }
});

test("les icônes sont dans les PREMIERS enfants du <head>, avant tout script", () => {
  // UniSat lit le carré d'identité de la demande de signature par
  // `querySelector('head > link[rel~="icon"]')` au moment où son provider
  // s'injecte (document_start), et ne relit JAMAIS ensuite : la valeur du
  // premier passage est figée pour la session. Si la balise est derrière un
  // <script src> bloquant (frame-guard.js), elle n'est pas encore dans le DOM
  // à cet instant, le wallet reçoit `undefined`, et la fenêtre de signature
  // affiche un carré vide — définitivement. Vécu deux fois avant ce test.
  const html = code("index.html");
  // Les commentaires sont retirés : ils citent les balises pour expliquer la
  // règle, et un `<!-- ... <script ... -->` ne s'exécute pas.
  const head = html
    .slice(html.indexOf("<head"), html.indexOf("</head>"))
    .replace(/<!--[\s\S]*?-->/g, "");
  const premiereIcone = head.search(/<link rel="(?:icon|shortcut icon)"/);
  assert.ok(premiereIcone > -1, "aucune balise d'icône dans le <head>");
  // Aucune balise <script> (ni <link rel=stylesheet>, qui bloque le parseur
  // pour les feuilles externes non bloquantes) ne doit précéder l'icône.
  const premierScript = head.search(/<script/);
  assert.ok(
    premierScript === -1 || premiereIcone < premierScript,
    "un <script> précède les icônes du <head> : le wallet les lira vides"
  );
  const premiereFeuille = head.search(/<link rel="stylesheet"/);
  assert.ok(
    premiereFeuille === -1 || premiereIcone < premiereFeuille,
    "une feuille de style externe précède les icônes du <head>"
  );
  // Et elles restent groupées en tête : moins de 2 000 caractères de <head>
  // avant la première icône (une balise perdue au milieu du microdata, c'est
  // le même bug une version plus tard).
  assert.ok(premiereIcone < 2000, "première icône trop loin dans le <head> : offset " + premiereIcone);
});
