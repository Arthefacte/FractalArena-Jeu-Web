const test = require("node:test");
const assert = require("node:assert");
const { loopDecision } = require("../loop.js");

// ECON minimal reflétant data.js (BET + plafonds quotidiens de loop)
const ECON = {
  BET: { bronze: 100, silver: 500, gold: 2000 },
  LOOP_SILVER_MAX: 100,
  LOOP_GOLD_MAX: 50,
};

// État joueur par défaut : large solde, aucun loop consommé
const state = (over) => Object.assign({
  freeFights: 0,
  loopSilverToday: 0,
  loopGoldToday: 0,
  liquid: 1_000_000,
  locked: 0,
  useLocked: false,
}, over);

test("Or sous le cap + solvable → la boucle continue", () => {
  const d = loopDecision(state({ loopGoldToday: 49 }), "gold", ECON);
  assert.deepStrictEqual(d, { go: true });
});

test("Or AU cap → la boucle s'ARRÊTE (plus de repli Bronze), même solvable", () => {
  const d = loopDecision(state({ loopGoldToday: 50 }), "gold", ECON);
  assert.strictEqual(d.go, false);
  assert.strictEqual(d.reason, "cap");
  assert.strictEqual(d.tier, "gold");
});

test("Argent AU cap → arrêt, tier=silver", () => {
  const d = loopDecision(state({ loopSilverToday: 100 }), "silver", ECON);
  assert.deepStrictEqual(d, { go: false, reason: "cap", tier: "silver" });
});

test("Bronze n'a aucun plafond → continue tant que solvable (loops Or/Argent épuisés sans effet)", () => {
  const d = loopDecision(state({ loopGoldToday: 999, loopSilverToday: 999 }), "bronze", ECON);
  assert.deepStrictEqual(d, { go: true });
});

test("Or sous le cap mais solde insuffisant → arrêt, reason=funds", () => {
  const d = loopDecision(state({ loopGoldToday: 10, liquid: 100 }), "gold", ECON);
  assert.deepStrictEqual(d, { go: false, reason: "funds" });
});

test("Verrouillage ON : le verrouillé doit couvrir la mise, sinon funds", () => {
  const ok = loopDecision(state({ useLocked: true, liquid: 0, locked: 5000 }), "gold", ECON);
  assert.deepStrictEqual(ok, { go: true });
  const ko = loopDecision(state({ useLocked: true, liquid: 1_000_000, locked: 100 }), "gold", ECON);
  assert.deepStrictEqual(ko, { go: false, reason: "funds" });
});

test("Le cap prime sur la solvabilité : Or au cap ET fauché → reason=cap", () => {
  const d = loopDecision(state({ loopGoldToday: 50, liquid: 0, locked: 0 }), "gold", ECON);
  assert.strictEqual(d.reason, "cap");
});

test("Combats gratuits : restants → go ; épuisés → arrêt reason=free", () => {
  assert.deepStrictEqual(loopDecision(state({ freeFights: 3 }), "", ECON), { go: true });
  assert.deepStrictEqual(loopDecision(state({ freeFights: 0 }), "", ECON), { go: false, reason: "free" });
});
