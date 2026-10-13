/* Retrait de l'écran de démarrage : quand React a monté, que TOUT est préparé
   (cinématique : modèles, environnement, shaders compilés, textures envoyées,
   images décodées, son) et après une durée minimale pour voir un cycle
   d'assemblage. Fondu de sortie avant le début de la timeline.

   Décision du fondateur (13/10) : mieux vaut faire attendre le joueur le temps
   que tout soit prêt que de commencer une séquence qui se figera ou affichera
   des zones noires. La préparation affiche donc son avancement, et un plafond
   de 15 s évite d'enfermer le joueur si une ressource ne vient jamais.

   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne. */
(function () {
  // Ce fichier est aussi évalué hors navigateur (test/cine-startup.test.js le
  // charge dans un contexte Node sans `window`) : l'état de préparation s'écrit
  // donc sur le global disponible, jamais sur `window` en dur.
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : this);
  var t0 = Date.now(), MIN = 2400, MAX = 15000, tries = 0;

  // Avancement de la préparation, affiché sur l'écran de chargement. Les étapes
  // sont annoncées par le code qui les termine (cinematique.jsx) ; chacune vaut
  // une part égale, ce qui suffit à rendre l'attente lisible.
  var ETAPES = ["react", "three", "glb", "environnement", "shaders", "textures", "images", "audio", "polices"];
  var faites = {};
  G.FA_PREP = {
    etape: function (nom) {
      if (faites[nom]) return;
      faites[nom] = true;
      var n = ETAPES.filter(function (e) { return faites[e]; }).length;
      var tag = document.querySelector("#boot .bhash .tag");
      if (tag) tag.textContent = "PRÉPARATION " + Math.round((100 * n) / ETAPES.length) + " %";
      if (n === ETAPES.length) {
        if (tag) tag.textContent = "MINING GENESIS";
        G.FA_PRET = true;
      }
    },
    pret: function () { return G.FA_PRET === true; },
  };

  var iv = setInterval(function () {
    tries++;
    var root = document.getElementById('root');
    var cine = root && root.querySelector('[data-screen-label="cinematique-ouverture"]');
    // Une cinématique qui n'est pas dans la page (joueur déjà installé, écran
    // d'accueil direct) ne doit pas bloquer : seule sa présence fait attendre.
    var toutPret = G.FA_PRET === true || (!cine && root && root.children.length);
    var ready = root && root.children.length && (!cine || cine.getAttribute('data-cine-ready') === 'true');
    var tempsEcoule = Date.now() - t0;
    if (root && root.children.length && G.FA_PREP) G.FA_PREP.etape("react");
    if ((ready && toutPret && tempsEcoule >= MIN) || tempsEcoule >= MAX) {
      clearInterval(iv);
      var b = document.getElementById('boot');
      if (b) { b.style.transition = 'opacity .45s ease'; b.style.opacity = '0'; setTimeout(function () { if (b) b.remove(); }, 460); }
    }
    if (tries > 400) clearInterval(iv); // garde-fou ~32s
  }, 80);
})();
