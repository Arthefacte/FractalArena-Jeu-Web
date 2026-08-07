// test/diag.test.js
// La sonde ne doit rien coûter au joueur qui ne l'a pas demandée : sans ?diag=1
// elle sort immédiatement, sans observateur, sans boucle rAF, sans DOM.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const SRC = lire("diag.js");
const HTML = lire("index.html");
const CINE = lire("cinematique.jsx");

function charger(search) {
  const frames = [];
  const win = {
    location: { search },
    devicePixelRatio: 2,
    addEventListener: (ev, fn) => { win._load = fn; },
    matchMedia: () => ({ matches: false }),
  };
  const observes = [];
  const sandbox = {
    window: win,
    // Dans un navigateur, `location` est aussi une globale — la sonde la lit ainsi.
    location: win.location,
    document: { createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} }), body: { appendChild() {} } },
    performance: { now: () => 1, getEntriesByType: () => [], getEntriesByName: () => [] },
    navigator: {}, screen: { width: 400, height: 800 },
    PerformanceObserver: function () { observes.push(1); this.observe = () => {}; },
    requestAnimationFrame: (fn) => { frames.push(fn); },
    matchMedia: () => ({ matches: false }),
  };
  sandbox.globalThis = sandbox;
  const vm = require("node:vm");
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { win, observes, frames };
}

test("sans ?diag=1 : aucun observateur, aucune boucle d'images", () => {
  const { win, observes, frames } = charger("");
  assert.strictEqual(win.FA_DIAG.actif, false);
  assert.strictEqual(observes.length, 0, "un PerformanceObserver a ete pose sans diag=1");
  assert.strictEqual(frames.length, 0, "une boucle requestAnimationFrame tourne sans diag=1");
});

test("sans ?diag=1 : marque() existe et ne coute rien", () => {
  const { win } = charger("");
  assert.strictEqual(typeof win.FA_DIAG.marque, "function");
  assert.doesNotThrow(() => win.FA_DIAG.marque("x")); // appelee par cinematique.jsx en prod
});

test("avec ?diag=1 : la sonde mesure", () => {
  const { win, observes, frames } = charger("?diag=1");
  assert.strictEqual(win.FA_DIAG.actif, true);
  assert.ok(observes.length > 0, "aucune observation des taches longues");
  assert.ok(frames.length > 0, "les images ne sont pas comptees");
});

test("la sonde est le premier script de la page", () => {
  const iDiag = HTML.indexOf("diag.js");
  const iData = HTML.indexOf("data.js");
  assert.ok(iDiag > -1, "diag.js n'est pas charge");
  assert.ok(iDiag < iData, "diag.js doit preceder data.js, sinon il rate le debut du boot");
});

test("la cinematique pose ses jalons", () => {
  for (const jalon of ["three-importe", "renderer-cree", "pmrem-pret", "emblème-charge", "1re-image"]) {
    assert.ok(CINE.includes(jalon), "jalon absent : " + jalon);
  }
  // Toujours garde par `window.FA_DIAG &&` : jamais d'exception si le fichier manque.
  const appels = CINE.match(/FA_DIAG\.marque/g) || [];
  const gardes = CINE.match(/window\.FA_DIAG && window\.FA_DIAG\.marque/g) || [];
  assert.strictEqual(appels.length, gardes.length, "un appel a marque() n'est pas garde");
});
