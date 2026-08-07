// test/juice-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../juice-ui.js");
const J = globalThis.window.FA_JUICE_UI;

test("shakeIntensity : crit = max (1)", () => {
  assert.strictEqual(J.shakeIntensity(1, 100, true), 1);
  assert.strictEqual(J.shakeIntensity(0, 0, true), 1); // crit prime, même sans PV connus
});

test("shakeIntensity : petit coup = 0 (le board ne tremble pas)", () => {
  assert.strictEqual(J.shakeIntensity(5, 100, false), 0);   // 5% des PV
  assert.strictEqual(J.shakeIntensity(14, 100, false), 0);  // 14% < seuil 15%
});

test("shakeIntensity : paliers montants sur gros coup", () => {
  assert.strictEqual(J.shakeIntensity(15, 100, false), 0.35); // 15%
  assert.strictEqual(J.shakeIntensity(25, 100, false), 0.6);  // 25%
  assert.strictEqual(J.shakeIntensity(60, 100, false), 0.6);  // plafonné
});

test("shakeIntensity : robuste aux entrées dégénérées", () => {
  assert.strictEqual(J.shakeIntensity(10, 0, false), 0);
  assert.strictEqual(J.shakeIntensity(0, 100, false), 0);
  for (const v of [J.shakeIntensity(30, 100, false)]) assert.ok(v >= 0 && v <= 1);
});

test("particleSpec : crit et sp se distinguent de atk", () => {
  const atk = J.particleSpec("atk", false);
  const sp = J.particleSpec("sp", false);
  const crit = J.particleSpec("atk", true);
  assert.ok(atk.count > 0 && sp.count > 0 && crit.count > 0);
  assert.notStrictEqual(atk.color, sp.color);   // couleurs distinctes
  assert.ok(crit.count >= atk.count);            // crit ≥ atk en densité
  for (const s of [atk, sp, crit]) {
    assert.strictEqual(typeof s.color, "string");
    assert.ok(s.spread > 0);
  }
});

test("pureté : deux appels identiques rendent le même résultat", () => {
  assert.deepStrictEqual(J.particleSpec("sp", true), J.particleSpec("sp", true));
});

// --- Variation de solde affichée dans le bandeau du haut ---
// Un gain qui n'apparait nulle part n'a pas eu lieu, du point de vue du joueur :
// le quiz creditait le solde verrouille sans que rien ne bouge a l'ecran.

test("variationSolde : une hausse s'annonce avec son montant", () => {
  assert.deepStrictEqual(J.variationSolde(626, 636, true), { anime: true, delta: 10 });
});

test("variationSolde : une baisse aussi (offrir retire du verrouille)", () => {
  assert.deepStrictEqual(J.variationSolde(636, 626, true), { anime: true, delta: -10 });
});

test("variationSolde : un solde inchange n'anime rien", () => {
  assert.deepStrictEqual(J.variationSolde(636, 636, true), { anime: false, delta: 0 });
});

// Au login la save arrive d'un coup : 0 -> 636. Ce n'est pas un gain, et
// afficher « +636 » a la connexion serait un mensonge visuel.
test("variationSolde : le premier remplissage n'est pas un gain", () => {
  assert.deepStrictEqual(J.variationSolde(0, 636, false), { anime: false, delta: 0 });
});
