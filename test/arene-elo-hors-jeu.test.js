/* Arène V2 : les adversaires implicites disparaissent. Le rejeu conserve le drapeau serveur elo=false pour nommer un combat hors classement, sans inventer sa cause. */
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
  assert.match(BATTLE, /I18N\.t\("AR2_NO_ELO"\)/, "et NOMMÉ, pas rendu comme un zéro");
});

test("l'écran reçoit `elo` (le drapeau que porte la réponse d'attaque)", () => {
  assert.match(ARENE, /elo=\{result\.elo\}/, "arene.jsx doit transmettre le drapeau au rejeu");
  assert.match(BATTLE, /\{ events, p1Team, p2Team, won, delta, elo, onClose/,
    "l'écran doit déclarer la prop `elo`");
});

test("le libellé existe dans les TROIS langues (FR/EN/ZH)", () => {
  const m = /AR2_NO_ELO:\s*\{[^}]*\}/.exec(I18N);
  assert.ok(m, "AR2_NO_ELO absent de i18n.js");
  for (const lg of ["FR", "EN", "ZH"]) {
    assert.ok(m[0].includes(lg + ":"), "traduction " + lg + " manquante");
  }
});
