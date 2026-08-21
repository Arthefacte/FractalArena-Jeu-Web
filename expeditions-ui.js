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
  // loot = coefficient d XP/FA ; frag = le rang de fragment que ce monde produit,
  // et lui seul. C est ce qui donne une raison de monter : le S n existe qu au Coeur.
  var WORLDS = [
    { id: "blocs",    type: "HASH",    ref: 400,  loot: 1,    frag: "C", i18nKey: "EXP_W_BLOCS",    color: "var(--elec)",    rgb: "0,240,255"  },
    { id: "mines",    type: "MINING",  ref: 700,  loot: 1.15, frag: "C", i18nKey: "EXP_W_MINES",    color: "var(--gold)",    rgb: "255,230,0"  },
    { id: "registre", type: "LEDGER",  ref: 1100, loot: 1.3,  frag: "B", i18nKey: "EXP_W_REGISTRE", color: "var(--forge)",   rgb: "176,38,255" },
    { id: "reseau",   type: "NETWORK", ref: 1600, loot: 1.45, frag: "B", i18nKey: "EXP_W_RESEAU",   color: "var(--success)", rgb: "39,224,138" },
    { id: "genesis",  type: "GENESIS", ref: 2200, loot: 1.65, frag: "A", i18nKey: "EXP_W_GENESIS",  color: "var(--fire)",    rgb: "247,147,26" },
    { id: "coeur",    type: "BLOCK",   ref: 3000, loot: 1.85, frag: "S", i18nKey: "EXP_W_COEUR",    color: "var(--alert)",   rgb: "255,59,92"  },
  ];
  // Durée LIBRE de 1 a 12 h : plus de paliers, un curseur.
  var DURATION_MIN_H = 1, DURATION_MAX_H = 12;
  var XP_PER_H = 25, FA_PER_H = 10;
  var FRAG_PER_H = { C: 2, B: 0.9, A: 0.75, S: 0.5 };
  var RISK_MULT = 1.3, FAIL_MULT = 0.35, TICKET_MULT = 1.5;
  var DUST_MIN_H = 8;
  var FRAGMENT_COSTS = { C: 100, B: 250, A: 600, S: 1000 };

  function durationBonus(h) { return 1 + 0.02 * (h - 1); }
  function scaled(perHour, h) { return Math.round(perHour * h * durationBonus(h)); }

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
  // Plafond UNIQUE : le taux NE DÉPEND PLUS DU MODE (les plafonds 90/70 sont
  // supprimés). Un plafond ne mordait qu au-dela de 720 de puissance aux Blocs,
  // donc pour un debutant les deux modes affichaient deja le meme chiffre.
  var RATE_MIN = 15, RATE_MAX = 98, RATE_CAP = 90;
  function previewSuccessRate(team, destKey) {
    var w = worldOf(destKey);
    if (!w) return RATE_MIN;
    var P = collectionPower(team);
    var base = Math.round((110 * P) / (P + w.ref));
    var raw = Math.max(RATE_MIN, Math.min(RATE_MAX, base + affinityBonus(team, destKey)));
    return Math.min(raw, RATE_CAP);
  }
  // Taux réellement figé au lancement : le ticket Or achète la certitude.
  function previewStartRate(team, destKey, ticket) {
    return ticket === "or" ? 100 : previewSuccessRate(team, destKey);
  }

  // Aperçu du butin, miroir de rollOutcome côté serveur. Sert l écran de config :
  // sans ces chiffres affichés, le joueur ne peut pas choisir en connaissance de
  // cause — et un choix non informé n en est pas un.
  function previewLoot(destKey, h, mode, ticket, success) {
    var w = worldOf(destKey);
    if (!w) return null;
    var risky = mode === "risquee";
    var tMult = (ticket === "argent" || ticket === "or") ? TICKET_MULT : 1;
    var out = { rank: w.frag, xp: 0, fa: 0, frags: 0 };
    if (success) {
      var m = (risky ? RISK_MULT : 1) * tMult;
      out.xp = Math.round(scaled(XP_PER_H, h) * w.loot * m);
      out.fa = Math.round(scaled(FA_PER_H, h) * w.loot * m);
      out.frags = Math.round(scaled(FRAG_PER_H[w.frag], h) * m);
    } else if (risky) {
      out.frags = 1;   // on ne rentre jamais les mains vides
    } else {
      var f = FAIL_MULT * tMult;
      out.xp = Math.round(scaled(XP_PER_H, h) * f);
      out.fa = Math.round(scaled(FA_PER_H, h) * f);
      out.frags = Math.round(scaled(FRAG_PER_H[w.frag], h) * f);
    }
    return out;
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

  // Traduction d'un code d'erreur serveur des Expéditions (codes 1:1 avec les
  // clés EXP_ERR_<code>). I18N résolu à l'appel — absent dans les tests Node,
  // on renvoie alors le code brut. Partagé par l'écran ET la Forge (fragments).
  function errText(code) {
    var I = typeof window !== "undefined" && window.FA_I18N;
    if (!I) return String(code);
    var k = "EXP_ERR_" + code;
    var s = I.t(k);
    return s === k ? I.t("EXP_ERR_generic") : s;
  }

  window.FA_EXPEDITIONS_UI = {
    WORLDS: WORLDS, FRAGMENT_COSTS: FRAGMENT_COSTS,
    DURATION_MIN_H: DURATION_MIN_H, DURATION_MAX_H: DURATION_MAX_H, DUST_MIN_H: DUST_MIN_H,
    XP_PER_H: XP_PER_H, FA_PER_H: FA_PER_H, FRAG_PER_H: FRAG_PER_H,
    RISK_MULT: RISK_MULT, FAIL_MULT: FAIL_MULT, TICKET_MULT: TICKET_MULT,
    RATE_MIN: RATE_MIN, RATE_CAP: RATE_CAP,
    durationBonus: durationBonus, scaled: scaled,
    beastPower: beastPower, collectionPower: collectionPower, worldOf: worldOf,
    affinityBonus: affinityBonus, previewSuccessRate: previewSuccessRate,
    previewStartRate: previewStartRate, previewLoot: previewLoot,
    fmtCountdown: fmtCountdown, statusOf: statusOf, errText: errText,
  };
})();
