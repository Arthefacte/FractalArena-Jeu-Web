"use strict";
// Forge d'équipement : helpers purs de sélection/état (miroir des règles serveur
// relic-fuse / equip-disenchant). Reliques SEULEMENT — un core n'est ni
// fusionnable ni désenchantable en v1.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
require("../forge-ui.js");
const F = window.FA_FORGE_UI;

const relic = (id, rarity) => ({ id, type: "ruby_shard", rarity });
const core = (id) => ({ id, core_id: "fury_core", rarity: "Common", acquired_at: "2026-08-28" });

test("equipSelToggle : ajoute/retire une relique (immutable)", () => {
  const a = relic("a", "Common"), b = relic("b", "Common");
  const s1 = F.equipSelToggle([], a);
  assert.deepStrictEqual(s1.map((x) => x.id), ["a"]);
  const s2 = F.equipSelToggle(s1, b);
  assert.deepStrictEqual(s2.map((x) => x.id), ["a", "b"]);
  assert.deepStrictEqual(s1.map((x) => x.id), ["a"], "immutabilité");
  assert.deepStrictEqual(F.equipSelToggle(s2, a).map((x) => x.id), ["b"], "re-clic = désélection");
});

test("equipSelToggle : changer de rareté REPART sur la nouvelle relique", () => {
  const s = [relic("a", "Common"), relic("b", "Common")];
  const next = F.equipSelToggle(s, relic("c", "Rare"));
  assert.deepStrictEqual(next.map((x) => x.id), ["c"], "sélection redémarrée");
});

test("equipSelToggle : plafond 3 → null (l'écran toast FG_EQ_SEL_MAX)", () => {
  const s = [relic("a", "Common"), relic("b", "Common"), relic("c", "Common")];
  assert.strictEqual(F.equipSelToggle(s, relic("d", "Common")), null);
});

test("equipSelToggle : un core n'est JAMAIS sélectionnable", () => {
  assert.strictEqual(F.equipSelToggle([], core("c1")), null);
  assert.strictEqual(F.equipSelToggle([relic("a", "Common")], core("c1")), null);
});

test("relicFuseState : 3 mêmes raretés → prêt, coût et rareté de sortie du miroir", () => {
  const sel = [relic("a", "Common"), relic("b", "Common"), relic("c", "Common")];
  const s = F.relicFuseState({ sel, balance: 2000, busy: false });
  assert.strictEqual(s.disabled, false);
  assert.strictEqual(s.cost, 2000);
  assert.strictEqual(s.nextRarity, "Rare");
  assert.strictEqual(s.showInsufficient, false);
  const epic = F.relicFuseState({ sel: sel.map((x) => ({ ...x, rarity: "Epic" })), balance: 99999, busy: false });
  assert.strictEqual(epic.cost, 15000);
  assert.strictEqual(epic.nextRarity, "Legendary");
});

test("relicFuseState : sélection incomplète → désactivé sans avertissement", () => {
  const s = F.relicFuseState({ sel: [relic("a", "Common")], balance: 99999, busy: false });
  assert.strictEqual(s.disabled, true);
  assert.strictEqual(s.showInsufficient, false);
  assert.strictEqual(s.cost, 2000, "le coût s'affiche dès la 1re relique");
});

test("relicFuseState : Legendary = rareté max, jamais fusible", () => {
  const sel = [relic("a", "Legendary"), relic("b", "Legendary"), relic("c", "Legendary")];
  const s = F.relicFuseState({ sel, balance: 999999, busy: false });
  assert.strictEqual(s.disabled, true);
  assert.strictEqual(s.maxRarity, true);
  assert.strictEqual(s.cost, null);
});

test("relicFuseState : solde insuffisant bloque et se signale ; busy bloque", () => {
  const sel = [relic("a", "Rare"), relic("b", "Rare"), relic("c", "Rare")];
  const ko = F.relicFuseState({ sel, balance: 4999, busy: false });
  assert.strictEqual(ko.disabled, true);
  assert.strictEqual(ko.showInsufficient, true);
  assert.strictEqual(F.relicFuseState({ sel, balance: 99999, busy: true }).disabled, true);
});

test("disenchantState : exactement 1 relique → valeur, frais 500, net", () => {
  const s = F.disenchantState({ sel: [relic("a", "Common")], balance: 500, busy: false });
  assert.strictEqual(s.disabled, false);
  assert.strictEqual(s.value, 1600);
  assert.strictEqual(s.fee, 500);
  assert.strictEqual(s.net, 1100);
  const leg = F.disenchantState({ sel: [relic("a", "Legendary")], balance: 500, busy: false });
  assert.strictEqual(leg.disabled, false, "une Legendary SE désenchante (mais ne fusionne pas)");
  assert.strictEqual(leg.value, 25000);
});

test("disenchantState : 0 ou 2+ sélections → désactivé", () => {
  assert.strictEqual(F.disenchantState({ sel: [], balance: 9999, busy: false }).disabled, true);
  assert.strictEqual(F.disenchantState({ sel: [relic("a", "Common"), relic("b", "Common")], balance: 9999, busy: false }).disabled, true);
});

test("disenchantState : les 500 de frais exigent le solde ; busy bloque", () => {
  const ko = F.disenchantState({ sel: [relic("a", "Common")], balance: 499, busy: false });
  assert.strictEqual(ko.disabled, true);
  assert.strictEqual(ko.showInsufficient, true);
  assert.strictEqual(F.disenchantState({ sel: [relic("a", "Common")], balance: 9999, busy: true }).disabled, true);
});

test("equipForgeErrText : codes serveur → clés FG_EQ_ERR_<code>, repli générique", () => {
  // Sans i18n (tests node) : code brut, jamais de plantage.
  assert.strictEqual(F.equipForgeErrText("max_rarity"), "max_rarity");
  // Avec i18n : clé dédiée si elle existe, générique sinon (pattern EXP errText).
  window.FA_I18N = { t: (k) => (k === "FG_EQ_ERR_max_rarity" ? "Rareté max" : k === "FG_EQ_ERR_generic" ? "Erreur serveur" : k) };
  try {
    assert.strictEqual(F.equipForgeErrText("max_rarity"), "Rareté max");
    assert.strictEqual(F.equipForgeErrText("code_inconnu"), "Erreur serveur");
  } finally { delete window.FA_I18N; }
});
