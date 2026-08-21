// test/quiz-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../quiz-ui.js");
const {
  QUIZ_INTERVAL_MS, QUIZ_TOAST_MS,
  shouldAsk, nextDueAt, tickerItems, restantSecondes,
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

// ---- tickerItems : la matière de la tape des dons (remplace tickerLine, qui
// figeait le bandeau sur dons[0] — constat joueur du 11/08). Items structurés,
// le rendu (quiz.jsx) formate via i18n.

test("les dons d'un meme joueur s'agregent (somme), ordre de premiere apparition", () => {
  const items = tickerItems({ dons: [
    { nom: "Kevin", amount: 10 }, { nom: "Ana", amount: 20 }, { nom: "Kevin", amount: 30 },
  ], total: 0 });
  assert.deepStrictEqual(items, [
    { type: "don", nom: "Kevin", amount: 40 },
    { type: "don", nom: "Ana", amount: 20 },
  ]);
});

test("le cumul communautaire ferme le cycle quand il est positif", () => {
  const items = tickerItems({ dons: [{ nom: "Kevin", amount: 10 }], total: 500 });
  assert.deepStrictEqual(items[items.length - 1], { type: "total", total: 500 });
});

test("aucun don : le cumul seul, jamais un faux joueur", () => {
  assert.deepStrictEqual(tickerItems({ dons: [], total: 12340 }),
    [{ type: "total", total: 12340 }]);
});

test("au plus 8 donateurs sur la tape", () => {
  const dons = Array.from({ length: 12 }, (_, i) => ({ nom: "J" + i, amount: 5 }));
  const items = tickerItems({ dons, total: 0 });
  assert.strictEqual(items.length, 8);
});

test("donnees absentes ou degenerees : liste vide, jamais une exception", () => {
  assert.deepStrictEqual(tickerItems(null), []);
  assert.deepStrictEqual(tickerItems({ dons: [], total: 0 }), []);
  assert.deepStrictEqual(tickerItems({ dons: [{ nom: "", amount: 10 }, { nom: "Ana", amount: "x" }], total: 0 }),
    [], "nom vide ou montant non numerique : ignores, pas affiches");
});

// La pastille ❓ du header est COLLANTE : elle s'allume quand shouldAsk le dit,
// mais ne s'éteint plus toute seule. Sans ça elle clignotait (constat joueur,
// 21/08) — shouldAsk retombe à false dès qu'un .overlay entre dans le DOM
// (modale, combat d'Arène) et se rallume à sa fermeture, une fois par seconde.
// Ce test verrouille la règle d'accumulation appliquée dans quiz.jsx.
function pastille(overlays, wallet = "w1") {
  let pret = false;
  return overlays.map((busy) => {
    const etat = { lastAskAt: 0, toastOpen: false, busy, wallet };
    pret = !etat.wallet ? false : pret || shouldAsk(etat, 999999);
    return pret ? 1 : 0;
  });
}

test("la pastille ne clignote pas quand une surcouche va et vient", () => {
  const overlays = [false, false, true, true, false, true, false];
  // Sans accumulation, shouldAsk suit l'overlay : 1100101 — c'est le clignotement.
  assert.deepStrictEqual(overlays.map((b) => (shouldAsk({ lastAskAt: 0, toastOpen: false, busy: b, wallet: "w1" }, 999999) ? 1 : 0)),
    [1, 1, 0, 0, 1, 0, 1]);
  // Avec accumulation, elle reste allumée.
  assert.deepStrictEqual(pastille(overlays), [1, 1, 1, 1, 1, 1, 1]);
});

test("la pastille s'allume meme si le premier tick tombe pendant une surcouche", () => {
  assert.deepStrictEqual(pastille([true, true, false]), [0, 0, 1]);
});

test("la deconnexion eteint la pastille", () => {
  assert.deepStrictEqual(pastille([false, false], null), [0, 0]);
});
