/* MODE APP PC (`?app=pc`) — le seul endroit où le logo 3D est demandé en HD.
 *
 * L'app native (desktop/src-tauri) charge `https://fractalarena.com/?app=pc` :
 * c'est elle, et elle seule, qui reçoit la bande d'assemblage de 440 px
 * (`assets/boot-strip-hd.webp`). Le web garde exactement la bande de 220 px.
 *
 * Pourquoi un fichier séparé plutôt qu'un <script> en ligne : la CSP n'accorde
 * plus 'unsafe-inline' à script-src (test/csp-inline.test.js). Un script en
 * ligne serait bloqué — et le logo resterait en SD dans l'app, sans message.
 *
 * Pourquoi si tôt : il est chargé juste après le <link rel=preload> de la bande.
 * À cet instant le lien existe et le parseur n'a pas encore rencontré l'image
 * `#boot-emblem` : réécrire le href ici fait précharger la HD AU LIEU de la SD,
 * pas en plus. Sans le paramètre, ce fichier ne fait rien du tout : aucune
 * requête, aucun octet, aucun changement de comportement pour un visiteur web.
 */
(function () {
  "use strict";
  if (!/[?&]app=pc(?:[&#]|$)/.test(location.search)) return;

  document.documentElement.dataset.app = "pc"; // lu par cinematique.jsx
  window.__FA_APP_PC = true;                   // lu par boot-emblem-hd.js

  // Le <link rel=preload> est déjà dans le document (ce script le suit) : on le
  // pointe sur la HD pour que la requête de l'image soit servie par ce
  // préchargement. La SD éventuellement déjà partie est inutilisée — mesuré :
  // 660 Ko demandés en plus dans l'app, jamais dans le web (voir RAPPORT_HD.md).
  var lien = document.querySelector('link[rel="preload"][as="image"][href*="boot-strip"]');
  if (lien) lien.href = lien.href.replace("boot-strip.webp", "boot-strip-hd.webp");
})();
