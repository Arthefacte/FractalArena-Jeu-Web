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
 
  "ACC_PHISHING_WARN", "ACC_CONFIRM_SAVED", "ACC_CONTINUE",
  "ACC_RECOVER_LINK", "ACC_RECOVER_TITLE", "ACC_RECOVER_SUB",
  "ACC_RECOVER_PLACEHOLDER", "ACC_RECOVER_BTN", "ACC_RECOVER_FAIL",
  "ACC_RECOVER_SEED_REFUSED", "ACC_RECOVER_RATE",
  "ACC_LOCKED_BANNER", "ACC_LOCKED_HOW", "ACC_LOCKED_CLOSE",
  "ACC_HOWTO_TITLE", "ACC_HOWTO_1", "ACC_HOWTO_2", "ACC_HOWTO_3", "ACC_HOWTO_CAP",
  "ACC_LINK_BTN", "ACC_LINK_OK", "ACC_LINK_NO_UNISAT", "ACC_LINK_TAKEN", "ACC_LINK_DESKTOP_ONLY",
  "ACC_LINK_SAME", "ACC_LINK_REJECTED", "ACC_LINK_FAIL",
  "ACC_VERIFY_BTN", "ACC_VERIFY_OK", "ACC_VERIFY_NONE", "ACC_VERIFY_ERR",
  "ACC_DISCONNECT_CONFIRM_TITLE", "ACC_DISCONNECT_CONFIRM_BODY",
  "ACC_DISCONNECT_CONFIRM_BODY_LINKED",
  "ACC_DISCONNECT_CONFIRM_BTN", "ACC_DISCONNECT_CANCEL",
  "ACC_RECOVER_ERROR",
  // Parcours de decouverte — meme regle du depot : FR/EN/ZH, aucune vide.
  "DISC_TITLE", "DISC_SUB", "DISC_DONE_ALL",
  "DISC_D_WIN", "DISC_D_PAID", "DISC_D_LEVEL", "DISC_D_CAMP", "DISC_D_TOWER", "DISC_D_PVP",
  "DISC_CLAIM", "DISC_CLAIMED", "DISC_CLAIM_FAIL",
  "DISC_CRYPTO_TITLE", "DISC_CRYPTO_LOCKED", "DISC_DUST_WAIT", "DISC_DUST_ARRIVED",
  "DISC_TXID_LABEL", "DISC_TXID_HINT", "DISC_TXID_PLACEHOLDER", "DISC_TXID_BTN",
  "DISC_TXID_BAD", "DISC_TXID_NONE", "DISC_TXID_OK",
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
  // Depuis le 2026-07-27 il n'y a plus ni depot obligatoire ni plafond : la preuve
  // d'activite on-chain libere d'un coup les gains mis en attente. Mais elle ne
  // libere QUE ceux-la — le verrouille normal du jeu (quetes, campagne, connexion,
  // combats gratuits) reste verrouille, y compris pour un compte verifie. Le libelle
  // doit porter cette limite dans les 3 langues, sinon le joueur croit que tout son
  // solde verrouille va se debloquer et se sent floue. La presence seule de la cle
  // est deja verifiee par le premier test du fichier.
  const b = bloc("ACC_HOWTO_CAP");
  assert.ok(b, "ACC_HOWTO_CAP absente");
  const limite = { FR: /reste verrouillé/i, EN: /stays locked/i, ZH: /保持锁定/ };
  for (const lang of ["FR", "EN", "ZH"]) {
    const m = b.match(new RegExp(lang + ':\\s*"([^"]*)"'));
    assert.ok(m, `${lang} absente de ACC_HOWTO_CAP`);
    assert.match(m[1], limite[lang],
      `${lang} ne dit pas que le verrouille de jeu reste verrouille -> laisse croire a un deverrouillage total`);
  }
});

test("le mobile n'est plus annonce comme bloque", () => {
  const b = bloc("OB_MOBILE_MSG");
  if (!b) return; // cle supprimee : acceptable
  assert.ok(!/extension UniSat\. La version mobile arrive bientôt/.test(b),
    "OB_MOBILE_MSG promet encore que le mobile n'est pas jouable");
});
