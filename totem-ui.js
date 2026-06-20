// totem-ui.js — logique UI pure du Totem (art de repli + libellés)
(function () {
  "use strict";

  // Repli déterministe : asset du type (en attendant l'art génératif, Plan 5)
  const TYPE_ART = {
    HASH: "assets/HASHBYTE.png", MINING: "assets/MINER.png", LEDGER: "assets/LEDGER.png",
    NETWORK: "assets/NETWORK.png", BLOCK: "assets/BLOCK.png", GENESIS: "assets/GENESIS.png",
  };
  const TIER_NAMES = ["Dormant", "Hatchling", "Fledgling", "Ascendant", "Sovereign", "Ascended"];

  function totemArtFallback(type) { return TYPE_ART[type] || "assets/HASHBYTE.png"; }
  function tierName(tier) { return TIER_NAMES[tier] || TIER_NAMES[0]; }
  function pct(x) { return Math.round((x || 0) * 100); }
  function auraSummary(aura) {
    if (!aura || (!aura.ampSameType && !aura.globalBuff)) return "Aucun bonus (dormant)";
    return `+${pct(aura.ampSameType)}% même type · +${pct(aura.globalBuff)}% global`;
  }
  function totemArt(t) {
    if (!t) return "assets/HASHBYTE.png";
    return t.displayArtUrl || t.artUrl || totemArtFallback(t.type);
  }
  // Images de palier révélées, pour la galerie cosmétique. Trié par palier croissant.
  function galleryItems(t) {
    if (!t || !t.artByTier) return [];
    return Object.keys(t.artByTier)
      .map(Number)
      .filter(n => n >= 1 && n <= (t.revealedTier || 0))
      .sort((a, b) => a - b)
      .map(tier => ({ tier, url: t.artByTier[tier] }));
  }

  const api = { totemArtFallback, totemArt, galleryItems, tierName, auraSummary, TIER_NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FA_TOTEM_UI = api;
})();
