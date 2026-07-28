// Deux libelles constates faux en production le 2026-07-28 (verification v93).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");
const I18N = read("i18n.js");

// --- 1. « Création… » s'affichait en cliquant « J'ai déjà un wallet » ---
// Les trois actions de l'ecran d'accueil partageaient un seul etat `checking` :
// se connecter avec son wallet allumait le libelle de creation sur l'autre bouton.
// Le joueur qui voulait juste se connecter croyait qu'on lui fabriquait un compte —
// l'inquietude exacte que « jouer sans wallet » cherche a desamorcer.

test("le libelle de creation ne depend pas d'un etat partage", () => {
  const i = APP.indexOf('I18N.t("ACC_CREATING")');
  assert.ok(i > 0, "libelle de creation absent");
  const bloc = APP.slice(Math.max(0, i - 300), i + 80);
  assert.ok(!/\bchecking\s*\?\s*I18N\.t\("ACC_CREATING"\)/.test(bloc),
    "un etat partage par les trois actions ne peut pas dire laquelle est en cours");
  assert.match(bloc, /busy\s*===\s*"create"/,
    "le libelle doit etre conditionne a l'action de creation elle-meme");
});

test("le libelle de verification manuelle est conditionne a SON action", () => {
  const i = APP.indexOf('I18N.t("OB_CHECKING")');
  assert.ok(i > 0, "libelle de verification absent");
  const bloc = APP.slice(Math.max(0, i - 300), i + 80);
  assert.match(bloc, /busy\s*===\s*"manual"/);
});

test("une action en cours desactive toujours les autres boutons", () => {
  // Separer les libelles ne doit pas rouvrir la porte au double-clic : deux
  // creations concurrentes feraient deux comptes, dont un orphelin.
  const zone = APP.slice(APP.indexOf("function Onboarding"), APP.indexOf("function Onboarding") + 8000);
  const boutons = [...zone.matchAll(/disabled=\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(boutons.length >= 3, `attendu au moins 3 boutons gardes, vu ${boutons.length}`);
  for (const b of boutons) {
    assert.match(b, /busy/, `un bouton de l'accueil n'est pas garde pendant une action : ${b}`);
  }
});

// --- 2. « Termine les six etapes ci-dessus » ---
// Le bandeau est global : la fenetre s'ouvre depuis la Fosse, la Forge, n'importe
// ou. « Ci-dessus » ne designe alors rien du tout — il faut nommer l'endroit.
test("le message de parcours verrouille nomme l'onglet au lieu de dire « ci-dessus »", () => {
  const m = I18N.match(/\bDISC_CRYPTO_LOCKED:\s*\{[^}]*\}/);
  assert.ok(m, "DISC_CRYPTO_LOCKED absente");
  const bloc = m[0];
  for (const mot of ["ci-dessus", "above", "以上"]) {
    assert.ok(!bloc.includes(mot),
      `« ${mot} » suppose que le joueur est sur l'onglet Quetes, ce que rien ne garantit`);
  }
  // Chaque langue doit nommer l'onglet avec le libelle de NAV_QUESTS.
  for (const [lang, nom] of [["FR", "Quêtes"], ["EN", "Quests"], ["ZH", "任务"]]) {
    const t = bloc.match(new RegExp(lang + ':\\s*"([^"]*)"'));
    assert.ok(t && t[1].includes(nom), `${lang} ne nomme pas l'onglet « ${nom} »`);
  }
});
