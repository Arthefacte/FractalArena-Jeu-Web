const test = require("node:test");
const assert = require("node:assert");
const A = require("../relic-assets.js");

test("TYPES : les 8 types de reliques", () => {
  assert.deepStrictEqual([...A.TYPES].sort(), [
    "amber_cell", "cobalt_spring", "jade_circuit", "onyx_membrane",
    "prism_matrix", "quartz_lens", "ruby_shard", "sapphire_plate",
  ]);
});

test("path : chemin .glb par type", () => {
  assert.strictEqual(A.path("ruby_shard"), "assets/relics/ruby_shard.glb");
  assert.strictEqual(A.path("prism_matrix"), "assets/relics/prism_matrix.glb");
});

test("RARITY_GLOW : 4 raretés, intensité croissante", () => {
  const order = ["Common", "Rare", "Epic", "Legendary"];
  order.forEach((r) => {
    assert.ok(typeof A.RARITY_GLOW[r].color === "number", `${r} color`);
    assert.ok(A.RARITY_GLOW[r].intensity >= 0 && A.RARITY_GLOW[r].intensity <= 1, `${r} intensity`);
  });
  for (let i = 1; i < order.length; i++) {
    assert.ok(A.RARITY_GLOW[order[i]].intensity > A.RARITY_GLOW[order[i - 1]].intensity,
      `${order[i]} > ${order[i - 1]}`);
  }
});
