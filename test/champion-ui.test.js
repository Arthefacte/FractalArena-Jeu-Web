"use strict";
/* Helpers purs du Champion de soutien (patron tour-ui). */
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis.window || {};
require("../champion-ui.js");
const CU = window.FA_CHAMPION_UI;

test("CHAMPION_SLOT fixe a 2, requiredOwnCount 2 avec champion sinon 3", () => {
  assert.equal(CU.CHAMPION_SLOT, 2);
  assert.equal(CU.requiredOwnCount(true), 2);
  assert.equal(CU.requiredOwnCount(false), 3);
});

test("championRunState : absent = plein, hp_frac repris, mort detectee", () => {
  assert.deepEqual(CU.championRunState({}, "x"), { hpFrac: 1, dead: false });
  assert.deepEqual(CU.championRunState({ x: { hp_frac: 0.4 } }, "x"), { hpFrac: 0.4, dead: false });
  assert.deepEqual(CU.championRunState({ x: { hp_frac: 0, dead: true } }, "x"), { hpFrac: 0, dead: true });
  assert.deepEqual(CU.championRunState(null, "x"), { hpFrac: 1, dead: false });
});

test("aggregateUsesByDay : agrege par jour, jours recents d abord, 3 noms max", () => {
  const uses = [
    { day: "2026-08-23", commission: 5, points: 2, borrower_name: "Alice" },
    { day: "2026-08-24", commission: 0, points: 2, borrower_name: "Bob" },
    { day: "2026-08-24", commission: 12, points: 0, borrower_name: "Carol" },
    { day: "2026-08-24", commission: 3, points: 2, borrower_name: "Bob" },
    { day: "2026-08-24", commission: 1, points: 0, borrower_name: "Dave" },
    { day: "2026-08-24", commission: 1, points: 0, borrower_name: "Eve" },
  ];
  const agg = CU.aggregateUsesByDay(uses);
  assert.equal(agg.length, 2);
  assert.equal(agg[0].day, "2026-08-24");
  assert.deepEqual({ f: agg[0].fights, c: agg[0].commission, p: agg[0].points }, { f: 5, c: 17, p: 4 });
  assert.deepEqual(agg[0].names, ["Bob", "Carol", "Dave"]);   // distincts, 3 max
  assert.deepEqual({ f: agg[1].fights, c: agg[1].commission }, { f: 1, c: 5 });
  assert.deepEqual(CU.aggregateUsesByDay([]), []);
});
