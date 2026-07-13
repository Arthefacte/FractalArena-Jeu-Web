"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];

// [clé, nb d'args attendus]
const KEYS = [
  ["NAV_TOUR", 0],
  ["TOUR_TITLE", 0], ["TOUR_SUB", 0],
  ["TOUR_WEEK_ENDS", 1], ["TOUR_BEST", 1], ["TOUR_FLOOR", 1],
  ["TOUR_NO_RUN", 0], ["TOUR_FREE_BADGE", 0],
  ["TOUR_START_FREE", 0], ["TOUR_START_PAID", 1], ["TOUR_START_TITLE", 0],
  ["TOUR_START_FREE_LINE", 0], ["TOUR_START_COST_LINE", 1],
  ["TOUR_START_CONFIRM", 0], ["TOUR_CANCEL", 0],
  ["TOUR_NEED3", 0], ["TOUR_GOTO_TEAM", 0], ["TOUR_FIGHT", 1],
  ["TOUR_ABANDON", 0], ["TOUR_ABANDON_TITLE", 0], ["TOUR_ABANDON_DESC", 0], ["TOUR_ABANDON_CONFIRM", 0],
  ["TOUR_AUTO", 0], ["TOUR_AUTO_STOP", 0], ["TOUR_AUTO_RUNNING", 0],
  ["TOUR_AUTO_LOG_WIN", 1], ["TOUR_AUTO_LOG_LOSS", 1],
  ["TOUR_AUTO_RECAP_TITLE", 0], ["TOUR_AUTO_RECAP_CLIMB", 2],
  ["TOUR_ALIVE", 1], ["TOUR_DEAD_TAG", 0],
  ["TOUR_RUN_OVER", 0], ["TOUR_VICTORY", 0], ["TOUR_DEFEAT", 0],
  ["TOUR_TIER_REACHED", 1], ["TOUR_TIERS_TITLE", 0], ["TOUR_REWARDS", 0], ["TOUR_CONTINUE", 0],
  ["TOUR_LB_TITLE", 0], ["TOUR_LB_EMPTY", 0],
  ["TOUR_LOADING", 0], ["TOUR_ERROR", 0], ["TOUR_LOGIN", 0],
  ["TOUR_ERR_ACTIVE", 0], ["TOUR_ERR_NORUN", 0], ["TOUR_ERR_BALANCE", 0], ["TOUR_ERR_BEASTS", 0], ["TOUR_ERR_GENERIC", 0],
];

test("tour : toutes les clés présentes et non vides dans les 3 langues", () => {
  for (const [key] of KEYS) {
    assert.ok(T[key], `clé manquante : ${key}`);
    for (const l of LANGS) assert.ok(typeof T[key][l] === "string" && T[key][l].length > 0, `${key}.${l} vide`);
  }
});

test("tour : nombre de %s/%d conforme au nombre d'args, pas de % dans les 0-arg", () => {
  for (const [key, argc] of KEYS) {
    for (const l of LANGS) {
      const tpl = T[key][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, argc, `${key}.${l} : ${n} placeholders, ${argc} attendus`);
      if (argc === 0) assert.ok(!tpl.includes("%"), `${key}.${l} : % interdit dans un template 0-arg`);
    }
  }
});
