"use strict";
/* Défi hebdo des boss (Campagne Phase 2) — MIROIR D'AFFICHAGE.
 *
 * Le serveur (campaign.js) tranche le re-clear hebdo ; le client ne fait
 * qu'afficher l'état. Contrat partagé bit à bit :
 *   - WEEKLY_COOLDOWN_MS = 7 j
 *   - boss « défi hebdo » ⇔ progress["w-9"] > 0
 *   - last = Number(weekly["w-9"] || 0) ; available = (now - last) >= cooldown
 *   - remainingMs = max(0, cooldown - (now - last))
 * Toute divergence ferait annoncer « dispo » là où le serveur refuse.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../data.js");
require("../i18n.js");
const D = globalThis.window.FA_DATA;
const { T } = globalThis.window.FA_I18N;

function lire(f) { return fs.readFileSync(path.join(__dirname, "..", f), "utf8"); }

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const NOW = 1_800_000_000_000;

test("WEEKLY_COOLDOWN_MS = 7 jours exactement", () => {
  assert.strictEqual(D.WEEKLY_COOLDOWN_MS, 7 * DAY);
});

test("bossWeeklyState : boss jamais clear → pas de défi hebdo", () => {
  assert.deepStrictEqual(D.bossWeeklyState({}, {}, 0, NOW), { cleared: false, available: false, remainingMs: 0 });
  assert.deepStrictEqual(D.bossWeeklyState({ "0-9": 0 }, { "0-9": NOW }, 0, NOW), { cleared: false, available: false, remainingMs: 0 });
});

test("bossWeeklyState : boss clear, jamais rejoué → dispo", () => {
  assert.deepStrictEqual(D.bossWeeklyState({ "2-9": 3 }, {}, 2, NOW), { cleared: true, available: true, remainingMs: 0 });
  // weekly absent / null tolérés
  assert.deepStrictEqual(D.bossWeeklyState({ "2-9": 1 }, null, 2, NOW), { cleared: true, available: true, remainingMs: 0 });
});

test("bossWeeklyState : rejoué il y a 1 h → cooldown de 7 j − 1 h", () => {
  const r = D.bossWeeklyState({ "1-9": 3 }, { "1-9": NOW - HOUR }, 1, NOW);
  assert.deepStrictEqual(r, { cleared: true, available: false, remainingMs: 7 * DAY - HOUR });
});

test("bossWeeklyState : borne — exactement 7 j → dispo, 1 ms avant → pas dispo", () => {
  assert.deepStrictEqual(D.bossWeeklyState({ "3-9": 3 }, { "3-9": NOW - 7 * DAY }, 3, NOW),
    { cleared: true, available: true, remainingMs: 0 });
  assert.deepStrictEqual(D.bossWeeklyState({ "3-9": 3 }, { "3-9": NOW - 7 * DAY + 1 }, 3, NOW),
    { cleared: true, available: false, remainingMs: 1 });
});

test("bossWeeklyState : timestamp servi en chaîne → Number()", () => {
  const r = D.bossWeeklyState({ "0-9": 3 }, { "0-9": String(NOW - 2 * DAY) }, 0, NOW);
  assert.deepStrictEqual(r, { cleared: true, available: false, remainingMs: 5 * DAY });
});

test("bossWeeklyState : ne lit que le boss du monde demandé", () => {
  const progress = { "0-9": 3, "1-9": 0 };
  const weekly = { "0-9": NOW - HOUR };
  assert.strictEqual(D.bossWeeklyState(progress, weekly, 1, NOW).cleared, false);
  assert.strictEqual(D.bossWeeklyState(progress, weekly, 0, NOW).available, false);
});

test("bossWeeklyState est PURE : aucune horloge interne", () => {
  const src = lire("data.js");
  const idx = src.indexOf("function bossWeeklyState");
  assert.ok(idx >= 0, "bossWeeklyState absente de data.js");
  const body = src.slice(idx, src.indexOf("\n  }", idx));
  assert.ok(!/Date\.now|new Date/.test(body), "bossWeeklyState doit recevoir `now` en paramètre");
});

test("i18n : clés du défi hebdo présentes et non vides en FR/EN/ZH", () => {
  const KEYS = ["CAMP_WEEKLY_BADGE", "CAMP_WEEKLY_READY", "CAMP_WEEKLY_COOLDOWN", "CAMP_WEEKLY_REWARD", "CAMP_WEEKLY_HINT",
    "CAMP_WEEKLY_DAYS", "CAMP_WEEKLY_HOURS"];
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const l of ["FR", "EN", "ZH"]) assert.ok(typeof T[k][l] === "string" && T[k][l].length > 0, `${k}.${l} vide`);
  }
  for (const l of ["FR", "EN", "ZH"]) assert.ok(T.CAMP_WEEKLY_COOLDOWN[l].includes("%s"), "COOLDOWN doit interpoler la durée");
  // Aperçu : 50 % + Argent, jamais d'Or.
  assert.ok(/50\s?%/.test(T.CAMP_WEEKLY_REWARD.FR));
  for (const l of ["FR", "EN", "ZH"]) assert.ok(!/\bor\b|gold|金票/i.test(T.CAMP_WEEKLY_REWARD[l]), `récompense hebdo sans Or (${l})`);
});

test("campaign.jsx : FloorSelect affiche l'état hebdo via D.bossWeeklyState, sans ticker", () => {
  const src = lire("campaign.jsx");
  const i0 = src.indexOf("function FloorSelect");
  assert.ok(i0 >= 0);
  const body = src.slice(i0, src.indexOf("\n}", i0));
  assert.ok(/D\.bossWeeklyState\(/.test(body), "FloorSelect doit appeler D.bossWeeklyState");
  assert.ok(/isBoss && weekly\.cleared && <WeeklyBadge/.test(body), "badge rendu sur la tuile de boss déjà clear uniquement");
  const b0 = src.indexOf("function WeeklyBadge");
  assert.ok(b0 >= 0, "composant WeeklyBadge absent");
  const badge = src.slice(b0, src.indexOf("\n}", b0));
  for (const k of ["CAMP_WEEKLY_BADGE", "CAMP_WEEKLY_READY", "CAMP_WEEKLY_COOLDOWN", "CAMP_WEEKLY_REWARD", "CAMP_WEEKLY_HINT"]) {
    assert.ok(badge.includes(`"${k}"`), `WeeklyBadge doit utiliser ${k}`);
  }
  assert.ok(!/setInterval/.test(body), "pas de ticker temps réel : Date.now() lu une fois par rendu");
  assert.strictEqual((body.match(/Date\.now\(\)/g) || []).length, 1, "Date.now() lu exactement une fois par rendu");
});

test("app.jsx : campaignWeekly hydraté depuis la save serveur et le retour de combat", () => {
  const src = lire("app.jsx");
  assert.ok(/campaignWeekly:\s*save\.campaign_weekly/.test(src), "serverToState doit hydrater campaignWeekly");
  assert.ok(/campaignWeekly:\s*\{\}/.test(src), "état initial campaignWeekly: {}");
  assert.ok(/campaignWeekly:\s*data\.campaign_weekly/.test(src), "le retour /campaign/fight doit rafraîchir campaignWeekly");
});
