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
    await self.clients.claim();
  })());
});

async function metsEnCache(req, res) {
  /* Uniquement des réponses complètes et exploitables : une 206 (Range, audio)
     ou une réponse opaque en cache produirait des lectures cassées. */
  if (!res || res.status !== 200 || res.type === "opaque") return res;
  const cache = await caches.open(P.CACHE);
  cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const route = P.routeFor(e.request, self.location.origin);
  if (route === "reseau-seul") return; // on ne s'interpose pas du tout

  if (route === "reseau-d-abord") {
    e.respondWith((async () => {
      try {
        return await metsEnCache(e.request, await fetch(e.request));
      } catch (err) {
        /* Hors ligne : on rend le dernier document connu s'il existe, sinon on
           laisse le navigateur afficher SA page d'erreur — mentir avec une
           page « tout va bien » serait pire que l'absence de réseau. */
        const cache = await caches.open(P.CACHE);
        const vieux = await cache.match(e.request) || await cache.match("index.html");
        if (vieux) return vieux;
        throw err;
      }
    })());
    return;
  }

  // cache-d-abord : l'adresse porte ?v=N, son contenu ne change pas.
  e.respondWith((async () => {
    const cache = await caches.open(P.CACHE);
    const hit = await cache.match(e.request);
    if (hit) return hit;
    return metsEnCache(e.request, await fetch(e.request));
  })());
});
