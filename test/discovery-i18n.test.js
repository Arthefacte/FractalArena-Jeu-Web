"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

const KEYS = [
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

test("toutes les cles du parcours existent en FR/EN/ZH", () => {
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

test("un libelle par etape, dans l'ordre du serveur", () => {
  // Les six identifiants du serveur (discovery.js:18-23) doivent tous avoir leur
  // libelle : une etape sans texte s'afficherait comme une cle brute au joueur.
  for (const id of ["d_win", "d_paid", "d_level", "d_camp", "d_tower", "d_pvp"]) {
    assert.ok(bloc("DISC_" + id.toUpperCase()), `libelle manquant pour ${id}`);
  }
});

test("le libelle du volet crypto dit ce qui debloque", () => {
  // Le joueur doit comprendre que le volet crypto s'ouvre APRES le volet jeu,
  // sinon il croit a un bug.
  const b = bloc("DISC_CRYPTO_LOCKED");
  assert.ok(b, "DISC_CRYPTO_LOCKED absente");
  for (const lang of ["FR", "EN", "ZH"]) assert.match(b, new RegExp(lang + ":"));
});
