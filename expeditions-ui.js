/* ============================================================
   FRACTAL ARENA — Expéditions : logique pure (testable en Node)
   Miroir EXACT du serveur (fractal-arena-server/expeditions.js +
   leaderboard.js). Le serveur fait foi : le taux calculé ici n'est
   qu'un APERÇU d'affichage — le taux FIGÉ renvoyé par
   POST /expeditions/start le remplace toujours.
   ============================================================ */
(function () {
  "use strict";

  // Mondes dans l'ordre de la Campagne ; ref = puissance de référence serveur.
  var WORLDS = [
    { id: "blocs",    type: "HASH",    ref: 400,  i18nKey: "EXP_W_BLOCS",    color: "var(--elec)",    rgb: "0,240,255"  },
    { id: "mines",    type: "MINING",  ref: 700,  i18nKey: "EXP_W_MINES",    color: "var(--gold)",    rgb: "255,230,0"  },
    { id: "registre", type: "LEDGER",  ref: 1100, i18nKey: "EXP_W_REGISTRE", color: "var(--forge)",   rgb: "176,38,255" },
    { id: "reseau",   type: "NETWORK", ref: 1600, i18nKey: "EXP_W_RESEAU",   color: "var(--success)", rgb: "39,224,138" },
    { id: "genesis",  type: "GENESIS", ref: 2200, i18nKey: "EXP_W_GENESIS",  color: "var(--fire)",    rgb: "247,147,26" },
    { id: "coeur",    type: "BLOCK",   ref: 3000, i18nKey: "EXP_W_COEUR",    color: "var(--alert)",   rgb: "255,59,92"  },
  ];
  var DURATIONS = [
    { s: 3600,  i18nKey: "EXP_D_1H" },
    { s: 7200,  i18nKey: "EXP_D_2H" },
    { s: 28800, i18nKey: "EXP_D_8H" },
  ];
  var FRAGMENT_COSTS = { C: 100, B: 250, A: 600, S: 1000 };

  // Échelle de puissance du serveur (leaderboard.js) — ne pas dériver.
  var RARITY_WEIGHT = { Common: 1, Rare: 1.5, Epic: 2.5, Legendary: 4 };
  function levelMult(level) { return 1 + 0.03 * ((level || 1) - 1); }
  function beastPower(b) {
    if (!b) return 0;
    var base = (b.base_hp || 0) + (b.base_atk || 0) + (b.base_def || 0) + (b.base_spd || 0) + (b.base_mag || 0);
    return base * levelMult(b.level) * (RARITY_WEIGHT[b.rarity] || 1);
  }
  function collectionPower(creatures) {
    if (!Array.isArray(creatures)) return 0;
    return Math.round(creatures.reduce(function (s, b) { return s + beastPower(b); }, 0));
  }

  function worldOf(destKey) {
    for (var i = 0; i < WORLDS.length; i++) if (WORLDS[i].id === destKey) return WORLDS[i];
    return null;
  }
  function affinityBonus(team, destKey) {
    var w = worldOf(destKey);
    if (!w) return 0;
    var n = (team || []).filter(function (b) { return b && b.type === w.type; }).length;
    return Math.min(n * 5, 15);
  }
  function previewSuccessRate(team, destKey) {
    var w = worldOf(destKey);
    if (!w) return 40;
    var P = collectionPower(team);
    var base = Math.round((110 * P) / (P + w.ref));
    return Math.max(40, Math.min(98, base + affinityBonus(team, destKey)));
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return "00:00";
    var t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var p = function (n) { return String(n).padStart(2, "0"); };
    return h > 0 ? h + ":" + p(m) + ":" + p(s) : p(m) + ":" + p(s);
  }

  // exp = ligne de GET /expeditions/state (actives + non réclamées seulement).
  function statusOf(exp, now) {
    if (!exp) return "free";
    return new Date(exp.ends_at).getTime() > now ? "running" : "ready";
  }

  window.FA_EXPEDITIONS_UI = {
    WORLDS: WORLDS, DURATIONS: DURATIONS, FRAGMENT_COSTS: FRAGMENT_COSTS,
    beastPower: beastPower, collectionPower: collectionPower, worldOf: worldOf,
    affinityBonus: affinityBonus, previewSuccessRate: previewSuccessRate,
    fmtCountdown: fmtCountdown, statusOf: statusOf,
  };
})();
