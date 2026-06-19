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

test("totemArt : artUrl présent → l'URL générée", () => {
  assert.strictEqual(
    TU.totemArt({ type: "HASH", tier: 2, artUrl: "https://totems.fractalarena.com/totem/bc1qx/2.webp" }),
    "https://totems.fractalarena.com/totem/bc1qx/2.webp");
});

test("totemArt : pas d'artUrl → repli par type", () => {
  assert.strictEqual(TU.totemArt({ type: "GENESIS", tier: 1, artUrl: null }), "assets/GENESIS.png");
});

test("totemArt : totem absent → repli HASHBYTE", () => {
  assert.strictEqual(TU.totemArt(null), "assets/HASHBYTE.png");
});
