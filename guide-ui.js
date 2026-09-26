/* ============================================================
   FRACTAL ARENA — Guide de la première session (logique pure)
   ============================================================

   Pourquoi. Le tutoriel était cinq diapositives de texte, affichées une fois,
   avant que le joueur ait vu le moindre écran, au milieu de trois autres
   fenêtres (code de récupération, cadeau, bandeau verrouillé). Le vrai parcours
   guidé — « Tes premiers pas », six étapes récompensées — dormait dans l'onglet
   Quêtes, où personne n'allait le chercher (audit 22/09/2026, joué sur un compte
   neuf : découvert par hasard).

   Ce fichier décide, sans React ni réseau, QUELLE étape montrer et QUEL élément
   de l'écran mettre en avant. Le composant (guide.jsx) ne fait qu'afficher.
   Chargé aussi par les tests node (module.exports), d'où le double export.

   Deux sources de vérité, dans l'ordre :
   1. Le parcours découverte serveur (discovery.js) quand le compte y est éligible
      (compte créé sans wallet) : `steps[]` avec done/claimed — exact.
   2. Sinon (compte UniSat), une lecture LOCALE de l'état du jeu : victoires de
      session, niveau des entités, étoiles de campagne, plus deux drapeaux posés
      quand un combat de Tour ou une attaque d'Arène a eu lieu. Pas de récompense
      à réclamer dans ce cas : le guide se contente d'orienter.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FA_GUIDE_UI = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Ordre = celui du parcours découverte (discovery.js DISCOVERY_STEPS).
  // view : l'onglet où l'action se fait. target : l'élément [data-guide] à
  // mettre en avant sur cet onglet ; `targetAlt` sert quand la première
  // condition n'est pas remplie (ex. Fosse : d'abord choisir l'équipe).
  //
  // Aucune étape ne porte plus de prédicat « local » (26/09/2026). Elles en
  // avaient un — victoires de session, niveau, étoiles, plus deux drapeaux
  // « Tour jouée » / « Arène jouée » posés en localStorage — utilisé pour les
  // comptes non éligibles au parcours découverte. C'est ce mode local qui
  // faisait dire au guide, dans le navigateur intégré d'UniSat, que la Tour et
  // l'Arène restaient à faire à un joueur qui les avait faites sur son
  // ordinateur : ces deux drapeaux ne pouvaient venir que de CE navigateur.
  // Les six étapes viennent maintenant du serveur pour tout le monde
  // (GET /guide/state), qui les recompte depuis l'historique réel du joueur.
  const STEPS = [
    { id: "d_win",   view: "fosse",    target: "fosse-fight",      reward: 50 },
    { id: "d_paid",  view: "fosse",    target: "fosse-bet-bronze", reward: 75 },
    { id: "d_level", view: "fosse",    target: "fosse-fight",      reward: 100 },
    { id: "d_camp",  view: "campaign", target: "camp-fight",       reward: 125 },
    { id: "d_tower", view: "tour",     target: "tour-start",       reward: 150 },
    { id: "d_pvp",   view: "arene",    target: "arene-attack",     reward: 175 },
  ];
  const TOTAL_REWARD = STEPS.reduce((n, s) => n + s.reward, 0); // 675

  // Résumé LOCAL de la progression, calculé depuis l'état client `g`.
  // Il ne sert plus qu'à une chose : savoir si l'équipe est complète, pour
  // envoyer d'abord sur Équipe plutôt que sur la Fosse. Le reste (victoires,
  // niveau, étages, drapeaux de Tour/Arène) a été retiré le 26/09/2026 avec le
  // mode local du guide — le serveur est la seule source des étapes.
  function localSummary(g) {
    const s = g || {};
    const roster = Array.isArray(s.roster) ? s.roster : [];
    const progress = s.campaignProgress || {};
    let floors = 0;
    for (const w of Object.keys(progress)) {
      const stars = progress[w] && Array.isArray(progress[w].stars) ? progress[w].stars : [];
      floors += stars.filter((n) => n > 0).length;
    }
    return {
      sessionWins: (s.session && s.session.wins) || 0,
      sessionNet: (s.session && s.session.net) || 0,
      maxLevel: roster.reduce((m, b) => Math.max(m, (b && b.level) || 1), 1),
      campaignFloors: floors,
      selected: Array.isArray(s.selected) ? s.selected.length : 0,
    };
  }

  // Décide ce que le guide affiche.
  // `disc` = réponse de GET /guide/state : { rewarded, steps:[{id,done,claimed,…}] }.
  //   - rewarded : le compte est éligible au parcours RÉCOMPENSÉ (les claims
  //     n'existent que là). Sinon le guide oriente, sans annoncer de montant.
  //   - steps : les six étapes, recomptées par le serveur. Absentes tant que la
  //     réponse n'est pas arrivée (ou hors ligne) : on ne guide rien plutôt que
  //     de guider faux.
  // → { mode: "do" | "claim" | "done", step, index, total, target, view, reward, rewarded }
  //   mode "do"    : l'étape est à faire ; target = élément à mettre en avant.
  //   mode "claim" : l'étape est accomplie côté serveur mais pas réclamée (compte
  //                  éligible seulement) ; target = son bouton Réclamer.
  //   mode "done"  : tout est fait → le guide se retire.
  function computeGuide({ disc, g, view }) {
    const rewarded = !!(disc && disc.rewarded);
    const steps = (disc && Array.isArray(disc.steps)) ? disc.steps : [];
    const sum = localSummary(g);
    for (let i = 0; i < STEPS.length; i++) {
      const st = STEPS[i];
      const srv = steps.find((x) => x && x.id === st.id);
      if (!srv) continue;                  // étape inconnue du serveur : on ne la guide pas
      if (srv.claimed) continue;           // déjà réclamée
      if (srv.done) {
        // Accomplie côté serveur. Récompensée → on envoie réclamer ; sinon c'est
        // une étape d'orientation déjà passée, on passe à la suivante.
        if (rewarded) {
          return { mode: "claim", step: st, index: i, total: STEPS.length, view: "quests", target: "quest-claim-" + st.id, reward: srv.reward || st.reward, rewarded: true };
        }
        continue;
      }
      // À faire. Sur la Fosse, tant que l'équipe n'est pas complète, c'est
      // l'écran Équipe qu'il faut montrer (les cartes, puis le bouton d'entrée).
      let target = st.target, v = st.view;
      if (st.view === "fosse" && sum.selected < 3) { v = "team"; target = "team-grid"; }
      else if (st.view === "fosse" && view === "team") { target = "team-enter"; v = "team"; }
      return { mode: "do", step: st, index: i, total: STEPS.length, view: v, target, reward: st.reward, rewarded };
    }
    return { mode: "done", step: null, index: STEPS.length, total: STEPS.length, view: null, target: null, reward: 0, rewarded };
  }

  // Clé i18n de la consigne d'une étape selon le contexte (équipe incomplète
  // ou non). Une seule fonction pour que le composant et les tests s'accordent.
  function instructionKey(res) {
    if (!res || !res.step) return "GUIDE_DONE";
    if (res.mode === "claim") return "GUIDE_CLAIM";
    if (res.target === "team-grid") return "GUIDE_PICK_TEAM";
    if (res.target === "team-enter") return "GUIDE_ENTER_FOSSE";
    return "GUIDE_" + res.step.id.toUpperCase(); // GUIDE_D_WIN, GUIDE_D_PAID…
  }

  // Onglets qui méritent une phrase la première fois qu'on les ouvre.
  const TAB_HINTS = ["team", "fosse", "arene", "campaign", "tour", "expeditions", "quests", "forge", "market", "wallet", "boosts", "perso", "leaderboard"];
  function tabHintKey(view) {
    return TAB_HINTS.includes(view) ? "HINT_TAB_" + view.toUpperCase() : null;
  }

  return { STEPS, TOTAL_REWARD, localSummary, computeGuide, instructionKey, TAB_HINTS, tabHintKey };
});
