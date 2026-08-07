// test/quiz-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../quiz-ui.js");
const {
  QUIZ_INTERVAL_MS, QUIZ_TOAST_MS,
  shouldAsk, nextDueAt, tickerLine, restantSecondes,
} = globalThis.window.FA_QUIZ_UI;

const base = { lastAskAt: 0, toastOpen: false, busy: false, wallet: "w1" };

test("cadence et duree de toast conformes a la spec", () => {
  assert.strictEqual(QUIZ_INTERVAL_MS, 30000);
  assert.strictEqual(QUIZ_TOAST_MS, 30000);
});

test("demande une question quand le delai est ecoule", () => {
  assert.strictEqual(shouldAsk(base, 30000), true);
  assert.strictEqual(shouldAsk(base, 29999), false);
});

test("jamais deux toasts a l'ecran", () => {
  assert.strictEqual(shouldAsk({ ...base, toastOpen: true }, 999999), false);
});

test("jamais pendant un combat, une cinematique ou une signature", () => {
  assert.strictEqual(shouldAsk({ ...base, busy: true }, 999999), false);
});

test("jamais sans joueur connecte", () => {
  assert.strictEqual(shouldAsk({ ...base, wallet: null }, 999999), false);
  assert.strictEqual(shouldAsk(null, 999999), false);
});

test("nextDueAt repousse d'un intervalle plein", () => {
  assert.strictEqual(nextDueAt(1000), 31000);
});

// Le decompte est la seule horloge de la bulle : ce que le joueur lit a l'ecran
// est exactement ce qui declenchera la fermeture. Deux minuteries separees se
// desynchroniseraient, et la bulle disparaitrait avant la fin du compte.
test("le decompte part de 30 s", () => {
  assert.strictEqual(restantSecondes(30000, 0), 30);
});

test("le decompte arrondit vers le haut : 0 s ne s'affiche qu'a la fermeture", () => {
  assert.strictEqual(restantSecondes(30000, 29001), 1);
  assert.strictEqual(restantSecondes(30000, 29999), 1);
});

test("le decompte ne descend jamais sous zero", () => {
  assert.strictEqual(restantSecondes(30000, 30000), 0);
  assert.strictEqual(restantSecondes(30000, 45000), 0, "jamais de secondes negatives");
});

// Cote serveur, POST /quiz/donate refuse au-dela de DONATE_WINDOW_MS = 60 s :
// le decompte doit expirer avant, sinon « Offrir » serait un bouton qui echoue.
test("la bulle se ferme avant l'expiration de la fenetre de don du serveur", () => {
  assert.ok(QUIZ_TOAST_MS < 60000, "au-dela de 60 s, offrir echoue cote serveur");
});

test("le ticker montre les dons quand il y en a", () => {
  const t = (k, ...a) => (k === "QUIZ_TICKER_DON" ? `${a[0]} a offert ${a[1]} FA` : `total ${a[0]}`);
  assert.strictEqual(tickerLine({ dons: [{ nom: "Kevin", amount: 10 }], total: 500 }, t),
    "Kevin a offert 10 FA");
});

test("aucun don : cumul communautaire, jamais un faux joueur", () => {
  const t = (k, ...a) => (k === "QUIZ_TICKER_DON" ? `${a[0]} a offert ${a[1]} FA` : `total ${a[0]}`);
  assert.strictEqual(tickerLine({ dons: [], total: 12340 }, t), "total 12340");
});

test("donnees absentes : chaine vide, jamais une exception", () => {
  const t = () => "x";
  assert.strictEqual(tickerLine(null, t), "");
  assert.strictEqual(tickerLine({ dons: [], total: 0 }, t), "");
});
