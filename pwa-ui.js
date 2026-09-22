/* ============================================================
   FRACTAL ARENA — PWA : décisions d'interface (helpers purs, testables Node)
   Quand proposer d'installer, à qui, et que dire quand le réseau tombe.
   ============================================================ */
(function () {
  const JOUR = 86400000;
  const REFUS_RESPECTE = 30 * JOUR;   // un « non » vaut un mois, pas un écran
  const COMBATS_AVANT_INVITE = 3;     // le temps de savoir si le jeu lui plaît
  const ECHECS_AVANT_ALERTE = 3;      // un timeout isolé arrive ; trois, non

  const estIOS = (ua) => /iPhone|iPad|iPod/i.test(String(ua || ""));

  /* Trois issues :
       "aucun"  — rien à proposer (déjà installé, ou le navigateur ne veut pas)
       "invite" — on détient un beforeinstallprompt, on peut vraiment installer
       "ios"    — iOS n'émet jamais beforeinstallprompt : on explique le geste */
  function installMode(ctx) {
    const c = ctx || {};
    if (c.standalone) return "aucun";
    if (c.prompt) return "invite";
    if (estIOS(c.ua)) return "ios";
    return "aucun";
  }

  /* Proposer au bon moment, et une seule fois. Une bannière avant même
     d'avoir joué, c'est du harcèlement : le joueur ne sait pas encore s'il
     veut ce jeu sur son écran d'accueil. */
  function doitProposer(ctx) {
    const c = ctx || {};
    if (c.mode !== "invite" && c.mode !== "ios") return false;
    if (!(Number(c.combats) >= COMBATS_AVANT_INVITE)) return false;
    if (c.refusLe && Number(c.maintenant) - Number(c.refusLe) < REFUS_RESPECTE) return false;
    return true;
  }

  /* Le jeu ne combat pas sans serveur : mieux vaut le dire que laisser un
     bouton tourner dans le vide. Mais pas au premier raté. */
  function etatReseau(ctx) {
    const c = ctx || {};
    if (c.online === false) return "hors-ligne";
    if (Number(c.echecsApi) >= ECHECS_AVANT_ALERTE) return "serveur-injoignable";
    return "ok";
  }

  /* Compteur d'ÉCHECS API consécutifs (audit 22/09/2026). Le chemin
     « serveur-injoignable » d'etatReseau existait mais était mort : app.jsx lui passait
     0 en dur. Règle : une réussite remet à zéro ; un échec isolé s'oublie au bout de la
     fenêtre (un 500 passager ne doit pas alerter) ; seuls des échecs RAPPROCHÉS comptent. */
  const ECHECS_FENETRE = 60000;
  function majCompteurEchecs(etat, evenement, maintenant) {
    const c = etat || { n: 0, dernier: 0 };
    if (evenement === "ok") return { n: 0, dernier: maintenant };
    if (c.n > 0 && maintenant - c.dernier > ECHECS_FENETRE) return { n: 1, dernier: maintenant };
    return { n: c.n + 1, dernier: maintenant };
  }

  const API = { installMode, doitProposer, etatReseau, estIOS, majCompteurEchecs,
    JOUR, REFUS_RESPECTE, COMBATS_AVANT_INVITE, ECHECS_AVANT_ALERTE, ECHECS_FENETRE };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.FA_PWA = API;
})();
