const test = require("node:test");
const assert = require("node:assert");
const M = require("../market-ui.js");

test("listingFees : miroir serveur (1% min 20, commission 5%, net)", () => {
  assert.deepStrictEqual(M.listingFees(100), { listing_fee: 20, commission: 5, net_seller: 95 });
  assert.deepStrictEqual(M.listingFees(8000), { listing_fee: 80, commission: 400, net_seller: 7600 });
  assert.deepStrictEqual(M.listingFees(1000000), { listing_fee: 10000, commission: 50000, net_seller: 950000 });
});

test("isValidPrice : entier dans [100, 1000000]", () => {
  assert.strictEqual(M.isValidPrice(100), true);
  assert.strictEqual(M.isValidPrice(99), false);
  assert.strictEqual(M.isValidPrice(1000001), false);
  assert.strictEqual(M.isValidPrice(2.5), false);
  assert.strictEqual(M.isValidPrice("500"), false);
});

test("isListingExpired : 7 jours depuis created_at", () => {
  const now = Date.parse("2026-07-11T12:00:00Z");
  assert.strictEqual(M.isListingExpired("2026-07-05T12:00:01Z", now), false);
  assert.strictEqual(M.isListingExpired("2026-07-04T12:00:00Z", now), true);
});

test("filterListings : filtre type/rareté + tri prix croissant", () => {
  const L = [
    { id: 1, price: 900, item: { type: "ruby_shard", rarity: "Rare" } },
    { id: 2, price: 300, item: { type: "amber_cell", rarity: "Epic" } },
    { id: 3, price: 500, item: { type: "ruby_shard", rarity: "Common" } },
  ];
  assert.deepStrictEqual(M.filterListings(L, {}).map((l) => l.id), [2, 3, 1]);
  assert.deepStrictEqual(M.filterListings(L, { type: "ruby_shard" }).map((l) => l.id), [3, 1]);
  assert.deepStrictEqual(M.filterListings(L, { rarity: "Epic" }).map((l) => l.id), [2]);
  assert.deepStrictEqual(M.filterListings(L, { type: "ruby_shard", rarity: "Rare" }).map((l) => l.id), [1]);
});
