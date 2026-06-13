/* ============================================================
   FRACTAL ARENA — Rescale cosmétique des stats adverses (affichage arène)
   Pur, sans effet de bord. Global navigateur (window.FA_COSMETIC) + export Node.
   ============================================================ */
(function () {
  "use strict";

  function _levelMult(level) { return 1 + 0.03 * ((level || 1) - 1); }
  function _effTotal(b) {
    if (!b) return 0;
    const base = (b.base_hp || 0) + (b.base_atk || 0) + (b.base_def || 0) + (b.base_spd || 0) + (b.base_mag || 0);
    return base * _levelMult(b.level);
  }

  // Facteur cosmétique K par colonne i : remonte l'affichage de l'ennemi i vers
  // 85–100 % de la bête joueur i. Jamais de réduction (K>=1), plafonné (K<=12).
  // rng injectable pour les tests (défaut Math.random).
  function cosmeticEnemyScale(enemyTeam, playerTeam, rng) {
    rng = rng || Math.random;
    const out = [];
    const team = Array.isArray(enemyTeam) ? enemyTeam : [];
    for (let i = 0; i < team.length; i++) {
      const enemyTotal = _effTotal(team[i]);
      const playerTotal = _effTotal(playerTeam && playerTeam[i]);
      if (!(enemyTotal > 0) || !(playerTotal > 0)) { out.push(1); continue; }
      const target = playerTotal * (0.85 + rng() * 0.15); // 85–100 %
      let k = target / enemyTotal;
      k = Math.round(k * 1e10) / 1e10; // stabilité flottante
      if (k < 1) k = 1;     // jamais de réduction
      if (k > 12) k = 12;   // garde-fou anti-inflation
      out.push(k);
    }
    return out;
  }

  const api = { cosmeticEnemyScale };
  if (typeof window !== "undefined") window.FA_COSMETIC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
