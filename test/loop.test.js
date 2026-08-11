const test = require("node:test");
const assert = require("node:assert");
const { loopDecision, resolveDaily } = require("../loop.js");

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

/* ---- resolveDaily : miroir client de la règle serveur (minuit UTC) ---- */

const DAY = 86_400_000;
const FREE_MAX = 5;
// now = 10h00 UTC un jour quelconque
const NOW = 1_754_000_000_000 - (1_754_000_000_000 % DAY) + 10 * 3_600_000;
const DAY_START = NOW - (NOW % DAY);

const daily = (over) => resolveDaily(Object.assign({
  freeFights: 2,
  freeResetTs: DAY_START + 3_600_000,   // reset fait aujourd'hui à 01h UTC
  loopSilverToday: 40,
  loopGoldToday: 20,
  loopResetTs: DAY_START + 3_600_000,
}, over), NOW, FREE_MAX);

test("resolveDaily : resets d'aujourd'hui → rien ne change", () => {
  const r = daily({});
  assert.strictEqual(r.changed, false);
  assert.strictEqual(r.freeFights, 2);
  assert.strictEqual(r.loopSilverToday, 40);
  assert.strictEqual(r.loopGoldToday, 20);
});

test("resolveDaily : loops épuisés HIER → remis à zéro dès maintenant (sans combat)", () => {
  const r = daily({ loopSilverToday: 100, loopGoldToday: 50, loopResetTs: DAY_START - 4 * 3_600_000 });
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.loopSilverToday, 0);
  assert.strictEqual(r.loopGoldToday, 0);
  assert.strictEqual(r.loopResetTs, NOW);
  // les combats gratuits d'aujourd'hui ne bougent pas
  assert.strictEqual(r.freeFights, 2);
});

test("resolveDaily : combats gratuits d'hier → recrédités au plafond", () => {
  const r = daily({ freeFights: 0, freeResetTs: DAY_START - 1 });
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.freeFights, FREE_MAX);
  assert.strictEqual(r.freeResetTs, NOW);
});

test("resolveDaily : timestamp absent/0 → traité comme périmé (nouveau compte)", () => {
  const r = daily({ freeResetTs: 0, loopResetTs: undefined, freeFights: 0, loopSilverToday: 7 });
  assert.strictEqual(r.freeFights, FREE_MAX);
  assert.strictEqual(r.loopSilverToday, 0);
});

test("resolveDaily : clamp anti-dérive — jamais au-dessus du plafond quotidien", () => {
  const r = daily({ freeFights: 99 });
  assert.strictEqual(r.freeFights, FREE_MAX);
});

test("resolveDaily : nextResetAt = prochain minuit UTC", () => {
  const r = daily({});
  assert.strictEqual(r.nextResetAt, DAY_START + DAY);
});
