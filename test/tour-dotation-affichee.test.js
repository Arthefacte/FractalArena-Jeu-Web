"use strict";
// 26/10/2026 : « pourtant la dotation est de 3 000, comment ça se fait que je gagne que ça ».
// Le classement annonçait « jusqu'à 3 000 FA au top 10 » : un montant que le barème ne peut
// pas produire (10 payés × 100 FA = 1 000 ; le rang 1 en touche 186). On affiche la dotation
// réelle, calculée par le serveur avec la MÊME fonction que le versement.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(RACINE, "i18n.js"), "utf8");
const TOUR = fs.readFileSync(path.join(RACINE, "tour.jsx"), "utf8");
const APP = fs.readFileSync(path.join(RACINE, "app.jsx"), "utf8");
const ARENE = fs.readFileSync(path.join(RACINE, "arene.jsx"), "utf8");

function ligneDe(cle) {
  return I18N.split("\n").find((l) => new RegExp("\\b" + cle + ":\\s*\\{").test(l)) || "";
}

test("le classement n'annonce plus une dotation impossible", () => {
  const l = ligneDe("TOUR_LB_DOTATION");
  assert.ok(l, "clé absente");
  assert.ok(!/3\s?000|3,000/.test(l), "le « jusqu'à 3 000 FA » est un montant que le barème ne produit pas");
  assert.match(l, /100 FA/, "la règle réelle : 100 FA par joueur classé");
  for (const lang of ["FR:", "EN:", "ZH:"]) assert.ok(l.includes(lang), "libellé manquant : " + lang);
});

test("le classement affiche la dotation réelle de la semaine et la part du rang 1", () => {
  assert.ok(ligneDe("TOUR_LB_LIVE"), "clé TOUR_LB_LIVE absente");
  assert.match(TOUR, /I18N\.t\("TOUR_LB_LIVE", st\.ranked, st\.dotation, rang1\)/,
    "les trois chiffres doivent venir du serveur, pas d'une constante");
  assert.match(TOUR, /const rang1 = st\.rank1 \|\| 0/, "la part du rang 1 vient du serveur (reste de division inclus)");
  // L'action doit remonter les champs du payload serveur, sinon l'écran affiche 0.
  assert.match(APP, /ranked: data\.ranked \|\| 0/, "ranked non remonté par towerLeaderboard");
  assert.match(APP, /dotation: data\.dotation \|\| 0/, "dotation non remontée par towerLeaderboard");
  assert.match(APP, /rank1: data\.rank1 \|\| 0/, "part du rang 1 non remontée");
});

test("le popup de la Tour rappelle la dotation de la semaine", () => {
  assert.ok(ligneDe("PRIZE_TOWER_DOTATION"), "clé absente");
  for (const lang of ["FR:", "EN:", "ZH:"]) assert.ok(ligneDe("PRIZE_TOWER_DOTATION").includes(lang));
  assert.match(ARENE, /p\.dotation != null/, "les lignes archivées avant la colonne n'ont pas de dotation");
  assert.match(ARENE, /I18N\.t\("PRIZE_TOWER_DOTATION", p\.dotation\)/);
});
