/* Anti-clickjacking — à charger EN TÊTE, avant tout affichage.
 *
 * La CSP déclare `frame-ancestors 'none'`, mais les navigateurs IGNORENT cette
 * directive quand elle est délivrée par un <meta> — et GitHub Pages ne permet
 * pas d'ajouter un en-tête HTTP. La protection ne peut donc être que celle-ci.
 *
 * Deux pièges, tous deux constatés en encadrant réellement le jeu :
 *
 * 1. `document.write` ne suffit PAS. Appelé pendant le parsing, il INSÈRE à
 *    l'endroit courant au lieu de remplacer : le message s'affichait, mais le
 *    reste de la page continuait de se charger et le jeu se montait derrière —
 *    donc restait cliquable, ce qui était précisément l'attaque à empêcher.
 *    D'où window.stop(), qui interrompt le chargement, puis la réécriture
 *    complète du document.
 *
 * 2. On neutralise NOTRE page, on ne touche pas à celle du parent :
 *    `top.location = ...` est bloqué dans une iframe sandboxée, lève une
 *    exception, et laisserait le jeu affiché.
 */
(function () {
  try {
    if (window.self === window.top) return;   // cas normal : rien à faire
  } catch (e) { /* accès refusé = on est bien encadré depuis une autre origine */ }

  try { window.stop(); } catch (e) {}

  var lien = "https://fractalarena.com/";
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title>Fractal Arena</title></head>'
    + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;'
    + 'background:#05070f;color:#EAF1FF;font-family:system-ui,sans-serif;text-align:center">'
    + '<div style="padding:24px;max-width:32em">'
    + '<h1 style="font-size:20px;letter-spacing:.1em">FRACTAL ARENA</h1>'
    + '<p style="color:#7F8DAD;line-height:1.6">Ce site tente d\'afficher le jeu à l\'intérieur '
    + 'd\'une autre page. Par sécurité, il ne s\'ouvre pas ici.</p>'
    + '<p><a href="' + lien + '" target="_blank" rel="noopener noreferrer" '
    + 'style="color:#00F0FF">Ouvrir Fractal Arena sur fractalarena.com</a></p>'
    + '</div></body>';
})();
