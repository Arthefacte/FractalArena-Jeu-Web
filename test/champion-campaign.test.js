"use strict";
/* Integration du Champion de soutien dans la Campagne. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "campaign.jsx"), "utf8");

test("CampaignCombat integre le champion : liste, rangee, envoi, erreur traduite", () => {
  assert.match(SRC, /championsList\(\)/);
  assert.match(SRC, /ChampionRow/);
  assert.match(SRC, /championBorrow/);
  assert.match(SRC, /requiredOwnCount/);
  assert.match(SRC, /champion_indisponible/);
  assert.match(SRC, /champion_epuise/);
  assert.match(SRC, /championClearBorrow/);
  assert.match(SRC, /CHAMP_BORROWED_TAG/);
  assert.match(SRC, /CHAMP_NEED2/);
});

test("le resultat affiche la commission versee (jamais le wallet brut)", () => {
  assert.match(SRC, /CHAMP_COMMISSION_ROW/);
  assert.ok(!/owner_wallet\s*\)/.test(SRC.slice(SRC.indexOf("function CampResultModal"))),
    "la modale ne doit pas afficher owner_wallet");
});
