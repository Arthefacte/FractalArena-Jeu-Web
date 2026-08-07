// test/asset-hash.test.js
// Mesure du 07/08/2026 (Mali-G68, sonde v3) :
//
//   telecharge : 1455 Ko en 86 requetes
//   plus lourds : emblem.glb 1350 Ko
//   pire (SW) : emblem.glb (service 430 ms)
//
// L'emblème était retéléchargé EN ENTIER à chaque déploiement, sans avoir changé
// d'un octet. Effet de bord de la PR #92 : `FA_ASSET_URL` versionnait les URL
// d'assets avec le numéro de version du JEU, donc `emblem.glb?v=127` était une
// adresse neuve à chaque livraison. La version du jeu dit « le code a changé »,
// pas « ce fichier a changé » — seul son contenu peut le dire.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

function assetsGlb() {
  const out = [];
  for (const d of ["assets", "assets/relics"]) {
    const abs = path.join(RACINE, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (f.endsWith(".glb")) out.push(d + "/" + f);
  }
  return out;
}

function chargerManifeste() {
  const sandbox = { window: {} };
  require("node:vm").runInNewContext(lire("asset-hashes.js"), sandbox);
  return sandbox.window.FA_ASSET_HASHES;
}

test("le manifeste couvre tous les .glb servis", () => {
  const m = chargerManifeste();
  const fichiers = assetsGlb();
  assert.ok(fichiers.length > 0, "aucun .glb trouve — test a reajuster");
  for (const f of fichiers) {
    assert.ok(m[f], "absent du manifeste : " + f + " (relancer npm run build)");
  }
});

test("chaque empreinte correspond au contenu reel du fichier", () => {
  const m = chargerManifeste();
  for (const f of assetsGlb()) {
    const attendu = crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(RACINE, f))).digest("hex").slice(0, 10);
    assert.strictEqual(m[f], attendu,
      f + " : empreinte perimee — le fichier a change sans que le manifeste soit regenere");
  }
});

test("FA_ASSET_URL utilise l'empreinte, pas la version du jeu", () => {
  const data = lire("data.js");
  assert.match(data, /FA_ASSET_HASHES/,
    "data.js doit lire le manifeste, sinon chaque livraison retelecharge les assets inchanges");
  // Le repli sur la version du jeu reste legitime : un asset hors manifeste doit
  // continuer d'etre cache-buste plutot que servi indefiniment par le CDN.
  assert.match(data, /FA_ASSET_V/);
});

test("le manifeste est charge avant data.js", () => {
  const html = lire("index.html");
  const iHash = html.indexOf("asset-hashes.js");
  const iData = html.indexOf("data.js");
  assert.ok(iHash > -1, "asset-hashes.js n'est pas charge par la page");
  assert.ok(iHash < iData, "le manifeste doit preceder data.js qui s'en sert");
});

test("le manifeste est regenere par npm run build", () => {
  const pkg = JSON.parse(lire("package.json"));
  assert.match(pkg.scripts.build, /asset-hashes/,
    "sans cela, un asset modifie garderait son ancienne empreinte");
});

// Le vrai gain : deux versions differentes du jeu doivent produire la MEME URL
// pour un asset inchange. C'est ce qui evite les 1350 Ko a chaque deploiement.
test("l'URL d'un asset ne depend pas de la version du jeu", () => {
  const sandbox = { window: {} };
  const vm = require("node:vm");
  vm.runInNewContext(lire("asset-hashes.js"), sandbox);
  vm.runInNewContext(lire("data.js"), sandbox, { filename: "data.js" });
  const url1 = sandbox.window.FA_ASSET_URL("assets/emblem.glb");
  sandbox.window.FA_ASSET_V = "999";                       // livraison suivante
  const url2 = sandbox.window.FA_ASSET_URL("assets/emblem.glb");
  assert.strictEqual(url1, url2,
    "l'URL bouge avec la version du jeu : l'asset sera retelecharge pour rien");
  assert.match(url1, /\?v=[0-9a-f]{10}$/, "l'URL doit porter l'empreinte du contenu");
});
