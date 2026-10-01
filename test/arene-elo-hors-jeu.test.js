/* L'écran de combat affichait « +0 ELO ».

 * Le serveur ne fait PAS bouger le classement contre une cible implicite (adversaire sans
 * défense enregistrée, donc non classé) — règle d'audit B2, doublée par #130 pour les cibles
 * hors de portée. Le client, lui, calculait `delta = rating - rating_precedent` et affichait
 * donc « +0 ELO » : le joueur ne pouvait pas distinguer « rien échangé » de « combat hors
 * classement », et lisait un zéro qui ressemble à un bug.
 *
 * La réponse d'attaque porte maintenant `elo` (le classement était-il en jeu ?), et l'écran
 * le NOMME. Ces tests tiennent le contrat des deux côtés.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const BATTLE = lire("arene-battle.jsx");
const ARENE = lire("arene.jsx");
const I18N = lire("i18n.js");

test("l'écran de combat nomme un combat hors classement au lieu d'afficher « +0 ELO »", () => {
  assert.match(BATTLE, /elo === false/, "le combat hors classement doit être reconnu");
  assert.match(BATTLE, /I18N\.t\("AR2_NO_ELO_UNRANKED"\)/, "et NOMMÉ, pas rendu comme un zéro");
});

test("l'écran reçoit `elo` (le drapeau que porte la réponse d'attaque)", () => {
  assert.match(ARENE, /elo=\{result\.elo\}/, "arene.jsx doit transmettre le drapeau au rejeu");
  assert.match(BATTLE, /\{ events, p1Team, p2Team, won, delta, elo, onClose/,
    "l'écran doit déclarer la prop `elo`");
});

test("le libellé existe dans les TROIS langues (FR/EN/ZH)", () => {
  const m = /AR2_NO_ELO_UNRANKED:\s*\{[^}]*\}/.exec(I18N);
  assert.ok(m, "AR2_NO_ELO_UNRANKED absent de i18n.js");
  for (const lg of ["FR", "EN", "ZH"]) {
    assert.ok(m[0].includes(lg + ":"), "traduction " + lg + " manquante");
  }
});
