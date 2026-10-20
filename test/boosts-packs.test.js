// Taille des packs de boosts — garde de DÉRIVE, pas de forme.
// La carte Boosts affiche `def.charges + " charges / pack"` (screens.jsx) depuis
// data.js, et le hint de l'onglet annonce la même taille en prose dans les 3 langues.
// Deux surfaces, deux façons d'écrire le chiffre : ce test exige qu'elles disent la
// MÊME chose, et que le barème (prix) n'ait pas bougé au passage.
// Décision fondateur 16/10/2026 : 4 packs à 100 charges, prix inchangés.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const racine = path.join(__dirname, "..");
const dataSrc = fs.readFileSync(path.join(racine, "data.js"), "utf8");
const i18nSrc = fs.readFileSync(path.join(racine, "i18n.js"), "utf8");

function lignesBoosts() {
  const i = dataSrc.indexOf("const BOOSTS = {");
  assert.ok(i > 0, "data.js doit déclarer BOOSTS");
  const bloc = dataSrc.slice(i, dataSrc.indexOf("};", i));
  const lignes = [...bloc.matchAll(/(xp_boost|lucky_strike|momentum|catalyst):\s*\{\s*cost:\s*(\d+),\s*charges:\s*(\d+)/g)];
  assert.strictEqual(lignes.length, 4, `les 4 boosts doivent être décrits (trouvé ${lignes.length})`);
  return lignes;
}

test("BOOSTS : les 4 packs portent la même taille (100 charges), prix inchangés", () => {
  const lignes = lignesBoosts();
  const tailles = new Set();
  for (const [, cle, , charges] of lignes) tailles.add(Number(charges));
  assert.deepStrictEqual([...tailles], [100], "les 4 packs valent 100 charges");
  const prix = Object.fromEntries(lignes.map((m) => [m[1], Number(m[2])]));
  assert.deepStrictEqual(prix, { xp_boost: 500, lucky_strike: 750, momentum: 750, catalyst: 750 });
});

test("le hint de l'onglet Boutique annonce la même taille, dans les 3 langues", () => {
  // L'onglet s'appelait « Boosts », il devient « Boutique » avec deux onglets (décision
  // fondateur 20/10/2026 : achat en FA / achat en FB). Les marqueurs de langue suivent le
  // nouveau libellé — la garantie testée, elle, ne bouge pas : le hint chiffre la taille du
  // pack dans les trois langues, à la même valeur que la carte.
  const tailles = lignesBoosts().map((m) => Number(m[3]));
  const attendu = tailles[0];
  const i = i18nSrc.indexOf("HINT_TAB_BOOSTS:");
  assert.ok(i > 0, "i18n.js doit porter HINT_TAB_BOOSTS");
  const ligne = i18nSrc.slice(i, i18nSrc.indexOf("\n", i));
  for (const [langue, marque] of [["FR", 'FR: "Boutique'], ["EN", 'EN: "Shop'], ["ZH", 'ZH: "商店']]) {
    assert.ok(ligne.includes(marque), `le hint doit exister en ${langue}`);
  }
  const annoncees = [...ligne.matchAll(/(\d+)\s*(?:次)?\s*(?:charges|充能)/g)].map((m) => Number(m[1]));
  assert.strictEqual(annoncees.length, 3, `le hint doit chiffrer la taille dans les 3 langues (trouvé ${annoncees.length})`);
  for (const n of annoncees) {
    assert.strictEqual(n, attendu, "le hint annonce une autre taille de pack que la carte");
  }
});
