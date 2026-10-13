/* Retrait de l'écran de démarrage : quand React a monté, que la cinématique
   éventuelle a préparé ses ressources, ET après une durée minimale pour voir
   un cycle d'assemblage. Fondu de sortie avant le début de la timeline.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne. */
(function () {
  var t0 = Date.now(), MIN = 2400, tries = 0;
  var iv = setInterval(function () {
    tries++;
    var root = document.getElementById('root');
    var cine = root && root.querySelector('[data-screen-label="cinematique-ouverture"]');
    var ready = root && root.children.length && (!cine || cine.getAttribute('data-cine-ready') === 'true');
    if (ready && (Date.now() - t0) >= MIN) {
      clearInterval(iv);
      var b = document.getElementById('boot');
      if (b) { b.style.transition = 'opacity .45s ease'; b.style.opacity = '0'; setTimeout(function () { if (b) b.remove(); }, 460); }
    }
    if (tries > 250) clearInterval(iv); // garde-fou ~20s
  }, 80);
})();
