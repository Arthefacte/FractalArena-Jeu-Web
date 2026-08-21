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

test("previewSuccessRate : clamp [15, 98] puis plafond 90, formule serveur", () => {
  const weak = [beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50), beast("LEDGER", "Common", 1, 50)];
  assert.ok(XU.previewSuccessRate(weak, "coeur") >= XU.RATE_MIN);
  // P = 3 x 100x1.57x2.5 = 1177.5 sur blocs (ref 400) : base = 82, +15 affinite -> 97, plafonne a 90
  const strong = [beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100)];
  assert.equal(XU.previewSuccessRate(strong, "blocs"), XU.RATE_CAP);
  assert.ok(XU.previewSuccessRate(strong, "coeur") <= XU.RATE_CAP);
});

test("previewSuccessRate NE DEPEND PLUS DU MODE — miroir exact du serveur", () => {
  // Les plafonds par mode (90/70) sont supprimes : ils ne mordaient qu au-dela
  // de 720 de puissance aux Blocs, donc pour un debutant les deux modes
  // affichaient deja le meme chiffre et la Risquee etait strictement dominante.
  const strong = [beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100), beast("HASH", "Epic", 20, 100)];
  // Un argument de mode en trop ne doit RIEN changer (garde anti-regression).
  assert.equal(XU.previewSuccessRate(strong, "blocs", "prudente"), XU.previewSuccessRate(strong, "blocs", "risquee"));
  assert.equal(XU.previewSuccessRate(strong, "blocs", "prudente"), 90);
  // Seul le ticket Or deplace le taux, et il le pousse a 100.
  assert.equal(XU.previewStartRate(strong, "blocs", null), 90);
  assert.equal(XU.previewStartRate(strong, "blocs", "argent"), 90);
  assert.equal(XU.previewStartRate(strong, "coeur", "or"), 100);
});

test("scaled : barème horaire, +2 %/h au-dela de la premiere heure", () => {
  assert.equal(XU.scaled(XU.XP_PER_H, 1), 25);
  assert.equal(XU.scaled(XU.FA_PER_H, 8), 91);
  assert.equal(XU.scaled(XU.FA_PER_H, 12), 146);
  for (let h = 2; h <= XU.DURATION_MAX_H; h++) {
    assert.ok(XU.scaled(XU.FA_PER_H, h) > XU.scaled(XU.FA_PER_H, h - 1), h + " h doit payer plus que " + (h - 1));
  }
});

test("previewLoot : chaque monde son rang, et l echec Risquee laisse 1 fragment", () => {
  const attendu = { blocs: "C", mines: "C", registre: "B", reseau: "B", genesis: "A", coeur: "S" };
  for (const [id, rank] of Object.entries(attendu)) {
    assert.equal(XU.worldOf(id).frag, rank, id);
    assert.equal(XU.previewLoot(id, 8, "prudente", null, true).rank, rank);
  }
  const echec = XU.previewLoot("coeur", 12, "risquee", null, false);
  assert.equal(echec.xp, 0);
  assert.equal(echec.fa, 0);
  assert.equal(echec.frags, 1);   // on ne rentre jamais les mains vides
});

test("previewLoot : le coefficient du monde porte sur XP/FA, jamais sur les fragments", () => {
  const blocs = XU.previewLoot("blocs", 8, "prudente", null, true);
  const coeur = XU.previewLoot("coeur", 8, "prudente", null, true);
  assert.equal(coeur.fa, Math.round(blocs.fa * 1.85));
  assert.equal(blocs.frags, XU.scaled(XU.FRAG_PER_H.C, 8));
  assert.equal(coeur.frags, XU.scaled(XU.FRAG_PER_H.S, 8));
});

test("previewLoot : le ticket Or n est jamais moins bon que l Argent", () => {
  for (const mode of ["prudente", "risquee"]) {
    for (const id of Object.keys({ blocs: 1, mines: 1, registre: 1, reseau: 1, genesis: 1, coeur: 1 })) {
      const argent = XU.previewLoot(id, 12, mode, "argent", true);
      const or = XU.previewLoot(id, 12, mode, "or", true);
      assert.equal(or.fa, argent.fa, "les deux tickets donnent le meme x1,5 en succes");
      // La difference vient du taux : l Or garantit le succes (previewStartRate).
    }
  }
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
