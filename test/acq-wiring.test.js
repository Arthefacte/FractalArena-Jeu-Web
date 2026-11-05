// test/acq-wiring.test.js — origine d'un compte (acquisition) côté web.
//
// Contrat serveur (fractal-arena-server/acq.js, testé) : le corps des trois points
// de création d'un compte (POST /save d'un joueur nouveau, POST /claim-airdrop,
// POST /account/create) peut porter `acq` = { s, m, c, r, p } — les FAITS de la
// première touche. Le serveur en tire le canal (acq_source) et ne l'écrit qu'à
// l'INSERT : jamais sur un resync, jamais sur un compte existant.
//
// Règles tenues ici : capture UNE fois par première touche (localStorage, fenêtre
// de 30 jours), referrer du site ignoré (il dirait « direct » de travers), app
// native déclarée (elle n'envoie aucun referrer), rien d'inventé si l'URL est vide.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");
const HTML = read("index.html");

function memoire() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// Charge le module dans un contexte simulé (window/document/location/localStorage).
function charge({ search = "", referrer = "", hostname = "fractalarena.com", capacitor = false, store = memoire() } = {}) {
  global.window = capacitor ? { Capacitor: { isNativePlatform: () => true } } : {};
  global.location = { search, hostname };
  global.document = { referrer };
  global.localStorage = store;
  delete require.cache[require.resolve("../acq-ui.js")];
  require("../acq-ui.js");
  return { api: global.window.FA_ACQ, store };
}

test("index.html charge acq-ui.js avant le bundle de l'app", () => {
  assert.match(HTML, /<script src="acq-ui\.js\?v=\d+"><\/script>/, "acq-ui.js non chargé");
  assert.ok(HTML.indexOf("acq-ui.js") < HTML.indexOf("build/app.js"), "acq-ui.js doit précéder app.js");
  // Après referral-ui.js : même famille de logique pure, lue au même moment.
  assert.ok(HTML.indexOf("referral-ui.js") < HTML.indexOf("acq-ui.js"), "acq-ui doit suivre referral-ui");
});

test("app.jsx : la première touche est figée au boot, une seule fois, hors state React", () => {
  assert.match(APP, /if \(window\.FA_ACQ\) window\.FA_ACQ\.boot\(\);/, "boot() de la capture manquant");
  // Le module garde lui-même la valeur : rien dans le blob persisté du jeu.
  assert.doesNotMatch(APP, /state\.[a-zA-Z]*acq/i, "l'origine ne doit pas entrer dans l'état persisté");
});

test("app.jsx : le corps de création porte `acq`, via le même refBody() que le parrainage", () => {
  const i = APP.indexOf("const refBody = () => ({");
  assert.ok(i > 0, "refBody() n'a plus la forme attendue");
  const bloc = APP.slice(i, i + 400);
  assert.match(bloc, /FA_ACQ \? window\.FA_ACQ\.payload\(\)/, "acq absent du corps de création");
  assert.match(bloc, /FA_REFERRAL/, "le parrainage doit rester dans le même corps");
  // Le corps n'est construit qu'aux TROIS points de création (jamais sur un resync).
  const appels = (APP.match(/refBody\(\)/g) || []).length;
  assert.strictEqual(appels, 3, "refBody() appelé " + appels + " fois (attendu 3 : /save nouveau, /claim-airdrop, /account/create)");
});

test("première touche : utm_source lu dans l'URL de lancement et mémorisé", () => {
  const { api, store } = charge({ search: "?utm_source=X&utm_medium=post&utm_campaign=lancement" });
  const o = api.boot();
  assert.strictEqual(o.s, "X");
  assert.strictEqual(o.m, "post");
  assert.strictEqual(o.c, "lancement");
  assert.deepStrictEqual(api.payload(), { acq: { s: "X", m: "post", c: "lancement", p: "web" } });
  assert.ok(store.getItem("fa_acq_v1"), "la touche doit être persistée");
});

test("première touche : elle prime sur un retour sans lien (c'est le but)", () => {
  const store = memoire();
  charge({ search: "?utm_source=telegram", store }).api.boot();
  // Trois jours plus tard, retour direct : la touche d'origine est reprise telle quelle.
  const { api } = charge({ search: "", store });
  assert.strictEqual(api.payload().acq.s, "telegram");
});

test("au-delà de 30 jours, une nouvelle touche remplace l'ancienne", () => {
  const store = memoire();
  const { api } = charge({ search: "?utm_source=x", store });
  const vieux = Date.now() - 31 * 24 * 3600 * 1000;
  store.setItem("fa_acq_v1", JSON.stringify({ s: "x", t: vieux }));
  const o = api.capturer("?utm_source=telegram", Date.now());
  assert.strictEqual(o.s, "telegram");
});

test("referrer : seul un referrer EXTERNE compte (le site ne se compte pas lui-même)", () => {
  const { api } = charge({ referrer: "https://t.co/abc123", hostname: "fractalarena.com" });
  assert.strictEqual(api.boot().r, "https://t.co/abc123");
  // Navigation interne / retour direct sur le domaine : rien à déclarer.
  const interne = charge({ referrer: "https://fractalarena.com/earn/", hostname: "fractalarena.com" });
  assert.ok(!interne.api.boot().r, "un referrer du site est une navigation interne");
});

test("app native : la plateforme est déclarée (aucun referrer n'y arrive)", () => {
  const { api } = charge({ capacitor: true });
  api.boot();
  assert.deepStrictEqual(api.payload(), { acq: { p: "app" } });
});

test("URL vide : rien d'inventé (le serveur seul décide de « direct »)", () => {
  const { api } = charge({});
  api.boot();
  assert.deepStrictEqual(api.payload(), { acq: { p: "web" } }, "seule la plateforme est un fait");
});

test("payload() sans capture préalable ne rend rien (jamais de corps bricolé)", () => {
  const { api } = charge({});
  // Aucun boot() : le stockage est vide.
  assert.deepStrictEqual(api.payload(), {});
});

test("la charge reste bornée : pas de pavé d'URL dans le corps de requête", () => {
  const { api } = charge({ search: "?utm_source=" + "z".repeat(500) + "&utm_campaign=" + "c".repeat(500) });
  const acq = api.boot();
  assert.ok(acq.s.length <= 48, "utm_source non borné : " + acq.s.length);
  assert.ok(acq.c.length <= 64, "utm_campaign non borné : " + acq.c.length);
});

test("un stockage hostile (JSON cassé, type inattendu) ne casse pas la capture", () => {
  const store = memoire();
  store.setItem("fa_acq_v1", "{pas du json");
  const { api } = charge({ search: "?utm_source=x", store });
  assert.strictEqual(api.boot().s, "x");
  store.setItem("fa_acq_v1", "[1,2,3]");
  const bis = charge({ search: "?utm_source=telegram", store });
  assert.strictEqual(bis.api.boot().s, "telegram");
  // localStorage indisponible (mode privé strict) : on ne lève pas, on rend la touche.
  global.localStorage = { getItem() { throw new Error("refusé"); }, setItem() { throw new Error("refusé"); } };
  delete require.cache[require.resolve("../acq-ui.js")];
  global.window = {};
  require("../acq-ui.js");
  assert.strictEqual(global.window.FA_ACQ.boot().p, "web");
});
