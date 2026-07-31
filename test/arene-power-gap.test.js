/* Lisibilité de l'appariement : depuis le matchmaking par puissance
   (serveur, 2026-07-31), c'est l'écart de PUISSANCE qui dit si un adversaire
   est à ma taille — l'ELO ne le dit pas, tout le monde démarre à 1000. */
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../arene-ui.js");
const U = globalThis.window.FA_ARENE_UI;

test("powerGapPct : écart relatif en %, arrondi, signé", () => {
  assert.strictEqual(U.powerGapPct(500, 500), 0);
  assert.strictEqual(U.powerGapPct(500, 550), 10);
  assert.strictEqual(U.powerGapPct(500, 450), -10);
  assert.strictEqual(U.powerGapPct(500, 826), 65);
});

test("powerGapPct : puissance de référence absente ou nulle → 0, jamais Infinity", () => {
  assert.strictEqual(U.powerGapPct(0, 500), 0);
  assert.strictEqual(U.powerGapPct(null, 500), 0);
  assert.strictEqual(U.powerGapPct(500, undefined), 0);
});

test("powerGapTone : à ma taille / au-dessus / hors de portée", () => {
  assert.strictEqual(U.powerGapTone(0), "even");
  assert.strictEqual(U.powerGapTone(-8), "even");
  assert.strictEqual(U.powerGapTone(18), "edge");
  assert.strictEqual(U.powerGapTone(-18), "edge");
  assert.strictEqual(U.powerGapTone(40), "hard");
});
