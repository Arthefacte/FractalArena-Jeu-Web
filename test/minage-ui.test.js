"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");
const M = require("../minage-ui.js");
const I = require("../i18n.js");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("hypothèses fixes du brief et part du joueur ajoutée au dénominateur", () => {
  assert.deepEqual([M.BLOC_MS, M.BLOCS_PAR_JOUR, M.REWARD_FB, M.GH_PAR_COMPTE, M.COMPTES_FALLBACK], [30000, 2880, 6.25, 20, 1000]);
  assert.equal(M.BLOC_MS * M.BLOCS_PAR_JOUR, 86400000);
  assert.equal(M.partReseau(6, M.COMPTES_FALLBACK * M.GH_PAR_COMPTE), 6 / 20006);
  assert.equal(M.partReseau(6, 0), 1);
  assert.equal(M.partReseau(0, 1000), 0);
  assert.equal(M.partReseau(0, 0), null);
  assert.equal(M.partReseau(Number.MAX_VALUE, Number.MAX_VALUE), 0.5);
});

test("repères à 6 et 12 GH/s : part, FB par jour et attente moyenne", () => {
  const autresGh = M.COMPTES_FALLBACK * M.GH_PAR_COMPTE;
  const part6 = M.partReseau(6, autresGh), part12 = M.partReseau(12, autresGh);
  assert.equal(M.formaterProba(part6), "0,030 %");
  assert.equal(M.formaterProba(part12), "0,060 %");
  assert.ok(Math.abs(M.fbParJour(part6) - 5.4) < 0.002);
  assert.ok(Math.abs(M.fbParJour(part12) - 10.8) < 0.007);
  assert.ok(Math.abs(M.tempsMoyenMs(part6) / 86400000 - 1.158) < 0.001);
  assert.ok(Math.abs(M.tempsMoyenMs(part12) / 86400000 - 0.579) < 0.001);
  assert.equal(M.formaterDuree(M.tempsMoyenMs(part6)), "1 jour");
  assert.ok(Math.abs(part12 / part6 - 2) < 0.001);
});

test("espérance FB, probabilité par bloc et sur 24 h, temps moyen", () => {
  assert.equal(M.fbParJour(0), 0);
  assert.equal(M.fbParJour(1), 18000);
  assert.ok(M.fbParJour(0.2) > M.fbParJour(0.1));
  assert.equal(M.probaParBloc(0.032), 0.032);
  assert.equal(M.probaJour(0), 0);
  assert.equal(M.probaJour(1), 1);
  assert.ok(Math.abs(M.probaJour(0.5) - 1) < 1e-12);
  assert.ok(Math.abs(M.probaJour(0.00002) - (1 - Math.pow(1 - 0.00002, 2880))) < 1e-12);
  assert.ok(M.probaJour(1e-20) > 0, "pas d'arrondi à zéro pour une très faible part");
  assert.equal(M.tempsMoyenMs(0), null);
  assert.equal(M.tempsMoyenMs(0.5), 60000);
});

test("toutes les fonctions numériques refusent les entrées invalides sans coercition", () => {
  const functions = [M.fbParJour, M.probaParBloc, M.probaJour, M.tempsMoyenMs, M.formaterProba, M.formaterDuree, M.formaterFb, M.formaterGh, M.formaterNombre];
  for (const input of [NaN, undefined, null, Infinity, -Infinity, -1, "0.5", {}, [], Symbol("x")]) {
    for (const fn of functions) assert.equal(fn(input), null, fn.name);
    assert.equal(M.partReseau(input, 1000), null);
    assert.equal(M.partReseau(5, input), null);
  }
  for (const fn of [M.fbParJour, M.probaParBloc, M.probaJour, M.tempsMoyenMs, M.formaterProba]) assert.equal(fn(1.01), null);
  assert.equal(M.tempsMoyenMs(Number.MIN_VALUE), null);
});

test("probabilités à deux chiffres significatifs, exemples du brief et valeurs extrêmes", () => {
  assert.equal(M.formaterProba(0.0003), "0,030 %");
  assert.equal(M.formaterProba(0.00006), "0,006 %");
  assert.equal(M.formaterProba(0.00002), "0,002 %");
  assert.equal(M.formaterProba(0.00006123), "0,0061 %");
  assert.equal(M.formaterProba(0.000001234), "0,00012 %");
  assert.equal(M.formaterProba(0.00099), "0,099 %");
  assert.equal(M.formaterProba(0.001), "0,10 %");
  assert.equal(M.formaterProba(0.032), "3,2 %");
  assert.equal(M.formaterProba(0.03256), "3,3 %");
  assert.equal(M.formaterProba(0), "0 %");
  assert.equal(M.formaterProba(-0), "0 %");
  assert.equal(M.formaterProba(1), "100 %");
  assert.match(M.formaterProba(Number.MIN_VALUE), /^0,0*[1-9]\d* %$/);
});

test("durées et FB en français", () => {
  assert.equal(M.formaterDuree(72 * 60000), "1 h 12");
  assert.equal(M.formaterDuree(9 * 86400000), "9 jours");
  assert.equal(M.formaterDuree(3 * 365 * 86400000), "3 ans");
  assert.equal(M.formaterDuree(86400000), "1 jour");
  assert.equal(M.formaterDuree(365 * 86400000), "1 an");
  assert.equal(M.formaterDuree(30000), "30 s");
  for (const [n, expected] of [[0.42, "0,42 FB"], [0.003, "0,003 FB"], [12.5, "12,5 FB"], [1.23456, "1,235 FB"], [0.00001, "< 0,001 FB"]]) assert.equal(M.formaterFb(n), expected);
});

test("le formatage est pur et localisé, indépendamment de la langue globale", () => {
  I.setLang("ZH");
  assert.equal(M.formaterProba(0.032), "3,2 %");
  assert.equal(M.formaterProba(0.032, "EN"), "3.2%");
  for (const lang of ["EN", "ZH"]) {
    assert.equal(M.formaterProba(0.0003, lang), "0.030%");
    assert.equal(M.formaterProba(0.00006, lang), "0.006%");
    assert.equal(M.formaterProba(0.00002, lang), "0.002%");
    assert.equal(M.formaterProba(0, lang), "0%");
  }
  assert.equal(M.formaterFb(0.42, "EN"), "0.42 FB");
  assert.equal(M.formaterDuree(9 * 86400000, "EN"), "9 days");
  assert.equal(M.formaterDuree(9 * 86400000, "ZH"), "9 天");
  assert.equal(M.formaterGh(6, "ZH"), "6 GH/s");
  I.setLang("FR");
  for (const [key, translations] of Object.entries(I.T).filter(([k]) => k === "NAV_MINAGE" || k.startsWith("minage."))) {
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(translations[lang], key + " " + lang);
  }
});

function extract(source) {
  source = source.replace(/\r\n/g, "\n");
  const start = source.indexOf("function Minage(");
  const end = source.indexOf("\n}\n", start);
  assert.ok(start >= 0 && end > start, "Minage absent");
  return source.slice(start, end + 2);
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.children)] : [];
}
function textOf(tree) {
  if (Array.isArray(tree)) return tree.map(textOf).join("");
  if (tree && typeof tree === "object") return textOf(tree.children);
  return tree == null || typeof tree === "boolean" ? "" : String(tree);
}
function screen(compiled, raw, lang) {
  let index, detections = 0;
  const states = [];
  const context = { window: {}, fetch() { assert.fail("aucun réseau dans le simulateur"); } };
  vm.createContext(context);
  for (const f of ["i18n.js", "gpu-hashrate.js", "minage-ui.js"]) vm.runInContext(read(f), context);
  const win = context.window;
  win.FA_I18N.setLang(lang);
  win.useFA = () => ({ g: { lang } });
  win.FA_GPU_HASHRATE.detectGpu = () => { detections++; return raw; };
  context.React = {
    Fragment: "Fragment",
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = index++;
      if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
      return [states[i], (next) => { states[i] = next; }];
    },
  };
  Object.assign(context, { useState: context.React.useState, useFA: win.useFA,
    I18N: win.FA_I18N, MU: win.FA_MINAGE_UI, GPU: win.FA_GPU_HASHRATE });
  vm.runInContext(compiled, context);
  return { render() { index = 0; return context.Minage(); }, get detections() { return detections; }, i18n: win.FA_I18N };
}

for (const file of ["minage.jsx", "build/minage.js"]) {
  const compiled = Babel.transform(extract(read(file)), { presets: ["react"], sourceType: "script" }).code;

  test(`${file} : carte reconnue, estimation d'usine et hypothèse explicite sans réseau`, () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      const h = screen(compiled, "NVIDIA GeForce RTX 4070", lang);
      const tree = h.render();
      assert.match(textOf(tree), /RTX 4070/);
      assert.match(textOf(tree), /6 GH\/s/);
      assert.ok(textOf(tree).includes(h.i18n.t("minage.reseau", M.formaterNombre(1000, lang))));
      assert.ok(textOf(tree).includes(h.i18n.t("minage.note")));
      const blocks = nodes(tree);
      const order = ["minage-machine", "minage-chance", "minage-estimates", "minage-network", "minage-note"]
        .map((name) => blocks.findIndex((n) => n.props.className === name));
      assert.ok(order.every((position, i) => position >= 0 && (i === 0 || position > order[i - 1])));
      const meter = blocks.find((n) => n.props.role === "meter");
      const part = M.partReseau(6, M.COMPTES_FALLBACK * M.GH_PAR_COMPTE);
      assert.equal(meter.props["aria-valuetext"], M.formaterProba(part, lang));
      assert.equal(meter.props["aria-valuenow"], part * 100);
      assert.equal(nodes(meter).find((n) => n.type === "span").props.style.minWidth, 2);
      assert.ok(!/undefined|NaN|minage\./.test(textOf(tree)));
      assert.ok(textOf(tree).includes(M.formaterFb(M.fbParJour(part), lang)));
      assert.ok(textOf(tree).includes(M.formaterDuree(M.tempsMoyenMs(part), lang)));
      assert.ok(textOf(tree).includes(h.i18n.t("minage.table")));
      assert.ok(!blocks.some((n) => ["input", "button", "select", "a"].includes(n.type)));
      assert.deepEqual(h.render(), tree);
      assert.equal(h.detections, 1);
    }
  });

  test(`${file} : GPU mobile, masqué ou inconnu, message localisé sans chiffres ni action`, () => {
    for (const lang of ["FR", "EN", "ZH"]) for (const raw of ["Apple GPU", "Adreno (TM) 740", "Mali-G78", null, "", "GPU non répertorié", "RTX 4070 Laptop GPU"]) {
      const h = screen(compiled, raw, lang);
      const tree = h.render();
      const blocks = nodes(tree), text = textOf(tree);
      const heading = blocks.find((n) => n.props.id === "minage-unavailable-title");
      assert.ok(heading);
      assert.equal(textOf(heading), h.i18n.t("minage.nonDetectee"));
      if (lang === "FR") assert.equal(textOf(heading), "Pas de carte graphique détectée");
      assert.ok(text.includes(h.i18n.t("minage.pcRequis")));
      assert.ok(text.includes(h.i18n.t("minage.titre")));
      assert.ok(text.includes(h.i18n.t("minage.note")));
      assert.doesNotMatch(text, /\d|[%％]|GH\/s|undefined|NaN|minage\./);
      assert.ok(!blocks.some((n) => n.props.role === "meter" || ["input", "button", "select", "a", "dl"].includes(n.type)));
      for (const className of ["minage-machine", "minage-chance", "minage-estimates", "minage-network"]) {
        assert.ok(!blocks.some((n) => n.props.className === className), className);
      }
      assert.deepEqual(h.render(), tree);
      assert.equal(h.detections, 1);
    }
  });
}

test("écran chargé dans le bon ordre et proposé dans Plus, hors MAIN", () => {
  const html = read("index.html"), app = read("app.jsx");
  for (const f of ["i18n.js", "gpu-hashrate.js", "minage-ui.js", "build/components.js"]) assert.ok(html.indexOf(f) < html.indexOf("build/minage.js"));
  assert.ok(html.indexOf("build/minage.js") < html.indexOf("build/app.js"));
  assert.match(app, /\["minage", "NAV_MINAGE"\]/);
  assert.match(app, /minage: Minage/);
  assert.ok(!app.match(/const MAIN = \[[^\]]+\]/)[0].includes("minage"));
});
