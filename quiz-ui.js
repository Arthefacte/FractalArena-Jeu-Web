/* ============================================================
   FRACTAL ARENA — Quiz éducatif : logique pure.
   Aucun DOM, aucun réseau, aucune horloge implicite : `now` est
   toujours passé en paramètre. quiz.jsx peint le résultat.
   Spec : repo serveur, docs/superpowers/specs/2026-08-06-quiz-educatif-design.md
   ============================================================ */
(function () {
  "use strict";

  const QUIZ_INTERVAL_MS = 30000; // une bulle toutes les 30 s
  // 30 s à chaque étape, décompte affiché : pour lire la question, puis — le
  // compteur repart à la réponse — pour lire l'explication et choisir la
  // destination des FA. Tenu sous les 60 s de DONATE_WINDOW_MS (serveur), sinon
  // « Offrir » serait un bouton qui échoue.
  const QUIZ_TOAST_MS = 30000;

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

  // Secondes affichées par le décompte, et unique déclencheur de la fermeture :
  // ce que le joueur lit est ce qui ferme la bulle. Arrondi vers le haut, donc
  // « 0 s » ne s'affiche qu'au moment où elle disparaît vraiment.
  function restantSecondes(finAt, now) {
    return Math.max(0, Math.ceil((finAt - now) / 1000));
  }

  // La matière de la tape des dons. L'ancien tickerLine figeait le bandeau sur
  // dons[0] : la ligne ne changeait jamais entre deux dons (constat joueur,
  // 11/08). Ici : dons agrégés PAR DONATEUR (somme, ordre de première
  // apparition — le serveur renvoie les plus récents d'abord), au plus 8, puis
  // le cumul communautaire en fin de cycle. Jamais de faux joueur : un bandeau
  // qui invente du trafic se repère tout de suite.
  function tickerItems(data) {
    if (!data) return [];
    const parNom = new Map();
    for (const d of data.dons || []) {
      const nom = d && typeof d.nom === "string" ? d.nom : "";
      const amount = Number(d && d.amount);
      if (!nom || !Number.isFinite(amount) || amount <= 0) continue;
      parNom.set(nom, (parNom.get(nom) || 0) + amount);
    }
    const items = [...parNom.entries()].slice(0, 8)
      .map(([nom, amount]) => ({ type: "don", nom, amount }));
    if (Number(data.total) > 0) items.push({ type: "total", total: Number(data.total) });
    return items;
  }

  const api = { QUIZ_INTERVAL_MS, QUIZ_TOAST_MS, shouldAsk, nextDueAt, tickerItems, restantSecondes };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_QUIZ_UI = api;
})();
