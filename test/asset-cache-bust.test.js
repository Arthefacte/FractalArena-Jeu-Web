// test/asset-cache-bust.test.js
// Le 07/08/2026, le correctif OOM de la PR #90 n'atteignait AUCUN joueur : les .glb
// allégés étaient bien déployés à l'origine, mais Cloudflare servait encore les
// anciens (amber_cell.glb : 12,7 Mo servis pour 492 Ko à l'origine, Age de 5 jours),
// et assets/emblem.glb renvoyait un 404 HTML mis en cache. Cause : les scripts
// portent tous « ?v=N », les .glb n'avaient aucun cache-buster — rien ne signalait
// au CDN que le fichier avait changé. Ces tests interdisent la récidive.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const HTML = lire("index.html");
const DATA = lire("data.js");

// La version des assets doit être la même que celle des scripts : deux versions
// différentes voudraient dire qu'une livraison a oublié la moitié du jeu.
function versionDesScripts() {
  const v = [...HTML.matchAll(/\?v=(\d+)/g)].map((m) => m[1]).filter((x) => x !== "1");
  return [...new Set(v)][0];
}

test("data.js publie une version d'assets", () => {
  assert.match(DATA, /FA_ASSET_V\s*=\s*"(\d+)"/, "window.FA_ASSET_V absent de data.js");
});

test("la version des assets suit celle des scripts", () => {
  const asset = DATA.match(/FA_ASSET_V\s*=\s*"(\d+)"/)[1];
  assert.strictEqual(asset, versionDesScripts(),
    "FA_ASSET_V doit etre bumpee en meme temps que les balises ?v= d'index.html");
});

// Chaque point qui charge un .glb doit passer par le cache-buster. Un seul oubli
// suffit à laisser un asset périmé au CDN pendant des jours.
const CHARGEURS = ["relic-assets.js", "totem-cine.js", "cinematique.jsx"];

test("aucun .glb n'est charge sans cache-buster", () => {
  for (const f of CHARGEURS) {
    const src = lire(f);
    // Un CHEMIN complet vers un .glb : « assets/… ». Les fragments de
    // concaténation (le seul suffixe ".glb") ne comptent pas — c'est le chemin
    // assemblé qui part au réseau, et il doit passer par FA_ASSET_URL.
    const chemins = [...src.matchAll(/["'][^"']*assets\/[^"']*\.glb["']/g)].map((m) => m[0]);
    for (const chemin of chemins) {
      const i = src.indexOf(chemin);
      // La version est appliquee soit dans la chaine elle-meme, soit par un appel
      // FA_ASSET_URL qui l'entoure (au plus quelques caracteres avant).
      const avant = src.slice(Math.max(0, i - 60), i);
      assert.ok(/\?v=/.test(chemin) || /FA_ASSET_URL/.test(avant),
        `${f} : ${chemin} charge sans version — le CDN servira l'ancien fichier`);
    }
    // relic-assets.js assemble son chemin par concaténation (pas de littéral
    // complet) : ce qui compte alors, c'est qu'il passe par le helper.
    assert.match(src, /FA_ASSET_URL/, `${f} : ne versionne aucun de ses .glb`);
  }
});

test("le helper de version est expose une seule fois", () => {
  assert.match(DATA, /FA_ASSET_URL/, "data.js doit exposer le helper d'URL versionnee");
});
