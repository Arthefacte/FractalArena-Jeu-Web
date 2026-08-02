// test/auth-diagnostic.test.js
//
// authenticate() attrapait TOUTE erreur et rendait "" sans rien dire. Résultat :
// extension absente, extension verrouillée, signature refusée, serveur en panne
// — quatre causes très différentes donnaient le MÊME symptôme muet, et on a
// diagnostiqué à l'aveugle (une régression à la clé, cf. v111→v112).
// Ces tests fixent la règle : chaque échec doit être NOMMÉ.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  function mkStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
  const win = { localStorage: mkStore(), sessionStorage: mkStore() };
  const fn = new Function("window", "localStorage", "sessionStorage", src);
  fn(win, win.localStorage, win.sessionStorage);
  return win.FA_ACCOUNT;
}

test("chaque étape d'échec a sa propre clé i18n", () => {
  const A = load();
  const vus = new Set();
  for (const etape of ["extension", "challenge", "signature", "verify"]) {
    const r = A.authFailure(etape, null, 0);
    assert.ok(r && r.cle, `étape ${etape} sans clé`);
    assert.match(r.cle, /^AUTHDIAG_/, `${etape} : la clé doit être une clé i18n`);
    assert.ok(!vus.has(r.cle), `${etape} réutilise la clé ${r.cle} — les causes doivent être distinguables`);
    vus.add(r.cle);
  }
});

test("une extension verrouillée se distingue d'une signature refusée", () => {
  const A = load();
  const verrouille = A.authFailure("signature", { message: "Wallet is locked" }, 0);
  const refuse = A.authFailure("signature", { message: "User rejected the request." }, 0);
  assert.notStrictEqual(verrouille.cle, refuse.cle,
    "verrouillé et refusé demandent deux gestes différents au joueur : les confondre le laisse sans solution");
});

test("le détail technique est conservé pour le diagnostic", () => {
  const A = load();
  const r = A.authFailure("signature", { message: "Wallet is locked" }, 0);
  assert.match(String(r.detail), /locked/i, "le message brut de l'extension doit survivre pour le diagnostic");
});

test("le code HTTP est repris quand le serveur est en cause", () => {
  const A = load();
  const r = A.authFailure("verify", null, 401);
  assert.match(String(r.detail), /401/, "le statut HTTP doit apparaître, c'est lui qui oriente vers le serveur");
});

test("une étape inconnue ne fait pas planter et reste nommée", () => {
  const A = load();
  const r = A.authFailure("n-importe-quoi", null, 0);
  assert.ok(r && r.cle, "un échec non prévu doit RESTER signalé, jamais avalé");
});

test("toute clé produite par authFailure existe en i18n, dans les 3 langues", () => {
  const A = load();
  const I18N = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  // Les cas réels rencontrés en production, plus les bornes.
  const cas = [
    ["extension", null, 0], ["challenge", null, 503], ["verify", null, 401],
    ["signature", { message: "Wallet is locked" }, 0],
    ["signature", { message: "User rejected the request." }, 0],
    ["signature", { message: "boom" }, 0],
    ["etape-imprevue", null, 0],
  ];
  const cles = new Set(cas.map((c) => A.authFailure(c[0], c[1], c[2]).cle));
  cles.add("AUTHDIAG_TITLE"); // posée par callFight
  for (const cle of cles) {
    const m = I18N.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
    assert.ok(m, `${cle} est produite par le code mais absente d'i18n.js — le joueur verrait un message vide`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(m[0], new RegExp(lang + ':\\s*"[^"]+"'), `${cle} : ${lang} vide ou manquant`);
    }
  }
});

// ---- Câblage dans app.jsx (le JSX n'est pas requérable) ----

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("authenticate ne renvoie plus un échec muet", () => {
  const i = APP.indexOf("async authenticate(");
  const bloc = APP.slice(i, i + 1600);
  assert.match(bloc, /authFailure/,
    "chaque sortie en échec d'authenticate doit nommer sa cause");
  assert.match(bloc, /console\.(error|warn)/,
    "la cause doit aussi partir en console : c'est la seule trace exploitable dans une fenêtre PWA");
});

test("le joueur voit la raison, pas seulement la console", () => {
  const i = APP.indexOf("async callFight(");
  const bloc = APP.slice(i, i + 900);
  assert.match(bloc, /authReason|lastAuthReason/,
    "le refus de combattre doit porter la raison réelle, sinon le joueur reste devant un mur sans explication");
});

test("callFight ne rappelle PAS authenticate (régression v111)", () => {
  const i = APP.indexOf("async callFight(");
  const bloc = APP.slice(i, i + 900);
  assert.ok(!/await actions\.authenticate/.test(bloc),
    "v111 : signMessage ne rendait jamais la main dans la PWA et le combat restait suspendu — ne pas réintroduire");
});
