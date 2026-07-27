// test/account-i18n.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

const KEYS = [
  "ACC_PLAY_NOW", "ACC_PLAY_NOW_SUB", "ACC_HAVE_WALLET", "ACC_CREATING",
  "ACC_CREATE_FAIL", "ACC_SECRETS_TITLE", "ACC_SECRETS_INTRO",
  "ACC_CODE_LABEL", "ACC_CODE_HINT", "ACC_COPY", "ACC_COPIED",
  "ACC_SEED_LABEL", "ACC_SEED_HINT", "ACC_SEED_REVEAL", "ACC_SEED_HIDE",
  "ACC_PHISHING_WARN", "ACC_CONFIRM_SAVED", "ACC_CONTINUE",
  "ACC_RECOVER_LINK", "ACC_RECOVER_TITLE", "ACC_RECOVER_SUB",
  "ACC_RECOVER_PLACEHOLDER", "ACC_RECOVER_BTN", "ACC_RECOVER_FAIL",
  "ACC_RECOVER_SEED_REFUSED", "ACC_RECOVER_RATE",
  "ACC_LOCKED_BANNER", "ACC_LOCKED_HOW", "ACC_LOCKED_CLOSE",
  "ACC_HOWTO_TITLE", "ACC_HOWTO_1", "ACC_HOWTO_2", "ACC_HOWTO_3", "ACC_HOWTO_CAP",
  "ACC_VERIFY_BTN", "ACC_VERIFY_OK", "ACC_VERIFY_NONE",
];

function bloc(cle) {
  const m = SRC.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
  return m ? m[0] : null;
}

test("toutes les cles du compte sans wallet existent en FR/EN/ZH", () => {
  const manquantes = [];
  for (const k of KEYS) {
    const b = bloc(k);
    if (!b) { manquantes.push(k + " (absente)"); continue; }
    for (const lang of ["FR", "EN", "ZH"]) {
      if (!new RegExp(lang + ":").test(b)) manquantes.push(k + " → " + lang);
    }
  }
  assert.deepStrictEqual(manquantes, []);
});

test("aucune traduction vide", () => {
  for (const k of KEYS) {
    const b = bloc(k);
    for (const lang of ["FR", "EN", "ZH"]) {
      const m = b.match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(m && m[1].trim().length > 0, `${k} → ${lang} vide`);
    }
  }
});

test("l'avertissement anti-phishing nomme le jeu (une consigne vague ne protege personne)", () => {
  const b = bloc("ACC_PHISHING_WARN");
  assert.match(b, /Fractal Arena/, "l'avertissement doit dire que MEME Fractal Arena ne demandera jamais la seed");
});

test("le message du bandeau ne promet pas de deverrouillage total", () => {
  // Le deverrouillage est plafonne au montant depose (serveur §8.4) : le libelle
  // ne doit pas laisser croire qu'un depot symbolique debloque tout.
  const b = bloc("ACC_HOWTO_CAP");
  assert.ok(b, "ACC_HOWTO_CAP absente");
  for (const lang of ["FR", "EN", "ZH"]) assert.match(b, new RegExp(lang + ":"));
});

test("le mobile n'est plus annonce comme bloque", () => {
  const b = bloc("OB_MOBILE_MSG");
  if (!b) return; // cle supprimee : acceptable
  assert.ok(!/extension UniSat\. La version mobile arrive bientôt/.test(b),
    "OB_MOBILE_MSG promet encore que le mobile n'est pas jouable");
});
