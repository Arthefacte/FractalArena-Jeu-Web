// test/core-i18n.test.js
// Pattern de test/market-i18n.test.js : chaque clé existe en FR, EN et ZH.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  // noms des 6 cores
  "CORE_FURY_CORE", "CORE_GUARDIAN_CORE", "CORE_OVERCLOCK_CORE",
  "CORE_REGEN_CORE", "CORE_FEEDBACK_CORE", "CORE_LAST_STAND_CORE",
  // descriptions (suffixe _D, pattern RELIC_*_D)
  "CORE_FURY_CORE_D", "CORE_GUARDIAN_CORE_D", "CORE_OVERCLOCK_CORE_D",
  "CORE_REGEN_CORE_D", "CORE_FEEDBACK_CORE_D", "CORE_LAST_STAND_CORE_D",
  // slot d'équipement
  "CORE_EQUIP", "CORE_UNEQUIP", "CORE_NONE",
];

test("i18n : toutes les clés CORE_* existent en FR/EN/ZH", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  for (const k of KEYS) {
    const idx = src.indexOf(k + ":");
    assert.notStrictEqual(idx, -1, `clé manquante : ${k}`);
    const block = src.slice(idx, src.indexOf("}", idx) + 1);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(block.includes(lang), `${k} : langue manquante ${lang}`);
    }
  }
});

test("i18n : les descriptions portent les chiffres du design v1", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  const bloc = (k) => {
    const idx = src.indexOf(k + ":");
    return src.slice(idx, src.indexOf("}", idx) + 1);
  };
  assert.match(bloc("CORE_FURY_CORE_D"), /15/, "fury : +15% ATK par kill");
  assert.match(bloc("CORE_GUARDIAN_CORE_D"), /20/, "guardian : bouclier 20% PV max");
  assert.match(bloc("CORE_REGEN_CORE_D"), /8/, "regen : 8% PV max");
  assert.match(bloc("CORE_FEEDBACK_CORE_D"), /15/, "feedback : renvoie 15%");
  assert.match(bloc("CORE_LAST_STAND_CORE_D"), /25/, "last stand : +25% ATK");
  assert.match(bloc("CORE_OVERCLOCK_CORE_D"), /SPD|速度/, "overclock : condition SPD");
});
