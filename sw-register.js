/* PWA — enregistrement du service worker. Après le chargement, pour ne pas
   disputer la bande passante au premier écran. Gardé : file:// et les contextes
   non sécurisés n'ont pas navigator.serviceWorker, et un échec d'enregistrement
   ne doit jamais empêcher de jouer.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (e) {
      console.warn("[PWA] service worker non enregistré :", e && e.message);
    });
  });
})();
