// test/core-data.test.js
// Miroir web des CORES (le serveur — data.node.js — fait foi) + format des
// objets d'inventaire. Les cores COEXISTENT avec les reliques dans le même
// tableau `equipment` : les helpers de tri protègent l'affichage existant.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
const D = globalThis.window.FA_DATA;

const CORE_IDS = [
  "fury_core", "guardian_core", "overclock_core",
  "regen_core", "feedback_core", "last_stand_core",
];

test("CORES : les 6 cores du design v1, pattern trigger + effect", () => {
  assert.deepStrictEqual(Object.keys(D.CORES).sort(), [...CORE_IDS].sort());
  assert.deepStrictEqual(D.CORE_KEYS, Object.keys(D.CORES));
  for (const id of CORE_IDS) {
    const c = D.CORES[id];
    assert.strictEqual(typeof c.name, "string", `${id} : name`);
    assert.strictEqual(typeof c.trigger, "string", `${id} : trigger`);
    assert.ok(c.effect && typeof c.effect === "object", `${id} : effect`);
  }
});

test("CORES : noms et chiffres du design v1", () => {
  assert.strictEqual(D.CORES.fury_core.name, "Fury Core");
  assert.strictEqual(D.CORES.guardian_core.name, "Guardian Core");
  assert.strictEqual(D.CORES.overclock_core.name, "Overclock Core");
  assert.strictEqual(D.CORES.regen_core.name, "Regen Core");
  assert.strictEqual(D.CORES.feedback_core.name, "Feedback Core");
  assert.strictEqual(D.CORES.last_stand_core.name, "Last Stand Core");
  assert.strictEqual(D.CORES.fury_core.effect.atk, 0.15);
  assert.strictEqual(D.CORES.guardian_core.effect.shield, 0.20);
  assert.strictEqual(D.CORES.regen_core.effect.heal, 0.08);
  assert.strictEqual(D.CORES.feedback_core.effect.reflect, 0.15);
  assert.strictEqual(D.CORES.last_stand_core.effect.atk, 0.25);
  assert.strictEqual(D.CORES.last_stand_core.effect.def, 0.15);
});

test("v1 : pas de rareté de core — Common seul, multiplicateur 1.0", () => {
  assert.deepStrictEqual(D.CORE_RARITY_MULT, { Common: 1.0 });
});

test("isCoreItem / isRelicItem : trient le tableau equipment mixte", () => {
  // Format serveur : relique = { id, type, rarity }, core = { id, core_id, rarity, acquired_at }
  const relic = { id: "r1", type: "ruby_shard", rarity: "Rare" };
  const core = { id: "c1", core_id: "fury_core", rarity: "Common", acquired_at: "2026-08-28" };
  assert.strictEqual(D.isRelicItem(relic), true);
  assert.strictEqual(D.isRelicItem(core), false);
  assert.strictEqual(D.isCoreItem(core), true);
  assert.strictEqual(D.isCoreItem(relic), false);
  // robustesse : entrées dégénérées ne lèvent pas
  for (const junk of [null, undefined, {}, { id: "x" }]) {
    assert.strictEqual(D.isCoreItem(junk), false);
    assert.strictEqual(D.isRelicItem(junk), false);
  }
});

test("rétro-compat : les constantes reliques sont intactes", () => {
  assert.deepStrictEqual(Object.keys(D.RELICS).length, 8);
  assert.deepStrictEqual(D.relicEffect("ruby_shard", "Common"), { stat: "atk", bonus: 0.12 });
});
