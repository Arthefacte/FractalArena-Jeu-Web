// Le nom affiché du joueur est décidé par le SERVEUR (`save.display_name`, names.js).
// Lui seul sait si `wallet_address` est un portefeuille que le joueur possède ou une
// adresse fabriquée à la création d'un compte « sans wallet ». Le client qui recalcule
// « bc1qxx…yyyy » depuis l'adresse du compte réaffiche donc, pour ces joueurs, un
// portefeuille qui n'est pas le leur — et continue de l'afficher après qu'ils ont lié
// le vrai. Ces tests interdisent la fabrication locale.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");
const SCREENS = read("screens.jsx");
const ARENE = read("arene.jsx");

// account-ui.js est une IIFE qui écrit sur `window` (même chargement que test/account-ui.test.js).
function loadACC() {
  const mkStore = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  const win = { localStorage: mkStore(), sessionStorage: mkStore() };
  new Function("window", "localStorage", "sessionStorage", read("account-ui.js"))(win, win.localStorage, win.sessionStorage);
  return win.FA_ACCOUNT;
}

// Repli hors-ligne : quand le serveur n'a pas répondu, il n'y a pas de display_name.
test("hors-ligne : un compte généré n'affiche AUCUN nom plutôt que son adresse serveur", () => {
  const ACC = loadACC();
  assert.strictEqual(ACC.localDisplayName("bc1qgenerated0000000000000000000000000000", ACC.KIND_GENERATED), "");
});

test("hors-ligne : un compte UniSat affiche son portefeuille — c'est bien le sien", () => {
  const ACC = loadACC();
  const W = "bc1qzjz3gydt9cg6qgsgd8edsu02e99v90ulasgkgv";
  assert.strictEqual(ACC.localDisplayName(W, ACC.KIND_UNISAT), "bc1qzj…gkgv");
  assert.strictEqual(ACC.localDisplayName("", ACC.KIND_UNISAT), "");
});

// « bc1q… » fabriqué à la main : slice(0, 6) + … + slice(-4) sur une adresse.
const FABRIQUE = /\.slice\(\s*0\s*,\s*6\s*\)\s*\+\s*"…"\s*\+\s*\w+\.slice\(\s*-4\s*\)/g;

function blocServerToState() {
  const i = APP.indexOf("function serverToState");
  assert.ok(i > 0, "serverToState introuvable");
  return APP.slice(i, i + 2600);
}

test("serverToState prend le nom du serveur, sans le fabriquer depuis l'adresse", () => {
  const bloc = blocServerToState();
  assert.match(bloc, /save\.display_name/, "le nom affiché doit venir du serveur");
  assert.ok(!FABRIQUE.test(bloc), "aucun nom ne doit être fabriqué depuis l'adresse du compte");
});

test("app.jsx ne fabrique plus aucun nom depuis une adresse", () => {
  // Les branches de repli (404, réseau KO) fabriquaient elles aussi le nom : un compte
  // généré y repassait à son adresse serveur dès la moindre coupure réseau.
  const m = APP.match(FABRIQUE);
  assert.strictEqual(m, null, "restes de fabrication locale : " + (m || []).join(" | "));
});

test("l'écran de compte n'affiche pas l'adresse du compte en guise de nom", () => {
  // screens.jsx repliait sur g.wallet tronqué quand il n'y avait pas d'ordinal.
  const i = SCREENS.indexOf("g.ordinalName");
  assert.ok(i > 0, "bloc du nom introuvable dans screens.jsx");
  const bloc = SCREENS.slice(i - 400, i + 700);
  assert.ok(!FABRIQUE.test(bloc), "l'adresse du compte ne doit pas servir de nom affiché");
  assert.match(bloc, /g\.playerName/, "le nom affiché doit être celui du serveur");
});

test("le chat ne retombe pas sur l'adresse d'un message sans nom", () => {
  // Le nom d'un message est composé et stocké par le serveur. S'il manque, l'adresse
  // du message n'est pas une identité de repli acceptable : pour un compte sans
  // portefeuille, c'est l'adresse fabriquée par le serveur.
  const ROOM = read("roomchat.jsx");
  const i = ROOM.indexOf("function safeName");
  assert.ok(i > 0, "safeName introuvable");
  const bloc = ROOM.slice(i, i + 250);
  assert.ok(!/shortWallet\(/.test(bloc), "safeName ne doit pas replier sur l'adresse");
});

test("le classement d'Arène ne tronque pas « Joueur 48213 »", () => {
  // `.slice(0, 10)` coupait le numéro en plein milieu : « Joueur 482 ».
  const i = ARENE.indexOf("row.name");
  assert.ok(i > 0, "ligne de classement introuvable dans arene.jsx");
  const bloc = ARENE.slice(i, i + 200);
  const m = bloc.match(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/);
  assert.ok(m, "troncature du nom introuvable");
  assert.ok(Number(m[1]) >= 13, `« Joueur NNNNN » fait 12 caractères, troncature à ${m[1]}`);
});
