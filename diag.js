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

  // Tout est horodaté en absolu : performance.now() compte déjà depuis le début
  // de la navigation. La v1 soustrayait l'instant de chargement de la sonde, ce
  // qui rendait les jalons incomparables au « premier pixel » — on ne pouvait pas
  // dire si la cinématique démarrait avant ou après lui.
  const T_SONDE = Math.round(performance.now()); // quand la sonde elle-même a démarré
  const gels = [];      // tâches longues : le thread ne rend plus la main
  const etapes = {};    // jalons posés par la cinématique (FA_DIAG.marque)

  // Tâches longues : c'est ce qui « fige » l'écran. buffered pour ne rien
  // manquer entre le chargement du script et l'installation de l'observateur.
  try {
    new PerformanceObserver(function (l) {
      for (const e of l.getEntries()) gels.push({ a: Math.round(e.startTime), ms: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) { /* Safari : pas d'API longtask, le reste du rapport tient */ }

  // Qui bloque ? `longtask` donne la duree, jamais le coupable. `long-animation-frame`
  // (Chrome 123+) attribue chaque image trop longue aux scripts qui l'ont causee :
  // fichier, fonction, temps passe. Sans ca, on sait qu'une seconde est perdue mais
  // pas ou — c'est precisement ce qui manquait pour trancher.
  const coupables = [];
  try {
    new PerformanceObserver(function (l) {
      for (const e of l.getEntries()) {
        if (e.duration < 100) continue; // on ne garde que ce qui se voit
        const scripts = (e.scripts || []).map(function (s) {
          return {
            ms: Math.round(s.duration),
            ou: String(s.sourceURL || s.name || "?").split("/").pop().split("?")[0],
            quoi: s.sourceFunctionName || s.invoker || s.invokerType || "",
          };
        }).sort(function (a, b) { return b.ms - a.ms; });
        coupables.push({
          a: Math.round(e.startTime),
          ms: Math.round(e.duration),
          rendu: Math.round(e.renderStart ? e.duration - (e.renderStart - e.startTime) : 0),
          scripts: scripts.slice(0, 3),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch (e) { /* navigateur sans LoAF : le rapport le dira */ }

  // Jalons de la cinématique. Appelée depuis cinematique.jsx ; sans ?diag=1
  // c'est une fonction vide, donc coût nul en production.
  window.FA_DIAG.marque = function (nom) {
    if (etapes[nom] === undefined) etapes[nom] = Math.round(performance.now());
  };

  // Images réellement affichées. Un chiffre honnête seulement si l'onglet est
  // au premier plan — d'où la mention dans le rapport.
  // Chaque image est HORODATÉE, pas seulement mesurée : la v3 ne gardait que la
  // durée, si bien qu'un gel de dix secondes disparaissait dans une moyenne
  // calculée sur toute la fenêtre. C'est la frise seconde par seconde qui le
  // fait ressortir, et elle a besoin du « quand ».
  const frames = [];
  let dernier = performance.now(), mesureFrames = true;
  (function tic(now) {
    if (!mesureFrames) return;
    frames.push({ a: now, d: now - dernier }); dernier = now;
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

  // Traversée du service worker. `workerStart` marque l'instant où la requête
  // entre dans le worker ; l'écart avec `fetchStart` est le temps d'attente de
  // son démarrage, et `responseEnd - workerStart` ce que le worker a mis à
  // répondre. Quand 86 requêtes sont servies depuis le cache et que le premier
  // pixel arrive quand même à 6 s, c'est ici qu'il faut regarder.
  function serviceWorker() {
    const r = performance.getEntriesByType("resource");
    const parSw = r.filter(function (x) { return x.workerStart > 0; });
    if (parSw.length === 0) {
      return { actif: !!(navigator.serviceWorker && navigator.serviceWorker.controller), servies: 0 };
    }
    let attente = 0, service = 0, pire = null;
    for (const x of parSw) {
      const a = x.workerStart - x.fetchStart;      // réveil du worker
      const s = x.responseEnd - x.workerStart;     // travail du worker
      attente += a; service += s;
      if (!pire || (a + s) > pire.total) {
        pire = { total: a + s, nom: x.name.split("/").pop().split("?")[0], attente: Math.round(a), service: Math.round(s) };
      }
    }
    const derniere = parSw.reduce(function (m, x) { return Math.max(m, x.responseEnd); }, 0);
    return {
      actif: true,
      servies: parSw.length,
      surTotal: r.length,
      attenteCumulee: Math.round(attente),
      serviceCumule: Math.round(service),
      moyenneParRequete: Math.round((attente + service) / parSw.length),
      derniereReponse: Math.round(derniere),
      pire: pire,
    };
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
    const tri = f.map(function (x) { return x.d; }).sort(function (a, b) { return a - b; });
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
    // Sans cette ligne, un rapport de banc d'essai est inexploitable : on ne
    // saurait pas quelle variante il decrit.
    const variante = (/[?&]sans=([a-z0-9,]+)/i.exec(location.search) || [])[1];
    L.push("VARIANTE : " + (variante ? "sans " + variante : "aucune (cinematique complete)"));
    L.push("gpu : " + gpu());
    L.push("");
    L.push("BOOT");
    L.push("  premier pixel     : " + (fcp ? Math.round(fcp) : "?") + " ms");
    L.push("  dom pret          : " + Math.round(nav.domContentLoadedEventEnd || 0) + " ms");
    L.push("  page chargee      : " + Math.round(nav.loadEventEnd || 0) + " ms");
    L.push("  telecharge        : " + net.total + " Ko en " + net.nb + " requetes");
    if (net.lourds.length) L.push("  plus lourds       : " + net.lourds.join(" | "));
    L.push("  sonde demarree a  : " + T_SONDE + " ms");
    L.push("");
    L.push("SERVICE WORKER");
    const sw = serviceWorker();
    if (!sw.servies) {
      L.push("  aucune requete servie par le worker (actif : " + sw.actif + ")");
    } else {
      L.push("  requetes via SW   : " + sw.servies + " / " + sw.surTotal);
      L.push("  attente de reveil : " + sw.attenteCumulee + " ms cumules");
      L.push("  temps de service  : " + sw.serviceCumule + " ms cumules");
      L.push("  moyenne/requete   : " + sw.moyenneParRequete + " ms");
      L.push("  derniere reponse  : " + sw.derniereReponse + " ms");
      L.push("  pire              : " + sw.pire.nom + " (reveil " + sw.pire.attente + " ms + service " + sw.pire.service + " ms)");
    }
    L.push("");
    L.push("CINEMATIQUE (jalons, ms depuis le debut du chargement)");
    const ordre = ["react-monte", "three-importe", "renderer-cree", "1re-image", "pmrem-pret",
      "emblème-charge", "cine-t0", "cine-embleme", "cine-fin"];
    // Trié par instant réel, pas par ordre d'écriture : la v3 listait
    // `1re-image` après `pmrem-pret` alors qu'elle le précède, ce qui produisait
    // un delta négatif illisible et faussait la lecture de la séquence.
    const atteints = ordre.filter(function (k) { return etapes[k] !== undefined; })
      .sort(function (a, b) { return etapes[a] - etapes[b]; });
    let precedent = 0;
    for (const k of atteints) {
      L.push("  " + k + " : " + etapes[k] + " ms  (+" + (etapes[k] - precedent) + ")");
      precedent = etapes[k];
    }
    for (const k of ordre) if (etapes[k] === undefined) L.push("  " + k + " : NON ATTEINT");
    // Le pas de temps de la cinématique est plafonné à 50 ms/image : quand le
    // framerate s'effondre, la timeline n'accélère pas pour rattraper, elle
    // s'étire. Vingt secondes théoriques peuvent en durer bien plus à l'écran.
    if (etapes["cine-t0"] !== undefined && etapes["cine-fin"] !== undefined) {
      const reel = etapes["cine-fin"] - etapes["cine-t0"];
      L.push("  --> cinematique vecue : " + Math.round(reel / 100) / 10 + " s pour 20 s theoriques"
        + (reel > 23000 ? "   <<< ETIREE" : ""));
    }
    L.push("");
    L.push("FLUIDITE (" + f.length + " images mesurees)");
    if (f.length > 2) {
      const somme = f.reduce(function (a, x) { return a + x.d; }, 0);
      L.push("  fps moyen         : " + Math.round(1000 / (somme / f.length)));
      L.push("  image mediane     : " + Math.round(tri[Math.floor(tri.length / 2)]) + " ms");
      L.push("  pire image        : " + Math.round(tri[tri.length - 1]) + " ms");
      L.push("  images > 100 ms   : " + f.filter(function (x) { return x.d > 100; }).length);
    }
    L.push("");
    // La frise est le coeur du rapport : une moyenne sur vingt-quatre secondes
    // noie un gel de dix. Ici chaque seconde est jugée seule, et la colonne
    // « <<< » marque celles qui ont décroché. C'est ce qui situe le gel.
    L.push("FRISE (par seconde : images affichees, pire image)");
    if (f.length > 2) {
      // Seconde ENTIERE seulement : la derniere est coupee par l'affichage du
      // rapport, elle contiendrait deux ou trois images et serait signalee
      // comme un gel qui n'existe pas.
      const fin = Math.floor(f[f.length - 1].a / 1000);
      for (let s = 0; s < fin; s++) {
        const dedans = f.filter(function (x) { return x.a >= s * 1000 && x.a < (s + 1) * 1000; });
        const pire = dedans.reduce(function (m, x) { return Math.max(m, x.d); }, 0);
        // Le seuil de 24 images/s est bas exprès : au-dessus, l'oeil ne parle
        // pas de « gel ». Une seconde sous ce seuil, ou avec une image de plus
        // de 250 ms, est une seconde que le joueur a vue figer.
        const decroche = dedans.length < 24 || pire > 250;
        L.push("  " + (s + "s").padEnd(4) + " " + String(dedans.length).padStart(3) + " img   pire "
          + String(Math.round(pire)).padStart(5) + " ms" + (decroche ? "   <<<" : ""));
      }
    }
    L.push("");
    L.push("THREAD BLOQUE : " + bloque + " ms au total, " + gels.length + " taches longues");
    L.push("  les pires : " + gels.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 6)
      .map(function (g) { return g.ms + "ms a " + g.a; }).join(", "));
    L.push("");
    L.push("QUI BLOQUE (images > 100 ms, script par script)");
    if (coupables.length === 0) {
      L.push("  aucune — ou navigateur sans long-animation-frame");
    } else {
      const pires = coupables.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 6);
      for (const c of pires) {
        // `rendu` était collecté depuis la v3 mais jamais affiché — c'est
        // pourtant lui qui tranche : une image longue dont le script ne
        // représente presque rien n'est pas un problème de JavaScript mais de
        // style, de layout ou de composition GPU, et aucun correctif côté code
        // JS ne l'aurait touchée.
        const js = c.scripts.reduce(function (a, s) { return a + s.ms; }, 0);
        L.push("  " + c.ms + " ms a " + c.a + " ms   (script " + js + " ms | rendu " + c.rendu + " ms)");
        if (c.scripts.length === 0) L.push("      aucun script attribue — RENDU ou GPU");
        for (const s of c.scripts) L.push("      " + s.ms + " ms  " + s.ou + (s.quoi ? "  ." + s.quoi : ""));
      }
      const totJs = coupables.reduce(function (a, c) {
        return a + c.scripts.reduce(function (b, s) { return b + s.ms; }, 0);
      }, 0);
      const totMs = coupables.reduce(function (a, c) { return a + c.ms; }, 0);
      L.push("  cumul images longues : " + totMs + " ms, dont " + totJs + " ms de script"
        + "  -> " + Math.max(0, totMs - totJs) + " ms hors JS (rendu/GPU)");
    }
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

  // 32 secondes. La v3 s'arrêtait à 12 s pour « voir le démarrage », et c'est
  // exactement ce qui l'a rendue aveugle : l'emblème n'entre qu'à ~8,4 s de
  // timeline (≈10 s de page) et la cinématique dure 20 s, davantage encore si
  // le framerate la fait s'étirer. La sonde rendait donc son verdict avant
  // l'évènement à diagnostiquer, et jurait que tout allait bien.
  // `&s=N` ajuste la fenêtre sans redéployer, si 32 s ne suffisaient pas.
  const demande = parseInt((/[?&]s=(\d+)/.exec(location.search) || [])[1], 10);
  const fenetre = (demande > 0 && demande <= 120 ? demande : 32) * 1000;
  window.addEventListener("load", function () { setTimeout(afficher, fenetre); });
  window.FA_DIAG.afficher = afficher;
})();
