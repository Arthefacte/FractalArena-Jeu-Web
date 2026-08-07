/* ============================================================
   FRACTAL ARENA — Sonde de diagnostic (fractalarena.com/?diag=1)
   Inerte par défaut : sans le paramètre, ce fichier ne pose AUCUN
   observateur, ne mesure rien et n'ajoute rien au DOM.
   Existe parce qu'on ne peut pas diagnostiquer un téléphone depuis un PC :
   un onglet piloté a son requestAnimationFrame throttlé, et un GPU de bureau
   ne dit rien d'un GPU mobile. Le joueur ouvre l'URL, lit les chiffres.
   Chargé EN PREMIER dans index.html : les mesures de boot n'ont de valeur
   que si la sonde est en place avant le reste.
   ============================================================ */
(function () {
  "use strict";

  const actif = typeof location !== "undefined" && /[?&]diag=1\b/.test(location.search);
  window.FA_DIAG = { actif: actif, marque: function () {} };
  if (!actif) return;

  const T0 = performance.now();
  const gels = [];      // tâches longues : le thread ne rend plus la main
  const etapes = {};    // jalons posés par la cinématique (FA_DIAG.marque)

  // Tâches longues : c'est ce qui « fige » l'écran. buffered pour ne rien
  // manquer entre le chargement du script et l'installation de l'observateur.
  try {
    new PerformanceObserver(function (l) {
      for (const e of l.getEntries()) gels.push({ a: Math.round(e.startTime), ms: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) { /* Safari : pas d'API longtask, le reste du rapport tient */ }

  // Jalons de la cinématique. Appelée depuis cinematique.jsx ; sans ?diag=1
  // c'est une fonction vide, donc coût nul en production.
  window.FA_DIAG.marque = function (nom) {
    if (etapes[nom] === undefined) etapes[nom] = Math.round(performance.now() - T0);
  };

  // Images réellement affichées. Un chiffre honnête seulement si l'onglet est
  // au premier plan — d'où la mention dans le rapport.
  const frames = [];
  let dernier = performance.now(), mesureFrames = true;
  (function tic(now) {
    if (!mesureFrames) return;
    frames.push(now - dernier); dernier = now;
    requestAnimationFrame(tic);
  })(performance.now());

  function reseau() {
    const r = performance.getEntriesByType("resource");
    let octets = 0;
    for (const x of r) octets += x.transferSize || 0;
    const lourds = r.filter((x) => (x.transferSize || 0) > 200000)
      .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
      .slice(0, 5)
      .map((x) => x.name.split("/").pop().split("?")[0] + " " + Math.round(x.transferSize / 1024) + " Ko");
    return { total: Math.round(octets / 1024), nb: r.length, lourds: lourds };
  }

  function gpu() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return "AUCUN WEBGL";
      const d = gl.getExtension("WEBGL_debug_renderer_info");
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : "masqué";
    } catch (e) { return "erreur"; }
  }

  function rapport() {
    mesureFrames = false;
    const f = frames.slice(1);
    const tri = f.slice().sort(function (a, b) { return a - b; });
    const fcp = (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime;
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const net = reseau();
    const bloque = gels.reduce(function (a, g) { return a + g.ms; }, 0);
    const L = [];
    L.push("FRACTAL ARENA — diagnostic v" + (window.FA_ASSET_V || "?"));
    L.push("appareil : " + (navigator.hardwareConcurrency || "?") + " coeurs, "
      + (navigator.deviceMemory ? navigator.deviceMemory + " Go RAM" : "RAM inconnue")
      + ", dpr " + (window.devicePixelRatio || 1) + ", ecran " + screen.width + "x" + screen.height);
    L.push("mode : " + (matchMedia("(display-mode: standalone)").matches ? "PWA installee" : "navigateur"));
    L.push("gpu : " + gpu());
    L.push("");
    L.push("BOOT");
    L.push("  premier pixel     : " + (fcp ? Math.round(fcp) : "?") + " ms");
    L.push("  dom pret          : " + Math.round(nav.domContentLoadedEventEnd || 0) + " ms");
    L.push("  page chargee      : " + Math.round(nav.loadEventEnd || 0) + " ms");
    L.push("  telecharge        : " + net.total + " Ko en " + net.nb + " requetes");
    if (net.lourds.length) L.push("  plus lourds       : " + net.lourds.join(" | "));
    L.push("");
    L.push("CINEMATIQUE (jalons, ms depuis le demarrage de la sonde)");
    const ordre = ["three-importe", "renderer-cree", "pmrem-pret", "emblème-charge", "1re-image"];
    let precedent = 0;
    for (const k of ordre) {
      if (etapes[k] === undefined) { L.push("  " + k + " : NON ATTEINT"); continue; }
      L.push("  " + k + " : " + etapes[k] + " ms  (+" + (etapes[k] - precedent) + ")");
      precedent = etapes[k];
    }
    L.push("");
    L.push("FLUIDITE (" + f.length + " images mesurees)");
    if (f.length > 2) {
      L.push("  fps moyen         : " + Math.round(1000 / (f.reduce(function (a, b) { return a + b; }, 0) / f.length)));
      L.push("  image mediane     : " + Math.round(tri[Math.floor(tri.length / 2)]) + " ms");
      L.push("  pire image        : " + Math.round(tri[tri.length - 1]) + " ms");
      L.push("  images > 100 ms   : " + f.filter(function (x) { return x > 100; }).length);
    }
    L.push("");
    L.push("THREAD BLOQUE : " + bloque + " ms au total, " + gels.length + " taches longues");
    L.push("  les pires : " + gels.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 6)
      .map(function (g) { return g.ms + "ms a " + g.a; }).join(", "));
    if (performance.memory) L.push("MEMOIRE JS : " + Math.round(performance.memory.usedJSHeapSize / 1048576) + " Mo");
    return L.join("\n");
  }

  function afficher() {
    const texte = rapport();
    const box = document.createElement("div");
    box.setAttribute("style", "position:fixed;inset:0;z-index:99999;background:#0b0b0f;color:#d8e0f0;"
      + "font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:14px;overflow:auto;-webkit-overflow-scrolling:touch");
    const pre = document.createElement("pre");
    pre.textContent = texte;
    pre.setAttribute("style", "white-space:pre-wrap;word-break:break-word;margin:0 0 14px");
    const barre = document.createElement("div");
    barre.setAttribute("style", "display:flex;gap:8px;position:sticky;bottom:0;background:#0b0b0f;padding:8px 0");
    const btn = function (label, onClick) {
      const b = document.createElement("button");
      b.textContent = label;
      b.setAttribute("style", "flex:1;padding:12px;font:600 13px system-ui;background:#1a1a24;color:#d8e0f0;"
        + "border:1px solid #2c2c3a;border-radius:8px");
      b.addEventListener("click", onClick);
      return b;
    };
    barre.appendChild(btn("Copier", function () {
      const ok = function () { barre.firstChild.textContent = "Copie !"; };
      if (navigator.clipboard) navigator.clipboard.writeText(texte).then(ok, function () {});
      else { const t = document.createElement("textarea"); t.value = texte; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); ok(); }
    }));
    barre.appendChild(btn("Fermer", function () { box.remove(); }));
    box.appendChild(pre); box.appendChild(barre);
    document.body.appendChild(box);
  }

  // 12 secondes : la cinématique dure 20 s, on veut son démarrage — le moment
  // où ça bloque — pas sa fin.
  window.addEventListener("load", function () { setTimeout(afficher, 12000); });
  window.FA_DIAG.afficher = afficher;
})();
