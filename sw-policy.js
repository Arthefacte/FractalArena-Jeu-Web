/* ============================================================
   FRACTAL ARENA — PWA : politique de cache (helpers purs, testables Node)
   Chargé des deux côtés : par sw.js via importScripts, par les tests via
   require. Aucune API de service worker ici — que des décisions.
   ============================================================ */
(function () {
  /* Suit le cache-bust d'index.html (?v=N) : chaque déploiement repart d'un
     cache neuf, et l'ancien est purgé à l'activation. Un test vérifie que les
     deux nombres ne divergent pas. */
  const CACHE = "fa-v172";

  /* Deux routes seulement. Une première version mettait aussi en cache tous les
   * assets same-origin ; elle a été retirée après mesure, pour deux raisons :
   *
   * 1. Aucun gain constaté. Les fichiers portent ?v=N — une adresse désigne
   *    toujours le même contenu — donc le cache HTTP du navigateur les garde
   *    déjà. Sur téléphone simulé (CPU ÷4), le lancement à froid tenait en
   *    1,2 s avec comme sans, et les lancements suivants restaient au moins
   *    aussi rapides sans service worker qu'avec.
   * 2. Un coût certain. Le jeu porte 94 Mo d'assets ; les recopier revenait à
   *    en garder deux exemplaires sur le téléphone du joueur pour rien.
   *
   * On garde donc le service worker — Chrome l'exige pour proposer
   * l'installation — et on lui retire ce qui ne servait pas.
   *
   * Reste le document : le garder permet d'afficher NOTRE écran « connexion
   * perdue », qui explique que les combats sont calculés côté serveur, plutôt
   * que la page d'erreur du navigateur.
   *
   * Et la règle qui ne bouge pas : le serveur de jeu n'est JAMAIS mis en
   * cache. Un solde, un roster ou un combat rejoué depuis le cache serait une
   * donnée fausse présentée comme normale. */
  function routeFor(req, origin) {
    const url = String((req && req.url) || "");
    const method = String((req && req.method) || "GET").toUpperCase();
    const mode = String((req && req.mode) || "");

    if (method !== "GET") return "reseau-seul";                // écritures : jamais
    if (!url.startsWith(String(origin))) return "reseau-seul"; // unpkg, fonts, R2, API
    if (mode === "navigate") return "reseau-d-abord";          // le document, et lui seul
    return "reseau-seul";                                      // le cache HTTP s'en charge
  }

  /* Ce qui mérite d'entrer en cache : une réponse complète et relisible. Une
     206 (Range) ou une réponse opaque y serait illisible et occuperait la
     place. Ne s'applique plus qu'au document, seule chose qu'on garde. */
  function copiable(res) {
    return !!res && res.status === 200 && res.type !== "opaque";
  }

  /* Nos anciens caches, et rien d'autre : on ne touche pas à ce qui ne nous
     appartient pas dans le stockage de l'origine. */
  function obsolete(name) {
    return /^fa-v\d+$/.test(String(name)) && String(name) !== CACHE;
  }

  const API = { CACHE, routeFor, obsolete, copiable };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof self !== "undefined") self.FA_SW_POLICY = API;
})();
