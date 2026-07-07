/* ============================================================
   FRACTAL ARENA — Talents par palier : CATALOGUE (miroir serveur).
   Miroir de fractal-arena-server/talents-data.js — LE SERVEUR FAIT FOI.
   Magnitudes = valeur Commun ; le mult de rareté scale la PART BONUS,
   jamais les seuils de condition. Ne modifier qu'en resynchronisant
   depuis le serveur (test sentinelle : test/talents-data.test.js).
   ============================================================ */
(() => {
  const TALENT_RARITY_MULT = { Common: 1.0, Rare: 1.3, Epic: 1.6, Legendary: 2.0 };
  const TIER_KEYS = ["25", "50", "75"];
  const RESPEC_COST = { "25": 500, "50": 1500, "75": 4000 };

  function scaled(base, rarity) {
    const m = Object.hasOwn(TALENT_RARITY_MULT, rarity) ? TALENT_RARITY_MULT[rarity] : 1.0;
    return base * m;
  }

  const TALENT_LIST = [
    // ---- HASH — burst / tempo ----
    { id: "hash_surchauffe",  type: "HASH", tier: 25, hook: "setup",  kind: "first_hit_crit",     p: {} },
    { id: "hash_cadence",     type: "HASH", tier: 25, hook: "crit",   kind: "crit_stack_stat",    p: { stat: "spd", per: 0.32, cap: 1.10 } },
    { id: "hash_momentum",    type: "HASH", tier: 50, hook: "kill",   kind: "on_kill_buff",       p: { stat: "atk", mult: 0.20, rounds: 2 } },
    { id: "hash_faille",      type: "HASH", tier: 50, hook: "dmgmod", kind: "crit_ignore_def",    p: { frac: 0.20 } },
    { id: "hash_rupture",     type: "HASH", tier: 75, hook: "dmgmod", kind: "team_atk_enemy_low", p: { below: 0.50, mult: 0.11 } },
    { id: "hash_surcadence",  type: "HASH", tier: 75, hook: "crit",   kind: "crit_count_bonus",   p: { after: 3, bonus: 0.35 } },
    // ---- NETWORK — assassin / exécution ----
    { id: "net_predateur",    type: "NETWORK", tier: 25, hook: "dmgmod", kind: "dmg_vs_low_hp",      p: { below: 0.35, mult: 0.65 } },
    { id: "net_celerite",     type: "NETWORK", tier: 25, hook: "setup",  kind: "opener_spd_decay",   p: { start: 0.06, decay: 0.06 } },
    { id: "net_mise_a_mort",  type: "NETWORK", tier: 50, hook: "onhit",  kind: "execute_rebound",    p: { below: 0.15, frac: 0.20 } },
    { id: "net_insaisissable",type: "NETWORK", tier: 50, hook: "kill",   kind: "on_kill_dodge",      p: { chance: 0.20, rounds: 1 } },
    { id: "net_execution",    type: "NETWORK", tier: 75, hook: "dmgmod", kind: "dmg_vs_low_hp",      p: { below: 0.50, mult: 2.50 } },
    { id: "net_chaine",       type: "NETWORK", tier: 75, hook: "kill",   kind: "on_kill_extra_action", p: { perRoundCap: 1 } },
    // ---- LEDGER — mage / contrôle ----
    { id: "led_focalisation", type: "LEDGER", tier: 25, hook: "dmgmod", kind: "mag_if_untouched",   p: { mult: 0.06 } },
    { id: "led_corrosion",    type: "LEDGER", tier: 25, hook: "onhit",  kind: "debuff_target_stat", p: { stat: "def", per: 0.075, cap: 0.22, chance: 1.0 } },
    { id: "led_resonance",    type: "LEDGER", tier: 50, hook: "dmgmod", kind: "every_n_rounds_dmg", p: { n: 3, mult: 0.25 } },
    { id: "led_brouillage",   type: "LEDGER", tier: 50, hook: "onhit",  kind: "debuff_target_stat", p: { stat: "spd", per: 0.20, cap: 0.20, chance: 0.22 } },
    { id: "led_surcharge",    type: "LEDGER", tier: 75, hook: "dmgmod", kind: "stat_when_self_hp",  p: { stats: { mag: 0.11 }, below: 0.50 } },
    { id: "led_malediction",  type: "LEDGER", tier: 75, hook: "setup",  kind: "curse_strongest",    p: { stat: "atk", mult: 0.05 } },
    // ---- GENESIS — scaling / comeback ----
    { id: "gen_croissance",   type: "GENESIS", tier: 25, hook: "round", kind: "round_stack_all",    p: { per: 0.008, cap: 0.10 } },
    { id: "gen_adaptation",   type: "GENESIS", tier: 25, hook: "onhit", kind: "def_vs_last_attacker_type", p: { mult: 0.10 } },
    { id: "gen_second_souffle", type: "GENESIS", tier: 50, hook: "round", kind: "regen_below",      p: { below: 0.40, frac: 0.055 } },
    { id: "gen_elan",         type: "GENESIS", tier: 50, hook: "dmgmod", kind: "atk_per_ally",      p: { per: 0.06 } },
    { id: "gen_renaissance",  type: "GENESIS", tier: 75, hook: "lethal", kind: "revive_once",       p: { hpFrac: 0.03 } },
    { id: "gen_apogee",       type: "GENESIS", tier: 75, hook: "round", kind: "late_all_stats",     p: { afterRound: 5, mult: 0.05 } },
    // ---- MINING — endurance / attrition ----
    { id: "min_tenacite",     type: "MINING", tier: 25, hook: "dmgmod", kind: "dmg_in_above_hp",    p: { above: 0.60, reduce: 0.05 } },
    { id: "min_recuperation", type: "MINING", tier: 25, hook: "round",  kind: "regen_below",        p: { below: 1.01, frac: 0.006 } },
    { id: "min_roc",          type: "MINING", tier: 50, hook: "onhit",  kind: "immune_first_debuff", p: {} },
    { id: "min_contrepoids",  type: "MINING", tier: 50, hook: "dmgmod", kind: "stat_when_self_hp",  p: { stats: { def: 0.05, atk: 0.025 }, below: 0.50 } },
    { id: "min_inebranlable", type: "MINING", tier: 75, hook: "lethal", kind: "anti_oneshot",       p: { above: 0.30 } },
    { id: "min_attrition",    type: "MINING", tier: 75, hook: "dmgmod", kind: "dmg_out_per_round",  p: { per: 0.007 } },
    // ---- BLOCK — forteresse / riposte ----
    { id: "blk_riposte",      type: "BLOCK", tier: 25, hook: "onhit",  kind: "reflect",             p: { frac: 0.03, team: false } },
    { id: "blk_blindage",     type: "BLOCK", tier: 25, hook: "dmgmod", kind: "dmg_in_early_rounds", p: { rounds: 3, reduce: 0.045 } },
    { id: "blk_provocation",  type: "BLOCK", tier: 50, hook: "target", kind: "taunt",               p: { bias: 2.5 } },
    { id: "blk_endurance",    type: "BLOCK", tier: 50, hook: "dmgmod", kind: "stat_when_self_hp",   p: { stats: { def: 0.11 }, below: 0.40 } },
    { id: "blk_rempart",      type: "BLOCK", tier: 75, hook: "lethal", kind: "survive_lethal_once", p: {} },
    { id: "blk_forteresse",   type: "BLOCK", tier: 75, hook: "onhit",  kind: "reflect",             p: { frac: 0.05, team: true, below: 0.50 } },
  ];

  const TALENTS = {};
  for (const t of TALENT_LIST) TALENTS[t.id] = t;

  function talentsFor(type, tier) {
    return TALENT_LIST.filter((t) => t.type === type && t.tier === (tier | 0));
  }

  window.FA_TALENTS = { TALENTS, TALENT_LIST, talentsFor, TALENT_RARITY_MULT, TIER_KEYS, RESPEC_COST, scaled };
})();
