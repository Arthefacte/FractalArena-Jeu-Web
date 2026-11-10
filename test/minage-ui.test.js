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
  assert.deepEqual([M.BLOC_MS, M.BLOCS_PAR_JOUR, M.REWARD_FB, M.GH_PAR_COMPTE, M.COMPTES_FALLBACK], [30000, 2880, 6.25, 300, 1000]);
  assert.equal(M.BLOC_MS * M.BLOCS_PAR_JOUR, 86400000);
  assert.equal(M.partReseau(6, 300000), 6 / 300006);
  assert.equal(M.partReseau(6, 0), 1);
  assert.equal(M.partReseau(0, 1000), 0);
  assert.equal(M.partReseau(0, 0), null);
  assert.equal(M.partReseau(Number.MAX_VALUE, Number.MAX_VALUE), 0.5);
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

test("format français lisible, jamais zéro pour une probabilité positive", () => {
  assert.equal(M.formaterProba(0.00003), "< 0,1 %");
  assert.equal(M.formaterProba(Number.MIN_VALUE), "< 0,1 %");
  assert.equal(M.formaterProba(0.00099), "< 0,1 %");
  assert.equal(M.formaterProba(0.001), "0,1 %");
  assert.equal(M.formaterProba(0.032), "3,2 %");
  assert.equal(M.formaterProba(0), "0 %");
  assert.equal(M.formaterProba(1), "100 %");
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
  assert.equal(M.formaterFb(0.42, "EN"), "0.42 FB");
  assert.equal(M.formaterDuree(9 * 86400000, "EN"), "9 days");
  assert.equal(M.formaterDuree(9 * 86400000, "ZH"), "9 天");
  assert.equal(M.formaterGh(6, "ZH"), "6 GH/s");
  I.setLang("FR");
  for (const [key, translations] of Object.entries(I.T).filter(([k]) => k === "NAV_MINAGE" || k.startsWith("minage."))) {
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(translations[lang], key + " " + lang);
  }
});

const compiled = Babel.transform(read("minage.jsx"), { presets: ["react"], sourceType: "script" }).code;
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.children)] : [];
}
function textOf(tree) {
  if (Array.isArray(tree)) return tree.map(textOf).join("");
  if (tree && typeof tree === "object") return textOf(tree.children);
  return tree == null || typeof tree === "boolean" ? "" : String(tree);
}
function screen(raw, lang) {
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
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = index++;
      if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
      return [states[i], (next) => { states[i] = next; }];
    },
  };
  vm.runInContext(compiled, context);
  return { render() { index = 0; return win.Minage(); }, get detections() { return detections; }, i18n: win.FA_I18N };
}

test("écran réel FR/EN/ZH : hypothèse explicite, sélection manuelle et recalcul sans réseau", () => {
  for (const lang of ["FR", "EN", "ZH"]) {
    const h = screen("NVIDIA GeForce RTX 4070", lang);
    let tree = h.render();
    assert.match(textOf(tree), /RTX 4070/);
    assert.match(textOf(tree), /6 GH\/s/);
    assert.ok(textOf(tree).includes(h.i18n.t("minage.reseau", M.formaterNombre(1000, lang))));
    assert.ok(textOf(tree).includes(h.i18n.t("minage.note")));
    const blocks = nodes(tree);
    const order = ["minage-machine", "minage-chance", "minage-estimates", "minage-network", "minage-note"]
      .map((name) => blocks.findIndex((n) => n.props.className === name));
    assert.ok(order.every((position, i) => position >= 0 && (i === 0 || position > order[i - 1])));
    const meter = blocks.find((n) => n.props.role === "meter");
    assert.equal(meter.props["aria-valuetext"], M.formaterProba(M.partReseau(6, 300000), lang));
    assert.equal(nodes(meter).find((n) => n.type === "span").props.style.minWidth, 2);
    assert.ok(!/undefined|NaN|minage\./.test(textOf(tree)));
    nodes(tree).find((n) => n.type === "button").props.onClick();
    tree = h.render();
    let slider = nodes(tree).find((n) => n.type === "input");
    assert.equal(slider.props.value, 5);
    assert.equal(slider.props.min, "1");
    assert.equal(slider.props.max, "30");
    assert.ok(textOf(tree).includes(h.i18n.t("minage.manuelle")));
    for (const gh of [1, 30]) {
      slider.props.onChange({ target: { value: String(gh) } });
      tree = h.render();
      assert.ok(textOf(tree).includes(M.formaterFb(M.fbParJour(M.partReseau(gh, 300000)), lang)));
      assert.equal(nodes(tree).find((n) => n.props.role === "meter").props["aria-valuenow"], M.partReseau(gh, 300000) * 100);
    }
    nodes(tree).find((n) => n.type === "button").props.onClick();
    assert.ok(!nodes(h.render()).some((n) => n.type === "input"));
    assert.equal(h.detections, 1);
  }
});

test("GPU masqué ou inconnu : curseur immédiatement disponible à 5 GH/s", () => {
  for (const raw of ["Mali-G78", null, ""]) {
    const h = screen(raw, "FR");
    const tree = h.render();
    assert.equal(nodes(tree).find((n) => n.type === "input").props.value, 5);
    assert.match(textOf(tree), /Carte non reconnue/);
    assert.match(textOf(tree), /Estimation manuelle/);
  }
});

test("écran chargé dans le bon ordre et proposé dans Plus, hors MAIN", () => {
  const html = read("index.html"), app = read("app.jsx");
  for (const f of ["i18n.js", "gpu-hashrate.js", "minage-ui.js", "build/components.js"]) assert.ok(html.indexOf(f) < html.indexOf("build/minage.js"));
  assert.ok(html.indexOf("build/minage.js") < html.indexOf("build/app.js"));
  assert.match(app, /\["minage", "NAV_MINAGE"\]/);
  assert.match(app, /minage: Minage/);
  assert.ok(!app.match(/const MAIN = \[[^\]]+\]/)[0].includes("minage"));
});
