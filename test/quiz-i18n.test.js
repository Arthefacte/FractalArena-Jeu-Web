// test/quiz-i18n.test.js
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const CLES = [
  "QUIZ_KEEP", "QUIZ_GIVE", "QUIZ_CORRECT", "QUIZ_WRONG", "QUIZ_REVIEW",
  "QUIZ_GIVEN", "QUIZ_TICKER_DON", "QUIZ_TICKER_TOTAL",
  "QUIZ_TITLE_KNOWLEDGE", "QUIZ_TITLE_CONTRIB",
];

test("toutes les cles du quiz existent en FR, EN et ZH", () => {
  for (const cle of CLES) {
    assert.ok(T[cle], "cle manquante : " + cle);
    for (const lang of LANGS) {
      assert.ok(T[cle][lang] && T[cle][lang].trim(), `${cle}/${lang} manquant`);
    }
  }
});

test("les deux boutons ne portent aucun adjectif valorisant", () => {
  for (const lang of LANGS) {
    assert.ok(!/héros|hero|sois|be a /i.test(T.QUIZ_GIVE[lang]), `${lang} : bouton culpabilisant`);
  }
});

// Les deux boutons doivent peser pareil : ni l'un ni l'autre ne porte de montant
// en dur, et « garder » prend son montant du serveur (%d) comme « offrir ».
test("aucun montant en dur dans les libelles de bouton", () => {
  for (const lang of LANGS) {
    assert.ok(!/\b10\b/.test(T.QUIZ_KEEP[lang]), `${lang} : montant fige dans QUIZ_KEEP`);
    assert.match(T.QUIZ_KEEP[lang], /%d/, `${lang} : QUIZ_KEEP doit porter %d`);
  }
});

// Convention du depot (components.jsx:30) : un montant s'ecrit « %d FA » dans i18n,
// FaText le remplace par le logo du token. Sans « FA » apres le nombre, pas de logo.
test("les montants suivent la convention FaText", () => {
  for (const lang of LANGS) {
    for (const cle of ["QUIZ_KEEP", "QUIZ_GIVEN", "QUIZ_TICKER_DON", "QUIZ_TICKER_TOTAL"]) {
      assert.match(T[cle][lang], /%d\s*FA\b/, `${cle}/${lang} : montant hors convention FaText`);
    }
  }
});
