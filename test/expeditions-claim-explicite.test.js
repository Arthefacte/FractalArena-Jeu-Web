// test/expeditions-claim-explicite.test.js
// Le butin d'expédition se RÉCLAME : il ne doit jamais être crédité par un clic
// de consultation. Historiquement la carte de monde « À réclamer » de la vue
// destination appelait claim(e) directement — un joueur qui croyait ouvrir sa
// carte recevait le butin (tirage définitif, crédité en transaction) sans avoir
// rien réclamé. La règle : la carte OUVRE le suivi, le bouton Réclamer de la vue
// suivi encaisse. Verrouillage au niveau source, comme exp-fx-cards.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "expeditions.jsx"), "utf8");
const fnBody = (name) => {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i >= 0, name + " introuvable");
  const j = src.indexOf("\n  }", i);
  assert.ok(j > i, name + " : fin de fonction introuvable");
  return src.slice(i, j);
};

test("vue destination : la carte de monde ne réclame JAMAIS", () => {
  const dest = fnBody("renderDest");
  assert.doesNotMatch(dest, /claim\s*\(/,
    "la carte de monde ne doit pas appeler claim() : le clic sert à consulter, pas à encaisser");
});

test("vue destination : une carte prête OUVRE le suivi", () => {
  const dest = fnBody("renderDest");
  assert.match(dest, /setView\("track"\)/,
    "une carte prête (ou en cours) doit ouvrir la vue suivi");
});

test("vue destination : l'étiquette d'une carte prête est un ÉTAT, pas un bouton", () => {
  const dest = fnBody("renderDest");
  assert.doesNotMatch(dest, /EXP_CLAIM/,
    "la carte ne doit plus afficher « Réclamer le butin » puisqu'elle n'encaisse plus");
  assert.match(dest, /EXP_STATUS_READY/,
    "la carte prête porte son état (« À réclamer ») et rien de plus");
});

test("vue suivi : le bouton Réclamer reste le SEUL point d'encaissement", () => {
  const track = fnBody("renderTrack");
  assert.match(track, /isReady/);
  assert.match(track, /onClick=\{\(\) => claim\(e\)\}/,
    "le bouton Réclamer de la vue suivi appelle claim(e)");
  // Hors définition de la fonction, un seul appel : celui du bouton.
  const appels = [...src.matchAll(/[^a-zA-Z0-9_$.]claim\s*\(/g)];
  assert.strictEqual(appels.length, 2,
    "attendu : la définition de claim() + l'appel du bouton Réclamer, trouvé " + appels.length + " occurrence(s)");
});

test("aucun encaissement implicite ailleurs : ni effet, ni tick, ni montage", () => {
  // Un claim dans un useEffect / setInterval encaisserait tout seul au retour
  // d'expédition, exactement ce que le joueur a signalé.
  for (const m of src.matchAll(/useEffect\(([\s\S]*?)\n  \}/g)) {
    assert.doesNotMatch(m[1], /claim\s*\(/, "aucun claim ne doit vivre dans un effet");
  }
  assert.doesNotMatch(src, /setInterval\([^)]*claim/, "aucun claim ne doit vivre dans un minuteur");
});
