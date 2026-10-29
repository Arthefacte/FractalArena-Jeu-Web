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

test("fmtCountdownSec : affiche les secondes, borné à 0", () => {
  assert.strictEqual(U.fmtCountdownSec(0), "0h 00m 00s");
  assert.strictEqual(U.fmtCountdownSec(-5000), "0h 00m 00s");
  assert.strictEqual(U.fmtCountdownSec((5 * 3600 + 30 * 60 + 9) * 1000), "5h 30m 09s");
  assert.strictEqual(U.fmtCountdownSec(50 * 3600000), "2j 02h 00m 00s");
});

test("eventLogLines : tableau de chaînes, tolère vide", () => {
  assert.deepStrictEqual(U.eventLogLines([]), []);
  const lines = U.eventLogLines([{ t: "crit", tname: "Nyx", down: true }, { t: "win" }]);
  assert.ok(Array.isArray(lines) && lines.every((s) => typeof s === "string"));
  assert.ok(lines.length >= 1);
});

test("entryModes : quota gratuit préservé, FA disponible et stock Argent explicite", () => {
  const m = U.entryModes({ free_remaining: 2, fa_cost: 50 }, { ticketsSilver: 3 });
  const free = m.find((x) => x.key === "free");
  assert.strictEqual(free.available, true);
  assert.strictEqual(m.find((x) => x.key === "fa").available, true);
  assert.deepStrictEqual(m.find((x) => x.key === "ticket"), { key: "ticket", available: true, count: 3 });
  const m0 = U.entryModes({ free_remaining: 0, fa_cost: 50 }, { ticketsSilver: 0 });
  assert.strictEqual(m0.find((x) => x.key === "free").available, false);
  assert.deepStrictEqual(m0.find((x) => x.key === "ticket"), { key: "ticket", available: false, count: 0 });
});

test("entryModes : un stock absent ou invalide ne propose pas de ticket", () => {
  for (const tickets of [undefined, null, {}, { ticketsSilver: -1 }, { ticketsSilver: NaN }, { ticketsSilver: Infinity }]) {
    assert.deepStrictEqual(U.entryModes(null, tickets).find((x) => x.key === "ticket"),
      { key: "ticket", available: false, count: 0 });
  }
});

test("seasonCountdown : live===false → prelaunch + ms restant jusqu'à starts_at", () => {
  const now = 1000;
  const r = U.seasonCountdown({ live: false, starts_at: now + 5000 }, now);
  assert.strictEqual(r.prelaunch, true);
  assert.strictEqual(r.ms, 5000);
});

test("seasonCountdown : ms borné à 0 si starts_at déjà passé", () => {
  const r = U.seasonCountdown({ live: false, starts_at: 500 }, 1000);
  assert.strictEqual(r.prelaunch, true);
  assert.strictEqual(r.ms, 0);
});

test("seasonCountdown : live===true ou pas de saison → prelaunch=false", () => {
  assert.strictEqual(U.seasonCountdown({ live: true, starts_at: 9e15 }, 0).prelaunch, false);
  assert.strictEqual(U.seasonCountdown(null, 0).prelaunch, false);
  assert.strictEqual(U.seasonCountdown(undefined, 0).prelaunch, false);
});
