/* Hash de minage de l'écran de démarrage.
   Externalisé d'index.html pour que la CSP puisse refuser les scripts en ligne
   ('unsafe-inline' retiré de script-src). Chargé sans `defer` ni `async` pour
   garder son effet d'origine : démarrer immédiatement, avant l'assemblage de l'emblème. */
(function () {
  var hx = document.getElementById("boot-hx"); if (!hx) return;
  var H = "0123456789abcdef", solved = 0;
  function line() { var s = "0x" + Array(solved + 1).join("0"); for (var i = 0; i < 16 - solved; i++) s += H[(Math.random() * 16) | 0]; return s; }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Le hash cède la place à l'avancement réel de la préparation dès que
    // boot-splash.js l'expose : deux écritures concurrentes dans la même ligne
    // clignoteraient l'une sur l'autre.
    var tHash = setInterval(function () { if (window.FA_PREP) { clearInterval(tHash); clearInterval(tSolved); return; } hx.textContent = line(); }, 60);
    var tSolved = setInterval(function () { if (window.FA_PREP) return; solved = (solved + 1) % 13; }, 700);
  }
})();
