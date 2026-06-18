const { test } = require("node:test");
const assert = require("node:assert");
const TU = require("../totem-ui");

test("totemArtFallback : asset du type", () => {
  assert.strictEqual(TU.totemArtFallback("HASH"), "assets/HASHBYTE.png");
  assert.strictEqual(TU.totemArtFallback("GENESIS"), "assets/GENESIS.png");
});

test("tierName : paliers 0..5", () => {
  assert.strictEqual(TU.tierName(0), "Dormant");
  assert.strictEqual(TU.tierName(1), "Hatchling");
  assert.strictEqual(TU.tierName(5), "Ascended");
});

test("auraSummary : pourcentages lisibles", () => {
  assert.strictEqual(TU.auraSummary({ ampSameType: 0.15, globalBuff: 0.06, signature: null }), "+15% même type · +6% global");
  assert.strictEqual(TU.auraSummary({ ampSameType: 0, globalBuff: 0, signature: null }), "Aucun bonus (dormant)");
});
