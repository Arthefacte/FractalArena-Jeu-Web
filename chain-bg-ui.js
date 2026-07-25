/* FRACTAL ARENA — Fond blockchain vivante : état pur du cycle de minage (testable Node).
   Aucun DOM, aucun aléa, aucune horloge. Cycle t ∈ [0,1) : minage → découverte (t=0,74,
   flash+étincelles) → glissement d'un cran (t=0,8→1) pendant que le bloc suivant entre. */
(function () {
  "use strict";

  const GOLD = 2.399963; // angle d'or — variations déterministes

  function cycleVals(t) {
    const FOUND = 0.74, SLIDE = 0.8;
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 10);
    const hexTick = Math.floor(t * 30);
    const d = t - FOUND;
    const flash = d < 0 ? 0 : Math.exp(-(d * d) / 0.0018);
    const spark = d < 0 ? -1 : Math.min(d / 0.14, 1);
    let slide = 0;
    if (t >= SLIDE) { const u = (t - SLIDE) / (1 - SLIDE); slide = u * u * (3 - 2 * u); }
    return { pulse, hexTick, flash, spark, slide, mined: t >= FOUND };
  }

  function blockGeom(i) {
    const g = (((i * GOLD) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return { dy: Math.sin(g) * 6, scale: 0.9 + 0.14 * (0.5 + 0.5 * Math.cos(g * 1.7)), rot: Math.sin(g * 2.3) * 0.08 };
  }

  function hexPair(i, tick) {
    const f = ((((i * 137 + tick * 29) * GOLD) % 1) + 1) % 1;
    return Math.floor(f * 256).toString(16).padStart(2, "0");
  }

  const api = { GOLD, cycleVals, blockGeom, hexPair };
  if (typeof window !== "undefined") window.FA_CHAIN_BG_UI = api;
})();
