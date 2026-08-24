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

  window.FA_LB_LIVE_UI = { rowKey, diffChanges };
})();
