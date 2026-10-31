/* ============================================================
   FRACTAL ARENA — Décision de poursuite du mode Boucle (arène)
   Pur, sans effet de bord. Global navigateur (window.FA_LOOP) + export Node.

   Règle produit : quand le quota quotidien de loops du tier choisi (Or/Argent)
   est atteint, la BOUCLE S'ARRÊTE. Pas de repli automatique sur Bronze — sinon
   la boucle continuerait à puiser dans le solde après l'épuisement des « boucles
   d'or ». Le Bronze, lui, n'a aucun plafond (loop illimité tant que solvable).
   ============================================================ */
(function () {
  "use strict";

  // state : { freeFights, loopSilverToday, loopGoldToday, liquid, locked, useLocked }
  // econ  : { BET:{bronze,silver,gold}, LOOP_SILVER_MAX, LOOP_GOLD_MAX }
  // → { go:true } | { go:false, reason:"free"|"cap"|"funds", tier? }
  function loopDecision(state, betTier, econ) {
    const s = state || {};

    // Boucle de combats gratuits : continue tant qu'il reste des combats gratuits.
    if (betTier === "") {
      return s.freeFights > 0 ? { go: true } : { go: false, reason: "free" };
    }

    // Plafond quotidien atteint sur le tier choisi → ARRÊT (priorité sur la solvabilité).
    if (betTier === "silver" && s.loopSilverToday >= econ.LOOP_SILVER_MAX) {
      return { go: false, reason: "cap", tier: "silver" };
    }
    if (betTier === "gold" && s.loopGoldToday >= econ.LOOP_GOLD_MAX) {
      return { go: false, reason: "cap", tier: "gold" };
    }

    // Solvabilité. Verrouillage ON : la mise sort UNIQUEMENT du verrouillé.
    const amt = econ.BET[betTier] || 0;
    const solvent = s.useLocked ? s.locked >= amt : (s.liquid + s.locked) >= amt;
    return solvent ? { go: true } : { go: false, reason: "funds" };
  }

  // Miroir CLIENT de resolveLoopBet/resolveFreeFights (fight.js serveur) : les quotas
  // quotidiens se réinitialisent à MINUIT UTC (resetTs antérieur au jour courant →
  // compteurs remis à neuf). Le serveur ne tranche qu'au /fight suivant et GET /save
  // renvoie les compteurs bruts d'hier — sans ce calcul, l'écran affiche des loops
  // épuisés jusqu'au prochain combat. Pur AFFICHAGE/état local : /save ignore ces
  // champs (SERVER-OWNED), le serveur refera le même calcul, infalsifiable, au combat.
  const ONE_DAY_MS = 86_400_000;
  function resolveDaily(s, now, freeMax) {
    const dayStart = now - (now % ONE_DAY_MS);
    const freeStale = (Number(s.freeResetTs) || 0) < dayStart;
    const loopStale = (Number(s.loopResetTs) || 0) < dayStart;
    const freeFights = freeStale ? freeMax : Math.min(Math.max(s.freeFights | 0, 0), freeMax);
    const loopSilverToday = loopStale ? 0 : s.loopSilverToday | 0;
    const loopGoldToday = loopStale ? 0 : s.loopGoldToday | 0;
    return {
      changed: freeStale || loopStale || freeFights !== s.freeFights,
      freeFights,
      freeResetTs: freeStale ? now : Number(s.freeResetTs) || 0,
      loopSilverToday,
      loopGoldToday,
      loopResetTs: loopStale ? now : Number(s.loopResetTs) || 0,
      nextResetAt: dayStart + ONE_DAY_MS,
    };
  }

  // ── Durée d'une session de boucle ─────────────────────────────────────────
  // La boucle n'est PAS un pilote automatique permanent : c'est une session d'une
  // heure. Au bout des 60 minutes, elle ne relance plus de combat (le combat en cours
  // va au bout), et le joueur doit REVENIR appuyer sur « Boucle : ON » pour repartir
  // pour une heure. Le chrono vit côté client et n'est pas une ressource : le serveur
  // ne le connaît pas et ne le paie pas — ce qu'il faut freiner, c'est l'attention
  // laissée sans surveillance, pas la triche (chaque combat reste payé et plafonné
  // par les quotas quotidiens, inchangés).
  const LOOP_SESSION_MS = 60 * 60_000;

  // Reste-t-il du temps dans la session ouverte à `startedAt` ?
  // → { open:true, msLeft, endsAt } | { open:false, msLeft:0, endsAt }
  function loopSession(startedAt, now) {
    const start = Number(startedAt) || 0;
    if (!start) return { open: false, msLeft: 0, endsAt: 0 };
    const endsAt = start + LOOP_SESSION_MS;
    const msLeft = Math.max(0, endsAt - (Number(now) || 0));
    return { open: msLeft > 0, msLeft, endsAt };
  }

  // « 59:59 » / « 1:00:00 » — affichage du chrono, jamais une règle de jeu.
  function loopClock(msLeft) {
    const s = Math.max(0, Math.ceil((Number(msLeft) || 0) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const two = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
  }

  const api = { loopDecision, resolveDaily, loopSession, loopClock, LOOP_SESSION_MS };

  if (typeof window !== "undefined") window.FA_LOOP = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
