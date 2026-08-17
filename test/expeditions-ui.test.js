// Logique pure des Expéditions côté client — miroir EXACT du serveur
// (expeditions.js serveur : computeSuccessRate ; leaderboard.js : beastPower).
"use strict";
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../expeditions-ui.js");
const XU = globalThis.window.FA_EXPEDITIONS_UI;

function beast(type, rarity, level, statSum) {
  return { id: "b" + Math.random(), type, rarity, level,
    base_hp: statSum, base_atk: 0, base_def: 0, base_spd: 0, base_mag: 0 };
}

test("WORLDS : 6 mondes dans l'ordre Campagne avec refs serveur", () => {
  assert.deepEqual(XU.WORLDS.map((w) => w.id), ["blocs", "mines", "registre", "reseau", "genesis", "coeur"]);
  assert.deepEqual(XU.WORLDS.map((w) => w.ref), [400, 700, 1100, 1600, 2200, 3000]);
  assert.deepEqual(XU.WORLDS.map((w) => w.type), ["HASH", "MINING", "LEDGER", "NETWORK", "GENESIS", "BLOCK"]);
});

test("beastPower : base × levelMult × poids de rareté (échelle serveur)", () => {
  // base 150, level 20 → mult 1+0.03·19, Epic → ×2.5 (même arithmétique flottante que le serveur)
  assert.equal(XU.beastPower(beast("HASH", "Epic", 20, 150)), 150 * (1 + 0.03 * 19) * 2.5);
  assert.equal(XU.beastPower(null), 0);
});

test("collectionPower : somme arrondie", () => {
  const t = [beast("HASH", "Common", 1, 100), beast("HASH", "Common", 1, 100), beast("HASH", "Common", 1, 100)];
  assert.equal(XU.collectionPower(t), 300);
});

test("affinityBonus : +5 par bête du type du monde, max 15", () => {
  const t = [beast("HASH", "Common", 1, 100), beast("HASH", "Common", 1, 100), beast("MINING", "Common", 1, 100)];
  assert.equal(XU.affinityBonus(t, "blocs"), 10);
  assert.equal(XU.affinityBonus(t, "mines"), 5);
  assert.equal(XU.affinityBonus(t, "coeur"), 0);
});

test("previewSuccessRate : clamp [40, 98], formule serveur", () => {
  const weak = [beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50)];
  assert.equal(XU.previewSuccessRate(weak, "coeur"), 40);
  // P = 3 × 100×1.57×2.5 = 1177.5 sur blocs (ref 400) : base = round(110·P/(P+400)) = 82, +15 affinité → 97
  const strong = [beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100)];
  assert.equal(XU.previewSuccessRate(strong, "blocs"), 97);
  assert.ok(XU.previewSuccessRate(strong, "coeur") <= 98);
});

test("previewSuccessRate : plafonds par mode, miroir serveur (prudente 90, risquee 70)", () => {
  // Même équipe forte : 97 brut sur blocs → plafonné selon le mode passé.
  const strong = [beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100)];
  assert.equal(XU.previewSuccessRate(strong, "blocs", "prudente"), 90);
  assert.equal(XU.previewSuccessRate(strong, "blocs", "risquee"), 70);
  // Équipe faible sous les plafonds : le mode ne change rien.
  const weak = [beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50)];
  assert.equal(XU.previewSuccessRate(weak, "coeur", "prudente"), XU.previewSuccessRate(weak, "coeur", "risquee"));
});

test("fmtCountdown", () => {
  assert.equal(XU.fmtCountdown(3661000), "1:01:01");
  assert.equal(XU.fmtCountdown(59000), "00:59");
  assert.equal(XU.fmtCountdown(-5), "00:00");
});

test("statusOf : running tant que ends_at est futur, ready ensuite", () => {
  const now = Date.now();
  assert.equal(XU.statusOf({ ends_at: new Date(now + 60e3).toISOString() }, now), "running");
  assert.equal(XU.statusOf({ ends_at: new Date(now - 1).toISOString() }, now), "ready");
});

test("FRAGMENT_COSTS : seuils du serveur", () => {
  assert.deepEqual(XU.FRAGMENT_COSTS, { C: 100, B: 250, A: 600, S: 1000 });
});
