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

// ---- Poussière de FB : la condition affichée doit être la VRAIE ----
// Seuil fourni par le serveur : Épique OU PLUS, la Légendaire compte.
// Un désaccord ici n'envoie pas d'argent au mauvais joueur (le serveur
// décide), il MENT au joueur sur ses chances — c'est ce qu'on interdit.
test("isDustTeam : seuil serveur ou plus, exactement 3 entités", () => {
  const t = (...r) => r.map((rarity) => beast("HASH", rarity, 10));
  assert.equal(XU.isDustTeam(t("Epic", "Epic", "Epic"), "Epic"), true);
  assert.equal(XU.isDustTeam(t("Legendary", "Legendary", "Legendary"), "Epic"), true,
    "une équipe 100 % Légendaire y a droit");
  assert.equal(XU.isDustTeam(t("Epic", "Legendary", "Epic"), "Epic"), true, "mélange : oui");
  assert.equal(XU.isDustTeam(t("Epic", "Epic", "Rare"), "Epic"), false, "un Rare exclut");
  assert.equal(XU.isDustTeam(t("Legendary", "Legendary", "Common"), "Epic"), false, "un Common exclut");
  assert.equal(XU.isDustTeam(t("Epic", "Epic"), "Epic"), false, "deux entités : jamais");
  assert.equal(XU.isDustTeam(t("Epic", "Epic", "Epic", "Epic"), "Epic"), false, "quatre : jamais");
  assert.equal(XU.isDustTeam([], "Epic"), false, "équipe vide : jamais");
  assert.equal(XU.isDustTeam([t("Epic")[0], null, t("Epic")[0]], "Epic"), false, "entité absente : jamais");
  assert.equal(XU.isDustTeam(t("Mythique", "Mythique", "Mythique"), "Epic"), false,
    "rang inconnu = sous le seuil, jamais une exception");
  assert.equal(XU.isDustTeam(t("Epic", "Legendary", "Epic"), "Legendary"), false,
    "un changement du seuil serveur doit changer l'éligibilité");
  assert.equal(XU.isDustTeam(t("Rare", "Rare", "Rare"), "Rare"), true);
  for (const min of [undefined, null, "", "Mythique"]) {
    assert.equal(XU.isDustTeam(t("Legendary", "Legendary", "Legendary"), min), false,
      "un seuil absent ou inconnu n'autorise aucune promesse");
  }
});

const dustPayload = () => ({ dust_sats: 1000000, dust_p: 0.05, dust_min_h: 12,
  dust_min_rarity: "Epic", dust_weekly_cap: 5, dust_week: { used: 2, left: 3 } });

test("readDustState : les six champs viennent du serveur, sans seuil local", () => {
  assert.deepEqual(XU.readDustState(dustPayload()), {
    sats: 1000000, probability: 0.05, minHours: 12, minRarity: "Epic", cap: 5, used: 2, left: 3,
  });
  assert.deepEqual(XU.readDustState({ dust_sats: 2500000, dust_p: 0.125, dust_min_h: 10,
    dust_min_rarity: "Legendary", dust_weekly_cap: 7, dust_week: { used: 1, left: 6 } }), {
    sats: 2500000, probability: 0.125, minHours: 10, minRarity: "Legendary", cap: 7, used: 1, left: 6,
  });
  assert.equal(XU.DUST_MIN_H, undefined);
  assert.equal(XU.DUST_MIN_RARITY, undefined);
});

test("readDustState : payload absent, incomplet ou invalide = aucune règle inventée", () => {
  for (const payload of [undefined, null, {}]) assert.equal(XU.readDustState(payload), null);
  for (const field of Object.keys(dustPayload())) {
    const payload = dustPayload();
    delete payload[field];
    assert.equal(XU.readDustState(payload), null, field + " absent");
    assert.equal(XU.readDustState({ ...dustPayload(), [field]: null }), null, field + " null");
  }
  for (const field of ["dust_sats", "dust_p", "dust_min_h", "dust_weekly_cap"]) {
    for (const value of ["12", NaN, Infinity, -1]) {
      assert.equal(XU.readDustState({ ...dustPayload(), [field]: value }), null, field + " invalide");
    }
  }
  assert.equal(XU.readDustState({ ...dustPayload(), dust_p: 1.1 }), null);
  assert.equal(XU.readDustState({ ...dustPayload(), dust_min_rarity: "Mythique" }), null);
  for (const field of ["used", "left"]) {
    for (const value of [undefined, null, "2", -1, 0.5, Infinity]) {
      const payload = dustPayload();
      payload.dust_week[field] = value;
      assert.equal(XU.readDustState(payload), null, "dust_week." + field + " invalide");
    }
  }
});

test("formatDustFB : montant localisé en FB, jusqu'au satoshi", () => {
  assert.equal(XU.formatDustFB(1000000, "FR"), "0,01");
  assert.equal(XU.formatDustFB(1000000, "EN"), "0.01");
  assert.equal(XU.formatDustFB(1000000, "ZH"), "0.01");
  assert.equal(XU.formatDustFB(1, "FR"), "0,00000001");
  assert.equal(XU.formatDustFB(2500000, "EN"), "0.025");
});
