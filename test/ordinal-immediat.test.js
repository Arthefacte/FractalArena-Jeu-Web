// Le nom ordinal est COMPOSÉ PAR LE SERVEUR (names.js) depuis la colonne
// player_saves.ordinal_name : chat, classements, logs PvP et cartes adverses lisent
// cette colonne. Deux régressions constatées en production le 30/09/2026 :
//
// 1. Le choix du nom n'était écrit qu'à +1,5 s (debounce de l'autosave) : le joueur
//    voyait son nom dans l'écran Options (état local) mais restait son adresse
//    tronquée partout ailleurs jusqu'à un rechargement de la page.
// 2. L'écran Options affichait « Le Grand Le Grand Arthefacte.fb » : le titre payant
//    était préfixé à display_name, qui le contient DÉJÀ (régression v297, #202).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = lire("app.jsx");
const SCREENS = lire("screens.jsx");
const I18N = lire("i18n.js");

// Le bloc de la fonction, de son en-tête à sa fermeture (même méthode que
// test/nom-affiche.test.js : une fenêtre de N caractères casserait au champ suivant).
function bloc(source, entete) {
  const i = source.indexOf(entete);
  assert.ok(i > 0, entete + " introuvable");
  const fin = source.indexOf("\n  }", i);
  return source.slice(i, fin > i ? fin : i + 900);
}

test("le choix du nom ordinal s'écrit en base immédiatement", () => {
  const f = bloc(SCREENS, "function choisirNom");
  assert.match(f, /actions\.saveOrdinalName\(/, "le choix doit passer par l'écriture immédiate");
});

test("aucun chemin de clic ne se contente de l'état local", () => {
  // setOrdinalName ne persistait rien : l'autosave partait 1,5 s plus tard, et
  // toutes les surfaces composées côté serveur gardaient l'ancien nom entre-temps.
  const m = SCREENS.match(/actions\.setOrdinalName\(/g);
  assert.strictEqual(m, null, "screens.jsx ne doit plus appeler setOrdinalName");
});

test("l'écriture immédiate poste bien le nom au serveur", () => {
  const f = bloc(APP, "async saveOrdinalName(name)");
  assert.match(f, /\/vanity\/ordinal-name/, "l'écriture doit viser la route dédiée");
  assert.match(f, /method: "POST"/);
  assert.match(f, /JSON\.stringify\(\{ name \}\)/, "le corps ne porte que le nom choisi");
});

test("l'autosave ne peut plus écrire (ni vider) le nom ordinal", () => {
  // C'est le vecteur de l'effacement du 30/09/2026 : au chargement, l'état local repart
  // sans nom ; un autosave parti avant la lecture de la sauvegarde écrivait "" en base.
  const i = APP.indexOf("function stateToServer");
  assert.ok(i > 0, "stateToServer introuvable");
  const blocState = APP.slice(i, APP.indexOf("\n}", i));
  assert.ok(!/^\s*ordinal_name\s*:/m.test(blocState), "stateToServer ne doit plus transporter ordinal_name");
  const f = bloc(APP, "async saveOrdinalName(name)");
  // La PREMIÈRE requête du geste doit viser la route dédiée : le nom ne repasse plus par
  // POST /save (l'autosave, qui repartait d'un état local vide au chargement de la page).
  const url = f.match(/fetch\(`\$\{API_URL\}([^`]*)`/);
  assert.ok(url, "aucune requête dans saveOrdinalName");
  assert.strictEqual(url[1], "/vanity/ordinal-name", "le geste doit écrire sur la route dédiée");
});

test("les deux boutons de l'écran Options passent par le même chemin", () => {
  // La sélection d'une inscription ET le retour à l'adresse du wallet.
  const appels = SCREENS.match(/choisirNom\(/g) || [];
  assert.ok(appels.length >= 3, "choisirNom doit être défini et appelé par les deux boutons");
});

test("l'écran Options ne double pas le titre payant", () => {
  // display_name (« Le Grand Arthefacte.fb ») contient déjà player_title : le préfixer
  // encore donnait « Le Grand Le Grand Arthefacte.fb ».
  const i = SCREENS.indexOf("OP_ORDINAL\"");
  assert.ok(i > 0, "ligne du nom ordinal introuvable");
  const zone = SCREENS.slice(i, i + 1600);
  assert.ok(!/g\.playerTitle \? g\.playerTitle/.test(zone),
    "le titre payant ne doit plus être préfixé au nom serveur");
  assert.match(zone, /const nom = g\.playerName \|\| g\.ordinalName/,
    "le nom affiché doit venir du serveur (display_name), pas d'un assemblage client");
});

test("l'échec d'écriture est dit au joueur dans les trois langues", () => {
  assert.match(I18N, /OP_ORDINAL_SAVE_FAIL: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/,
    "clé i18n OP_ORDINAL_SAVE_FAIL incomplète");
});
