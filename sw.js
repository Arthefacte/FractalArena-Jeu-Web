/* ============================================================
   FRACTAL ARENA — service worker
   Ce fichier n'est QUE la couche d'exécution : les décisions (quoi mettre en
   cache, quoi laisser au réseau) vivent dans sw-policy.js, qui est éprouvé en
   node par test/sw-policy.test.js.

   Ce qu'il fait : accélérer le second lancement en gardant les assets
   versionnés, et permettre l'installation du jeu sur l'écran d'accueil.
   Ce qu'il ne fait PAS : servir du jeu hors ligne. Les combats sont calculés
   sur le serveur ; sans réseau, aucun match ne peut démarrer. On ne fabrique
   donc jamais de réponse de remplacement pour l'API.
   ============================================================ */
importScripts("sw-policy.js");
const P = self.FA_SW_POLICY;

/* Une seule ouverture pour toute la vie du worker : caches.open() était appelé
   à chaque requête, soit une cinquantaine de fois par lancement. */
let _cache = null;
const cache = () => (_cache || (_cache = caches.open(P.CACHE)));

self.addEventListener("install", () => {
  /* Aucun pré-chargement : la coquille du jeu pèse plusieurs dizaines de Mo
     (modèles 3D, illustrations). Les tout télécharger à l'installation ferait
     payer au joueur, d'un coup et sans qu'il l'ait demandé, ce que le premier
     lancement étale déjà. Le cache se remplit de ce qui est réellement lu. */
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(P.obsolete).map((n) => caches.delete(n)));
    /* Sans ceci, intercepter la navigation SÉRIALISE le démarrage du worker et
       le téléchargement du document : rien ne part tant que le worker n'est pas
       prêt. Mesuré sur téléphone simulé, c'est ce qui rendait le lancement
       suivant le démarrage du worker très lent. La préconnexion laisse Chrome
       lancer la requête du document EN MÊME TEMPS que le worker. */
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (err) {}
    }
    await self.clients.claim();
  })());
});

/* Met en cache SANS retarder la réponse : attendre caches.open() avant de
   rendre la ressource ajoutait une attente à chaque requête, pour rien. La
   copie part en tâche de fond, tenue en vie par waitUntil ; le clone doit être
   pris tout de suite, avant que le corps soit consommé par la page. Ce qui
   mérite d'être copié est décidé par la politique (P.copiable). */
function metsEnCache(e, req, res) {
  if (!P.copiable(res)) return res;
  const copie = res.clone();
  e.waitUntil((async () => {
    try { (await cache()).put(req, copie); } catch (err) { /* quota, mode privé */ }
  })());
  return res;
}

self.addEventListener("fetch", (e) => {
  const route = P.routeFor(e.request, self.location.origin);
  if (route === "reseau-seul") return; // on ne s'interpose pas du tout

  if (route === "reseau-d-abord") {
    e.respondWith((async () => {
      try {
        /* La réponse préchargée quand elle existe : Chrome l'a lancée en
           parallèle du démarrage du worker, l'ignorer reviendrait à refaire la
           requête et à perdre tout le bénéfice. */
        const precharge = e.preloadResponse ? await e.preloadResponse : null;
        return metsEnCache(e, e.request, precharge || await fetch(e.request));
      } catch (err) {
        /* Hors ligne : on rend le dernier document connu s'il existe, sinon on
           laisse le navigateur afficher SA page d'erreur — mentir avec une
           page « tout va bien » serait pire que l'absence de réseau. */
        const c = await cache();
        const vieux = await c.match(e.request) || await c.match("index.html");
        if (vieux) return vieux;
        throw err;
      }
    })());
    return;
  }

  /* Il n'y a pas de troisième route : les assets sont laissés au cache HTTP du
     navigateur, qui les garde déjà (ils portent ?v=N) et le fait mieux — mesuré
     dans sw-policy.js. */
});
