/* ============================================================
   FRACTAL ARENA — Reliques 3D : données pures (chemins + rareté).
   Global navigateur (window.FA_RELIC_ASSETS) + export Node.
   ============================================================ */
(function () {
  "use strict";

  const TYPES = [
    "ruby_shard", "sapphire_plate", "quartz_lens", "amber_cell",
    "cobalt_spring", "onyx_membrane", "jade_circuit", "prism_matrix",
  ];

  // URL versionnée (FA_ASSET_URL, data.js) : sans elle le CDN sert indéfiniment
  // l'ancien modèle, y compris après un allègement d'assets.
  // Garde `typeof` : ce module est aussi chargé en CommonJS par les tests node,
  // où `window` n'existe pas du tout (et non « vaut undefined »).
  function path(type) {
    const brut = "assets/relics/" + type + ".glb";
    const url = typeof window !== "undefined" && window.FA_ASSET_URL;
    return url ? url(brut) : brut;
  }

  // Rareté = halo émissif (couleur + intensité). Préserve la couleur du modèle.
  const RARITY_GLOW = {
    Common:    { color: 0x9CA3AF, intensity: 0.15 },
    Rare:      { color: 0x3B82F6, intensity: 0.35 },
    Epic:      { color: 0xB026FF, intensity: 0.60 },
    Legendary: { color: 0xF7931A, intensity: 0.95 },
  };

  const api = { TYPES, path, RARITY_GLOW };
  if (typeof window !== "undefined") window.FA_RELIC_ASSETS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
