// test/core-desc.test.js
// Le texte d'un core suit SA rareté : la rareté met à l'échelle les INTENSITÉS
// (miroir serveur data.node.js / CORE_SCALED_KEYS), jamais les seuils (30 % PV du
// Last Stand), les durées (1 tour du Gardien) ni les effets tout-ou-rien
// (Overclock). Sans ça, une Commune et une Rare affichaient le même chiffre :
// les deux cartes étaient indiscernables en jeu (constaté le 08/10/2026).
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../data.js");
require("../core-ui.js");
const D = globalThis.window.FA_DATA;
const CU = globalThis.window.FA_CORE_UI;

const CORE_IDS = [
  "fury_core", "guardian_core", "overclock_core",
  "regen_core", "feedback_core", "last_stand_core",
];

test("pct : 2 décimales max, sans zéro traînant (valeur exacte du moteur)", () => {
  assert.strictEqual(CU.pct(0.1875), 18.75);   // Rare : 0.15 × 1.25
  assert.strictEqual(CU.pct(0.15), 15);
  assert.strictEqual(CU.pct(0.30), 30);
  assert.strictEqual(CU.pct(0.3125), 31.25);   // Last Stand Rare : 0.25 × 1.25
  assert.strictEqual(CU.pct(0.16), 16);        // Regen Légendaire : 0.08 × 2
});

test("descArgs : intensités × rareté, aucun seuil ni durée dans les args", () => {
  assert.deepStrictEqual(CU.descArgs("fury_core", "Common"), [15]);
  assert.deepStrictEqual(CU.descArgs("fury_core", "Rare"), [18.75]);
  assert.deepStrictEqual(CU.descArgs("fury_core", "Epic"), [22.5]);
  assert.deepStrictEqual(CU.descArgs("fury_core", "Legendary"), [30]);
  assert.deepStrictEqual(CU.descArgs("guardian_core", "Rare"), [25]);   // 1 tour reste fixe
  assert.deepStrictEqual(CU.descArgs("regen_core", "Epic"), [12]);
  assert.deepStrictEqual(CU.descArgs("feedback_core", "Legendary"), [30]);
  assert.deepStrictEqual(CU.descArgs("last_stand_core", "Rare"), [31.25, 18.75]); // 30 % PV fixe
  // Overclock : tout-ou-rien, aucun chiffre — identique à toutes les raretés.
  assert.deepStrictEqual(CU.descArgs("overclock_core", "Common"), []);
  assert.deepStrictEqual(CU.descArgs("overclock_core", "Legendary"), []);
});

test("les valeurs affichées DÉRIVENT du catalogue et du mult de rareté", () => {
  // La valeur Commune est celle du catalogue, pas un chiffre recopié.
  assert.strictEqual(CU.descArgs("fury_core", "Common")[0], CU.pct(D.CORES.fury_core.effect.atk));
  assert.strictEqual(CU.descArgs("guardian_core", "Common")[0], CU.pct(D.CORES.guardian_core.effect.shield));
  assert.strictEqual(CU.descArgs("regen_core", "Common")[0], CU.pct(D.CORES.regen_core.effect.heal));
  assert.strictEqual(CU.descArgs("feedback_core", "Common")[0], CU.pct(D.CORES.feedback_core.effect.reflect));
  assert.deepStrictEqual(CU.descArgs("last_stand_core", "Common"),
    [CU.pct(D.CORES.last_stand_core.effect.atk), CU.pct(D.CORES.last_stand_core.effect.def)]);
  // Et chaque palier est exactement le palier précédent × CORE_RARITY_MULT :
  // un barème ou une échelle de rareté qui bouge fait rougir ce test.
  for (const id of CORE_IDS) {
    const commune = CU.descArgs(id, "Common");
    for (const rarity of ["Rare", "Epic", "Legendary"]) {
      const got = CU.descArgs(id, rarity);
      assert.strictEqual(got.length, commune.length, `${id} ${rarity} : nombre d'args`);
      commune.forEach((v, i) => {
        assert.strictEqual(got[i], CU.pct((v / 100) * D.CORE_RARITY_MULT[rarity]),
          `${id} ${rarity} arg ${i} : la rareté doit scaler l'intensité`);
      });
    }
  }
});

test("rareté absente ou inconnue : Commune (même repli que coreEffect serveur)", () => {
  assert.strictEqual(CU.rarityMult(undefined), 1.0);
  assert.strictEqual(CU.rarityMult("Mythic"), 1.0);
  assert.deepStrictEqual(CU.descArgs("fury_core"), [15]);
  assert.deepStrictEqual(CU.descArgs("fury_core", "Mythic"), [15]);
});

test("core inconnu ou instance vide : aucun argument, jamais d'exception", () => {
  assert.deepStrictEqual(CU.descArgs("noyau_fantome", "Rare"), []);
  assert.deepStrictEqual(CU.descArgs(null, "Rare"), []);
  assert.strictEqual(CU.coreDesc(null, () => "X"), "");
  assert.strictEqual(CU.coreDesc({}, () => "X"), "");
  assert.strictEqual(CU.coreDesc({ core_id: "noyau_fantome", rarity: "Rare" }, (k, ...a) => k + a.length), "CORE_NOYAU_FANTOME_D0");
});

test("coreDesc : délègue au gabarit de LA rareté de l'instance", () => {
  const calls = [];
  const fakeT = (key, ...args) => { calls.push([key, args]); return "X"; };
  CU.coreDesc({ core_id: "fury_core", rarity: "Rare" }, fakeT);
  CU.coreDesc({ core_id: "fury_core", rarity: "Legendary" }, fakeT);
  CU.coreDesc({ core_id: "overclock_core", rarity: "Common" }, fakeT);
  assert.deepStrictEqual(calls, [
    ["CORE_FURY_CORE_D", [18.75]],
    ["CORE_FURY_CORE_D", [30]],
    ["CORE_OVERCLOCK_CORE_D", []],
  ]);
});
