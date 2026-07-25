const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-cine-ui.js");
const U = globalThis.window.FA_FORGE_CINE_UI;

test("tierIndex : rangs, raretés, inconnus", () => {
  assert.strictEqual(U.tierIndex("C"), 0);
  assert.strictEqual(U.tierIndex("B"), 1);
  assert.strictEqual(U.tierIndex("A"), 2);
  assert.strictEqual(U.tierIndex("S"), 3);
  assert.strictEqual(U.tierIndex("Common"), 0);
  assert.strictEqual(U.tierIndex("Rare"), 1);
  assert.strictEqual(U.tierIndex("Epic"), 2);
  assert.strictEqual(U.tierIndex("Legendary"), 3);
  assert.strictEqual(U.tierIndex(undefined), 0);
  assert.strictEqual(U.tierIndex("garbage"), 0);
});

test("duration : par tier + échec fusion fixe", () => {
  assert.strictEqual(U.duration({ mode: "summon", tier: "C" }), 800);
  assert.strictEqual(U.duration({ mode: "summon", tier: "S" }), 2000);
  assert.strictEqual(U.duration({ mode: "fuse", success: true, tier: "Legendary" }), 2000);
  assert.strictEqual(U.duration({ mode: "fuse", success: false, tier: "Rare" }), 1000);
  assert.strictEqual(U.duration({ mode: "summon", tier: "Epic" }), 1600);
});

test("phases succès dans l'ordre, phases échec dédiées", () => {
  const o = { mode: "summon", tier: "B" };
  assert.strictEqual(U.forgeVals(0.1, o).phase, "frappe");
  assert.strictEqual(U.forgeVals(0.3, o).phase, "onde");
  assert.strictEqual(U.forgeVals(0.6, o).phase, "cristallisation");
  assert.strictEqual(U.forgeVals(0.95, o).phase, "eclat");
  const f = { mode: "fuse", success: false, tier: "Rare" };
  assert.strictEqual(U.forgeVals(0.1, f).phase, "frappe");
  assert.strictEqual(U.forgeVals(0.5, f).phase, "cendres");
  assert.strictEqual(U.forgeVals(0.5, f).success, false);
  assert.ok(U.forgeVals(0.5, f).ash > 0, "cendres présentes en échec");
});

test("intensité monotone croissante par tier", () => {
  const at = (tier, t) => U.forgeVals(t, { mode: "summon", tier });
  const tiers = ["C", "B", "A", "S"];
  for (let i = 1; i < tiers.length; i++) {
    const lo = at(tiers[i - 1], 0.9), hi = at(tiers[i], 0.9);
    assert.ok(hi.shardN > lo.shardN, `shardN ${tiers[i]} > ${tiers[i - 1]}`);
    assert.ok(hi.flash > lo.flash, `flash ${tiers[i]} > ${tiers[i - 1]}`);
    assert.ok(hi.I > lo.I, `I ${tiers[i]} > ${tiers[i - 1]}`);
    const loR = at(tiers[i - 1], 0.3).rings.length, hiR = at(tiers[i], 0.3).rings.length;
    assert.ok(hiR >= loR, `rings ${tiers[i]} >= ${tiers[i - 1]}`);
  }
});

test("premium → éclats or ; jamais en échec", () => {
  assert.strictEqual(U.forgeVals(0.9, { mode: "fuse", success: true, tier: "Epic", premium: true }).premium, true);
  assert.strictEqual(U.forgeVals(0.9, { mode: "fuse", success: true, tier: "Epic" }).premium, false);
  assert.ok(!U.forgeVals(0.9, { mode: "fuse", success: false, tier: "Epic", premium: true }).premium, "échec jamais premium");
});

test("couleur transmise, repli sinon", () => {
  assert.strictEqual(U.forgeVals(0.5, { mode: "summon", tier: "S", color: "#FACC15" }).color, "#FACC15");
  assert.ok(U.forgeVals(0.5, { mode: "summon", tier: "S" }).color, "repli couleur présent");
});

test("pureté + clamp de t", () => {
  const o = { mode: "summon", tier: "A", color: "#FB923C" };
  assert.deepStrictEqual(U.forgeVals(0.5, o), U.forgeVals(0.5, o));
  assert.strictEqual(U.forgeVals(-1, o).phase, "frappe");
  assert.strictEqual(U.forgeVals(2, o).phase, "eclat");
  assert.ok(Number.isFinite(U.forgeVals(1, o).flash));
  assert.ok(Number.isFinite(U.forgeVals(0, o).core));
});
