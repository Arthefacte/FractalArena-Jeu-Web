// dex-ui.js — formatage PUR des données DEX (/dex/status) pour le bandeau économie.
// Patron tape-ui.js : IIFE, window.FA_DEX, testé par test/dex-ui.test.js.
(function () {
  "use strict";

  // Prix spot en FB. Les réserves du pool donnent des prix très petits (~6e-5) :
  // 3 chiffres significatifs, jamais de notation exponentielle. Prix absent,
  // nul ou négatif → null, le rendu masque la rangée (pas de valeur fabriquée).
  function prixTexte(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0) return null;
    const decimales = Math.max(0, 2 - Math.floor(Math.log10(n)));
    return n.toFixed(decimales);
  }

  // Variation 24 h : l'API renvoie une fraction (0.0012 = +0,12 %).
  function variationTexte(v) {
    const n = Number(v) || 0;
    return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
  }

  const api = { prixTexte, variationTexte };
  if (typeof window !== "undefined") window.FA_DEX = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
