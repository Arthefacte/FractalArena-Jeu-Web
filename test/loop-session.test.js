const { test } = require("node:test");
const assert = require("node:assert");
const L = require("../loop");

// La boucle n'est pas un pilote automatique permanent : une session dure une heure.
// Ce sont les règles PURES ; le rendu est vérifié par le test de câblage.

test("une session neuve ouvre une heure pleine", () => {
  const t0 = 1_700_000_000_000;
  const s = L.loopSession(t0, t0);
  assert.strictEqual(s.open, true);
  assert.strictEqual(s.msLeft, L.LOOP_SESSION_MS);
  assert.strictEqual(s.endsAt, t0 + 60 * 60_000);
});

test("au bout de 60 minutes, la session est fermée — pas une seconde de plus", () => {
  const t0 = 1_700_000_000_000;
  assert.strictEqual(L.loopSession(t0, t0 + L.LOOP_SESSION_MS - 1).open, true);
  assert.strictEqual(L.loopSession(t0, t0 + L.LOOP_SESSION_MS).open, false);
  assert.strictEqual(L.loopSession(t0, t0 + L.LOOP_SESSION_MS + 3_600_000).open, false);
});

test("sans session ouverte, rien ne tourne", () => {
  assert.deepStrictEqual(L.loopSession(0, Date.now()), { open: false, msLeft: 0, endsAt: 0 });
  assert.strictEqual(L.loopSession(null, 5).open, false);
});

test("le chrono affiche mm:ss puis h:mm:ss", () => {
  assert.strictEqual(L.loopClock(60 * 60_000), "1:00:00");
  assert.strictEqual(L.loopClock(59 * 60_000 + 59_000), "59:59");
  assert.strictEqual(L.loopClock(5_000), "0:05");
  assert.strictEqual(L.loopClock(0), "0:00");
});

test("la décision de quota reste indépendante de la session", () => {
  // La session borne l'attention ; les plafonds quotidiens restent la règle serveur.
  const econ = { BET: { bronze: 10, silver: 50, gold: 100 }, LOOP_SILVER_MAX: 100, LOOP_GOLD_MAX: 50 };
  assert.strictEqual(L.loopDecision({ loopSilverToday: 100 }, "silver", econ).reason, "cap");
  assert.strictEqual(L.loopDecision({ loopSilverToday: 0, liquid: 500, locked: 0 }, "silver", econ).go, true);
});
