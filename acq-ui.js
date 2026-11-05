/* ============================================================
   FRACTAL ARENA — Origine d'un compte : capture de la PREMIÈRE touche.

   Ce module ne décide RIEN : il relève des faits au premier chargement
   (utm_source / utm_medium / utm_campaign de l'URL, referrer HTTP, plateforme)
   et les garde une fois pour toutes dans localStorage. Le serveur (acq.js) en
   tire le canal et le range à la CRÉATION du compte.

   Pourquoi la première touche et pas le dernier clic : un joueur qui découvre le
   jeu par un post X, ferme l'onglet et revient trois jours plus tard sans lien
   doit rester attribué à X — sinon la mesure ne compte que les conversions
   immédiates et sous-estime tous les canaux. Fenêtre de 30 jours : au-delà, une
   nouvelle touche remplace l'ancienne (un revenant six mois plus tard est une
   nouvelle acquisition, pas la même).

   Ce que le client n'envoie PAS : un canal inventé. Une URL sans utm et sans
   referrer donne `direct` — mais c'est le SERVEUR qui tranche, pas ce fichier.
   ============================================================ */
(function () {
  "use strict";

  const KEY = "fa_acq_v1";
  const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
  // Bornes de sécurité : le serveur reborne de toute façon (acq.js), ceci évite
  // juste d'écrire un pavé dans le corps de requête.
  const MAX = { s: 48, m: 24, c: 64, r: 200 };

  // Chaîne propre : pas de caractère de contrôle, longueur bornée. Toute autre
  // valeur (nombre, objet) devient "" — on ne fabrique pas de fait.
  function net(v, max) {
    if (typeof v !== "string") return "";
    return v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  // Plateforme : l'app native (Android Capacitor, Windows Tauri) n'envoie aucun
  // referrer — sans cette déclaration, tous ses joueurs compteraient `direct`.
  function plateforme() {
    try {
      if (typeof window !== "undefined") {
        if (window.Capacitor) return "app";
        if (window.__TAURI__ || window.__TAURI_INTERNALS__) return "app";
      }
    } catch (_e) { /* contexte exotique : on retombe sur web */ }
    return "web";
  }

  // Le referrer ne sert que s'il vient d'AILLEURS : le site se référence lui-même
  // à chaque navigation interne, et un referrer fractalarena.com dirait « direct »
  // de travers au serveur.
  function referrerExterne() {
    let ref = "";
    try { ref = (typeof document !== "undefined" && document.referrer) || ""; } catch (_e) { return ""; }
    if (!ref || ref === "null") return "";
    try {
      const h = new URL(ref).hostname.toLowerCase();
      const ici = (typeof location !== "undefined" && location.hostname || "").toLowerCase();
      if (h && ici && h === ici) return "";
      if (/(^|\.)fractalarena\.com$/.test(h)) return "";
    } catch (_e) { return ""; }
    return net(ref, MAX.r);
  }

  // Faits portés par l'URL de lancement (celles que le fondateur colle dans ses
  // posts : https://fractalarena.com/?utm_source=x&utm_medium=post).
  function depuisSearch(search) {
    const out = { s: "", m: "", c: "" };
    if (typeof search !== "string" || !search) return out;
    let q = null;
    try { q = new URLSearchParams(search); } catch (_e) { return out; }
    out.s = net(q.get("utm_source"), MAX.s);
    out.m = net(q.get("utm_medium"), MAX.m);
    out.c = net(q.get("utm_campaign"), MAX.c);
    return out;
  }

  function lire(now) {
    let brut = null;
    try { brut = localStorage.getItem(KEY); } catch (_e) { return null; }
    if (!brut) return null;
    let o = null;
    try { o = JSON.parse(brut); } catch (_e) { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const t = typeof o.t === "number" && isFinite(o.t) ? o.t : 0;
    if (!t || (now || Date.now()) - t > MAX_AGE_MS) return null; // trop vieux : nouvelle touche
    return o;
  }

  function ecrire(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (_e) { return false; }
  }

  /**
   * Première touche : renvoie celle déjà mémorisée si elle est fraîche, sinon
   * relève les faits du moment et la mémorise. `now` injectable pour les tests.
   */
  function capturer(search, now) {
    const t = now || Date.now();
    const deja = lire(t);
    if (deja) return deja;
    const q = depuisSearch(search);
    const o = {
      s: q.s, m: q.m, c: q.c,
      r: referrerExterne(),
      p: plateforme(),
      t,
    };
    ecrire(o);
    return o;
  }

  // Fragment à fusionner dans un corps de CRÉATION de compte ({ acq } ou {}).
  // Jamais envoyé sur un resync : le serveur ne lit l'origine qu'à l'INSERT.
  function payload() {
    const o = lire();
    if (!o) return {};
    const acq = {};
    if (o.s) acq.s = o.s;
    if (o.m) acq.m = o.m;
    if (o.c) acq.c = o.c;
    if (o.r) acq.r = o.r;
    if (o.p) acq.p = o.p;
    return Object.keys(acq).length ? { acq } : {};
  }

  // Appelé une fois au boot (app.jsx) : c'est ce qui fige la première touche
  // avant que la moindre navigation interne ne réécrive document.referrer.
  function boot() {
    let search = "";
    try { search = (typeof location !== "undefined" && location.search) || ""; } catch (_e) { search = ""; }
    return capturer(search);
  }

  const api = { KEY, MAX_AGE_MS, net, plateforme, referrerExterne, depuisSearch, lire, ecrire, capturer, payload, boot };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_ACQ = api;
})();
