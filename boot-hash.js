/* Hash de minage de l'écran de démarrage.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne
   ('unsafe-inline' retiré de script-src). Chargé sans `defer` ni `async` pour
   garder son effet d'origine : démarrer immédiatement, avant boot-anim.js. */
(function () {
  var hx = document.getElementById("boot-hx"); if (!hx) return;
  var H = "0123456789abcdef", solved = 0;
  function line() { var s = "0x" + Array(solved + 1).join("0"); for (var i = 0; i < 16 - solved; i++) s += H[(Math.random() * 16) | 0]; return s; }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(function () { hx.textContent = line(); }, 60);
    setInterval(function () { solved = (solved + 1) % 13; }, 700);
  }
})();
