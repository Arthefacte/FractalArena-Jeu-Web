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

test("totemArt : privilégie displayArtUrl (image cosmétique choisie)", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:"d.webp" }), "d.webp");
});
test("totemArt : sans displayArtUrl, retombe sur artUrl", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:null }), "a.webp");
});
test("totemArt : sans image, fallback du type", () => {
  assert.strictEqual(TU.totemArt({ type:"GENESIS" }), "assets/GENESIS.png");
});
test("galleryItems : paliers révélés triés, [] si aucun", () => {
  assert.deepStrictEqual(
    TU.galleryItems({ revealedTier:3, artByTier:{ "1":"u1", "3":"u3" } }),
    [{ tier:1, url:"u1" }, { tier:3, url:"u3" }]
  );
  assert.deepStrictEqual(TU.galleryItems({ revealedTier:0, artByTier:{} }), []);
  assert.deepStrictEqual(TU.galleryItems(null), []);
});
