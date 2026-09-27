/* ============================================================
   FRACTAL ARENA — relief des socles de l'Équipe (2,5D)
   Adaptateur du travail d'Astra (Equipe-25D) au jeu réel.

   Principes
   - Rien n'est réécrit : relief.js d'Astra est utilisé tel quel, et three.js
     est celui déjà vendorisé par le jeu (0.160.0, résolu par l'importmap).
   - Chargé seulement quand l'écran Équipe apparaît : import dynamique.
   - Le socle reste CELUI DU JEU : le socle industriel d'Astra (pedestal.js) a
     été retiré sur demande — rien d'autre n'a été touché.
   - Le détourage fixe reste affiché tant que le relief n'est pas prêt, et
     redevient l'affichage si WebGL manque, si le contexte se perd, ou si le
     visiteur a demandé moins de mouvement.
   - Aucune entité sans détourage n'est touchée : elle garde son illustration.
   ============================================================ */
(() => {
  "use strict";
  const CUTOUT = /assets\/entities\/([A-Za-z]+)\.webp/;
  // Amplitude du relief : c'est le `amount` de relief.js, celui que son curseur de démo
  // pilote (min 0, max 1, défaut 0,72 dans sa livraison). Au-delà de 1 le relief commence
  // à se décoller de l'illustration — d'où ce plafond.
  const AMPLITUDE = 1;
  // Calage du dessin sur son socle, entité par entité. Ces images ne sont PAS des
  // détourages : ce sont des scènes carrées où le fond est éteint par le relief, donc
  // la place du sujet dans le carré change d'une peinture à l'autre (Genesis est peint
  // plus gros que les autres, HashByte plus petit). k = échelle du dessin,
  // dy = décalage vertical en % du dessin (négatif = on monte l'entité).
  const REGLAGE_DEFAUT = { k: 1, dy: -8 };
  const CALAGE = {
    GENESIS: { k: 0.88, dy: -6 },
    NETWORK: { k: 0.95, dy: -8 },
    BLOCK: { k: 0.95, dy: -8 },
  };
  const reduit = matchMedia("(prefers-reduced-motion: reduce)");

  let relief = null;          // module relief.js une fois chargé
  let socleModule = null;     // module pedestal.js (le socle industriel d'Astra)
  let chargement = null;      // promesse d'import (une seule fois)
  const montees = new Map();  // socle -> { vue, nom, cadre }
  let boucle = 0;
  let dernier = 0;

  // Le socle porte-t-il un détourage (= une entité qu'on sait relever) ?
  function nomDuSocle(socle) {
    const img = socle.querySelector("img.stage-entity");
    if (!img) return null;
    const m = (img.getAttribute("src") || "").match(CUTOUT);
    return m ? m[1] : null;   // le nom du fichier EST la clé du profil chez Astra
  }

  function charger() {
    if (!chargement) {
      const v = (typeof window !== "undefined" && window.FA_ASSET_V) || "";
      const suffixe = v ? "?v=" + v : "";
      // Chaque module est indépendant : un socle qui manque ne doit pas emporter le relief.
      chargement = Promise.all([
        import("./relief.js" + suffixe).catch(() => null),
        import("./pedestal.js" + suffixe).catch(() => null),
      ]).then(([r, soc]) => { relief = r; socleModule = soc; })
        .catch(() => { chargement = null; return null; });
    }
    return chargement;
  }

  // Le canevas doit couvrir la zone réellement DESSINÉE, pas la boîte de l'image :
  // les détourages sont carrés et posés en « center bottom » (object-fit: contain),
  // donc la boîte de l'image est plus haute que le dessin. Viser la boîte étirerait
  // l'entité verticalement.
  // Clé d'entité : le nom du fichier EST le profil chez Astra (Genesis.webp, LEDGER.webp,
  // et les déclinaisons de rareté GENESIS_S.webp…).
  function cleEntite(img) {
    const f = (img.getAttribute("src") || "").split("/").pop().split("?")[0].replace(/\.webp$/i, "");
    return f.replace(/_[ABCS]$/i, "").toUpperCase();
  }

  function cadrer(socle, entree) {
    const img = socle.querySelector("img.stage-entity");
    if (!img || !entree || !entree.vue) return;
    const l = img.offsetLeft, h = img.offsetTop, w = img.offsetWidth, ht = img.offsetHeight;
    if (!w || !ht) return;
    const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
    const echelle = Math.min(w / nw, ht / nh);
    const dw = nw * echelle, dh = nh * echelle;
    const gl = Math.round(l + (w - dw) / 2), gt = Math.round(h + (ht - dh));
    const gw = Math.round(dw), gh = Math.round(dh);
    const canevas = entree.vue.renderer && entree.vue.renderer.domElement;
    if (!canevas) return;
    const r = CALAGE[cleEntite(img)] || REGLAGE_DEFAUT;
    const cw = Math.round(gw * r.k), ch = Math.round(gh * r.k);
    const cl = Math.round(gl + (gw - cw) / 2), ct = Math.round(gt + gh - ch + (gh * r.dy) / 100);
    const cadre = cl + "," + ct + "," + cw + "x" + ch;
    if (entree.cadre === cadre) return;
    entree.cadre = cadre;
    canevas.style.position = "absolute";
    canevas.style.left = cl + "px";
    canevas.style.top = ct + "px";
    canevas.style.width = cw + "px";
    canevas.style.height = ch + "px";
    canevas.style.zIndex = "3";
    canevas.style.pointerEvents = "none";
    entree.dessin = { l: gl, t: gt, w: gw, h: gh };   // le socle reste sur la boîte du dessin
    // Le relief dimensionne sa mémoire d'image sur le socle : on la remet sur le dessin.
    try { entree.vue.renderer.setSize(cw, ch, false); entree.vue.draw(0); } catch (e) {}
  }

  // Le socle d'Astra, avec TOUTES ses couches : plateforme (SVG), halo arrière, lumière
  // au sol, ombre au pied et brume devant. Les proportions sont celles de sa démo : la
  // boîte reçoit left 0 / width 100% / height 30% / bottom -7%, et chaque couche garde
  // ses pourcentages d'origine — d'où le calage du conteneur sur la zone DESSINÉE.
  function poserSocle(socle, entree) {
    if (!socleModule || !socleModule.pedestalSVG || !relief) return;
    const d = entree.dessin;
    if (!d || !d.w) return;
    const rang = Array.prototype.indexOf.call(socle.parentNode ? socle.parentNode.children : [], socle);
    let bloc = socle.querySelector(".stage-25d-socle");
    if (!bloc) {
      bloc = document.createElement("span");
      bloc.className = "stage-25d-socle";
      bloc.setAttribute("aria-hidden", "true");
      bloc.innerHTML = '<span class="s25d-sol"></span><span class="s25d-halo"></span>'
        + '<span class="s25d-ombre"></span><span class="s25d-contact"></span>'
        + socleModule.pedestalSVG("f" + rang + Math.random().toString(36).slice(2, 6)).replace('class="hardware"', 'class="s25d-hardware"')
        + '<span class="s25d-brume"></span>';
      socle.insertBefore(bloc, socle.firstChild);
      socle.dataset.socle25d = "1";       // masque le socle du jeu sous celui-ci
    }
    const couleur = (relief.profiles[entree.nom] && relief.profiles[entree.nom].color) || "var(--elec)";
    bloc.style.setProperty("--accent", couleur);
    bloc.style.left = d.l + "px";
    bloc.style.top = d.t + "px";
    bloc.style.width = d.w + "px";
    bloc.style.height = d.h + "px";
  }

  // Réagit au survol comme la démo : relief discret qui suit le pointeur.
  function brancherPointeur(socle, entree) {
    if (socle.dataset.reliefPointeur === "1") return;
    socle.dataset.reliefPointeur = "1";
    socle.addEventListener("pointermove", (e) => {
      const b = socle.getBoundingClientRect();
      try { entree.vue.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1); } catch (err) {}
    });
    socle.addEventListener("pointerleave", () => { try { entree.vue.pointer.set(0, 0); } catch (e) {} });
  }

  async function monter(socle, nom) {
    await charger();
    if (!relief || !document.contains(socle)) return;
    if (!socle.querySelector("img.stage-entity")) return;
    let entree = montees.get(socle);
    if (!entree) {
      let vue;
      try { vue = new relief.EntityRelief(socle, () => socle.querySelector("img.stage-entity").getAttribute("src")); }
      catch (e) { return; }                       // pas de WebGL : le détourage reste
      try { vue.amount = AMPLITUDE; } catch (e) {}     // amplitude du relief
      entree = { vue, nom: null, cadre: null };
      montees.set(socle, entree);
      brancherPointeur(socle, entree);
      lancerBoucle();
    }
    try { entree.vue.amount = AMPLITUDE; } catch (e) {}
    if (entree.nom !== nom) {
      entree.nom = nom;
      try { await entree.vue.setEntity(nom); } catch (e) {}
    }
    cadrer(socle, entree);
    poserSocle(socle, entree);
  }

  function demonter(socle) {
    const entree = montees.get(socle);
    if (!entree) return;
    montees.delete(socle);
    try { entree.vue.dispose(); } catch (e) {}
  }

  function synchroniser() {
    const socles = Array.from(document.querySelectorAll(".team-stage .stage-slot"));
    for (const socle of socles) {
      const nom = nomDuSocle(socle);
      if (!nom) { demonter(socle); continue; }
      monter(socle, nom);
    }
    for (const socle of Array.from(montees.keys())) if (!document.contains(socle)) demonter(socle);
  }

  function lancerBoucle() {
    if (boucle) return;
    dernier = performance.now();
    const tour = (t) => {
      boucle = requestAnimationFrame(tour);
      const dt = Math.min((t - dernier) / 1000, 0.05);
      dernier = t;
      if (document.hidden) return;                 // onglet caché : aucune animation
      const immobile = reduit.matches;
      for (const [socle, entree] of montees) {
        const r = socle.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;   // hors écran : suspendu
        // Le module d'Astra observe la PLACE et lui redonne sa taille entière : on rétablit
        // la zone dessinée, sinon l'entité est étirée dans un canevas trop haut.
        const d = entree.dessin, c = entree.vue.renderer && entree.vue.renderer.domElement;
        if (d && c && (c.width !== d.w || c.height !== d.h)) { try { entree.vue.renderer.setSize(d.w, d.h, false); } catch (e) {} }
        try { entree.vue.draw(immobile ? 0 : dt); } catch (e) {}
      }
      if (!montees.size) { cancelAnimationFrame(boucle); boucle = 0; }
    };
    boucle = requestAnimationFrame(tour);
  }

  // Le jeu est en React : on suit les recollections plutôt que de les supposer.
  let prevu = 0;
  const observateur = new MutationObserver(() => {
    if (prevu) return;
    prevu = requestAnimationFrame(() => { prevu = 0; synchroniser(); });
  });

  function demarrer() {
    if (!document.querySelector(".team-stage")) {
      observateur.observe(document.body, { childList: true, subtree: true });
      return;
    }
    observateur.observe(document.body, { childList: true, subtree: true });
    synchroniser();
  }

  window.__faRelief25d = montees;      // poignée de contrôle (lecture seule)
  addEventListener("resize", () => { for (const [socle, entree] of montees) { entree.cadre = null; cadrer(socle, entree); } });
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
  addEventListener("pagehide", () => { for (const socle of Array.from(montees.keys())) demonter(socle); });
})();
