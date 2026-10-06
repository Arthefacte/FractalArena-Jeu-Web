/* Read-only campaign team projection. Account stats remain server-owned. */
(function () {
  "use strict";
  function snapshot(g, championUI) {
    const champion = g.championBorrow || null;
    const ownNeeded = championUI.requiredOwnCount(!!champion);
    const ids = (g.selected || []).slice(0, ownNeeded);
    const roster = g.roster || [];
    const own = ids.map(id => roster.find(b => b.id === id)).filter(Boolean);
    const busyIds = new Set((g.expeditions || []).flatMap(e => Array.isArray(e.beast_ids) ? e.beast_ids : []));
    const duplicateChampion = !!champion && ids.includes(champion.beast.id);
    const busy = own.some(b => busyIds.has(b.id)) || !!champion && busyIds.has(champion.beast.id);
    const ready = ids.length === ownNeeded && own.length === ownNeeded
      && new Set(ids).size === ownNeeded && !duplicateChampion && !busy;
    return { champion, ownNeeded, ids, own, busyIds, busy, duplicateChampion, ready };
  }
  window.FA_CAMPAIGN_TEAM = { snapshot };
})();
