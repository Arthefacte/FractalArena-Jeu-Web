"use strict";
// 26/10/2026 : « pour l'arène j'ai rien reçu alors que j'étais dans le top 10 ».
// En base, la ligne existait bel et bien — saison 18, Diamant, rang 3, +492 FA, solde
// 456 → 948 — mais elle portait déjà `seen = TRUE` : la modale valait « récupéré » sur
// simple fermeture (`<Modal onClose={onClaim}>`), et `/pvp/prizes` ne renvoie que
// `seen = FALSE`. Le prix disparaissait sans avoir été lu.
//
// Ces gardes figent la séparation fermer / récupérer, et l'historique qui permet de
// revoir un paiement passé depuis l'écran Arène.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const ARENE = fs.readFileSync(path.join(RACINE, "arene.jsx"), "utf8");
const APP = fs.readFileSync(path.join(RACINE, "app.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "i18n.js"), "utf8");

test("la modale de prix sépare fermer et récupérer", () => {
  assert.match(ARENE, /function PrizeModal\(\{ prizes, onClaim, onClose \}\)/,
    "la modale doit recevoir les deux rappels distincts");
  assert.ok(!/<Modal onClose=\{onClaim\}/.test(ARENE),
    "fermer la modale ne doit plus valoir récupération");
  assert.match(ARENE, /<Modal onClose=\{onClose\}/, "la croix / Échap / clic à côté ferment");
  assert.match(ARENE, /onClick=\{onClaim\}/, "seul le bouton Récupérer récupère");
});

test("fermer la modale ne marque aucun prix comme vu", () => {
  const i = APP.indexOf("<window.PrizeModal");
  assert.ok(i > 0, "montage de PrizeModal introuvable dans app.jsx");
  const bloc = APP.slice(i, i + 900);
  assert.match(bloc, /onClose=\{\(\) => setPrixClos\(true\)\}/,
    "la fermeture doit seulement masquer la modale pour la session");
  const queue = bloc.slice(bloc.indexOf("onClose="));
  assert.ok(!/PrizesSeen/.test(queue),
    "aucun appel pvpPrizesSeen / towerPrizesSeen ne doit partir d'une fermeture");
});

test("l'écran Arène affiche l'historique des paiements de saison", () => {
  assert.match(APP, /pvpPrizesHistory: \[\]/, "état initial de l'historique");
  assert.match(APP, /\/pvp\/prizes\/history/, "route serveur appelée");
  assert.match(ARENE, /actions\.pvpPrizesHistory\(\)/, "chargé avec l'écran, pas avec le popup");
  assert.match(ARENE, /data-fa="hist-prix"/, "panneau présent dans l'Arène");
  assert.match(ARENE, /AR2_HIST_TITLE/, "titre traduit");
});

test("récupérer pousse la ligne dans l'historique sans rechargement", () => {
  const i = APP.indexOf("async pvpPrizesSeen()");
  assert.ok(i > 0);
  const bloc = APP.slice(i, i + 700);
  assert.match(bloc, /pvpPrizesHistory:/, "le prix vu rejoint l'historique à l'écran");
});

test("les clés i18n de l'historique existent en FR, EN et ZH", () => {
  for (const cle of ["AR2_HIST_TITLE", "AR2_HIST_NONE", "AR2_HIST_TOTAL", "PRIZE_KEEP_HINT"]) {
    assert.ok(new RegExp("\\b" + cle + ":\\s*\\{").test(I18N), cle + " absente d'i18n.js");
    const ligne = I18N.split("\n").find((l) => new RegExp("\\b" + cle + ":\\s*\\{").test(l)) || "";
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(ligne.includes(lang), cle + " sans libellé " + lang);
    }
  }
});
