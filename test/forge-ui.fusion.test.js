"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
// data.js = le VRAI module du client : le facteur de niveau de la comparaison vient de lui,
// aucune table du moteur n'est recopiée dans forge-ui.js (elle dériverait en silence).
require("../data.js");
const F = window.FA_FORGE_UI;
const LD = window.FA_DATA;

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

// ---- Garde anti-sacrifice : le joueur ne doit plus perdre son meilleur tirage sans le voir ----

function entite(sum, level) {
  return { base_hp: sum, base_atk: 0, base_def: 0, base_spd: 0, base_mag: 0, level: level || 1 };
}

test("entityPower : total des 5 stats de base × facteur de niveau du client", () => {
  const b = { base_hp: 100, base_atk: 20, base_def: 10, base_spd: 15, base_mag: 25, level: 20 };
  assert.strictEqual(F.entityPower(b), 170 * LD.levelMult(20), "le rang et le tirage sont déjà dans les stats");
  assert.strictEqual(F.entityPower(null), 0);
  assert.strictEqual(F.entityPower({ level: 5 }), 0, "entité sans stats : 0, jamais NaN");
});

test("fusionKeepWarning : signale la sacrifiée plus forte, silence dans le cas normal", () => {
  const faible = entite(140, 1);
  const forte = entite(280, 1);
  assert.strictEqual(F.fusionKeepWarning(forte, faible), null, "garder la plus forte : rien à signaler");
  assert.strictEqual(F.fusionKeepWarning(faible, faible), null, "égalité : pas d'avertissement (seuil strict)");
  const w = F.fusionKeepWarning(faible, forte);
  assert.ok(w, "la sacrifiée plus forte doit être signalée");
  assert.strictEqual(w.keptPower, 140);
  assert.strictEqual(w.sacrificedPower, 280);
  assert.strictEqual(w.gapPct, 100, "+100 % de puissance");
});

test("fusionKeepWarning : le NIVEAU compte (une entité peu jouée mais mieux tirée peut rester meilleure)", () => {
  // Même total de base, niveaux différents : la comparaison suit la puissance réelle, pas le tirage seul.
  const monte = entite(140, 100);
  const frais = entite(280, 1);
  assert.strictEqual(F.fusionKeepWarning(monte, frais), null, "niveau 100 : la sacrifiée n'est pas plus forte");
  assert.ok(F.fusionKeepWarning(frais, monte), "et l'inverse doit déclencher l'avertissement");
});

test("fusionKeepWarning : sélection incomplète ou entité vide → null, jamais une division par zéro", () => {
  assert.strictEqual(F.fusionKeepWarning(null, entite(100, 1)), null);
  assert.strictEqual(F.fusionKeepWarning(entite(100, 1), null), null);
  const w = F.fusionKeepWarning(entite(0, 1), entite(100, 1));
  assert.ok(w, "0 contre 100 : il y a bien quelque chose à signaler");
  assert.strictEqual(w.gapPct, null, "pas de pourcentage calculable sans base");
});
