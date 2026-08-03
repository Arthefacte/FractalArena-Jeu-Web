// test/unisat-provider.test.js
//
// UniSat a introduit window.unisat_wallet PARCE QUE de nombreux portefeuilles
// forkent leur code et injectent eux aussi window.unisat (leur doc :
// unisat-wallet/wallet → docs/api/browser-detection.md). Sur une machine où un
// fork est installé, window.unisat peut donc être un AUTRE portefeuille que celui
// que le joueur croit utiliser.
//
// Ce n'est pas cosmétique : lier un portefeuille est IRRÉVERSIBLE côté jeu, et on
// a déjà vécu un lien posé sur le mauvais compte le 2026-07-30. Signer avec le
// mauvais portefeuille, c'est le même dégât, en pire (le joueur n'a rien fait de
// travers). On interroge donc le global dédié en premier.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function load(globals) {
  const src = lire("account-ui.js");
  function mkStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
  const win = Object.assign({
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    navigator: {},
    matchMedia: () => ({ matches: false }),
  }, globals || {});
  new Function("window", "localStorage", "sessionStorage", src)(win, win.localStorage, win.sessionStorage);
  return win.FA_ACCOUNT;
}

test("provider() préfère window.unisat_wallet quand les deux existent", () => {
  const officiel = { nom: "officiel" };
  const fork = { nom: "fork-qui-a-squatte-window.unisat" };
  const A = load({ unisat_wallet: officiel, unisat: fork });
  assert.strictEqual(A.provider(), officiel,
    "un fork ne doit pas pouvoir capter la signature en occupant window.unisat");
});

test("provider() se replie sur window.unisat (UniSat plus ancien, sans le nouveau global)", () => {
  const ancien = { nom: "unisat-ancienne-version" };
  const A = load({ unisat: ancien });
  assert.strictEqual(A.provider(), ancien,
    "les versions installées aujourd'hui n'exposent que window.unisat — ne pas les casser");
});

test("provider() rend null si aucun portefeuille n'est injecté", () => {
  const A = load({});
  assert.strictEqual(A.provider(), null, "aucun portefeuille = null, jamais undefined");
});

test("hasProvider() dit s'il y a un portefeuille, sans exposer l'objet", () => {
  assert.strictEqual(load({ unisat: {} }).hasProvider(), true);
  assert.strictEqual(load({ unisat_wallet: {} }).hasProvider(), true);
  assert.strictEqual(load({}).hasProvider(), false);
});

// Le garde-fou qui fait tenir le correctif : sans lui, le prochain appel écrit
// window.unisat par habitude et la protection se dissout site par site.
test("aucun écran n'interroge window.unisat en direct", () => {
  for (const f of ["app.jsx", "account.jsx", "screens.jsx", "quests.jsx"]) {
    const src = lire(f);
    const fautes = src.split("\n")
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /window\.unisat\b/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    assert.deepStrictEqual(fautes, [],
      `${f} doit passer par ACC.provider() — window.unisat direct peut être un fork`);
  }
});
