/* PWA — enregistrement du service worker. Après le chargement, pour ne pas
   disputer la bande passante au premier écran. Gardé : file:// et les contextes
   non sécurisés n'ont pas navigator.serviceWorker, et un échec d'enregistrement
   ne doit jamais empêcher de jouer.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  // Une nouvelle version prend le relais (skipWaiting + clients.claim dans sw.js) mais
  // la page EN COURS tourne toujours l'ancien code. Sans rechargement, le joueur reste
  // sur une version périmée jusqu'à ce qu'il ferme tous ses onglets : un correctif
  // livré ne l'atteint pas, et il revit le bug qu'on vient de corriger (prod
  // 23/10/2026 — il ne doit pas avoir à ouvrir une fenêtre privée pour être à jour).
  // On recharge donc UNE seule fois, et seulement si un service worker contrôlait déjà
  // la page (une première visite n'a rien à recharger).
  var avaitControleur = !!navigator.serviceWorker.controller;
  var dejaRecharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!avaitControleur || dejaRecharge) return;
    dejaRecharge = true;
    location.reload();
  });
  addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js")
      // `update()` : sans lui, le navigateur peut attendre 24 h avant d'aller
      // chercher un nouveau service worker, et la version déployée reste invisible.
      .then(function (r) { return r.update(); })
      .catch(function (e) {
        console.warn("[PWA] service worker non enregistré :", e && e.message);
      });
  });
})();
