// Miroir web des constantes de la Forge d'équipement (le serveur — forge.js —
// fait foi) : fusion 3 reliques → rareté supérieure, désenchantement → 20 % de
// la valeur en FA moins des frais fixes.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
const D = globalThis.window.FA_DATA;

test("RELIC_FUSE_COSTS : coûts du design v1, Legendary exclu (rareté max)", () => {
  assert.deepStrictEqual(D.RELIC_FUSE_COSTS, { Common: 2000, Rare: 5000, Epic: 15000 });
  assert.ok(!Object.hasOwn(D.RELIC_FUSE_COSTS, "Legendary"), "Legendary ne fusionne pas");
});

test("RELIC_BUYBACK : valeurs rendues (20 %) pour les 4 raretés", () => {
  assert.deepStrictEqual(D.RELIC_BUYBACK, { Common: 1600, Rare: 4000, Epic: 10000, Legendary: 25000 });
});

test("DISENCHANT_FEE : 600 FA fixes, net Commune +1000 (fondateur 25/09)", () => {
  assert.strictEqual(D.DISENCHANT_FEE, 600);
  assert.strictEqual(D.RELIC_BUYBACK.Common - D.DISENCHANT_FEE, 1000);
});

test("cores : mêmes barèmes que les reliques (CORE_FUSE_COSTS / CORE_BUYBACK)", () => {
  assert.deepStrictEqual(D.CORE_FUSE_COSTS, D.RELIC_FUSE_COSTS);
  assert.deepStrictEqual(D.CORE_BUYBACK, D.RELIC_BUYBACK);
  assert.ok(!Object.hasOwn(D.CORE_FUSE_COSTS, "Legendary"), "un core Legendary ne fusionne pas");
});

test("rétro-compat : RARITY_UPGRADE inchangé (sert de next_rarity à la fusion)", () => {
  assert.deepStrictEqual(D.RARITY_UPGRADE, { Common: "Rare", Rare: "Epic", Epic: "Legendary", Legendary: "Legendary" });
});
