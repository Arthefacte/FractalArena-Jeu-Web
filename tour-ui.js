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

  // Rotation auto (auto-combat) : les 3 vivantes au hp_frac le plus haut, la plus
  // en forme d'abord (front). Départage déterministe par ordre du roster (testable).
  // null si < 3 vivantes → signal d'arrêt de la boucle auto.
  function pickFittest3(roster, rosterState) {
    const list = roster || [];
    const alive = list.filter((b) => b && !isDeadInRun(rosterState, b.id));
    if (alive.length < 3) return null;
    const idx = new Map(list.map((b, i) => [b.id, i]));
    const sorted = alive.slice().sort((a, b) => {
      const d = hpFracOf(rosterState, b.id) - hpFracOf(rosterState, a.id);
      return d !== 0 ? d : idx.get(a.id) - idx.get(b.id);
    });
    return sorted.slice(0, 3).map((b) => b.id);
  }

  /* Mutateurs de la Tour — formatage seul. Les VALEURS viennent du serveur
     (/tower/state), jamais d'un miroir local : c'est délibéré, le miroir
     TIERS/ENTRY_COST ci-dessus a déjà créé une classe de bug par dérive. */
  const MUT_STAT_KEYS = ["hp", "atk", "def", "spd", "mag"];

  function pct(mult) {
    // Arrondi obligatoire : 1.35 - 1 = 0.35000000000000009 en flottant.
    const p = Math.round((mult - 1) * 1000) / 10;
    if (p === 0) return null;
    return (p > 0 ? "+" : "−") + Math.abs(p) + " %"; // U+2212 pour le moins
  }

  function formatMutator(m) {
    if (!m || !m.id) return { id: (m && m.id) || null, parts: [] };
    const e = m.effects;
    if (!e) return { id: m.id, parts: [] };
    const parts = [];
    for (const k of Object.keys(e)) {
      if (k === "crit") {
        const pts = Math.round(e.crit * 100);
        if (pts !== 0) parts.push({ stat: "crit", text: (pts > 0 ? "+" : "−") + Math.abs(pts) + " pts" });
        continue;
      }
      if (k === "typeBonus" || k === "typeMalus") {
        const t = pct(e[k]);
        if (t) parts.push({ stat: k, text: t });
        continue;
      }
      if (MUT_STAT_KEYS.indexOf(k) === -1) continue;
      const t = pct(e[k]);
      if (t) parts.push({ stat: k, text: t });
    }
    const out = { id: m.id, parts };
    if (m.params && m.params.favored) out.types = { favored: m.params.favored, penalized: m.params.penalized };
    return out;
  }

  function formatMutators(list) {
    return Array.isArray(list) ? list.map(formatMutator) : [];
  }

  window.FA_TOUR_UI = { ENTRY_COST, TIERS, tiersView, hpFracOf, isDeadInRun, rosterRunView, aliveCount, validateEngage, nextTier, pickFittest3, formatMutator, formatMutators };
})();
