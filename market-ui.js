/* ============================================================
   FRACTAL ARENA — Marché (reliques) : helpers purs (testables Node)
   Miroir des constantes serveur (market.js) — affichage seulement,
   le serveur reste seul juge des montants réels.
   ============================================================ */
(function () {
  const MARKET_PRICE_MIN = 100;
  const MARKET_PRICE_MAX = 1000000;
  const MARKET_LISTING_FEE_MIN = 20;
  const MARKET_LISTING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function listingFees(price) {
    const listing_fee = Math.max(MARKET_LISTING_FEE_MIN, Math.floor(price * 0.01));
    const commission = Math.floor(price * 0.05);
    return { listing_fee, commission, net_seller: price - commission };
  }

  function isValidPrice(price) {
    return Number.isInteger(price) && price >= MARKET_PRICE_MIN && price <= MARKET_PRICE_MAX;
  }

  function isListingExpired(created_at, nowMs) {
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    return now - new Date(created_at).getTime() >= MARKET_LISTING_TTL_MS;
  }

  // Filtre type/rareté + tri prix croissant (id croissant en départage).
  // `type` matche le type de relique (item.type) OU de core (item.core_id) :
  // un listing porte l'un des deux champs, jamais les deux.
  function filterListings(listings, f) {
    const q = f || {};
    return (Array.isArray(listings) ? listings : [])
      .filter((l) => l && l.item && (!q.type || l.item.type === q.type || l.item.core_id === q.type) && (!q.rarity || l.item.rarity === q.rarity))
      .slice()
      .sort((a, b) => a.price - b.price || a.id - b.id);
  }

  const api = { listingFees, isValidPrice, isListingExpired, filterListings, MARKET_PRICE_MIN, MARKET_PRICE_MAX };
  if (typeof window !== "undefined") window.FA_MARKET = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
