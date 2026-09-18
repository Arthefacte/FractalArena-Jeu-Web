"use strict";
/* Integration du Champion de soutien dans la Tour (manuel + auto). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "tour.jsx"), "utf8");

test("la Tour integre le champion : rangee, envoi, validation a 2, erreur traduite", () => {
  assert.match(SRC, /ChampionRow/);
  assert.match(SRC, /championsList\(\)/);
  assert.match(SRC, /championBorrow/);
  assert.match(SRC, /requiredOwnCount/);
  assert.match(SRC, /champion_indisponible/);
  assert.match(SRC, /champion_epuise/);
  assert.match(SRC, /CHAMP_ACTIVE/);
});

test("l auto-combat conserve le champion et cumule la commission", () => {
  const auto = SRC.slice(SRC.indexOf("async function onAuto"), SRC.indexOf("async function onAbandon"));
  assert.match(auto, /champRef/);
  assert.match(auto, /championRunState/);
  assert.match(auto, /commission/);
  assert.match(SRC, /CHAMP_COMMISSION_GAIN/);
});

test("le resultat manuel affiche la commission", () => {
  const modal = SRC.slice(SRC.indexOf("function TourResultModal"), SRC.indexOf("function Tour("));
  assert.match(modal, /CHAMP_COMMISSION_ROW/);
});

test("la selection est plafonnee a 2 avec un champion (pas de 4e entite jetee)", () => {
  // La grille de la Tour passe ownNeeded (2 avec champion, 3 sans) au toggleSelect :
  // impossible de cocher une 3e entite propre qui serait jetee silencieusement.
  assert.match(SRC, /toggleSelect\(beast\.id, ownNeeded\)/);
  // Le prompt de combat suit le champion (CHAMP_NEED2) au lieu d'un TOUR_NEED3 trompeur.
  assert.match(SRC, /I18N\.t\(champ \? "CHAMP_NEED2" : "TOUR_NEED3"\)/);
  // app.jsx : toggleSelect accepte un plafond et championPickBorrow tronque a 2.
  const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
  assert.match(APP, /toggleSelect\(id, cap = 3\)/);
  assert.match(APP, /requiredOwnCount\(true\)/);
  // La Tour passe mon wallet a ChampionRow : mon propre champion est retire de la liste.
  assert.match(SRC, /myWallet=\{g\.wallet\}/);
});
