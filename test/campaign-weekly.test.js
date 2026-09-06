"use strict";
/* Défi hebdo — TOUS les étages clear (Campagne Phase 2 étendue) — MIROIR
 * D'AFFICHAGE.
 *
 * Le serveur (campaign.js) tranche le re-clear hebdo ; le client ne fait
 * qu'afficher l'état. Contrat partagé bit à bit :
 *   - WEEKLY_COOLDOWN_MS = 7 j
 *   - étage f « défi hebdo » ⇔ progress["w-f"] > 0 (déjà clear)
 *   - last = Number(weekly["w-f"] || 0) ; available = (now - last) >= cooldown
 *   - remainingMs = max(0, cooldown - (now - last))
 *   - aperçu : boss = 50 % FA (58) + 1 Argent, « proportionnel à ton équipe » ;
 *     non-boss = miette floor((12 + 4f) / 4) FA (3..11), pas de ticket, pas
 *     de mention « proportionnel ».
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

/* ---------- floorWeeklyState : n'importe quel étage ---------- */

test("floorWeeklyState : étage jamais clear → pas de défi hebdo (boss et non-boss)", () => {
  assert.deepStrictEqual(D.floorWeeklyState({}, {}, 0, 9, NOW), { cleared: false, available: false, remainingMs: 0 });
  assert.deepStrictEqual(D.floorWeeklyState({}, {}, 0, 3, NOW), { cleared: false, available: false, remainingMs: 0 });
  assert.deepStrictEqual(D.floorWeeklyState({ "0-3": 0 }, { "0-3": NOW }, 0, 3, NOW), { cleared: false, available: false, remainingMs: 0 });
});

test("floorWeeklyState : étage non-boss clear, jamais rejoué → dispo", () => {
  assert.deepStrictEqual(D.floorWeeklyState({ "2-0": 3 }, {}, 2, 0, NOW), { cleared: true, available: true, remainingMs: 0 });
  assert.deepStrictEqual(D.floorWeeklyState({ "2-5": 1 }, null, 2, 5, NOW), { cleared: true, available: true, remainingMs: 0 });
});

test("floorWeeklyState : non-boss rejoué il y a 1 h → cooldown de 7 j − 1 h", () => {
  const r = D.floorWeeklyState({ "1-4": 3 }, { "1-4": NOW - HOUR }, 1, 4, NOW);
  assert.deepStrictEqual(r, { cleared: true, available: false, remainingMs: 7 * DAY - HOUR });
});

test("floorWeeklyState : borne — exactement 7 j → dispo, 1 ms avant → pas dispo", () => {
  assert.deepStrictEqual(D.floorWeeklyState({ "3-7": 3 }, { "3-7": NOW - 7 * DAY }, 3, 7, NOW),
    { cleared: true, available: true, remainingMs: 0 });
  assert.deepStrictEqual(D.floorWeeklyState({ "3-7": 3 }, { "3-7": NOW - 7 * DAY + 1 }, 3, 7, NOW),
    { cleared: true, available: false, remainingMs: 1 });
});

test("floorWeeklyState : timestamp servi en chaîne → Number()", () => {
  const r = D.floorWeeklyState({ "0-2": 3 }, { "0-2": String(NOW - 2 * DAY) }, 0, 2, NOW);
  assert.deepStrictEqual(r, { cleared: true, available: false, remainingMs: 5 * DAY });
});

test("floorWeeklyState : cooldown PAR étage — l'étage 3 rejoué ne bloque pas l'étage 4", () => {
  const progress = { "0-3": 3, "0-4": 2, "0-9": 3 };
  const weekly = { "0-3": NOW - HOUR };
  assert.strictEqual(D.floorWeeklyState(progress, weekly, 0, 3, NOW).available, false);
  assert.strictEqual(D.floorWeeklyState(progress, weekly, 0, 4, NOW).available, true);
  assert.strictEqual(D.floorWeeklyState(progress, weekly, 0, 9, NOW).available, true);
  // ne lit que le monde demandé
  assert.strictEqual(D.floorWeeklyState(progress, weekly, 1, 3, NOW).cleared, false);
});

test("floorWeeklyState(w, 9) ≡ bossWeeklyState(w) : rétro-compat conservée", () => {
  const progress = { "1-9": 3 };
  const weekly = { "1-9": NOW - 3 * DAY };
  assert.deepStrictEqual(D.bossWeeklyState(progress, weekly, 1, NOW), D.floorWeeklyState(progress, weekly, 1, D.BOSS_FLOOR, NOW));
  assert.deepStrictEqual(D.bossWeeklyState({}, {}, 0, NOW), { cleared: false, available: false, remainingMs: 0 });
  assert.deepStrictEqual(D.bossWeeklyState({ "2-9": 3 }, {}, 2, NOW), { cleared: true, available: true, remainingMs: 0 });
});

test("floorWeeklyState est PURE : aucune horloge interne", () => {
  const src = lire("data.js");
  const idx = src.indexOf("function floorWeeklyState");
  assert.ok(idx >= 0, "floorWeeklyState absente de data.js");
  const body = src.slice(idx, src.indexOf("\n  }", idx));
  assert.ok(!/Date\.now|new Date/.test(body), "floorWeeklyState doit recevoir `now` en paramètre");
});

/* ---------- weeklyRewardPreview : aperçu (le serveur crédite) ---------- */

test("weeklyRewardPreview : boss → 58 FA (50 % de 116) + 1 Argent + mention proportionnel", () => {
  assert.deepStrictEqual(D.weeklyRewardPreview(0, D.BOSS_FLOOR), { fa: 58, silver: 1, hint: true });
  assert.deepStrictEqual(D.weeklyRewardPreview(5, 9), { fa: 58, silver: 1, hint: true });
  // cohérent avec campReward × WEEKLY_REWARD.faRatio
  assert.strictEqual(D.weeklyRewardPreview(0, 9).fa, Math.floor(D.campReward(9, true) * D.WEEKLY_REWARD.faRatio));
});

test("weeklyRewardPreview : non-boss → miette floor((12 + 4f) / 4), 0 ticket, pas de mention", () => {
  const attendu = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (let f = 0; f < D.BOSS_FLOOR; f++) {
    assert.deepStrictEqual(D.weeklyRewardPreview(2, f), { fa: attendu[f], silver: 0, hint: false }, `étage ${f}`);
    assert.strictEqual(D.weeklyRewardPreview(2, f).fa, Math.floor((12 + 4 * f) / 4));
  }
});

test("weeklyRewardPreview : jamais d'Or, indépendant du monde", () => {
  for (let w = 0; w < D.WORLDS.length; w++) {
    for (let f = 0; f < D.FLOORS_PER_WORLD; f++) {
      const p = D.weeklyRewardPreview(w, f);
      assert.strictEqual(p.gold, undefined);
      assert.deepStrictEqual(p, D.weeklyRewardPreview(0, f));
    }
  }
});

/* ---------- i18n ---------- */

test("i18n : clés du défi hebdo présentes et non vides en FR/EN/ZH", () => {
  const KEYS = ["CAMP_WEEKLY_BADGE", "CAMP_WEEKLY_READY", "CAMP_WEEKLY_COOLDOWN", "CAMP_WEEKLY_REWARD", "CAMP_WEEKLY_HINT",
    "CAMP_WEEKLY_DAYS", "CAMP_WEEKLY_HOURS", "CAMP_WEEKLY_CRUMB"];
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const l of ["FR", "EN", "ZH"]) assert.ok(typeof T[k][l] === "string" && T[k][l].length > 0, `${k}.${l} vide`);
  }
  for (const l of ["FR", "EN", "ZH"]) assert.ok(T.CAMP_WEEKLY_COOLDOWN[l].includes("%s"), "COOLDOWN doit interpoler la durée");
  // Aperçu boss : 50 % + Argent, jamais d'Or.
  assert.ok(/50\s?%/.test(T.CAMP_WEEKLY_REWARD.FR));
  for (const l of ["FR", "EN", "ZH"]) assert.ok(!/\bor\b|gold|金票/i.test(T.CAMP_WEEKLY_REWARD[l]), `récompense hebdo sans Or (${l})`);
  // Miette non-boss : « +%d FA », sans ticket ni mention « proportionnel ».
  for (const l of ["FR", "EN", "ZH"]) {
    assert.ok(T.CAMP_WEEKLY_CRUMB[l].includes("%d"), `CRUMB.${l} doit interpoler la miette`);
    assert.ok(/FA/.test(T.CAMP_WEEKLY_CRUMB[l]), `CRUMB.${l} doit mentionner FA`);
    assert.ok(!/ticket|argent|silver|银/i.test(T.CAMP_WEEKLY_CRUMB[l]), `CRUMB.${l} sans ticket`);
  }
});

/* ---------- campaign.jsx : structure d'affichage ---------- */

test("campaign.jsx : FloorSelect affiche le badge hebdo sur TOUS les étages clear via D.floorWeeklyState, sans ticker", () => {
  const src = lire("campaign.jsx");
  const i0 = src.indexOf("function FloorSelect");
  assert.ok(i0 >= 0);
  const body = src.slice(i0, src.indexOf("\n}", i0));
  assert.ok(/D\.floorWeeklyState\(/.test(body), "FloorSelect doit appeler D.floorWeeklyState");
  assert.ok(/D\.weeklyRewardPreview\(/.test(body), "FloorSelect doit passer l'aperçu de récompense au badge");
  assert.ok(/\{weekly\.cleared && <WeeklyBadge/.test(body), "badge rendu sur toute tuile déjà clear");
  assert.ok(!/isBoss && weekly\.cleared/.test(body), "plus de restriction f === 9 sur le badge hebdo");
  assert.ok(!/setInterval/.test(body), "pas de ticker temps réel : Date.now() lu une fois par rendu");
  assert.strictEqual((body.match(/Date\.now\(\)/g) || []).length, 1, "Date.now() lu exactement une fois par rendu");
});

test("campaign.jsx : WeeklyBadge distingue boss (50 % + Argent + proportionnel) et non-boss (miette, sans proportionnel)", () => {
  const src = lire("campaign.jsx");
  const b0 = src.indexOf("function WeeklyBadge");
  assert.ok(b0 >= 0, "composant WeeklyBadge absent");
  const badge = src.slice(b0, src.indexOf("\n}", b0));
  for (const k of ["CAMP_WEEKLY_BADGE", "CAMP_WEEKLY_READY", "CAMP_WEEKLY_COOLDOWN", "CAMP_WEEKLY_REWARD", "CAMP_WEEKLY_HINT", "CAMP_WEEKLY_CRUMB"]) {
    assert.ok(badge.includes(`"${k}"`), `WeeklyBadge doit utiliser ${k}`);
  }
  assert.ok(/preview\.hint/.test(badge), "la mention « proportionnel » doit être conditionnée à preview.hint");
  assert.ok(/preview\.fa/.test(badge), "la miette affichée vient de preview.fa");
  // Aucune logique de combat / replay dans le badge
  assert.ok(!/fetch\(|onPickFloor|fight/i.test(badge), "WeeklyBadge = affichage pur");
});

test("app.jsx : campaignWeekly hydraté depuis la save serveur et le retour de combat", () => {
  const src = lire("app.jsx");
  assert.ok(/campaignWeekly:\s*save\.campaign_weekly/.test(src), "serverToState doit hydrater campaignWeekly");
  assert.ok(/campaignWeekly:\s*\{\}/.test(src), "état initial campaignWeekly: {}");
  assert.ok(/campaignWeekly:\s*data\.campaign_weekly/.test(src), "le retour /campaign/fight doit rafraîchir campaignWeekly");
});
