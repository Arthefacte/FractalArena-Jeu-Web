/* ============================================================
   FRACTAL ARENA — Talents : helpers UI purs (testables en node).
   - Déblocage des paliers : miroir de syncTalentSlots (data.node.js
     serveur) — le serveur ne backfill que paresseusement, le client
     dérive l'état sans exiger beast.talents.
   - descArgs : arguments numériques des templates TAL_<id>_D.
     Le mult de rareté scale les MAGNITUDES, jamais les seuils
     (below/above/n/rounds/after/afterRound/perRoundCap/decay,
     ni chance des debuffs LEDGER) — sémantique engine.node.js.
   ============================================================ */
(() => {
  const TAL = window.FA_TALENTS;

  function rarityMult(rarity) {
    return Object.hasOwn(TAL.TALENT_RARITY_MULT, rarity) ? TAL.TALENT_RARITY_MULT[rarity] : 1.0;
  }

  function tierUnlocked(beast, tierKey) {
    if (!beast) return false;
    if (beast.rarity && beast.rarity !== "Common") return true;
    return (beast.level | 0) >= Number(tierKey);
  }

  function slotState(beast) {
    return TAL.TIER_KEYS.map((key) => ({
      key,
      unlocked: tierUnlocked(beast, key),
      chosen: (beast && beast.talents && typeof beast.talents === "object" && beast.talents[key]) || null,
    }));
  }

  function chooseCost(beast, tierKey) {
    const chosen = beast && beast.talents && typeof beast.talents === "object" && beast.talents[tierKey];
    if (!chosen) return { cost: 0, freeRespec: false };
    if (beast.respec_free === true) return { cost: 0, freeRespec: true };
    return { cost: TAL.RESPEC_COST[tierKey], freeRespec: false };
  }

  // 0.075 → 7.5 ; 1.10 → 110 (1 décimale max, sans zéro traînant).
  function pct(x) { return Math.round(x * 1000) / 10; }

  // Un entry par talent : (p, m) → args du template TAL_<id>_D, dans l'ordre des %s.
  const DESC_ARGS = {
    hash_surchauffe:  () => [],
    hash_cadence:     (p, m) => [pct(p.per * m), pct(p.cap * m)],
    hash_momentum:    (p, m) => [pct(p.mult * m), p.rounds],
    hash_faille:      (p, m) => [pct(p.frac * m)],
    hash_rupture:     (p, m) => [pct(p.below), pct(p.mult * m)],
    hash_surcadence:  (p, m) => [p.after, pct(p.bonus * m)],
    net_predateur:    (p, m) => [pct(p.mult * m), pct(p.below)],
    net_celerite:     (p, m) => [pct(p.start * m), pct(p.decay)],
    net_mise_a_mort:  (p, m) => [pct(p.below), pct(p.frac * m)],
    net_insaisissable:(p, m) => [pct(p.chance * m), p.rounds],
    net_execution:    (p, m) => [pct(p.mult * m), pct(p.below)],
    net_chaine:       (p) => [p.perRoundCap],
    led_focalisation: (p, m) => [pct(p.mult * m)],
    led_corrosion:    (p, m) => [pct(p.per * m), pct(p.cap * m)],
    led_resonance:    (p, m) => [p.n, pct(p.mult * m)],
    led_brouillage:   (p, m) => [pct(p.chance), pct(p.per * m)],
    led_surcharge:    (p, m) => [pct(p.below), pct(p.stats.mag * m)],
    led_malediction:  (p, m) => [pct(p.mult * m)],
    gen_croissance:   (p, m) => [pct(p.per * m), pct(p.cap * m)],
    gen_adaptation:   (p, m) => [pct(p.mult * m)],
    gen_second_souffle:(p, m) => [pct(p.below), pct(p.frac * m)],
    gen_elan:         (p, m) => [pct(p.per * m)],
    gen_renaissance:  (p, m) => [pct(p.hpFrac * m)],
    gen_apogee:       (p, m) => [p.afterRound, pct(p.mult * m)],
    min_tenacite:     (p, m) => [pct(p.reduce * m), pct(p.above)],
    min_recuperation: (p, m) => [pct(p.frac * m)],
    min_roc:          () => [],
    min_contrepoids:  (p, m) => [pct(p.below), pct(p.stats.def * m), pct(p.stats.atk * m)],
    min_inebranlable: (p) => [pct(p.above)],
    min_attrition:    (p, m) => [pct(p.per * m)],
    blk_riposte:      (p, m) => [pct(p.frac * m)],
    blk_blindage:     (p, m) => [pct(p.reduce * m), p.rounds],
    blk_provocation:  () => [],
    blk_endurance:    (p, m) => [pct(p.below), pct(p.stats.def * m)],
    blk_rempart:      () => [],
    blk_forteresse:   (p, m) => [pct(p.below), pct(p.frac * m)],
  };

  function descArgs(talent, rarity) {
    const fn = DESC_ARGS[talent.id];
    return fn ? fn(talent.p, rarityMult(rarity)) : [];
  }

  function talentDesc(talent, rarity, tFn) {
    return tFn("TAL_" + talent.id + "_D", ...descArgs(talent, rarity));
  }

  window.FA_TALENTS_UI = { tierUnlocked, slotState, chooseCost, pct, descArgs, talentDesc };
})();
