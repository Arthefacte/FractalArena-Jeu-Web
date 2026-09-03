// Liquidity Guardian côté client : lp_tier chargé dans l'état, badge LpBadge
// (2D pour G1, 3D pour G2), bouton refresh (POST /lp/refresh) et onglet
// leaderboard LP (GET /lp/leaderboard, 503 géré). Miroir des gardes de
// core-fragments-wiring : on épingle l'USAGE, pas seulement l'existence.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("app.jsx");
const components = read("components.jsx");
const screens = read("screens.jsx");
const leaderboard = read("leaderboard.jsx");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

test("app.jsx : serverToState expose lp_tier (null si absent) et freshState l'amorce", () => {
  const b = bloc(app, "function serverToState", 3200);
  assert.match(b, /lpTier: save\.lp_tier \|\| null/, "lp_tier du payload /save non chargé");
  const f = bloc(app, "function freshState", 3600);
  assert.match(f, /lpTier: null/, "lpTier absent de l'état initial");
  assert.match(f, /lpFa: null/, "lpFa absent de l'état initial");
});

test("app.jsx : refreshLp poste sur /lp/refresh, authentifié, et adopte la réponse sans reload", () => {
  const b = bloc(app, "async refreshLp", 2400);
  assert.match(b, /\/lp\/refresh/, "route /lp/refresh manquante");
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /401/, "gestion 401 manquante");
  assert.match(b, /lpTier: data\.lp_tier \|\| null/, "le palier retourné doit être adopté");
  assert.match(b, /lpFa: data\.fa/, "le montant LP retourné doit être adopté");
  assert.match(b, /svOpts\(\)/, "re-fetch /save manquant (le titre a pu changer)");
  assert.match(b, /serverToState/);
});

test("app.jsx : fetchLpLeaderboard lit /lp/leaderboard et distingue le 503 (InSwap down)", () => {
  const b = bloc(app, "async fetchLpLeaderboard", 1200);
  assert.match(b, /\/lp\/leaderboard/, "route /lp/leaderboard manquante");
  assert.match(b, /503/, "le 503 doit être distingué d'une erreur ordinaire");
  assert.match(b, /unavailable: true/, "signal unavailable manquant");
  assert.match(b, /data\.holders \|\| \[\]/, "repli holders manquant");
});

test("components.jsx : LpBadge — 2D pour G1, Emblem3D pour G2, rien sans tier, tooltip titré", () => {
  const b = bloc(components, "function LpBadge", 2200);
  assert.match(b, /tier !== "G1" && tier !== "G2"/, "sans palier, aucun badge (return null)");
  assert.match(b, /LOGO_cut\.webp/, "logo 2D manquant (G1 + repli G2)");
  assert.match(b, /window\.Emblem3D/, "logo 3D manquant pour G2");
  assert.match(b, /tier === "G2" && !flat && window\.Emblem3D/, "la 3D doit exiger G2 ET la dispo du composant (repli 2D silencieux)");
  assert.match(b, /LP_TIER_G2/, "titre du tooltip manquant");
  assert.match(b, /title=\{tip\}/, "tooltip au survol manquant");
  assert.match(components, /Object\.assign\(window, \{[^}]*LpBadge/, "LpBadge doit être exporté sur window");
});

test("screens.jsx : le badge est à côté du pseudo (profil) et le panneau LP appelle refreshLp", () => {
  assert.match(screens, /<LpBadge tier=\{g\.lpTier\} fa=\{g\.lpFa\}/, "badge absent du profil");
  const b = bloc(screens, "async function doLpRefresh", 800);
  assert.match(b, /actions\.refreshLp\(\)/, "le bouton doit appeler refreshLp");
  assert.match(b, /LP_REFRESH_ERR/, "l'échec doit être annoncé");
  assert.match(screens, /LP_REFRESH_BTN/, "libellé du bouton manquant");
  assert.match(screens, /LP_PANEL_HINT/, "texte d'aide (seuils) manquant");
});

test("leaderboard.jsx : onglet LP branché sur fetchLpLeaderboard, 503 affiché, badge plat", () => {
  assert.match(leaderboard, /LB_SEC_LP/, "bouton de section LP manquant");
  const b = bloc(leaderboard, "function LpBoard", 3200);
  assert.match(b, /fetchLpLeaderboard\(\)/, "fetch du classement LP manquant");
  assert.match(b, /LP_LB_UNAVAILABLE/, "message InSwap injoignable manquant");
  assert.match(b, /<LpBadge[^\n]*flat/, "badge de liste : 2D obligatoire (pas de canvas par ligne)");
  assert.match(b, /fmt\(h\.fa\)/, "montant fa formaté comme les soldes");
  // L'onglet LP ne doit PAS partir sur /leaderboard?board=lp ni sur le polling 20 s.
  assert.match(leaderboard, /if \(board === "lp"\) return undefined;/, "le polling générique doit ignorer l'onglet LP");
  assert.match(leaderboard, /section === "lp" && <LpBoard/, "LpBoard doit être rendu pour la section LP");
});
