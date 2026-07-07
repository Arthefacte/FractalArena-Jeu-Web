// test/talents-ui.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
require("../talents-ui.js");
const TAL = window.FA_TALENTS;
const TUI = window.FA_TALENTS_UI;

test("tierUnlocked : niveau OU rareté > Common (miroir syncTalentSlots serveur)", () => {
  assert.strictEqual(TUI.tierUnlocked({ level: 24, rarity: "Common" }, "25"), false);
  assert.strictEqual(TUI.tierUnlocked({ level: 25, rarity: "Common" }, "25"), true);
  assert.strictEqual(TUI.tierUnlocked({ level: 74, rarity: "Common" }, "75"), false);
  // Tout cycle de rareté implique d'avoir passé L100 → tous les paliers débloqués même à L1.
  assert.strictEqual(TUI.tierUnlocked({ level: 1, rarity: "Rare" }, "75"), true);
});

test("slotState : 3 entrées ordonnées, chosen depuis beast.talents (absent toléré)", () => {
  const b = { level: 60, rarity: "Common", talents: { "25": "hash_surchauffe", "50": null } };
  assert.deepStrictEqual(TUI.slotState(b), [
    { key: "25", unlocked: true, chosen: "hash_surchauffe" },
    { key: "50", unlocked: true, chosen: null },
    { key: "75", unlocked: false, chosen: null },
  ]);
  // Bête d'avant la feature : pas de champ talents du tout — le client dérive quand même.
  assert.deepStrictEqual(TUI.slotState({ level: 30, rarity: "Common" }), [
    { key: "25", unlocked: true, chosen: null },
    { key: "50", unlocked: false, chosen: null },
    { key: "75", unlocked: false, chosen: null },
  ]);
});

test("chooseCost : 1er choix gratuit, respec payant, respec_free armé", () => {
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "25": null } }, "25"), { cost: 0, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({}, "25"), { cost: 0, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "25": "hash_cadence" } }, "25"), { cost: 500, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "75": "net_chaine" } }, "75"), { cost: 4000, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "50": "min_roc" }, respec_free: true }, "50"), { cost: 0, freeRespec: true });
});

test("pct : pourcentage arrondi à 1 décimale", () => {
  assert.strictEqual(TUI.pct(0.075), 7.5);
  assert.strictEqual(TUI.pct(1.10), 110);
  assert.strictEqual(TUI.pct(0.32 * 1.3), 41.6);
});

test("descArgs : couvre les 36 talents, magnitudes scalées, seuils fixes", () => {
  for (const t of TAL.TALENT_LIST) {
    assert.ok(Array.isArray(TUI.descArgs(t, "Common")), `descArgs manquant pour ${t.id}`);
  }
  // Magnitude scalée par la rareté (per, cap de Cadence), seuils jamais scalés.
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_cadence, "Common"), [32, 110]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_cadence, "Legendary"), [64, 220]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.net_execution, "Common"), [250, 50]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.net_execution, "Legendary"), [500, 50]); // below fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.gen_apogee, "Rare"), [5, 6.5]);          // afterRound fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_momentum, "Rare"), [26, 2]);        // rounds fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.led_brouillage, "Legendary"), [22, 40]); // chance fixe, per scalé
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.min_contrepoids, "Common"), [50, 5, 2.5]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_surchauffe, "Common"), []);
});

test("talentDesc : délègue au template i18n avec les args", () => {
  const calls = [];
  const fakeT = (key, ...args) => { calls.push([key, args]); return "X"; };
  TUI.talentDesc(TAL.TALENTS.hash_cadence, "Rare", fakeT);
  assert.deepStrictEqual(calls, [["TAL_hash_cadence_D", [41.6, 143]]]);
});
