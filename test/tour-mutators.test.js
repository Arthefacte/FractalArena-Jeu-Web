// test/tour-mutators.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../tour-ui.js");
const TU = globalThis.window.FA_TOUR_UI;

test("formatMutator : multiplicateur > 1 → pourcentage positif", () => {
  const r = TU.formatMutator({ id: "surcharge", axis: "spd", effects: { spd: 1.35, def: 0.85 } });
  assert.strictEqual(r.id, "surcharge");
  assert.deepStrictEqual(r.parts, [
    { stat: "spd", text: "+35 %" },
    { stat: "def", text: "−15 %" },
  ]);
});

test("formatMutator : ordre des parts = ordre des clés du serveur", () => {
  const r = TU.formatMutator({ id: "frais_gaz", axis: "atk", effects: { atk: 1.30, hp: 0.80 } });
  assert.deepStrictEqual(r.parts.map((p) => p.stat), ["atk", "hp"]);
  assert.strictEqual(r.parts[0].text, "+30 %");
  assert.strictEqual(r.parts[1].text, "−20 %");
});

test("formatMutator : crit en points, pas en pourcentage", () => {
  const r = TU.formatMutator({ id: "fork", axis: "crit", effects: { crit: 0.18 } });
  assert.deepStrictEqual(r.parts, [{ stat: "crit", text: "+18 pts" }]);
});

test("formatMutator : affinite expose ses types", () => {
  const r = TU.formatMutator({
    id: "affinite", axis: "type",
    effects: { typeBonus: 1.20, typeMalus: 0.88 },
    params: { favored: "HASH", penalized: "BLOCK" },
  });
  assert.deepStrictEqual(r.types, { favored: "HASH", penalized: "BLOCK" });
  assert.deepStrictEqual(r.parts, [
    { stat: "typeBonus", text: "+20 %" },
    { stat: "typeMalus", text: "−12 %" },
  ]);
});

test("formatMutator : arrondi correct sur les flottants imprécis", () => {
  // 1.35 - 1 vaut 0.35000000000000009 en flottant : sans arrondi on afficherait +35.000000000000009 %.
  const r = TU.formatMutator({ id: "x", axis: "spd", effects: { spd: 1.35 } });
  assert.strictEqual(r.parts[0].text, "+35 %");
  const r2 = TU.formatMutator({ id: "y", axis: "hp", effects: { hp: 0.88 } });
  assert.strictEqual(r2.parts[0].text, "−12 %");
});

test("formatMutator : signe moins typographique (−), pas le tiret ASCII", () => {
  const r = TU.formatMutator({ id: "x", axis: "def", effects: { def: 0.85 } });
  assert.ok(r.parts[0].text.startsWith("−"), "attendu U+2212, obtenu " + r.parts[0].text);
});

test("formatMutator : multiplicateur exactement 1 → part omise", () => {
  const r = TU.formatMutator({ id: "x", axis: "spd", effects: { spd: 1.35, atk: 1 } });
  assert.deepStrictEqual(r.parts.map((p) => p.stat), ["spd"]);
});

test("formatMutator : entrée invalide → objet vide, pas de crash", () => {
  assert.deepStrictEqual(TU.formatMutator(null), { id: null, parts: [] });
  assert.deepStrictEqual(TU.formatMutator({}), { id: null, parts: [] });
  assert.deepStrictEqual(TU.formatMutator({ id: "x" }), { id: "x", parts: [] });
});

test("formatMutators : liste, tolère null/undefined", () => {
  assert.deepStrictEqual(TU.formatMutators(null), []);
  assert.deepStrictEqual(TU.formatMutators([]), []);
  const r = TU.formatMutators([
    { id: "fork", axis: "crit", effects: { crit: 0.18 } },
    { id: "surcharge", axis: "spd", effects: { spd: 1.35, def: 0.85 } },
  ]);
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r.map((x) => x.id), ["fork", "surcharge"]);
});
