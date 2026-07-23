"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
const F = window.FA_FORGE_UI;

// Sémantique fusion : sel[0] = conservée (primary), sel[1] = sacrifiée (miroir serveur handleFusion).

test("fusionSwap : inverse conservée/sacrifiée, immutable, no-op si pas 2 éléments", () => {
  const sel = ["a", "b"];
  assert.deepStrictEqual(F.fusionSwap(sel), ["b", "a"]);
  assert.deepStrictEqual(sel, ["a", "b"], "immutabilité");
  assert.deepStrictEqual(F.fusionSwap(["a"]), ["a"], "sélection incomplète inchangée");
  assert.deepStrictEqual(F.fusionSwap([]), []);
});

test("fusionButtonState mode Or : exige 1 ticket Or, IGNORE le solde FA", () => {
  const s = F.fusionButtonState({ gold: true, cost: 3000, balance: 0, ticketsGold: 1, busy: false });
  assert.strictEqual(s.disabled, false, "solde FA nul ne bloque pas une fusion premium");
  assert.strictEqual(s.showInsufficient, false, "pas d'avertissement solde FA en mode Or");
  const s0 = F.fusionButtonState({ gold: true, cost: 3000, balance: 99999, ticketsGold: 0, busy: false });
  assert.strictEqual(s0.disabled, true, "sans ticket Or le bouton est bloqué");
});

test("fusionButtonState mode FA : exige le solde, signale l'insuffisance", () => {
  const ok = F.fusionButtonState({ gold: false, cost: 3000, balance: 3000, ticketsGold: 0, busy: false });
  assert.strictEqual(ok.disabled, false);
  assert.strictEqual(ok.showInsufficient, false);
  const ko = F.fusionButtonState({ gold: false, cost: 3000, balance: 2999, ticketsGold: 5, busy: false });
  assert.strictEqual(ko.disabled, true, "solde insuffisant bloque en mode FA");
  assert.strictEqual(ko.showInsufficient, true);
});

test("fusionButtonState : busy bloque dans les deux modes", () => {
  assert.strictEqual(F.fusionButtonState({ gold: true, cost: 0, balance: 0, ticketsGold: 9, busy: true }).disabled, true);
  assert.strictEqual(F.fusionButtonState({ gold: false, cost: 100, balance: 900, ticketsGold: 0, busy: true }).disabled, true);
});
