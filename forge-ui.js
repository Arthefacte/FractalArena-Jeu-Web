/* FRACTAL ARENA — Forge : helpers purs (testables Node) */
(function () {
  const KEYS = [
    { stat: "hp",  key: "base_hp",  label: "HP" },
    { stat: "atk", key: "base_atk", label: "ATK" },
    { stat: "def", key: "base_def", label: "DEF" },
    { stat: "spd", key: "base_spd", label: "SPD" },
    { stat: "mag", key: "base_mag", label: "MAG" },
  ];
  // Verrous de reroll (miroir serveur forge.js — PR#49) : max 2, surcoût ×1.5/verrou.
  const MAX_REROLL_LOCKS = 2;
  const REROLL_LOCK_MULT = 1.5;

  // Ajoute/retire un verrou (immutable). Retourne null si l'ajout dépasserait le max.
  function toggleLock(locks, stat) {
    const L = Array.isArray(locks) ? locks : [];
    if (L.includes(stat)) return L.filter((s) => s !== stat);
    if (L.length >= MAX_REROLL_LOCKS) return null;
    return [...L, stat];
  }

  // Coût affiché avec verrous : arrondi sur le PRODUIT (parité formule serveur).
  function withLockCost(cost, nLocks) {
    return Math.round(cost * Math.pow(REROLL_LOCK_MULT, nLocks || 0));
  }

  function rerollDiff(oldStats, newStats, locks) {
    const o = oldStats || {}, n = newStats || {}, L = Array.isArray(locks) ? locks : [];
    return KEYS.map(({ stat, key, label }) => {
      const from = Number(o[key]) || 0;
      const to = Number(n[key]) || 0;
      const dir = to > from ? "up" : to < from ? "down" : "same";
      return { key, label, from, to, dir, locked: L.includes(stat) };
    });
  }

  window.FA_FORGE_UI = { rerollDiff, toggleLock, withLockCost, MAX_REROLL_LOCKS, REROLL_LOCK_MULT, LOCKABLE: KEYS };
})();
