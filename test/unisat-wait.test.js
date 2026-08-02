// test/unisat-wait.test.js
//
// L'extension UniSat injecte `window.unisat` de façon ASYNCHRONE. Tester sa
// présence une seule fois au démarrage est une course — que le jeu perdait
// depuis que la PWA démarre en 1,2 s au lieu de 26 s : pas de signature
// proposée, pas de jeton, et « Connexion UniSat requise pour jouer » au premier
// combat, sans aucun moyen de s'en sortir hormis recharger la page.
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
  // Vrais timers, mais des durées de quelques millisecondes : le test reste
  // instantané tout en exerçant le vrai chemin asynchrone.
  const win = {
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };
  const fn = new Function("window", "localStorage", "sessionStorage", src);
  fn(win, win.localStorage, win.sessionStorage);
  return { A: win.FA_ACCOUNT, win };
}

test("waitForUnisat : rend true tout de suite si l'extension est déjà injectée", async () => {
  const { A, win } = load();
  win.unisat = {};
  const t0 = Date.now();
  assert.strictEqual(await A.waitForUnisat(500, 10), true);
  assert.ok(Date.now() - t0 < 50, "ne doit pas attendre quand l'extension est déjà là");
});

test("waitForUnisat : rend true si l'extension arrive APRÈS le démarrage (le bug)", async () => {
  const { A, win } = load();
  // L'app démarre avant l'injection — exactement la course perdue en PWA.
  setTimeout(() => { win.unisat = {}; }, 40);
  assert.strictEqual(await A.waitForUnisat(1000, 10), true,
    "l'attente doit rattraper une injection tardive, sinon le joueur reste bloqué toute la session");
});

test("waitForUnisat : rend false au bout du délai si rien n'est jamais injecté", async () => {
  const { A } = load();
  const t0 = Date.now();
  assert.strictEqual(await A.waitForUnisat(60, 10), false,
    "sans extension (mobile, autre navigateur) l'attente doit RENDRE LA MAIN, jamais bloquer le démarrage");
  assert.ok(Date.now() - t0 >= 50, "doit avoir réellement patienté avant de conclure");
});

test("waitForUnisat : ne laisse aucun timer derrière lui", async () => {
  const { A, win } = load();
  let vivants = 0;
  win.setInterval = (fn, ms) => { vivants++; return setInterval(fn, ms); };
  win.clearInterval = (id) => { vivants--; clearInterval(id); };
  await A.waitForUnisat(40, 10);          // cas timeout
  win.unisat = {};
  await A.waitForUnisat(40, 10);          // cas succès immédiat
  setTimeout(() => { win.unisat = {}; }, 15);
  delete win.unisat;
  await A.waitForUnisat(200, 10);         // cas succès tardif
  assert.strictEqual(vivants, 0, "un intervalle non nettoyé fuit à chaque tentative de connexion");
});

// ---- Câblage dans app.jsx (source : le JSX n'est pas requérable) ----

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("authenticate attend l'extension au lieu de conclure au premier coup d'œil", () => {
  const i = APP.indexOf("async authenticate(");
  assert.ok(i > 0, "authenticate introuvable");
  const bloc = APP.slice(i, i + 700);
  assert.match(bloc, /waitForUnisat|ACC\.waitForUnisat/,
    "authenticate doit ATTENDRE window.unisat : le test unique est la course qui bloque le joueur");
});

test("callFight tente une signature au lieu de refuser sèchement sans jeton", () => {
  const i = APP.indexOf("async callFight(");
  assert.ok(i > 0, "callFight introuvable");
  const bloc = APP.slice(i, i + 900);
  const iRefus = bloc.indexOf("Connexion UniSat requise");
  if (iRefus > 0) {
    const avant = bloc.slice(0, iRefus);
    assert.match(avant, /authenticate/,
      "sans jeton, il faut TENTER une signature avant de refuser — sinon le joueur est dans une impasse dont seul un rechargement le sort");
  }
});
