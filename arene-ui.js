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

  // Compte à rebours AVEC secondes (pour le pré-lancement, qui tick chaque seconde).
  function fmtCountdownSec(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (d > 0) return d + "j " + pad(h) + "h " + pad(m) + "m " + pad(sec) + "s";
    return h + "h " + pad(m) + "m " + pad(sec) + "s";
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

  // Mode de saison. Si la saison existe et n'est pas encore ouverte (live === false),
  // renvoie prelaunch=true + le temps restant (ms) avant l'ouverture (starts_at).
  // Tout autre cas (pas de saison, ou live === true) → prelaunch=false.
  function seasonCountdown(season, now) {
    if (!season || season.live !== false) return { prelaunch: false, ms: 0 };
    return { prelaunch: true, ms: Math.max(0, Number(season.starts_at) - now) };
  }

  // Libellés des synergies de compo — PUREMENT COSMÉTIQUE (le serveur fait foi).
  // Miroir EXACT des règles de computeSynergies (engine.node.js) : Affinité +8% (3 même
  // type), Spectre +4% (3 types distincts), Duo +5% (la paire), Caste +4% (même rareté).
  function computeSynergiesLabels(team) {
    if (!Array.isArray(team) || team.length !== 3) return [];
    const types = team.map((b) => b && b.type);
    const rarities = team.map((b) => b && b.rarity);
    const out = [];
    const distinct = types.every(Boolean) ? new Set(types).size : 0;
    if (distinct === 1) out.push({ key: "affinity", label: "Affinité", effect: "+8% stats (aucune couverture de type)" });
    else if (distinct === 3) out.push({ key: "spectre", label: "Spectre", effect: "+4% stats à l'équipe" });
    else if (distinct === 2) out.push({ key: "duo", label: "Duo", effect: "+5% stats à la paire de même type" });
    if (new Set(rarities).size === 1 && rarities[0]) out.push({ key: "caste", label: "Caste", effect: "+4% stats (même rareté)" });
    return out;
  }

  // Indicateur d'affinité de type — PUREMENT COSMÉTIQUE (le serveur applique
  // déjà le multiplicateur : engine.node.js, getTypeMultiplier). Chiffres
  // dérivés de D.getTypeMultiplier / D.TYPE_ADVANTAGE (data.js), jamais en dur.
  // Pour `myType` face aux types adverses : ↑ si ma bête bat un type adverse
  // (×1.25), ↓ si un type adverse la bat (×0.80), null si neutre ou inconnu.
  // L'avantage prime sur le désavantage quand les deux coexistent (même règle
  // que la Fosse). FA_DATA est lu à l'appel : testable Node sans ordre imposé.
  function affinityIndicator(myType, enemyTypes) {
    const D = window.FA_DATA;
    if (!D || !myType || !Array.isArray(enemyTypes)) return null;
    let up = null, down = null;
    for (const t of enemyTypes) {
      if (!t) continue;
      const mult = D.getTypeMultiplier(myType, t);
      if (mult > 1 && !up) {
        up = { dir: "up", arrow: "↑", color: "var(--success)", vsType: t, pct: Math.round((mult - 1) * 100), tipKey: "AFF_TIP_UP", ariaKey: "AFF_UP_LABEL" };
      } else if (mult < 1 && !down) {
        down = { dir: "down", arrow: "↓", color: "var(--alert)", vsType: t, pct: Math.round((1 - mult) * 100), tipKey: "AFF_TIP_DOWN", ariaKey: "AFF_DOWN_LABEL" };
      }
    }
    return up || down;
  }

  // Écart de puissance à un adversaire, en % de la mienne. Le serveur apparie
  // désormais sur la puissance (±25 %) : c'est ce chiffre, pas l'ELO, qui dit si
  // le combat est jouable. 0 si ma puissance est inconnue — jamais d'Infinity.
  function powerGapPct(mine, theirs) {
    const m = Number(mine), t = Number(theirs);
    if (!(m > 0) || !Number.isFinite(t)) return 0;
    return Math.round((t / m - 1) * 100);
  }
  // Trois paliers de lecture, alignés sur la fenêtre d'appariement du serveur.
  function powerGapTone(pct) {
    const a = Math.abs(Number(pct) || 0);
    if (a <= 10) return "even";
    if (a <= 25) return "edge";
    return "hard";
  }

  window.FA_ARENE_UI = { leagueLabel, leagueColor, fmtCountdown, fmtCountdownSec, eventLogLines, entryModes, seasonCountdown, computeSynergiesLabels, affinityIndicator, powerGapPct, powerGapTone };
})();
