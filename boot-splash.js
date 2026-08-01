/* Retrait de l'écran de démarrage : quand React a monté ET après une durée
   minimale, pour qu'on voie au moins un cycle d'assemblage de l'emblème même
   si le rendu est immédiat. Fondu de sortie.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne. */
(function () {
  var t0 = Date.now(), MIN = 2400, tries = 0;
  var iv = setInterval(function () {
    tries++;
    var root = document.getElementById('root');
    var ready = root && root.children.length;
    if (ready && (Date.now() - t0) >= MIN) {
      clearInterval(iv);
      var b = document.getElementById('boot');
      if (b) { b.style.transition = 'opacity .45s ease'; b.style.opacity = '0'; setTimeout(function () { if (b) b.remove(); }, 460); }
    }
    if (tries > 250) clearInterval(iv); // garde-fou ~20s
  }, 80);
})();
