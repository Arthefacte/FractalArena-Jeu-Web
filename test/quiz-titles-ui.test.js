// test/quiz-titles-ui.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
// Le profil du joueur vit dans screens.jsx (Perso / Options), pas dans account.jsx
// qui ne traite que la creation de compte.
const files = ["screens.jsx", "app.jsx"].map(lire).join("\n");

test("les deux compteurs et les deux titres sont affiches", () => {
  assert.match(files, /knowledge_title/);
  assert.match(files, /contribution_title/);
});

test("le joueur choisit le titre qu'il affiche", () => {
  assert.match(files, /quizTitleChoice|title_choice/);
});

// v1 : le choix reste local, aucune route serveur supplementaire.
test("le choix est persiste en localStorage", () => {
  assert.match(files, /fa_quiz_title_choice/);
});

// Un selecteur qui ne change rien a l'ecran serait un bouton mort : le titre
// choisi doit apparaitre quelque part a cote du nom.
test("le titre choisi est effectivement affiche a cote du nom", () => {
  const bloc = lire("screens.jsx");
  assert.match(bloc, /titrePrestige|prestigeAffiche/);
});

test("les libelles du panneau existent en trois langues", () => {
  globalThis.window = {};
  delete require.cache[require.resolve("../i18n.js")];
  require("../i18n.js");
  const { T } = globalThis.window.FA_I18N;
  for (const cle of ["QUIZ_PRESTIGE", "QUIZ_ANSWERED", "QUIZ_CONTRIBUTED", "QUIZ_SHOWN", "QUIZ_NONE"]) {
    assert.ok(T[cle], "cle manquante : " + cle);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.ok(T[cle][lang] && T[cle][lang].trim(), `${cle}/${lang} manquant`);
    }
  }
});
