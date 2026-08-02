// test/token-app-installee.test.js
//
// Le jeton d'un compte UniSat vivait en sessionStorage, effacé à la fermeture.
// La justification écrite dans le code était : « un compte UniSat peut re-signer
// silencieusement à tout moment ».
//
// EN APPLICATION INSTALLÉE, CETTE PRÉMISSE EST FAUSSE. La popup d'approbation
// d'UniSat ne s'affiche pas dans une fenêtre standalone (ni barre d'adresse, ni
// barre d'extensions pour aller la chercher) : le joueur ne PEUT pas re-signer.
// Il se retrouvait donc à ne plus pouvoir combattre à chaque relance.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function load(opts) {
  const o = opts || {};
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  function mkStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
  const win = {
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    navigator: {},
    matchMedia: (q) => ({ matches: !!o.installee && /standalone/.test(q) }),
  };
  const fn = new Function("window", "localStorage", "sessionStorage", src);
  fn(win, win.localStorage, win.sessionStorage);
  return { A: win.FA_ACCOUNT, win };
}

const CLE = "fa_auth_token";

test("en ONGLET, un jeton UniSat reste en sessionStorage (décision d'audit inchangée)", () => {
  const { A, win } = load({ installee: false });
  A.writeToken("tok", A.KIND_UNISAT);
  assert.strictEqual(win.sessionStorage.getItem(CLE), "tok");
  assert.strictEqual(win.localStorage.getItem(CLE), null,
    "en onglet la popup fonctionne : rien ne justifie de faire survivre le jeton");
});

test("en APPLICATION INSTALLÉE, un jeton UniSat survit à la fermeture", () => {
  const { A, win } = load({ installee: true });
  A.writeToken("tok", A.KIND_UNISAT);
  assert.strictEqual(win.localStorage.getItem(CLE), "tok",
    "sans ça, le joueur doit re-signer à chaque lancement — or il ne peut pas, la popup ne s'affiche pas");
});

test("iOS installé (navigator.standalone) est traité pareil", () => {
  const { A, win } = load({ installee: false });
  win.navigator.standalone = true;
  A.writeToken("tok", A.KIND_UNISAT);
  assert.strictEqual(win.localStorage.getItem(CLE), "tok");
});

test("jamais deux jetons en vie à la fois", () => {
  for (const installee of [true, false]) {
    const { A, win } = load({ installee });
    A.writeToken("tok", A.KIND_UNISAT);
    const dans = [win.localStorage.getItem(CLE), win.sessionStorage.getItem(CLE)].filter(Boolean);
    assert.strictEqual(dans.length, 1,
      `installee=${installee} : deux jetons coexistent, readToken pourrait rendre le périmé`);
  }
});

test("le jeton reste relisible après écriture, dans les deux contextes", () => {
  for (const installee of [true, false]) {
    const { A } = load({ installee });
    A.writeToken("tok", A.KIND_UNISAT);
    assert.strictEqual(A.readToken(), "tok", `installee=${installee}`);
  }
});

test("clearToken purge les deux stockages", () => {
  const { A, win } = load({ installee: true });
  A.writeToken("tok", A.KIND_UNISAT);
  A.clearToken();
  assert.strictEqual(A.readToken(), "");
  assert.strictEqual(win.localStorage.getItem(CLE), null);
  assert.strictEqual(win.sessionStorage.getItem(CLE), null);
});

test("un compte généré garde localStorage, quel que soit le contexte", () => {
  for (const installee of [true, false]) {
    const { A, win } = load({ installee });
    A.writeToken("tok", A.KIND_GENERATED);
    assert.strictEqual(win.localStorage.getItem(CLE), "tok", `installee=${installee}`);
  }
});

test("l'absence de matchMedia ne fait pas planter (environnements pauvres)", () => {
  const { A, win } = load({ installee: false });
  delete win.matchMedia;
  delete win.navigator;
  assert.doesNotThrow(() => A.writeToken("tok", A.KIND_UNISAT));
  assert.strictEqual(A.readToken(), "tok");
});
