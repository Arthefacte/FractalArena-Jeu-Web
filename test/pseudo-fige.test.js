// `player_name` n'est le pseudo de personne : aucun écran ne permet d'en saisir un. Le
// client y recopiait le nom qu'il fabriquait — « bc1qxx…yyyy » — et POST /save le
// persistait. Constaté en prod le 2026-08-04 : les 8 comptes générés avaient leur
// adresse serveur figée dans cette colonne, et elle repassait DEVANT `display_name`.
// Le correctif du nom affiché (v116) était donc annulé sur leur propre écran.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("le nom affiché ne passe plus par player_name", () => {
  const i = APP.indexOf("function serverToState");
  // Fonction entière, jamais une fenêtre de N caractères : `playerName` était à
  // ~2536 caractères de l'en-tête, donc un seul champ ajouté à l'hydratation le
  // faisait sortir du champ et le test tombait sur du code correct (26/09/2026).
  const fin = APP.indexOf("\n}", i);
  const bloc = APP.slice(i, fin > i ? fin : i + 2600);
  const m = bloc.match(/playerName:\s*([^,\n]+)/);
  assert.ok(m, "playerName introuvable dans serverToState");
  assert.ok(!/player_name/.test(m[1]),
    `un nom figé en base masquerait le nom composé serveur : ${m[1].trim()}`);
  assert.match(m[1], /save\.display_name/, "le nom affiché doit venir du serveur");
});

test("le client ne renvoie plus de player_name au serveur", () => {
  // C'est l'aller-retour qui figeait la valeur : le client fabriquait le nom, /save le
  // persistait, et il revenait ensuite prioritaire sur le nom composé.
  assert.ok(!/player_name:\s*g\.playerName/.test(APP),
    "le nom d'affichage ne doit pas repartir en sauvegarde");
});
