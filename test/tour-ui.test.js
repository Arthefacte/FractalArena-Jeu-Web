// test/tour-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../tour-ui.js");
const TU = globalThis.window.FA_TOUR_UI;

// Palier d'entrée de l'étage 3 ajouté le 2026-07-29 (somme 6 500 → 6 550) et prix de
// re-run devenu progressif : les deux suivent le serveur, cette table est un miroir.
test("TIERS : miroir serveur — somme 9550 FA, 2 silver, 2 gold, étages 1..100", () => {
  assert.deepStrictEqual(TU.RERUN_COSTS, [100, 125, 150]);
  assert.strictEqual(TU.TIERS.length, 13);
  assert.deepStrictEqual(TU.TIERS.map((t) => t.floor), [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100]);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.fa, 0), 9550);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.silver, 0), 2);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.gold, 0), 2);
  assert.strictEqual(TU.TIERS[0].fa, 50);
  assert.strictEqual(TU.TIERS[1].fa, 100);
  assert.strictEqual(TU.TIERS[10].fa, 1500);
});

test("tiersView : reached/claimed dérivés", () => {
  const v = TU.tiersView(23, [1, 5, 10]);
  assert.strictEqual(v.length, 13);
  assert.deepStrictEqual(v.filter((t) => t.reached).map((t) => t.floor), [1, 5, 10, 15, 20]);
  assert.deepStrictEqual(v.filter((t) => t.claimed).map((t) => t.floor), [1, 5, 10]);
  // claimed_tiers null/undefined toléré (score vierge serveur)
  assert.strictEqual(TU.tiersView(0, null).filter((t) => t.reached).length, 0);
});

test("hpFracOf / isDeadInRun : absent = vivante 100 %, clamp, dead", () => {
  const rs = { a: { hp_frac: 0.42 }, b: { hp_frac: 0, dead: true }, c: { hp_frac: 1.7 }, d: { hp_frac: -0.3 } };
  assert.strictEqual(TU.hpFracOf(rs, "a"), 0.42);
  assert.strictEqual(TU.hpFracOf(rs, "zzz"), 1);
  assert.strictEqual(TU.hpFracOf(null, "zzz"), 1);
  assert.strictEqual(TU.hpFracOf(rs, "c"), 1, "clamp haut");
  assert.strictEqual(TU.hpFracOf(rs, "d"), 0, "clamp bas");
  assert.strictEqual(TU.isDeadInRun(rs, "b"), true);
  assert.strictEqual(TU.isDeadInRun(rs, "d"), true, "hp_frac ≤ 0 = morte même sans flag dead");
  assert.strictEqual(TU.isDeadInRun(rs, "a"), false);
  assert.strictEqual(TU.isDeadInRun(rs, "zzz"), false);
});

test("rosterRunView / aliveCount", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rs = { b: { hp_frac: 0, dead: true }, c: { hp_frac: 0.5 } };
  const v = TU.rosterRunView(roster, rs);
  assert.deepStrictEqual(v.map((x) => x.beast.id), ["a", "b", "c"], "ordre du roster conservé");
  assert.strictEqual(v[0].hpFrac, 1);
  assert.strictEqual(v[1].dead, true);
  assert.strictEqual(v[2].hpFrac, 0.5);
  assert.strictEqual(TU.aliveCount(roster, rs), 2);
  assert.strictEqual(TU.aliveCount(roster, {}), 3);
});

test("validateEngage : 3 distinctes, existantes, vivantes", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const rs = { d: { hp_frac: 0, dead: true } };
  assert.deepStrictEqual(TU.validateEngage(["a", "b", "c"], roster, rs), { ok: true });
  assert.strictEqual(TU.validateEngage(["a", "b"], roster, rs).reason, "need3");
  assert.strictEqual(TU.validateEngage(["a", "a", "b"], roster, rs).reason, "need3");
  assert.strictEqual(TU.validateEngage(["a", "b", "zzz"], roster, rs).reason, "unknown");
  assert.strictEqual(TU.validateEngage(["a", "b", "d"], roster, rs).reason, "dead");
});

test("nextTier : premier palier au-dessus du meilleur étage", () => {
  assert.strictEqual(TU.nextTier(0).floor, 1, "le premier objectif visible est le palier d'entrée");
  assert.strictEqual(TU.nextTier(1).floor, 5);
  assert.strictEqual(TU.nextTier(3).floor, 5);
  assert.strictEqual(TU.nextTier(5).floor, 10);
  assert.strictEqual(TU.nextTier(23).floor, 25);
  assert.strictEqual(TU.nextTier(50).floor, 75, "jalon d'endurance (2026-08-22)");
  assert.strictEqual(TU.nextTier(99).floor, 100);
  assert.strictEqual(TU.nextTier(100), null);
});

test("pickFittest3 : 3 IDs vivants au hp_frac le plus haut, ordre décroissant", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  const rs = {
    a: { hp_frac: 0.30 }, b: { hp_frac: 0.90 }, c: { hp_frac: 0.10 },
    d: { hp_frac: 0.60 }, e: { hp_frac: 1.0 },
  };
  assert.deepStrictEqual(TU.pickFittest3(roster, rs), ["e", "b", "d"]);
});

test("pickFittest3 : ignore les mortes, null si < 3 vivantes", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rs = { b: { hp_frac: 0, dead: true } };
  assert.strictEqual(TU.pickFittest3(roster, rs), null, "2 vivantes → null");
  // roster vierge (aucun state) → 3 premiers
  assert.deepStrictEqual(TU.pickFittest3(roster, {}), ["a", "b", "c"]);
});

test("pickFittest3 : départage stable par ordre du roster à hp_frac égal", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const rs = { a: { hp_frac: 0.5 }, b: { hp_frac: 0.5 }, c: { hp_frac: 0.5 }, d: { hp_frac: 0.5 } };
  assert.deepStrictEqual(TU.pickFittest3(roster, rs), ["a", "b", "c"]);
});
