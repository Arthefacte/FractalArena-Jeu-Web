// Constantes de fusion et anciens exports FA conservés pour compatibilité.
// Le recyclage rend des fragments sans frais : son contrat est vérifié dans
// forge-ui.equip.test.js, indépendamment de ces anciens barèmes.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
const D = globalThis.window.FA_DATA;

test("RELIC_FUSE_COSTS : coûts du design v1, Legendary exclu (rareté max)", () => {
  assert.deepStrictEqual(D.RELIC_FUSE_COSTS, { Common: 2000, Rare: 5000, Epic: 15000 });
  assert.ok(!Object.hasOwn(D.RELIC_FUSE_COSTS, "Legendary"), "Legendary ne fusionne pas");
});

test("RELIC_BUYBACK : ancien barème FA conservé pour compatibilité", () => {
  assert.deepStrictEqual(D.RELIC_BUYBACK, { Common: 1600, Rare: 4000, Epic: 10000, Legendary: 25000 });
});

test("DISENCHANT_FEE : ancien frais conservé, sans effet sur le recyclage", () => {
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
