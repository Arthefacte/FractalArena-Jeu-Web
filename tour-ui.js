/* ============================================================
   FRACTAL ARENA — Tour infinie : helpers purs (testables Node)
   Miroir d'affichage du serveur (tower.js) — le serveur fait foi
   pour toute décision (validation, paliers, PV). PIÈGE : garder
   TIERS/ENTRY_COST identiques au serveur (test anti-dérive Task 5).
   ============================================================ */
(function () {
  const ENTRY_COST = 2000; // re-run payant, 100 % → Buyback Reserve
  const TIERS = [
    { floor: 5,  fa: 100,  silver: 0, gold: 0 },
    { floor: 10, fa: 150,  silver: 1, gold: 0 },
    { floor: 15, fa: 250,  silver: 0, gold: 0 },
    { floor: 20, fa: 350,  silver: 0, gold: 1 },
    { floor: 25, fa: 500,  silver: 0, gold: 0 },
    { floor: 30, fa: 650,  silver: 1, gold: 0 },
    { floor: 35, fa: 800,  silver: 0, gold: 0 },
    { floor: 40, fa: 1000, silver: 0, gold: 1 },
    { floor: 45, fa: 1200, silver: 0, gold: 0 },
    { floor: 50, fa: 1500, silver: 0, gold: 0 },
  ];

  function tiersView(bestFloor, claimed) {
    const c = Array.isArray(claimed) ? claimed : [];
    const best = bestFloor | 0;
    return TIERS.map((t) => ({ ...t, reached: t.floor <= best, claimed: c.includes(t.floor) }));
  }

  function hpFracOf(rosterState, id) {
    const st = rosterState && rosterState[id];
    if (!st || typeof st.hp_frac !== "number") return 1;
    return Math.max(0, Math.min(1, st.hp_frac));
  }

  function isDeadInRun(rosterState, id) {
    const st = rosterState && rosterState[id];
    return !!(st && (st.dead || st.hp_frac <= 0));
  }

  function rosterRunView(roster, rosterState) {
    return (roster || []).map((b) => ({ beast: b, hpFrac: hpFracOf(rosterState, b.id), dead: isDeadInRun(rosterState, b.id) }));
  }

  function aliveCount(roster, rosterState) {
    return (roster || []).reduce((n, b) => n + (isDeadInRun(rosterState, b.id) ? 0 : 1), 0);
  }

  // Pré-vol client (confort UX) — le serveur revalide tout (betes_invalides).
  function validateEngage(selectedIds, roster, rosterState) {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (ids.length !== 3 || new Set(ids).size !== 3) return { ok: false, reason: "need3" };
    const byId = new Set((roster || []).map((b) => b.id));
    for (const id of ids) {
      if (!byId.has(id)) return { ok: false, reason: "unknown" };
      if (isDeadInRun(rosterState, id)) return { ok: false, reason: "dead" };
    }
    return { ok: true };
  }

  function nextTier(bestFloor) {
    const best = bestFloor | 0;
    return TIERS.find((t) => t.floor > best) || null;
  }

  window.FA_TOUR_UI = { ENTRY_COST, TIERS, tiersView, hpFracOf, isDeadInRun, rosterRunView, aliveCount, validateEngage, nextTier };
})();
