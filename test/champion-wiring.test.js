"use strict";
/* Cablage des actions Champion de soutien dans app.jsx (patron expeditions-wiring). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
function bloc(marker, len = 1600) {
  const i = SRC.indexOf(marker);
  assert.ok(i >= 0, "marqueur absent : " + marker);
  return SRC.slice(i, i + len);
}

test("actions champion : API_URL + Authorization, pas d URL en dur", () => {
  for (const m of ["async championGet", "async championSet", "async championUses", "async championUsesSeen"]) {
    const b = bloc(m);
    assert.match(b, /API_URL/, new Error(m));
    assert.match(b, /Authorization/, new Error(m));
    assert.ok(!/https?:\/\//.test(b), m + " : URL en dur interdite");
  }
  const pub = bloc("async championsList");   // GET /champions est public : pas de Bearer requis
  assert.match(pub, /API_URL/);
  assert.ok(!/https?:\/\//.test(pub));
});

test("championsList retire l emprunt d un champion devenu epuise (aucun « champion actif » fantome)", () => {
  // Le plafond d appels du jour est par CHAMPION : il peut tomber pendant le run d un
  // emprunteur. Le retrait doit se faire au rafraichissement de la liste — pas dans un
  // ecran — sinon la Campagne et la Tour divergent, et l ecran garde un champion que le
  // serveur refuse (le meme message revient a chaque combat).
  const pub = bloc("async championsList", 1400);
  assert.match(pub, /FA_CHAMPION_UI\.borrowExpire/);
  assert.match(pub, /championBorrow:\s*null/);
  assert.match(pub, /CHAMP_ERR_champion_epuise/);
});

test("campaignFight et towerFight envoient le champion emprunte (slot fixe)", () => {
  const c = bloc("async campaignFight", 2600);
  assert.match(c, /champion_owner_wallet/);
  assert.match(c, /champion_slot/);
  const t = bloc("async towerFight", 2600);
  assert.match(t, /champion_owner_wallet/);
  assert.match(t, /champion_slot/);
});

test("championPoints vient de save.link_points et reste server-owned", () => {
  assert.match(SRC, /championPoints:\s*save\.link_points\s*\?\?\s*0/);
  const sts = SRC.slice(SRC.indexOf("function stateToServer"), SRC.indexOf("function stateToServer") + 1600);
  assert.ok(!sts.includes("link_points") && !sts.includes("championPoints"), "jamais renvoye au serveur");
});

test("freshState declare l etat champion, et championUses est amorce a la connexion", () => {
  for (const k of ["championBeastId: null", "championsList: []", "championBorrow: null", "championPoints: 0"]) {
    assert.ok(SRC.includes(k), k);
  }
  assert.match(SRC, /g\.authToken\)\s*actions\.championUses\(\)/);
});
