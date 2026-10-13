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

test("fusion de RANG : trois cœurs convergent, durée majorée, phases dédiées", () => {
  const o = { mode: "rank", tier: "B", color: "#FB923C" };
  // Le 3 → 1 se paie en temps de jeu : le palier + le surplus, le temps de voir les trois entrer.
  assert.strictEqual(U.duration(o), U.DUR.TIER[1] + U.DUR.RANK_BONUS);
  assert.ok(U.duration(o) > U.duration({ mode: "fuse", success: true, tier: "B" }),
    "une fusion de rang dure plus qu'une fusion de rareté du même palier");
  assert.strictEqual(U.duration({ mode: "summon", tier: "B" }), U.DUR.TIER[1], "les autres modes ne bougent pas");
  // Début : trois cœurs ÉCARTÉS et visibles (le joueur doit voir trois entités, pas deux).
  const debut = U.forgeVals(0.2, o);
  assert.ok(debut.tri > 0.5, "trois cœurs écartés au départ, tri = " + debut.tri);
  assert.ok(debut.triA > 0, "et visibles");
  assert.strictEqual(debut.phase, "appel");
  // Milieu : convergés (tri = 0), éteints, et le cœur UNIQUE de la fusion prend le relais.
  const milieu = U.forgeVals(0.62, o);
  assert.strictEqual(milieu.tri, 0, "les trois ont convergé");
  assert.strictEqual(milieu.triA, 0, "et se sont éteints dans le cœur unique");
  assert.ok(milieu.core > 0, "le cœur fusionné est présent");
  assert.strictEqual(milieu.phase, "cristallisation");
  // Fin : éclat, et cette fusion ne peut pas échouer (le serveur garantit 100 %).
  const fin = U.forgeVals(0.95, o);
  assert.strictEqual(fin.phase, "eclat");
  assert.strictEqual(fin.success, true);
  assert.strictEqual(fin.premium, false, "aucun éclat doré : ce n'est pas un ticket Or");
  // La couleur vient du RANG atteint (C/B/A/S) — aucune rareté n'est lue dans ce mode.
  assert.strictEqual(U.forgeVals(0.5, o).color, "#FB923C");
  assert.strictEqual(U.forgeVals(0.5, o).success, true);
  // Les autres modes n'exposent toujours rien de la convergence.
  assert.strictEqual(U.forgeVals(0.2, { mode: "summon", tier: "B" }).tri, undefined);
});
