// test/api-echecs.test.js — audit 22/09/2026 : le chemin « serveur injoignable » de
// l'écran réseau était mort (app.jsx passait `echecsApi: 0` en dur, alors que le
// commentaire promettait de compter les échecs consécutifs). On teste ici la partie pure
// du compteur ET le câblage, parce qu'un compteur correct branché à zéro ne sert à rien.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../pwa-ui.js");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("compteur d'échecs : des échecs rapprochés s'accumulent, une réussite remet à zéro", () => {
  let e = { n: 0, dernier: 0 };
  e = P.majCompteurEchecs(e, "echec", 1000);
  e = P.majCompteurEchecs(e, "echec", 2000);
  e = P.majCompteurEchecs(e, "echec", 3000);
  assert.strictEqual(e.n, 3);
  e = P.majCompteurEchecs(e, "ok", 4000);
  assert.strictEqual(e.n, 0, "une réponse du serveur efface l'ardoise");
});

test("compteur d'échecs : un échec isolé (hors fenêtre) ne s'accumule pas", () => {
  let e = { n: 0, dernier: 0 };
  e = P.majCompteurEchecs(e, "echec", 1000);
  e = P.majCompteurEchecs(e, "echec", 1000 + P.ECHECS_FENETRE + 1);
  assert.strictEqual(e.n, 1, "un 500 passager d'il y a 10 minutes ne compte plus");
});

test("un seul échec passager n'affiche PAS l'écran serveur-injoignable", () => {
  let e = P.majCompteurEchecs({ n: 0, dernier: 0 }, "echec", 1000);
  assert.strictEqual(P.etatReseau({ online: true, echecsApi: e.n }), "ok");
});

test("trois échecs consécutifs affichent serveur-injoignable, et le hors-ligne reste prioritaire", () => {
  let e = { n: 0, dernier: 0 };
  for (let i = 1; i <= P.ECHECS_AVANT_ALERTE; i++) e = P.majCompteurEchecs(e, "echec", i * 100);
  assert.strictEqual(P.etatReseau({ online: true, echecsApi: e.n }), "serveur-injoignable");
  assert.strictEqual(P.etatReseau({ online: false, echecsApi: e.n }), "hors-ligne");
});

test("câblage : app.jsx passe le compteur RÉEL (plus de 0 en dur) et s'abonne à ses mises à jour", () => {
  assert.match(APP, /etatReseau\(\{ online: enLigne, echecsApi: echecsApi \}\)/,
    "le compteur doit être branché sur etatReseau");
  assert.ok(!/echecsApi: 0/.test(APP), "un 0 en dur rendrait le chemin mort — c'était le bug");
  assert.match(APP, /FA_ECHECS_API_ABONNE = \(n\) => setEchecsApi\(n\)/, "l'écran doit être notifié");
});

test("câblage : seuls un refus réseau, un 502 ou un 504 comptent comme injoignable", () => {
  assert.match(APP, /notreServeur|indexOf\(API_URL\) === 0/, "le compteur ne suit que nos appels");
  assert.match(APP, /rep\.status === 502 \|\| rep\.status === 504/,
    "un 500/503 est une RÉPONSE du serveur (503 = InSwap injoignable), il ne doit pas alerter");
  assert.match(APP, /window\.fetch = function/, "l'instrumentation doit être posée une fois");
});
