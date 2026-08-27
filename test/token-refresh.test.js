// Renouvellement glissant de session (serveur PR #127) : l'intercepteur fetch
// d'account-ui.js range le jeton frais et prévient app.jsx. Sans ce câblage,
// un joueur actif est déconnecté tous les 30 jours et repasse par le parcours
// de signature UniSat (vécu par le user le 2026-08-27).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ACC = read("account-ui.js");
const APP = read("app.jsx");

test("account-ui.js : l'intercepteur lit x-fa-token-refresh et range via writeToken", () => {
  assert.match(ACC, /x-fa-token-refresh/, "l'en-tête du serveur doit être lu");
  assert.match(ACC, /installTokenRefresh/, "l'enveloppe fetch doit exister");
  // Le jeton passe par writeToken (même stockage que la connexion), jamais un setItem direct.
  const bloc = ACC.slice(ACC.indexOf("installTokenRefresh"));
  assert.match(bloc.slice(0, 1200), /writeToken\(neuf\)/);
  assert.match(ACC, /fa:token-refresh/, "app.jsx doit pouvoir être prévenu");
});

test("account-ui.js : seuls les appels vers FA_API_URL sont inspectés", () => {
  const bloc = ACC.slice(ACC.indexOf("installTokenRefresh"));
  assert.match(bloc.slice(0, 1200), /FA_API_URL/,
    "sans ce filtre, chaque fetch tiers (UniSat, InSwap) serait inspecté pour rien");
});

test("app.jsx : écoute fa:token-refresh et aligne g.authToken", () => {
  assert.match(APP, /addEventListener\("fa:token-refresh"/);
  const idx = APP.indexOf('fa:token-refresh');
  const bloc = APP.slice(Math.max(0, idx - 600), idx + 600);
  assert.match(bloc, /authToken: t/,
    "l'état React doit adopter le jeton frais, sinon les Bearer suivants partent périmés");
});
