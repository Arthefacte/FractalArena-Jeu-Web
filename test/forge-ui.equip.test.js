"use strict";
// Forge d'équipement : helpers purs de sélection/état (miroir des règles serveur
// relic-fuse / core-fuse / equip-disenchant). Une famille par flux : "relic"
// (défaut) ou "core" — les deux vivent dans le même tableau `equipment`,
// donc le filtre est explicite.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
require("../forge-ui.js");
require("../expeditions-ui.js");
const F = window.FA_FORGE_UI;
const XU = window.FA_EXPEDITIONS_UI;

const relic = (id, rarity) => ({ id, type: "ruby_shard", rarity });
const core = (id, rarity = "Common") => ({ id, core_id: "fury_core", rarity, acquired_at: "2026-08-28" });

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

test("disenchantState : exactement 1 relique → fragments, aucun gain ni frais en FA", () => {
  const s = F.disenchantState({ sel: [relic("a", "Common")], balance: 1000, busy: false });
  assert.deepStrictEqual(s, { disabled: false, value: 0, fee: 0, net: 0,
    fragments: 30, rank: "C", showInsufficient: false });
  const leg = F.disenchantState({ sel: [relic("a", "Legendary")], balance: 1000, busy: false });
  assert.strictEqual(leg.disabled, false, "une Legendary se recycle (mais ne fusionne pas)");
  assert.strictEqual(leg.fragments, 300);
  assert.strictEqual(leg.rank, "S");
});

test("disenchantState : 0 ou 2+ sélections → désactivé", () => {
  for (const sel of [[], [relic("a", "Common"), relic("b", "Common")],
    [core("a"), core("b"), core("c")], null, [null], [relic("a", "Unknown")], [relic("a", "toString")]]) {
    assert.deepStrictEqual(F.disenchantState({ sel, balance: 9999, busy: false }), {
      disabled: true, value: 0, fee: 0, net: 0, fragments: null, rank: null, showInsufficient: false,
    }, "sans sélection recyclable, aucun rendement ne doit s'afficher");
  }
});

test("disenchantState : zéro FA suffit pour les deux familles ; busy bloque", () => {
  for (const item of [relic("a", "Common"), core("b")]) {
    const s = F.disenchantState({ sel: [item], balance: 0, busy: false });
    assert.strictEqual(s.disabled, false);
    assert.strictEqual(s.showInsufficient, false);
    assert.strictEqual(s.fee, 0);
    assert.strictEqual(F.disenchantState({ sel: [item], balance: 0, busy: true }).disabled, true);
  }
});

test("recyclage : 30/75/180/300 fragments, alignés sur 30 % des coûts de forge des deux familles", () => {
  // Les coûts restent dupliqués entre forge-ui.js et expeditions-ui.js : ce test
  // compare aussi les tables, car l'arrondi masquerait une dérive de 100 à 101.
  assert.deepStrictEqual(F.FRAGMENT_COSTS, XU.FRAGMENT_COSTS,
    "les coûts de recyclage divergent des coûts de forge des reliques");
  assert.deepStrictEqual(F.FRAGMENT_COSTS, XU.CORE_FRAGMENT_COSTS,
    "les coûts de recyclage divergent des coûts de forge des cores");
  assert.strictEqual(F.RECYCLE_SHARE, 0.30, "le recyclage doit rendre 30 % du coût de forge");
  assert.deepStrictEqual(F.RANK_OF_RARITY, { Common: "C", Rare: "B", Epic: "A", Legendary: "S" });
  const expected = [
    ["Common", "C", 30, 100], ["Rare", "B", 75, 250],
    ["Epic", "A", 180, 600], ["Legendary", "S", 300, 1000],
  ];
  for (const [family, make, costs] of [["relic", relic, XU.FRAGMENT_COSTS], ["core", core, XU.CORE_FRAGMENT_COSTS]]) {
    for (const [rarity, rank, fragments, cost] of expected) {
      const label = `${family} ${rarity}/${rank}`;
      const s = F.disenchantState({ sel: [make("a", rarity)], balance: 0, busy: false });
      assert.strictEqual(costs[rank], cost, label + " : coût de forge divergent");
      assert.deepStrictEqual(s, { disabled: false, value: 0, fee: 0, net: 0,
        fragments, rank, showInsufficient: false }, label + " : barème de recyclage divergent");
      assert.strictEqual(s.fragments, Math.floor(costs[s.rank] * 0.30),
        label + " : forge-ui.js et expeditions-ui.js divergent");
    }
  }
});

test("recyclage : indépendant des anciens barèmes FA et frais de data.js", () => {
  const D = window.FA_DATA;
  window.FA_DATA = new Proxy(D, { get(target, key) {
    assert.ok(!["RELIC_BUYBACK", "CORE_BUYBACK", "DISENCHANT_FEE"].includes(key),
      "le recyclage ne doit plus consulter " + key);
    return target[key];
  } });
  try {
    for (const item of [relic("a", "Rare"), core("b", "Rare")]) {
      assert.strictEqual(F.disenchantState({ sel: [item], balance: 0 }).fragments, 75);
    }
  } finally { window.FA_DATA = D; }
});

// ---- Famille "core" (forge d'équipement des cores, 25/09) ----

test("equipSelToggle(family core) : que des cores — une relique est refusée", () => {
  assert.strictEqual(F.equipSelToggle([], relic("r1", "Common"), "core"), null);
  assert.deepStrictEqual(F.equipSelToggle([relic("r1", "Common")], relic("r2", "Common"), "relic").map((x) => x.id), ["r1", "r2"], "la famille relique est intacte");
  const s = F.equipSelToggle([], core("c1"), "core");
  assert.deepStrictEqual(s.map((x) => x.id), ["c1"]);
  assert.deepStrictEqual(F.equipSelToggle(s, core("c1"), "core"), [], "re-clic = désélection");
});

test("familyMatch/buybackFor/fuseCostFor : la famille choisit la table, jamais la rareté seule", () => {
  assert.strictEqual(F.familyMatch(core("c1"), "core"), true);
  assert.strictEqual(F.familyMatch(core("c1"), "relic"), false);
  assert.strictEqual(F.buybackFor(core("c1")), 1600);
  assert.strictEqual(F.buybackFor(relic("r1", "Common")), 1600);
  assert.strictEqual(F.fuseCostFor(core("c1")), 2000);
});

test("coreFuseState : mêmes barèmes que les reliques, famille séparée", () => {
  const sel = [core("a"), core("b"), core("c")];
  const s = F.coreFuseState({ sel, balance: 2000, busy: false });
  assert.strictEqual(s.disabled, false);
  assert.strictEqual(s.cost, 2000);
  assert.strictEqual(s.nextRarity, "Rare");
  assert.strictEqual(F.coreFuseState({ sel, balance: 1999, busy: false }).showInsufficient, true);
});

test("disenchantState : un core commun rend 30 fragments C sans mouvement de FA", () => {
  const s = F.disenchantState({ sel: [core("c1")], balance: 1000, busy: false });
  assert.deepStrictEqual(s, { disabled: false, value: 0, fee: 0, net: 0,
    fragments: 30, rank: "C", showInsufficient: false });
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
