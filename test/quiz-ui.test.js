// test/quiz-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../quiz-ui.js");
const { QUIZ_INTERVAL_MS, QUIZ_TOAST_MS, shouldAsk, nextDueAt, tickerLine } = globalThis.window.FA_QUIZ_UI;

const base = { lastAskAt: 0, toastOpen: false, busy: false, wallet: "w1" };

test("cadence et duree de toast conformes a la spec", () => {
  assert.strictEqual(QUIZ_INTERVAL_MS, 30000);
  assert.strictEqual(QUIZ_TOAST_MS, 15000);
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
