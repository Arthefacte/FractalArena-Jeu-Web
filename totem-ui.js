// totem-ui.js — logique UI pure du Totem (art de repli + libellés)
(function () {
  "use strict";

  // Repli déterministe : asset du type (en attendant l'art génératif, Plan 5)
  const TYPE_ART = {
    HASH: "assets/HASHBYTE.webp", MINING: "assets/MINER.webp", LEDGER: "assets/LEDGER.webp",
    NETWORK: "assets/NETWORK.webp", BLOCK: "assets/BLOCK.webp", GENESIS: "assets/GENESIS.webp",
  };
  const TIER_NAMES = ["Dormant", "Hatchling", "Fledgling", "Ascendant", "Sovereign", "Ascended"];

  function totemArtFallback(type) { return TYPE_ART[type] || "assets/HASHBYTE.webp"; }
  function tierName(tier) { return TIER_NAMES[tier] || TIER_NAMES[0]; }
  function pct(x) { return Math.round((x || 0) * 100); }
  function auraSummary(aura) {
    if (!aura || (!aura.ampSameType && !aura.globalBuff)) return "Aucun bonus (dormant)";
    return `+${pct(aura.ampSameType)}% même type · +${pct(aura.globalBuff)}% global`;
  }
  function totemArt(t) {
    if (!t) return "assets/HASHBYTE.webp";
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

  // Miroir STRICT de totem.js serveur (accomplishmentLevel) — parité testée.
  // acc 0..3 = meilleur des deux chemins : mondes bouclés (1/2/4) ou
  // victoires payantes (100/400/1200).
  function accomplishmentLevel(worldsCompleted, paidWins) {
    let camp = 0;
    if (worldsCompleted >= 4) camp = 3; else if (worldsCompleted >= 2) camp = 2; else if (worldsCompleted >= 1) camp = 1;
    let win = 0;
    if (paidWins >= 1200) win = 3; else if (paidWins >= 400) win = 2; else if (paidWins >= 100) win = 1;
    return Math.max(camp, win);
  }

  const api = { totemArtFallback, totemArt, galleryItems, tierName, auraSummary, accomplishmentLevel, TIER_NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FA_TOTEM_UI = api;
})();
