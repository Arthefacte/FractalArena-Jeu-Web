const { test } = require("node:test");
const assert = require("node:assert");
const TU = require("../totem-ui");

test("totemArtFallback : asset du type", () => {
  assert.strictEqual(TU.totemArtFallback("HASH"), "assets/HASHBYTE.webp");
  assert.strictEqual(TU.totemArtFallback("GENESIS"), "assets/GENESIS.webp");
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
  assert.strictEqual(TU.totemArt({ type: "GENESIS", tier: 1, artUrl: null }), "assets/GENESIS.webp");
});

test("totemArt : totem absent → repli HASHBYTE", () => {
  assert.strictEqual(TU.totemArt(null), "assets/HASHBYTE.webp");
});

test("totemArt : privilégie displayArtUrl (image cosmétique choisie)", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:"d.webp" }), "d.webp");
});
test("totemArt : sans displayArtUrl, retombe sur artUrl", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:null }), "a.webp");
});
test("totemArt : sans image, fallback du type", () => {
  assert.strictEqual(TU.totemArt({ type:"GENESIS" }), "assets/GENESIS.webp");
});
test("galleryItems : paliers révélés triés, [] si aucun", () => {
  assert.deepStrictEqual(
    TU.galleryItems({ revealedTier:3, artByTier:{ "1":"u1", "3":"u3" } }),
    [{ tier:1, url:"u1" }, { tier:3, url:"u3" }]
  );
  assert.deepStrictEqual(TU.galleryItems({ revealedTier:0, artByTier:{} }), []);
  assert.deepStrictEqual(TU.galleryItems(null), []);
});

// Parité STRICTE avec totem.js serveur (accomplishmentLevel) — les seuils
// affichés par l'écran Lien doivent être ceux que le serveur applique.
test("accomplishmentLevel : miroir exact du serveur (mondes 1/2/4, victoires 100/400/1200)", () => {
  assert.strictEqual(TU.accomplishmentLevel(0, 0), 0);
  assert.strictEqual(TU.accomplishmentLevel(1, 0), 1);
  assert.strictEqual(TU.accomplishmentLevel(2, 0), 2);
  assert.strictEqual(TU.accomplishmentLevel(4, 0), 3);
  assert.strictEqual(TU.accomplishmentLevel(0, 100), 1);
  assert.strictEqual(TU.accomplishmentLevel(0, 400), 2);
  assert.strictEqual(TU.accomplishmentLevel(0, 1200), 3);
  assert.strictEqual(TU.accomplishmentLevel(1, 400), 2, "meilleur des deux chemins");
});
