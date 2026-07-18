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
