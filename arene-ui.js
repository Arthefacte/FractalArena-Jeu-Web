/* ============================================================
   FRACTAL ARENA — Arène (PvP) : helpers purs (testables Node)
   ============================================================ */
(function () {
  const LEAGUE_LABEL = { bronze: "Bronze", argent: "Argent", or: "Or", diamant: "Diamant" };
  const LEAGUE_COLOR = { bronze: "#CD7F32", argent: "#C0C0C0", or: "var(--gold)", diamant: "var(--elec)" };

  function leagueLabel(l) { return LEAGUE_LABEL[l] || "—"; }
  function leagueColor(l) { return LEAGUE_COLOR[l] || "var(--text-dim)"; }

  function fmtCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + "j " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  }

  function eventLogLines(events) {
    if (!Array.isArray(events)) return [];
    const out = [];
    for (const e of events) {
      if (!e || !e.t) continue;
      if (e.down && e.tname) out.push("✖ " + e.tname);
      else if (e.t === "win") out.push("→ victoire");
      else if (e.t === "lose") out.push("→ défaite");
    }
    return out;
  }

  function entryModes(cadence) {
    const c = cadence || {};
    return [
      { key: "free", available: (c.free_remaining | 0) > 0 },
      { key: "fa", available: true },
      { key: "ticket", available: true },
    ];
  }

  window.FA_ARENE_UI = { leagueLabel, leagueColor, fmtCountdown, eventLogLines, entryModes };
})();
