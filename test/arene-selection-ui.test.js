/* Lot 3c : mesure de puissance PvP et tri du roster actif, sans réseau. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: {} };
for (const file of ["arene-ui.js", "expeditions-ui.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
}
const U = context.window.FA_ARENE_UI;
const ids = (list) => Array.from(list, (b) => b.id);
const beast = (id, baseHp, level = 1, rarity = "Common") => ({
  id, base_hp: baseHp, base_atk: 0, base_def: 0, base_spd: 0, base_mag: 0, level, rarity,
});

test("puissance PvP : les cinq stats, le niveau et la rareté comptent", () => {
  const b = { base_hp: 100, base_atk: 20, base_def: 15, base_spd: 10, base_mag: 5, level: 20, rarity: "Epic" };
  assert.equal(U.entityPower(b), 150 * (1 + 0.03 * 19) * 2.5);
  for (const [rarity, weight] of [["Common", 1], ["Rare", 1.5], ["Epic", 2.5], ["Legendary", 4]]) {
    assert.equal(U.entityPower(beast(rarity, 100, 1, rarity)), 100 * weight);
  }
});

test("puissance PvP : les rangs ne remultiplient pas les stats déjà renforcées", () => {
  const b = beast("ranked", 400, 10, "Rare");
  assert.equal(U.entityPower({ ...b, rank: "S" }), U.entityPower({ ...b, rank: "C" }));
  assert.equal(U.entityPower(null), 0);
  assert.equal(U.entityPower({}), 0);
});

test("tri : la puissance prime sur la rareté et le niveau", () => {
  const roster = [beast("legendary", 50, 1, "Legendary"), beast("high-level", 10, 100), beast("strong-common", 300), beast("epic", 90, 1, "Epic")];
  assert.deepEqual(ids(U.rankedRoster(roster)), ["strong-common", "epic", "legendary", "high-level"]);
});

test("tri : conserve l'ordre du roster à puissance égale et ne mute rien", () => {
  const a = Object.freeze(beast("a", 150));
  const b = Object.freeze(beast("b", 100, 1, "Rare"));
  const c = Object.freeze(beast("c", 250));
  const roster = Object.freeze([a, b, c]);
  const sorted = U.rankedRoster(roster);
  assert.deepEqual(ids(sorted), ["c", "a", "b"]);
  assert.deepEqual(ids(roster), ["a", "b", "c"]);
  assert.notEqual(sorted, roster);
  assert.equal(sorted[0], c);
});

test("tri : compare la puissance exacte avant tout arrondi d'affichage", () => {
  const roster = [beast("low", 10), beast("high", 10, 2)];
  assert.equal(Math.round(U.entityPower(roster[0])), Math.round(U.entityPower(roster[1])));
  assert.deepEqual(ids(U.rankedRoster(roster)), ["high", "low"]);
});

test("tri : ne réintroduit aucune entité retirée du roster après fusion", () => {
  const fused = beast("consumed", 10000);
  const kept = beast("kept", 200);
  const before = [kept, fused];
  assert.deepEqual(ids(U.rankedRoster(before)), ["consumed", "kept"]);
  const after = before.filter((b) => b.id !== fused.id);
  assert.deepEqual(ids(U.rankedRoster(after)), ["kept"]);
  assert.deepEqual(ids(U.rankedRoster([null, kept, undefined])), ["kept"]);
  for (const roster of [null, undefined, {}, []]) assert.deepEqual(ids(U.rankedRoster(roster)), []);
});
