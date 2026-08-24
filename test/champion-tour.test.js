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
  assert.match(SRC, /CHAMP_ERR_champion_indisponible/);
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
