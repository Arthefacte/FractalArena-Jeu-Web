/* App PC : la bande d'assemblage HD remplace la SD avant le premier rendu.
 *
 * Chargé IMMÉDIATEMENT après l'image `#boot-emblem` : à cet instant le parseur
 * vient de créer l'élément, donc le remplacement de `src` précède de quelques
 * millisecondes tout ce que la SD aurait eu le temps d'afficher. Le script est
 * séparé (et non en ligne) parce que la CSP n'autorise plus 'unsafe-inline' sur
 * script-src : voir test/csp-inline.test.js.
 *
 * Repli silencieux : si la HD est absente (404 — vieux déploiement, fichier
 * purgé du CDN), on revient à la SD. C'est le seul cas où l'app se comporte
 * exactement comme le web.
 */
(function () {
  "use strict";
  if (!window.__FA_APP_PC) return;

  var img = document.getElementById("boot-emblem");
  if (!img) return;

  var sd = img.getAttribute("src");
  if (!sd || sd.indexOf("boot-strip.webp") === -1) return;

  img.addEventListener("error", function () {
    if (img.getAttribute("src") !== sd) img.setAttribute("src", sd);
  });
  img.setAttribute("src", sd.replace("boot-strip.webp", "boot-strip-hd.webp"));
})();
