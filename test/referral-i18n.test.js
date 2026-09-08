// test/referral-i18n.test.js
// Parrainage : chaque clé existe en FR, EN et ZH (pattern lp-i18n), et le
// texte d'aide dit la VRAIE règle (5 % des gains nets, en FA verrouillés).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  "REF_TITLE", "REF_EYEBROW", "REF_CODE_LABEL", "REF_COPY", "REF_COPIED",
  "REF_LINK_LABEL", "REF_EARNED", "REF_REFEREES", "REF_NONE", "REF_REFERRER",
  "REF_HINT", "REF_ERROR", "REF_LOADING", "REF_BACK", "OP_REFERRAL_BTN",
];

const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

test("i18n : toutes les clés REF_* / OP_REFERRAL_BTN existent en FR/EN/ZH, non vides", () => {
  for (const k of KEYS) {
    const idx = src.indexOf(k + ":");
    assert.notStrictEqual(idx, -1, `clé manquante : ${k}`);
    const block = src.slice(idx, src.indexOf("}", idx) + 1);
    for (const lang of ["FR", "EN", "ZH"]) {
      const m = block.match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(m && m[1].trim(), `${k} → ${lang} vide ou manquante`);
    }
  }
});

test("i18n : le texte d'aide porte la règle (5 %, verrouillé)", () => {
  const idx = src.indexOf("REF_HINT:");
  const block = src.slice(idx, src.indexOf("},", idx) + 1);
  assert.match(block, /5\s?%/, "le taux 5 % doit être dit");
  assert.match(block, /verrouill|locked|锁定/i, "les gains sont en FA verrouillés");
});
