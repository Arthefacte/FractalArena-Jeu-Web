const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../arene-ui.js");
const U = globalThis.window.FA_ARENE_UI;

test("leagueLabel", () => {
  assert.strictEqual(U.leagueLabel("bronze"), "Bronze");
  assert.strictEqual(U.leagueLabel("diamant"), "Diamant");
  assert.strictEqual(U.leagueLabel(null), "—");
});

test("leagueColor renvoie une string non vide pour chaque ligue", () => {
  for (const l of ["bronze", "argent", "or", "diamant"]) {
    assert.strictEqual(typeof U.leagueColor(l), "string");
    assert.ok(U.leagueColor(l).length > 0);
  }
});

test("fmtCountdown", () => {
  assert.strictEqual(U.fmtCountdown(0), "0m");
  assert.strictEqual(U.fmtCountdown(-5000), "0m");
  assert.strictEqual(U.fmtCountdown(90 * 60000), "1h 30m");
  assert.strictEqual(U.fmtCountdown(50 * 3600000), "2j 2h");
});

test("eventLogLines : tableau de chaînes, tolère vide", () => {
  assert.deepStrictEqual(U.eventLogLines([]), []);
  const lines = U.eventLogLines([{ t: "crit", tname: "Nyx", down: true }, { t: "win" }]);
  assert.ok(Array.isArray(lines) && lines.every((s) => typeof s === "string"));
  assert.ok(lines.length >= 1);
});

test("entryModes : free dispo si free_remaining>0, fa toujours, ticket toujours", () => {
  const m = U.entryModes({ free_remaining: 2, fa_cost: 50 });
  const free = m.find((x) => x.key === "free");
  assert.strictEqual(free.available, true);
  assert.ok(m.find((x) => x.key === "fa"));
  assert.ok(m.find((x) => x.key === "ticket"));
  const m0 = U.entryModes({ free_remaining: 0, fa_cost: 50 });
  assert.strictEqual(m0.find((x) => x.key === "free").available, false);
});
