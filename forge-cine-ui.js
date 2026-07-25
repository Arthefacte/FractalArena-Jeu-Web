/* FRACTAL ARENA — Moment Forge : état pur de la cinématique (testable Node).
   Aucun DOM, aucun aléa, aucune horloge : t (0..1) + options → état exact de la frame.
   Deux axes INDÉPENDANTS : le rang (C/B/A/S, fixé à la naissance) et la rareté
   (Common→Legendary, monte par fusion ; les reliques la tirent à l'invocation). */
(function () {
  "use strict";

  const DUR = { FUSE_FAIL: 1000, TIER: [800, 1200, 1600, 2000] };
  const TIER_MAP = {
    C: 0, B: 1, A: 2, S: 3,
    Common: 0, Rare: 1, Epic: 2, Legendary: 3,
  };

  function tierIndex(tier) {
    const i = TIER_MAP[tier];
    return i === undefined ? 0 : i;
  }

  // Durée totale de la cinématique en ms.
  function duration(o) {
    o = o || {};
    if (o.mode === "fuse" && o.success === false) return DUR.FUSE_FAIL;
    return DUR.TIER[tierIndex(o.tier)];
  }

  const clamp = (x, a, b) => Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x));
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const outBack = (x) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  // État exact de la frame pour t ∈ [0,1].
  // o = { mode:'fuse'|'summon', success, tier ('C'..'S' ou 'Common'..'Legendary'), color, premium }
  function forgeVals(t, o) {
    o = o || {};
    t = clamp(Number(t) || 0);
    const color = o.color || "#38BDF8";
    const L = o.level === undefined ? tierIndex(o.tier) : o.level;
    const I = 0.55 + 0.15 * L; // intensité globale par palier
    if (o.mode === "fuse" && o.success === false) {
      const strike = ramp(t, 0.02, 0.10);
      return {
        success: false, color, L, I: 0.6,
        core: strike * (1 - 0.85 * ramp(t, 0.22, 0.65)),
        ash: ramp(t, 0.30, 0.75),
        strikeFlash: strike * (1 - ramp(t, 0.10, 0.24)),
        sparks: ramp(t, 0.12, 1),
        rings: [], gemScale: 0, gemAlpha: 0, gemPulse: 0,
        shardP: 0, shardA: 0, shardN: 0, flash: 0,
        fade: ramp(t, 0.88, 1),
        phase: t < 0.22 ? "frappe" : "cendres",
      };
    }
    const strike = ramp(t, 0.02, 0.08);
    const ringCount = [1, 2, 2, 3][L];
    const rings = [];
    for (let k = 0; k < ringCount; k++) {
      const p = ramp(t, 0.16 + k * 0.05, 0.46 + k * 0.05);
      if (p > 0 && p < 1) rings.push({ p: outCubic(p), a: (1 - p) * (0.5 + 0.5 * I) });
    }
    const gemT = ramp(t, 0.40, 0.78);
    const burst = t >= 0.80;
    return {
      success: true, color, L, I, premium: !!o.premium,
      core: strike * (1 - 0.75 * ramp(t, 0.45, 0.80)),
      ash: 0,
      strikeFlash: strike * (1 - ramp(t, 0.08, 0.22)),
      sparks: 0,
      rings,
      gemScale: gemT > 0 ? outBack(gemT) : 0,
      gemAlpha: gemT > 0 ? Math.min(1, gemT * 3) * (1 - ramp(t, 0.80, 0.87)) : 0,
      gemPulse: 0.5 + 0.5 * Math.sin(gemT * 14),
      shardP: burst ? outCubic(ramp(t, 0.80, 1)) : 0,
      shardA: burst ? 1 - ramp(t, 0.86, 1) : 0,
      shardN: [10, 14, 20, 26][L],
      flash: burst ? (1 - ramp(t, 0.80, 0.95)) * (0.3 + 0.23 * L) : 0,
      fade: ramp(t, 0.90, 1),
      phase: t < 0.20 ? "frappe" : t < 0.45 ? "onde" : t < 0.80 ? "cristallisation" : "eclat",
    };
  }

  const api = { DUR, tierIndex, duration, forgeVals };
  if (typeof window !== "undefined") window.FA_FORGE_CINE_UI = api;
})();
