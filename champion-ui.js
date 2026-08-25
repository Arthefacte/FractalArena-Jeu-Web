/* ==== FRACTAL ARENA — Champion de soutien : helpers purs ====
   Spec serveur : fractal-arena-server/docs/superpowers/specs/2026-08-23-champion-soutien-design.md
   Testable en Node (globalThis.window = {}) comme tour-ui.js. */
(function () {
  // v1 : le champion emprunte occupe TOUJOURS le slot 2 (arriere).
  const CHAMPION_SLOT = 2;

  function requiredOwnCount(hasChampion) { return hasChampion ? 2 : 3; }

  // Etat du champion dans le run de Tour : suivi par SON id dans roster_state
  // (le serveur applique l attrition au snapshot comme aux autres entites).
  function championRunState(rosterState, beastId) {
    const st = (rosterState || {})[beastId];
    if (!st) return { hpFrac: 1, dead: false };
    const hpFrac = typeof st.hp_frac === "number" ? st.hp_frac : 1;
    return { hpFrac, dead: !!st.dead || hpFrac <= 0 };
  }

  // Agregat pour le bandeau « ton champion a servi » : une ligne par jour.
  function aggregateUsesByDay(uses) {
    const map = new Map();
    for (const u of uses || []) {
      const k = String(u.day).slice(0, 10);
      const a = map.get(k) || { day: k, fights: 0, commission: 0, points: 0, names: [] };
      a.fights += 1;
      a.commission += u.commission || 0;
      a.points += u.points || 0;
      if (u.borrower_name && !a.names.includes(u.borrower_name) && a.names.length < 3) a.names.push(u.borrower_name);
      map.set(k, a);
    }
    return [...map.values()].sort((x, y) => (x.day < y.day ? 1 : -1));
  }

  // Jours a afficher : les agregats serveur (exhaustifs, /champion/uses days[])
  // portent les chiffres ; les noms viennent des 20 dernieres lignes, seule
  // source qui les connait. Sans days (vieux serveur), repli sur l agregat local.
  function mergeDays(days, uses) {
    const local = aggregateUsesByDay(uses);
    if (!Array.isArray(days) || !days.length) return local;
    const names = new Map(local.map((a) => [a.day, a.names]));
    return days.map((d) => ({ day: d.day, fights: d.fights, commission: d.commission,
      points: d.points, names: names.get(d.day) || [] }));
  }

  window.FA_CHAMPION_UI = { CHAMPION_SLOT, requiredOwnCount, championRunState, aggregateUsesByDay, mergeDays };
})();
