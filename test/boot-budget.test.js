// test/boot-budget.test.js
// Le premier écran ne doit payer que ce qu'il montre.
//
// Constat du 07/08/2026 (cinématique lente et saccadée en PWA mobile) : `relic-icons.js`
// appelait `FA_RELIC_MODELS.preload()` AU CHARGEMENT DU MODULE. Au boot partaient donc
// 8 modèles de reliques — 3,1 Mo, 239 970 triangles, 39 Mo de VRAM — à télécharger,
// décoder (meshopt) et normaliser, en concurrence directe avec l'emblème de la
// cinématique (1,79 Mo, 60 000 triangles) et avec ses frames. Or aucune relique n'est
// affichée sur cet écran : `RelicIcon` ne vit que dans le Marché et l'équipement, et
// `get()` sait déjà charger à la demande avec un repli. Le préchargement était
// purement anticipatif, et il coûtait 3x plus de GPU que le seul asset visible.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// Le corps d'un module s'exécute au chargement : tout appel de préchargement écrit à
// ce niveau (hors d'une fonction) part au boot, quoi qu'affiche la page.
function corpsDuModule(src) {
  // On retire les corps de fonctions pour ne garder que le niveau racine.
  return src.replace(/function[^{]*\{[\s\S]*?\n  \}/g, "");
}

test("aucun preload de modeles 3D au chargement du module", () => {
  const racine = corpsDuModule(lire("relic-icons.js"));
  assert.ok(!/\.preload\s*\(/.test(racine),
    "relic-icons.js precharge les 8 reliques au boot : 3,1 Mo et 39 Mo de VRAM avant le premier pixel");
});

test("le prechargement reste disponible, mais differe", () => {
  const models = lire("relic-models.js");
  assert.match(models, /preloadWhenIdle/,
    "relic-models.js doit exposer un prechargement differe pour les ecrans qui montrent des reliques");
  // requestIdleCallback : le préchargement ne doit jamais disputer le thread à un rendu.
  assert.match(models, /requestIdleCallback/);
});

test("les ecrans qui montrent des reliques declenchent le prechargement", () => {
  for (const f of ["market.jsx", "screens.jsx"]) {
    assert.match(lire(f), /preloadWhenIdle/, `${f} n'amorce pas les modeles de reliques`);
  }
});

// Garde-fou chiffré : ce qui part au boot doit rester borné. Sans seuil, la dette
// revient sans qu'on la voie — c'est exactement ce qui s'était produit.
test("le budget du premier ecran reste sous 3 Mo", () => {
  const html = lire("index.html");
  // Les .glb chargés inconditionnellement au boot : uniquement le jeton à deux
  // faces (v217 — cinématique, header et connexion partagent EMBLEM_GLB).
  // Les reliques et le logo3d du Totem sont chargés à la demande.
  const boot = ["assets/jeton.glb"];
  let total = 0;
  for (const f of boot) {
    total += fs.statSync(path.join(__dirname, "..", f)).size;
  }
  const three = path.join(__dirname, "..", "vendor", "three-0.160.0", "three.module.js");
  if (fs.existsSync(three)) total += fs.statSync(three).size;
  assert.ok(total < 3 * 1024 * 1024,
    `premier ecran : ${(total / 1048576).toFixed(1)} Mo — au-dela de 3 Mo la cinematique rame sur mobile`);
  assert.match(html, /cinematique/, "index.html doit toujours charger la cinematique");
});
