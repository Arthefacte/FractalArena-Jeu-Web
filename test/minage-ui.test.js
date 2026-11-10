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

test("cible de bloc du réseau réel : 10 minutes, et pas 30 secondes", () => {
  assert.deepEqual([M.BLOC_MS, M.BLOCS_PAR_JOUR, M.REWARD_FB], [600000, 144, 6.25]);
  assert.equal(M.BLOC_MS * M.BLOCS_PAR_JOUR, 86400000);
});

test("hashrate réseau dérivé de la difficulté réelle, temps moyen et FB par jour", () => {
  // Difficulté réelle relevée sur mempool.fractalbitcoin.io ; cible 600 s.
  const diff = 3749992429.200496;
  const reseau = M.hashrateReseau(diff, 600);
  assert.ok(Math.abs(reseau - diff * Math.pow(2, 32) / 600) < 1);
  assert.match(M.formaterHashrate(reseau, "FR"), /^26,\d PH\/s$/);
  // Une RTX 4070 (6 GH/s) face à ce réseau : ~85 ans pour le moindre bloc.
  const t = M.tempsMoyenReseau(6, reseau, 600);
  assert.ok(Math.abs(t / 86400000 / 365 - 85.1) < 0.2);
    assert.equal(M.formaterDuree(t, "FR"), "85 ans");
  // Doubler la puissance divise l'attente par deux ; une carte absente n'a pas d'attente.
  assert.ok(Math.abs(M.tempsMoyenReseau(12, reseau, 600) * 2 - t) < 1);
  assert.equal(M.tempsMoyenReseau(0, reseau, 600), null);
  assert.equal(M.tempsMoyenReseau(6, 0, 600), null);
  assert.equal(M.tempsMoyenReseau(6, reseau, 0), null);
  assert.equal(M.hashrateReseau(0, 600), null);
  assert.equal(M.hashrateReseau(-1, 600), null);
  // Récompense de tête réelle : 625 000 575 sats, soit 6,25 FB.
  assert.ok(Math.abs(M.fbParJourReseau(625000575 / 1e8, 600) - 900) < 1);
  assert.equal(M.fbParJourReseau(0, 600), 0);
  assert.equal(M.fbParJourReseau(6.25, 0), null);
});

test("lecture du réseau : rejette une réponse vide ou incohérente, garde la médiane des blocs", async () => {
  const ok = (json) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
  const bloc = (height, difficulty, reward) => ({ height, difficulty, extras: { reward } });
  const r = await M.lireReseau(ok([bloc(10, 100, 625000000), bloc(11, 200, 625000000), bloc(12, 300, 625000000)]));
  assert.equal(r.etat, "ok");
  assert.equal(r.hauteur, 12);
  assert.equal(r.difficulte, 200);
  // La difficulté 1 du bloc d'ajustement est écartée, jamais retenue comme réseau.
  const ajust = await M.lireReseau(ok([bloc(20, 1, 625000000), bloc(21, 500, 625000000), bloc(22, 400, 625000000)]));
  assert.equal(ajust.difficulte, 500);
  await assert.rejects(M.lireReseau(ok([])));
  await assert.rejects(M.lireReseau(ok(null)));
  await assert.rejects(M.lireReseau(() => Promise.resolve({ ok: false, status: 503 })));
  assert.equal(M.RESEAU_URL, "https://mempool.fractalbitcoin.io/api/blocks");
});

test("réseau réel : repères à 6 et 12 GH/s, attente et espérance qui suivent la puissance", () => {
  const reseau = M.hashrateReseau(3749992429.2, 600);
  for (const gh of [6, 12, 22]) {
    const t = M.tempsMoyenReseau(gh, reseau, 600);
    assert.ok(t > 0 && Number.isFinite(t));
  }
  // Doubler la puissance double l'espérance et divise l'attente par deux.
  const t6 = M.tempsMoyenReseau(6, reseau, 600), t12 = M.tempsMoyenReseau(12, reseau, 600);
  assert.ok(Math.abs(t6 / t12 - 2) < 1e-9);
  const fb6 = (625000000 / 1e8) * 86400000 / t6;
  const fb12 = (625000000 / 1e8) * 86400000 / t12;
  assert.ok(Math.abs(fb12 / fb6 - 2) < 1e-9);
  // Aucune écriture ne grossit une chance réelle : la probabilité par bloc reste exacte.
  assert.equal(M.formaterProba(6e9 / reseau), "0,000022 %");
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
  let index, detections = 0, monte = false;
  const states = [], effets = [];
  // Le seul réseau autorisé est la lecture de l'explorateur public, et elle est simulée ici.
  const reseauSimule = [{ height: 100, difficulty: 3749992429.2, extras: { reward: 625000000 } }];
  const context = { window: {}, fetch(url) {
    assert.equal(url, "https://mempool.fractalbitcoin.io/api/blocks");
    return Promise.resolve({ ok: true, json: () => Promise.resolve(reseauSimule) });
  } };
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
    useEffect(effet) {
      // Un seul montage : l'effet réseau n'est pas rejoué aux rendus suivants.
      if (monte) return;
      monte = true;
      effets.push(effet());
    },
  };
  Object.assign(context, { useState: context.React.useState, useEffect: context.React.useEffect, React: context.React, useFA: win.useFA,
    I18N: win.FA_I18N, MU: win.FA_MINAGE_UI, GPU: win.FA_GPU_HASHRATE });
  vm.runInContext(compiled, context);
  const attendre = async () => { await Promise.all(effets.splice(0)); };
  return {
    render() { index = 0; return context.Minage(); },
    // Monte l'écran, laisse la lecture réseau se résoudre, puis rend le résultat.
    async renderAvecReseau() { index = 0; context.Minage(); await attendre(); await new Promise((r) => setTimeout(r, 0)); index = 0; return context.Minage(); },
    get detections() { return detections; }, i18n: win.FA_I18N };
}

for (const file of ["minage.jsx", "build/minage.js"]) {
  const compiled = Babel.transform(extract(read(file)), { presets: ["react"], sourceType: "script" }).code;

  test(`${file} : réseau réel lu une fois, carte détectée, attente et espérance calculées`, async () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      const h = screen(compiled, "NVIDIA GeForce RTX 4070", lang);
      const tree = h.render();
      assert.match(textOf(tree), /RTX 4070/);
      assert.match(textOf(tree), /6 GH\/s/);
      assert.ok(textOf(tree).includes(h.i18n.t("minage.reseauChargement")));
      assert.ok(textOf(tree).includes(h.i18n.t("minage.note")));
      const blocks = nodes(tree);
      const order = ["minage-machine", "minage-chance", "minage-estimates", "minage-network", "minage-note"]
        .map((name) => blocks.findIndex((n) => n.props.className === name));
      assert.ok(order.every((position, i) => position >= 0 && (i === 0 || position > order[i - 1])));
      const meter = blocks.find((n) => n.props.role === "meter");
      // Avant l'arrivée des données réseau : aucune valeur inventée, seulement l'attente.
      assert.equal(meter.props["aria-valuenow"], 0);
      assert.ok(!/undefined|NaN|minage\./.test(textOf(tree)));
      assert.equal(h.detections, 1);
      assert.ok(textOf(tree).includes(h.i18n.t("minage.table")));
      assert.ok(!blocks.some((n) => ["input", "button", "select", "a"].includes(n.type)));
      assert.deepEqual(h.render(), tree);
      assert.equal(h.detections, 1);
    }
  });

  test(`${file} : après lecture réseau, une RTX 4070 affiche ~85 ans et moins de 0,001 FB par jour`, async () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      const h = screen(compiled, "NVIDIA GeForce RTX 4070", lang);
      const tree = await h.renderAvecReseau();
      const texte = textOf(tree), blocks = nodes(tree);
      const reseau = M.hashrateReseau(3749992429.2, 600);
      const attendu = M.tempsMoyenReseau(6, reseau, 600);
      assert.ok(texte.includes(M.formaterHashrate(reseau, lang)), "puissance du réseau");
      assert.ok(texte.includes(M.formaterDuree(attendu, lang)), "attente moyenne");
      assert.ok(texte.includes(h.i18n.t("minage.reseauReel", M.formaterNombre(100, lang))), "hauteur réelle");
      const meter = blocks.find((n) => n.props.role === "meter");
      assert.equal(meter.props["aria-valuetext"], M.formaterProba(6e9 / reseau, lang));
      assert.ok(h.i18n.t("minage.reseauReel", "100").length > 0);
      assert.ok(!/NaN|undefined|minage\./.test(texte));
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
