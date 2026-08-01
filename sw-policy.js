/* ============================================================
   FRACTAL ARENA — PWA : politique de cache (helpers purs, testables Node)
   Chargé des deux côtés : par sw.js via importScripts, par les tests via
   require. Aucune API de service worker ici — que des décisions.
   ============================================================ */
(function () {
  /* Suit le cache-bust d'index.html (?v=N) : chaque déploiement repart d'un
     cache neuf, et l'ancien est purgé à l'activation. Un test vérifie que les
     deux nombres ne divergent pas. */
  const CACHE = "fa-v109";

  /* Trois routes, et une seule règle à retenir : le serveur de jeu n'est
     JAMAIS mis en cache. Un solde, un roster ou un combat rejoué depuis le
     cache serait une donnée fausse présentée comme normale. */
  function routeFor(req, origin) {
    const url = String((req && req.url) || "");
    const method = String((req && req.method) || "GET").toUpperCase();
    const mode = String((req && req.mode) || "");

    if (method !== "GET") return "reseau-seul";          // écritures : jamais
    if (!url.startsWith(String(origin))) return "reseau-seul"; // unpkg, fonts, R2, API
    if (mode === "navigate") return "reseau-d-abord";    // le document mène la version
    return "cache-d-abord";                              // assets versionnés par ?v=N
  }

  /* Nos anciens caches, et rien d'autre : on ne touche pas à ce qui ne nous
     appartient pas dans le stockage de l'origine. */
  function obsolete(name) {
    return /^fa-v\d+$/.test(String(name)) && String(name) !== CACHE;
  }

  const API = { CACHE, routeFor, obsolete };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof self !== "undefined") self.FA_SW_POLICY = API;
})();
