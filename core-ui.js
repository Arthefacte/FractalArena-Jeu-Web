/* ============================================================
   FRACTAL ARENA — Cores : helpers d'affichage PURS (testables Node).
   - descArgs : arguments numériques des gabarits i18n CORE_<ID>_D.
   - coreDesc : délègue au gabarit avec les valeurs de LA RARETÉ de l'instance.
   La rareté met à l'échelle les INTENSITÉS de l'effet (miroir serveur :
   CORE_RARITY_MULT / CORE_SCALED_KEYS de data.node.js), jamais les seuils,
   durées ni booléens. Afficher le chiffre du catalogue (racine : 15 %) sur
   une Rare annonçait la valeur d'une Commune — les deux cartes étaient
   indiscernables à l'écran (signalé par le fondateur le 08/10/2026).
   ============================================================ */
(() => {
  const D = window.FA_DATA;

  // Rareté absente ou inconnue → Commune, comme le serveur (instances d'avant
  // la rareté : coreEffect retombe sur ×1.0).
  function rarityMult(rarity) {
    return Object.hasOwn(D.CORE_RARITY_MULT, rarity) ? D.CORE_RARITY_MULT[rarity] : 1.0;
  }

  // 0.1875 → 18.75 ; 0.08 → 8 (2 décimales max, sans zéro traînant) — 18.75 est
  // exactement le facteur appliqué en combat, on ne l'arrondit pas à 18.8.
  function pct(x) { return Math.round(x * 10000) / 100; }

  // Un entry par core : (effect, mult) → args du gabarit CORE_<ID>_D, dans
  // l'ordre des %s. Seules les clés scalées côté serveur figurent ici : ni
  // `duration` (1 tour du Gardien), ni `below` (seuil des 30 % PV), ni
  // `first_strike` (l'Overclock est tout-ou-rien à toutes les raretés).
  const DESC_ARGS = {
    fury_core:       (e, m) => [pct(e.atk * m)],
    guardian_core:   (e, m) => [pct(e.shield * m)],
    overclock_core:  () => [],
    regen_core:      (e, m) => [pct(e.heal * m)],
    feedback_core:   (e, m) => [pct(e.reflect * m)],
    last_stand_core: (e, m) => [pct(e.atk * m), pct(e.def * m)],
  };

  function descArgs(core_id, rarity) {
    const id = String(core_id || "").toLowerCase();
    const c = Object.hasOwn(D.CORES, id) ? D.CORES[id] : null;
    const f = Object.hasOwn(DESC_ARGS, id) ? DESC_ARGS[id] : null;
    if (!c || !f) return [];            // core inconnu : rien à injecter, jamais d'exception
    return f(c.effect || {}, rarityMult(rarity));
  }

  function coreDesc(inst, t) {
    const id = String((inst && inst.core_id) || "").toLowerCase();
    if (!id) return "";
    return t("CORE_" + id.toUpperCase() + "_D", ...descArgs(id, inst.rarity));
  }

  window.FA_CORE_UI = { pct, rarityMult, descArgs, coreDesc };
})();
