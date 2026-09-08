/* ============================================================
   FRACTAL ARENA — Parrainage : logique pure (spec 2026-09-07).
   Le code d'un parrain arrive par le lien https://fractalarena.com/?ref=CODE.
   Il est lu UNE fois au boot (app.jsx, BOOT_REF_CODE) et transmis aux TROIS
   points de création d'un compte — POST /account/create, POST /claim-airdrop,
   POST /save — jamais aux resyncs : le serveur ne le prend en compte qu'à
   l'INSERT de la ligne (anti-Sybil : pas de rattachement a posteriori).
   Les constantes MIROIRENT fractal-arena-server/referral.js : si l'un bouge,
   l'autre doit bouger (test de symétrie dans referral-ui.test.js).
   ============================================================ */
(function () {
  "use strict";

  // Alphabet sans ambiguïté visuelle : ni 0/O, ni 1/I/l. 8 caractères.
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LEN = 8;
  const CODE_RE = new RegExp("^[" + CODE_ALPHABET + "]{" + CODE_LEN + "}$");
  const SITE_URL = "https://fractalarena.com/";

  // Même normalisation que le serveur : chaîne uniquement, trim + majuscules,
  // puis format strict. Tout le reste → null : on n'envoie pas ce que le
  // serveur rejetterait de toute façon en silence.
  function normalizeRefCode(input) {
    if (typeof input !== "string") return null;
    const c = input.trim().toUpperCase();
    return CODE_RE.test(c) ? c : null;
  }

  // `?ref=CODE` dans la query string de lancement (window.location.search).
  function parseRefSearch(search) {
    if (typeof search !== "string" || !search) return null;
    let raw = null;
    try { raw = new URLSearchParams(search).get("ref"); } catch (e) { return null; }
    return normalizeRefCode(raw);
  }

  // Le lien à partager, sur le domaine public (pas location.origin : un joueur
  // en fenêtre installée ou en test local doit partager le vrai site).
  function referralLink(code) {
    return SITE_URL + "?ref=" + encodeURIComponent(String(code || ""));
  }

  // Fragment de body à fusionner dans une requête de création : `{ ref }` si un
  // code bien formé est présent, `{}` sinon (réponse serveur inchangée).
  function refBody(code) {
    const c = normalizeRefCode(code);
    return c ? { ref: c } : {};
  }

  const api = { CODE_ALPHABET, CODE_LEN, SITE_URL, normalizeRefCode, parseRefSearch, referralLink, refBody };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_REFERRAL = api;
})();
