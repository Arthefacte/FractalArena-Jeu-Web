// test/talents-data.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
const TAL = window.FA_TALENTS;

const TYPES = ["HASH", "NETWORK", "LEDGER", "GENESIS", "MINING", "BLOCK"];

test("catalogue : 36 talents, ids uniques", () => {
  assert.strictEqual(TAL.TALENT_LIST.length, 36);
  const ids = new Set(TAL.TALENT_LIST.map((t) => t.id));
  assert.strictEqual(ids.size, 36);
  for (const t of TAL.TALENT_LIST) assert.strictEqual(TAL.TALENTS[t.id], t);
});

test("catalogue : 2 options exactement par type × palier", () => {
  for (const type of TYPES) {
    for (const tier of [25, 50, 75]) {
      const opts = TAL.talentsFor(type, tier);
      assert.strictEqual(opts.length, 2, `${type} L${tier}`);
      for (const t of opts) { assert.strictEqual(t.type, type); assert.strictEqual(t.tier, tier); }
    }
  }
});

test("constantes : paliers, coûts de respec, multiplicateurs de rareté", () => {
  assert.deepStrictEqual(TAL.TIER_KEYS, ["25", "50", "75"]);
  assert.deepStrictEqual(TAL.RESPEC_COST, { "25": 500, "50": 1500, "75": 4000 });
  assert.deepStrictEqual(TAL.TALENT_RARITY_MULT, { Common: 1.0, Rare: 1.3, Epic: 1.6, Legendary: 2.0 });
});

test("scaled : applique le mult de rareté, fallback 1.0", () => {
  assert.strictEqual(TAL.scaled(0.2, "Legendary"), 0.4);
  assert.strictEqual(TAL.scaled(0.2, "Common"), 0.2);
  assert.strictEqual(TAL.scaled(0.2, "Inconnu"), 0.2);
});

test("valeurs calibrées : échantillon anti-dérive vs serveur (§9.2)", () => {
  // Sentinelles des valeurs recalibrées en passe 2 — si le serveur rechange, ce test rappelle de resynchroniser.
  assert.deepStrictEqual(TAL.TALENTS.hash_cadence.p, { stat: "spd", per: 0.32, cap: 1.10 });
  assert.deepStrictEqual(TAL.TALENTS.net_execution.p, { below: 0.50, mult: 2.50 });
  assert.deepStrictEqual(TAL.TALENTS.led_malediction.p, { stat: "atk", mult: 0.05 });
  assert.deepStrictEqual(TAL.TALENTS.gen_apogee.p, { afterRound: 5, mult: 0.05 });
  assert.deepStrictEqual(TAL.TALENTS.gen_renaissance.p, { hpFrac: 0.03 });
  assert.deepStrictEqual(TAL.TALENTS.blk_forteresse.p, { frac: 0.05, team: true, below: 0.50 });
});
