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

/* Mesuré en prod le 01/10/2026 : une défense à 1 369 381 face à des candidats de 629 à 6 076
   affichait « (−100 %) » sur TOUTES ses cartes — le pourcentage sature et se lit comme un bug.
   Au-delà de ±50 % (la bande large du serveur), on nomme l'écart. */
test("powerGapLabel : un écart saturé est nommé, pas chiffré", () => {
  assert.strictEqual(U.powerGapLabel(-100), "AR2_GAP_FAR_WEAKER");
  assert.strictEqual(U.powerGapLabel(-99), "AR2_GAP_FAR_WEAKER");
  assert.strictEqual(U.powerGapLabel(-50), "AR2_GAP_FAR_WEAKER");
  assert.strictEqual(U.powerGapLabel(124), "AR2_GAP_FAR_STRONGER");
  assert.strictEqual(U.powerGapLabel(50), "AR2_GAP_FAR_STRONGER");
});

test("powerGapLabel : dans la bande, le chiffre reste affiché (null)", () => {
  assert.strictEqual(U.powerGapLabel(0), null);
  assert.strictEqual(U.powerGapLabel(-25), null);
  assert.strictEqual(U.powerGapLabel(49), null);
  assert.strictEqual(U.powerGapLabel(-49), null);
  assert.strictEqual(U.powerGapLabel(NaN), null);
});
