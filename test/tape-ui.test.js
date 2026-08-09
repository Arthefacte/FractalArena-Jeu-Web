// test/tape-ui.test.js — composition de la tape boursière (pure, sans DOM).
// La tape affiche de VRAIES donnees (/buyback/status) : si la composition ment
// (pourcentage hors bornes, rachat fantome au premier releve), c'est pire que
// pas de tape du tout. D'ou des tests sur les bornes et les gardes avant tout.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../tape-ui.js");
const T = globalThis.window.FA_TAPE;

const MAINTENANT = 1754700000000; // instant fixe : les tests ne dependent pas de l'horloge

function pool(tier, extra) {
  return Object.assign({ tier, total: 0, threshold: tier, buyback_count: 0, total_bought: 0, last_buyback: null }, extra);
}

// ——— composerTape ———

test("tape vide sur entrees degenerees", () => {
  assert.deepStrictEqual(T.composerTape(null, {}, MAINTENANT), []);
  assert.deepStrictEqual(T.composerTape("pools", {}, MAINTENANT), []);
  assert.deepStrictEqual(T.composerTape([], {}, MAINTENANT), []);
});

test("les rachats viennent en tete, du plus recent au plus ancien", () => {
  const pools = [
    pool(5000, { last_buyback: { at: new Date(MAINTENANT - 86400000 * 3).toISOString(), amount: 5000, txid: "a".repeat(64) } }),
    pool(10000, { last_buyback: { at: new Date(MAINTENANT - 3600000).toISOString(), amount: 10000, txid: null } }),
    pool(25000),
    pool(50000),
  ];
  const items = T.composerTape(pools, {}, MAINTENANT);
  const rachats = items.filter((i) => i.type === "rachat");
  assert.strictEqual(rachats.length, 2);
  assert.strictEqual(rachats[0].tier, 10000, "le plus recent d'abord");
  assert.strictEqual(rachats[0].montant, 10000);
  assert.strictEqual(rachats[1].tier, 5000);
  assert.strictEqual(items[0].type, "rachat", "les rachats ouvrent le cycle");
});

test("le pourcentage de pool est borne 0-100 et entier", () => {
  const pools = [
    pool(5000, { total: 2600 }),          // 52 %
    pool(10000, { total: 999999 }),       // surplus (carryover) -> 100, pas 9999
    pool(25000, { total: -50 }),          // degenere -> 0
  ];
  const pcts = T.composerTape(pools, {}, MAINTENANT).filter((i) => i.type === "pool");
  assert.deepStrictEqual(pcts.map((i) => i.pct), [52, 100, 0]);
  assert.ok(pcts.every((i) => Number.isInteger(i.pct)));
});

test("le cumul rachete n'apparait que s'il est positif", () => {
  const sans = T.composerTape([pool(5000), pool(10000)], {}, MAINTENANT);
  assert.ok(!sans.some((i) => i.type === "cumul"), "pas de « CUMUL 0 FA » au lancement du jeu");
  const avec = T.composerTape([pool(5000, { total_bought: 10000 }), pool(10000, { total_bought: 20000 })], {}, MAINTENANT);
  const cumul = avec.find((i) => i.type === "cumul");
  assert.strictEqual(cumul.montant, 30000, "somme des total_bought");
});

test("les entrees de la session rejoignent le cycle", () => {
  const items = T.composerTape([pool(5000)], { 5000: 250 }, MAINTENANT);
  const entree = items.find((i) => i.type === "entree");
  assert.deepStrictEqual({ tier: entree.tier, montant: entree.montant }, { tier: 5000, montant: 250 });
});

test("un rachat sans montant retombe sur le tier, jamais sur NaN", () => {
  const pools = [pool(5000, { last_buyback: { at: new Date(MAINTENANT - 1000).toISOString(), amount: null, txid: null } })];
  const r = T.composerTape(pools, {}, MAINTENANT).find((i) => i.type === "rachat");
  assert.strictEqual(r.montant, 5000);
});

// ——— rachatsDetectes ———

test("aucun rachat detecte au premier releve (garde d'initialisation)", () => {
  // Le piege du « +38 610 au login » : sans la garde, un joueur qui arrive
  // apres 7 rachats verrait 7 pluies d'or a la connexion.
  const suivants = [pool(5000, { buyback_count: 7 })];
  assert.deepStrictEqual(T.rachatsDetectes([], suivants, false), {});
});

test("un buyback_count qui monte declenche, avec le montant du dernier rachat", () => {
  const prev = [pool(5000, { buyback_count: 2 }), pool(10000, { buyback_count: 1 })];
  const suivants = [
    pool(5000, { buyback_count: 3, last_buyback: { at: new Date(MAINTENANT).toISOString(), amount: 5200, txid: null } }),
    pool(10000, { buyback_count: 1 }),
  ];
  assert.deepStrictEqual(T.rachatsDetectes(prev, suivants, true), { 5000: 5200 });
});

test("un pool inconnu au releve precedent ne declenche pas", () => {
  const suivants = [pool(5000, { buyback_count: 4 })];
  assert.deepStrictEqual(T.rachatsDetectes([pool(10000)], suivants, true), {});
});

test("montant du rachat absent -> repli sur le tier", () => {
  const prev = [pool(25000, { buyback_count: 0 })];
  const suivants = [pool(25000, { buyback_count: 1 })];
  assert.deepStrictEqual(T.rachatsDetectes(prev, suivants, true), { 25000: 25000 });
});

// ——— tempsRelatif ———

test("temps relatif : paliers minute / heure / jour", () => {
  assert.deepStrictEqual(T.tempsRelatif(20 * 1000), { unite: "now", n: 0 });
  assert.deepStrictEqual(T.tempsRelatif(5 * 60000), { unite: "min", n: 5 });
  assert.deepStrictEqual(T.tempsRelatif(3 * 3600000), { unite: "h", n: 3 });
  assert.deepStrictEqual(T.tempsRelatif(9 * 86400000), { unite: "j", n: 9 });
});

test("temps relatif : robuste aux ages negatifs (horloges desynchronisees)", () => {
  // Le serveur peut horodater legerement dans le futur du client.
  assert.deepStrictEqual(T.tempsRelatif(-5000), { unite: "now", n: 0 });
});
