"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sandbox = { window: {} };
for (const file of ["champion-ui.js", "campaign-team.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), sandbox);
}
const snapshot = g => sandbox.window.FA_CAMPAIGN_TEAM.snapshot(g, sandbox.window.FA_CHAMPION_UI);
const make = () => ({ roster: [{ id: "test-a", level: 8, xp: 37, base_hp: 913 }, { id: "test-b" }, { id: "test-c" }], selected: ["test-c", "test-a", "test-b"] });

test("uses the owned instances in formation order, including server-updated stats", () => {
  const g = make(), before = JSON.stringify(g), team = snapshot(g);
  assert.equal(team.ready, true);
  assert.equal(team.own[1], g.roster[0]);
  assert.equal(JSON.stringify(g), before);
  g.roster = [{ ...g.roster[0], level: 9, xp: 12, base_hp: 1127 }, ...g.roster.slice(1)];
  assert.equal(snapshot(g).own[1], g.roster[0]);
  assert.equal(snapshot(g).own[1].base_hp, 1127);
});
test("missing and repeated ids cannot become a ready team", () => {
  for (const selected of [[], ["test-a"], ["test-a", "missing", "test-c"], ["test-a", "test-a", "test-c"]]) {
    assert.equal(snapshot({ ...make(), selected }).ready, false);
  }
});
test("borrowed champion uses two own slots and never supplies fabricated XP", () => {
  const championBorrow = { name: "Test lender", beast: { id: "test-borrowed", stats: { hp: 300 } } };
  const team = snapshot({ ...make(), championBorrow });
  assert.equal(team.ownNeeded, 2);
  assert.equal(team.own.length, 2);
  assert.equal(team.champion, championBorrow);
  assert.equal(team.champion.beast.xp, undefined);
  assert.equal(team.ready, true);
});
test("an owned champion cannot also occupy an own slot", () => {
  const g = make();
  const team = snapshot({ ...g, championBorrow: { beast: g.roster[0] } });
  assert.equal(team.duplicateChampion, true);
  assert.equal(team.ready, false);
});
test("expedition occupancy blocks own and self-borrowed units until refreshed", () => {
  const g = make();
  g.expeditions = [{ beast_ids: ["test-a"] }];
  assert.equal(snapshot(g).busy, true);
  assert.equal(snapshot(g).ready, false);
  g.selected = ["test-b", "test-c"];
  g.championBorrow = { beast: g.roster[0] };
  assert.equal(snapshot(g).ready, false);
  g.expeditions = [];
  assert.equal(snapshot(g).ready, true);
});
test("an empty roster stays empty and produces no starter entities", () => {
  const team = snapshot({});
  assert.equal(team.own.length, 0);
  assert.equal(team.ready, false);
});
