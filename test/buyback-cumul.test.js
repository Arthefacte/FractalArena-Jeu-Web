// test/buyback-cumul.test.js
// Le compteur « FA rachetés » du bandeau ne doit JAMAIS reculer devant le joueur.
//
// Constaté le 2026-09-17 : quand /dex/status échoue, le bandeau retombait sur la
// somme des tranches de la base (plus faible que le cumul on-chain, qui compte
// aussi les restes sous-seuil) sous un libellé inchangé. Le nombre « depuis le
// lancement » reculait d'un relevé à l'autre.
//
// Tests PURS sur les helpers exposés sur window par buyback.jsx (même pattern que
// buybackFraction) : pas de React, le .jsx est transpilé ici comme le fait
// tools/precompile.mjs, puis exécuté avec un `window` vide.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "buyback.jsx"), "utf8");

function chargerHelpers() {
  const Babel = require("@babel/standalone");
  const code = Babel.transform(SRC, { presets: ["react"], filename: "buyback.jsx", sourceType: "script" }).code;
  const win = {};
  // React n'est touché qu'à l'intérieur des composants : un stub vide suffit.
  new Function("window", "React", code)(win, {});
  return win;
}

const W = chargerHelpers();
const { resolveBoughtTotal, lireCumulOnChain, ecrireCumulOnChain, plancherCumul, BB_CUMUL_KEY } = W;

// Faux localStorage minimal, en mémoire.
function memoire(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m,
  };
}
// localStorage qui lève à la lecture ET à l'écriture (mode privé, iframe interstitielle).
const boom = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

test("les helpers sont exposés sur window, comme buybackFraction", () => {
  assert.strictEqual(typeof W.buybackFraction, "function");
  assert.strictEqual(typeof resolveBoughtTotal, "function");
  assert.strictEqual(typeof lireCumulOnChain, "function");
  assert.strictEqual(typeof ecrireCumulOnChain, "function");
  assert.strictEqual(typeof plancherCumul, "function");
  assert.strictEqual(BB_CUMUL_KEY, "fa:buyback-cumul-onchain");
});

// 1. onchain prioritaire quand > 0, même si les tranches sont plus grandes.
test("onchain prioritaire quand > 0, même si tranches est plus grand", () => {
  const r = resolveBoughtTotal({ onchain: 1000, tranches: 5000, stored: 3000 });
  assert.deepStrictEqual(r, { value: 1000, source: "onchain" });
});

// 2. stored utilisé quand onchain est 0.
test("stored utilisé quand onchain vaut 0", () => {
  const r = resolveBoughtTotal({ onchain: 0, tranches: 900, stored: 1200 });
  assert.deepStrictEqual(r, { value: 1200, source: "stored" });
});

// 3. tranches en dernier recours.
test("tranches en dernier recours, source « tranches »", () => {
  const r = resolveBoughtTotal({ onchain: 0, tranches: 900, stored: 0 });
  assert.deepStrictEqual(r, { value: 900, source: "tranches" });
});

// 4. onchain non numérique / null / undefined → ne lève pas, retombe proprement.
test("onchain non numérique, null ou undefined : pas d'exception, repli propre", () => {
  for (const mauvais of ["abc", null, undefined, NaN, {}, [], "", true]) {
    let r;
    assert.doesNotThrow(() => { r = resolveBoughtTotal({ onchain: mauvais, tranches: 700, stored: 0 }); }, `onchain=${String(mauvais)}`);
    assert.deepStrictEqual(r, { value: 700, source: "tranches" }, `onchain=${String(mauvais)}`);
  }
  // Sans argument du tout : rien ne casse, zéro affiché.
  assert.doesNotThrow(() => resolveBoughtTotal());
  assert.doesNotThrow(() => resolveBoughtTotal({}));
  assert.deepStrictEqual(resolveBoughtTotal({}), { value: 0, source: "tranches" });
  // Une chaîne numérique venue du stockage est acceptée.
  assert.deepStrictEqual(resolveBoughtTotal({ onchain: 0, tranches: 1, stored: "1200" }), { value: 1200, source: "stored" });
});

// 5. jamais de valeur négative ni de NaN.
test("jamais de valeur négative ni de NaN", () => {
  const cas = [
    { onchain: -5, tranches: -3, stored: -1 },
    { onchain: NaN, tranches: NaN, stored: NaN },
    { onchain: "x", tranches: "y", stored: "z" },
    { onchain: -Infinity, tranches: Infinity, stored: -Infinity },
    { onchain: Infinity, tranches: 0, stored: 0 },
  ];
  for (const c of cas) {
    const r = resolveBoughtTotal(c);
    assert.ok(Number.isFinite(r.value), `NaN/Infinity pour ${JSON.stringify(c)}`);
    assert.ok(r.value >= 0, `négatif pour ${JSON.stringify(c)}`);
    assert.ok(["onchain", "stored", "tranches"].includes(r.source));
  }
});

// 6. localStorage qui lève à la lecture ET à l'écriture ne casse pas la résolution.
test("un localStorage qui lève à la lecture et à l'écriture ne casse rien", () => {
  let stored;
  assert.doesNotThrow(() => { stored = lireCumulOnChain(boom); });
  assert.strictEqual(stored, 0);
  assert.doesNotThrow(() => ecrireCumulOnChain(boom, 1234));
  assert.strictEqual(ecrireCumulOnChain(boom, 1234), false);
  const r = resolveBoughtTotal({ onchain: 0, tranches: 800, stored });
  assert.deepStrictEqual(r, { value: 800, source: "tranches" });
  // localStorage absent (null / undefined) : même comportement.
  assert.strictEqual(lireCumulOnChain(null), 0);
  assert.strictEqual(lireCumulOnChain(undefined), 0);
  assert.strictEqual(ecrireCumulOnChain(null, 5), false);
});

test("lireCumulOnChain lit la clé fa:buyback-cumul-onchain et ignore le bruit", () => {
  assert.strictEqual(lireCumulOnChain(memoire({ "fa:buyback-cumul-onchain": "1060000" })), 1060000);
  assert.strictEqual(lireCumulOnChain(memoire({ "fa:buyback-cumul-onchain": "garbage" })), 0);
  assert.strictEqual(lireCumulOnChain(memoire({ "fa:buyback-cumul-onchain": "-42" })), 0);
  assert.strictEqual(lireCumulOnChain(memoire({})), 0);
});

test("ecrireCumulOnChain n'écrit que des valeurs > 0 et ne fait jamais reculer la valeur stockée", () => {
  const st = memoire({});
  assert.strictEqual(ecrireCumulOnChain(st, 0), false);
  assert.strictEqual(ecrireCumulOnChain(st, -1), false);
  assert.strictEqual(ecrireCumulOnChain(st, NaN), false);
  assert.strictEqual(st._m.size, 0);
  assert.strictEqual(ecrireCumulOnChain(st, 1000), true);
  assert.strictEqual(lireCumulOnChain(st), 1000);
  // Une valeur plus faible ne remplace pas la plus haute connue.
  assert.strictEqual(ecrireCumulOnChain(st, 500), false);
  assert.strictEqual(lireCumulOnChain(st), 1000);
  assert.strictEqual(ecrireCumulOnChain(st, 1500), true);
  assert.strictEqual(lireCumulOnChain(st), 1500);
});

// Critère d'acceptation 3 : scénario de bout en bout.
test("bout en bout : onchain=1060000 puis onchain=0 → toujours 1060000, source stored", () => {
  const st = memoire({});
  const tranches = 1020000;
  // Premier relevé : /dex/status répond.
  const r1 = resolveBoughtTotal({ onchain: 1060000, tranches, stored: lireCumulOnChain(st) });
  assert.deepStrictEqual(r1, { value: 1060000, source: "onchain" });
  ecrireCumulOnChain(st, r1.value);
  // Relevé suivant : /dex/status échoue.
  const r2 = resolveBoughtTotal({ onchain: 0, tranches, stored: lireCumulOnChain(st) });
  assert.deepStrictEqual(r2, { value: 1060000, source: "stored" });
});

// Critère d'acceptation 4 : sans on-chain ni mémoire, la somme des tranches sous son propre libellé.
test("bout en bout : onchain=0 et aucun stored → tranches, libellé BB_BOUGHT_SUB_DB", () => {
  const r = resolveBoughtTotal({ onchain: 0, tranches: 1020000, stored: lireCumulOnChain(memoire({})) });
  assert.deepStrictEqual(r, { value: 1020000, source: "tranches" });
  assert.strictEqual(W.cleLibelleCumul(r.source), "BB_BOUGHT_SUB_DB");
  assert.strictEqual(W.cleLibelleCumul("onchain"), "BB_BOUGHT_SUB");
  assert.strictEqual(W.cleLibelleCumul("stored"), "BB_BOUGHT_SUB");
});

// Règle dure : d'un rendu à l'autre, le nombre affiché ne diminue jamais.
test("plancherCumul : la valeur affichée ne recule jamais d'un rendu à l'autre", () => {
  const a = plancherCumul(null, { value: 1060000, source: "onchain" });
  assert.deepStrictEqual(a, { value: 1060000, source: "onchain" });
  // Le parent re-rend avec une valeur plus faible : on garde la précédente (et sa source).
  const b = plancherCumul(a, { value: 1020000, source: "tranches" });
  assert.deepStrictEqual(b, { value: 1060000, source: "onchain" });
  // Une valeur plus haute passe.
  const c = plancherCumul(b, { value: 1070000, source: "onchain" });
  assert.deepStrictEqual(c, { value: 1070000, source: "onchain" });
  // Égalité : la nouvelle résolution (source à jour) l'emporte.
  const d = plancherCumul(c, { value: 1070000, source: "stored" });
  assert.deepStrictEqual(d, { value: 1070000, source: "stored" });
  // Entrées douteuses : jamais de NaN, jamais de négatif.
  const e = plancherCumul(c, { value: NaN, source: "onchain" });
  assert.deepStrictEqual(e, c);
  assert.deepStrictEqual(plancherCumul(undefined, undefined), { value: 0, source: "tranches" });
});

// Le composant doit réellement câbler ces helpers (pas de logique dupliquée inline).
test("BuybackTicker utilise resolveBoughtTotal, le plancher et le libellé selon la source", () => {
  const corps = SRC.slice(SRC.indexOf("function BuybackTicker("));
  assert.match(corps, /resolveBoughtTotal\(/, "le ticker doit résoudre le cumul via resolveBoughtTotal");
  assert.match(corps, /plancherCumul\(/, "le ticker doit passer par le plancher (ref) pour ne jamais reculer");
  assert.match(corps, /lireCumulOnChain\(/, "le ticker doit relire la dernière valeur on-chain connue au montage");
  assert.match(corps, /ecrireCumulOnChain\(/, "le ticker doit mémoriser la valeur on-chain");
  assert.match(corps, /cleLibelleCumul\(/, "le libellé doit dépendre de la source");
  assert.ok(!/I\.t\("BB_BOUGHT_SUB",/.test(corps), "plus de libellé on-chain codé en dur : il dépend de la source");
  // Les chiffres du 17/09 ne sont écrits nulle part dans le code.
  assert.ok(!/1060000|1 060 000|1020000|1 020 000|883394|883 394/.test(SRC), "aucun chiffre en dur : tout vient du serveur");
});
