/* ==== FRACTAL ARENA — Classement vivant : helpers purs ====
   Detection des lignes qui ont bouge entre deux fetches (flash visuel).
   Testable en Node (globalThis.window = {}) comme tour-ui.js. */
(function () {
  // Cle stable d'une ligne (le rang change justement quand ca bouge).
  function rowKey(row) { return row.wallet_short || row.name; }

  // Lignes dont la valeur OU le rang a change entre deux tops.
  // Les nouveaux entrants ne flashent pas (premier affichage, pas un mouvement).
  function diffChanges(prevTop, nextTop) {
    const changed = new Set();
    const prev = new Map((prevTop || []).map((r) => [rowKey(r), r]));
    for (const r of nextTop || []) {
      const p = prev.get(rowKey(r));
      if (p && (p.value !== r.value || p.rank !== r.rank)) changed.add(rowKey(r));
    }
    return changed;
  }

  // Recence « il y a X » : cle i18n + valeur (le composant fait I18N.t(key, n)).
  // null si l age est inconnu (compte sans updated_at).
  function formatAgo(ageS) {
    if (typeof ageS !== "number" || !isFinite(ageS)) return null;
    const s = Math.max(0, Math.floor(ageS));
    if (s < 60) return { key: "LB_AGO_NOW", n: null };
    if (s < 3600) return { key: "LB_AGO_MIN", n: Math.floor(s / 60) };
    if (s < 86400) return { key: "LB_AGO_H", n: Math.floor(s / 3600) };
    return { key: "LB_AGO_D", n: Math.floor(s / 86400) };
  }

  window.FA_LB_LIVE_UI = { rowKey, diffChanges, formatAgo };
})();
