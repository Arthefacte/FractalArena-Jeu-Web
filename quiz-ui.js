/* ============================================================
   FRACTAL ARENA — Quiz éducatif : logique pure.
   Aucun DOM, aucun réseau, aucune horloge implicite : `now` est
   toujours passé en paramètre. quiz.jsx peint le résultat.
   Spec : repo serveur, docs/superpowers/specs/2026-08-06-quiz-educatif-design.md
   ============================================================ */
(function () {
  "use strict";

  const QUIZ_INTERVAL_MS = 30000; // une bulle toutes les 30 s
  const QUIZ_TOAST_MS = 15000;    // puis elle s'efface toute seule

  // Le joueur n'est jamais interrompu : pas pendant un combat, une cinématique
  // ou une signature UniSat, et jamais deux toasts en même temps.
  function shouldAsk(state, now) {
    if (!state || !state.wallet) return false;
    if (state.toastOpen || state.busy) return false;
    return now - (state.lastAskAt || 0) >= QUIZ_INTERVAL_MS;
  }

  function nextDueAt(now) {
    return now + QUIZ_INTERVAL_MS;
  }

  // Le bandeau montre un don réel, sinon le cumul communautaire. Jamais de faux
  // joueur : un bandeau qui invente du trafic se repère tout de suite.
  function tickerLine(data, t) {
    if (!data) return "";
    const dons = data.dons || [];
    if (dons.length > 0) return t("QUIZ_TICKER_DON", dons[0].nom, dons[0].amount);
    if (data.total > 0) return t("QUIZ_TICKER_TOTAL", data.total);
    return "";
  }

  const api = { QUIZ_INTERVAL_MS, QUIZ_TOAST_MS, shouldAsk, nextDueAt, tickerLine };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_QUIZ_UI = api;
})();
