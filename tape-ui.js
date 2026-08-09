// tape-ui.js — composition PURE de la tape boursière du header (idée #7).
// La tape affiche de vraies données (/buyback/status) : ce module transforme le
// relevé en items structurés, sans DOM ni I18N — le rendu (buyback.jsx) formate.
// Patron juice-ui.js : IIFE, window.FA_TAPE, testé par test/tape-ui.test.js.
(function () {
  "use strict";

  // Âge → palier lisible. Renvoie {unite, n} : le rendu choisit la clé i18n.
  // Un âge négatif (horloge serveur en avance sur le client) vaut « à l'instant »
  // plutôt qu'un « il y a -1 min » qui décrédibiliserait toute la tape.
  function tempsRelatif(ageMs) {
    const a = Math.max(0, Number(ageMs) || 0);
    if (a < 60000) return { unite: "now", n: 0 };
    if (a < 3600000) return { unite: "min", n: Math.floor(a / 60000) };
    if (a < 86400000) return { unite: "h", n: Math.floor(a / 3600000) };
    return { unite: "j", n: Math.floor(a / 86400000) };
  }

  // Le cycle d'items de la tape, dans l'ordre d'affichage :
  //   1. rachats exécutés (last_buyback), du plus récent au plus ancien — la
  //      preuve la plus forte que l'économie tourne, elle ouvre le cycle ;
  //   2. entrées vues dans la session ({tier: montant}, alimenté par gainsPools) ;
  //   3. remplissage de chaque pool (pct entier borné 0-100 : un carryover
  //      au-delà du seuil n'affiche pas « 400 % ») ;
  //   4. cumul racheté, seulement s'il est positif (« CUMUL 0 FA » au lancement
  //      dirait le contraire de ce que la tape veut prouver).
  function composerTape(pools, gainsSession, maintenantMs) {
    if (!Array.isArray(pools) || !pools.length) return [];
    const items = [];

    const rachats = [];
    for (const p of pools) {
      const lb = p && p.last_buyback;
      if (!lb || !lb.at) continue;
      const ageMs = maintenantMs - new Date(lb.at).getTime();
      rachats.push({
        type: "rachat",
        tier: p.tier,
        montant: lb.amount != null ? lb.amount : p.tier,
        age: tempsRelatif(ageMs),
        ageMs,
        txid: lb.txid || null,
      });
    }
    rachats.sort((a, b) => a.ageMs - b.ageMs);
    items.push(...rachats);

    const gains = gainsSession || {};
    for (const tier of Object.keys(gains)) {
      const montant = gains[tier];
      if (montant > 0) items.push({ type: "entree", tier: Number(tier), montant });
    }

    for (const p of pools) {
      if (!p || !p.tier) continue;
      const frac = (p.total || 0) / (p.threshold || p.tier || 1);
      items.push({ type: "pool", tier: p.tier, pct: Math.round(Math.max(0, Math.min(1, frac)) * 100) });
    }

    const cumul = pools.reduce((s, p) => s + ((p && p.total_bought) || 0), 0);
    if (cumul > 0) items.push({ type: "cumul", montant: cumul });

    return items;
  }

  // Un rachat vient d'être exécuté ⇔ le buyback_count d'un pool a augmenté
  // entre deux relevés. Même garde que gainsPools : rien au premier relevé
  // (sinon un joueur qui se connecte après 7 rachats prendrait 7 pluies d'or),
  // et un pool absent du relevé précédent est ignoré (on ne sait pas d'où il
  // part). Renvoie {tier: montant} — montant du dernier rachat, tier en repli.
  function rachatsDetectes(prev, suivants, initialise) {
    const rachats = {};
    if (!initialise || !Array.isArray(prev) || !Array.isArray(suivants)) return rachats;
    const avant = new Map(prev.map((p) => [p.tier, p.buyback_count || 0]));
    for (const p of suivants) {
      if (!avant.has(p.tier)) continue;
      if ((p.buyback_count || 0) > avant.get(p.tier)) {
        const lb = p.last_buyback;
        rachats[p.tier] = lb && lb.amount != null ? lb.amount : p.tier;
      }
    }
    return rachats;
  }

  window.FA_TAPE = { composerTape, rachatsDetectes, tempsRelatif };
})();
