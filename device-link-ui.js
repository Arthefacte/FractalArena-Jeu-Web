/* ============================================================
   FRACTAL ARENA — Liaison d'appareil par QR : logique pure.
   Le PC (session authentifiée) affiche un code bref ; le téléphone le
   scanne (ou le recopie) et devient une session du MÊME compte — aucune
   signature mobile, UniSat ne sachant pas en produire pour une web app
   (deeplink natif only, DApp Center en liste blanche gelée — 2026-08-15).
   Les constantes MIROIRENT device-link.js côté serveur : si l'un bouge,
   l'autre doit bouger (test de symétrie dans device-link-ui.test.js).
   ============================================================ */
(function () {
  "use strict";

  // Alphabet Crockford (pas de I/L/O/U) — recopiable à la main sans ambiguïté.
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CODE_LEN = 16;

  // Même normalisation que le serveur : tolère tirets, espaces, minuscules.
  function normalizeLinkCode(input) {
    if (typeof input !== "string" || !input || input.length > 64) return null;
    const c = input.toUpperCase().replace(/[\s-]/g, "");
    if (c.length !== CODE_LEN) return null;
    for (const ch of c) if (!ALPHABET.includes(ch)) return null;
    return c;
  }

  function isLinkCode(input) {
    return normalizeLinkCode(input) !== null;
  }

  // Un lien complet collé vaut son code. Le pont vers l'app UniSat (mobile)
  // copie l'URL entière ; selon la version de l'app, son navigateur n'a pas de
  // barre où la coller — le joueur la met alors dans « Récupérer mon compte »,
  // et ce champ doit en tirer le code plutôt que la rejeter.
  function codeFromInput(input) {
    const s = String(input || "");
    const i = s.indexOf("#link=");
    return normalizeLinkCode(i >= 0 ? s.slice(i + 6) : s);
  }

  // L'URL portée par le QR. Le code reste groupé (lisible si le joueur ouvre
  // le lien à la main) ; la normalisation d'en face retire les tirets.
  function linkUrl(origin, code) {
    return origin + "/#link=" + String(code || "").trim();
  }

  // Lien universel openDapp (réponse UniSat, dev-support#105, 2026-08-18) :
  // ouvre une URL HTTPS — notre lien de liaison compris — directement dans le
  // navigateur intégré de l'app UniSat, où window.unisat est injecté. Universal
  // Link iOS / App Link Android : pas besoin du schéma unisat://, et pas besoin
  // d'être listé au DApp Center. btoa existe en navigateur comme sous Node ≥16.
  // SANS code : ouvre le jeu NU dans l'app. Le joueur qui y a déjà lié sa
  // session (fa_device_linked, dans le localStorage de l'app — invisible depuis
  // un navigateur normal) y retombe connecté. C'est le chemin d'un seul
  // toucher : aucun appel serveur, donc aucun code à faire expirer (TTL 2 min)
  // ni à compter contre le plafond de 3 codes actifs du serveur.
  function openDappUrl(origin, code) {
    const cible = code ? linkUrl(origin, code) : String(origin || "") + "/";
    const data = encodeURIComponent(btoa(JSON.stringify([cible])));
    return "https://app.unisat.cloud/request?method=openDapp&from=FractalArena&data=" + data;
  }

  // Au boot du téléphone : le hash contient-il un code de liaison ?
  // Renvoie le code NORMALISÉ ou null — jamais une chaîne brute du monde.
  function parseLinkHash(hash) {
    const m = /^#link=([0-9A-Za-z-]{16,25})$/.exec(String(hash || ""));
    return m ? normalizeLinkCode(m[1]) : null;
  }

  // SVG du QR — via la lib vendorisée (window.qrcode, MIT, aucun réseau).
  // Type 0 = taille auto ; correction M = suffisant pour un écran propre.
  function svgQr(text) {
    if (typeof window === "undefined" || typeof window.qrcode !== "function") return null;
    try {
      const qr = window.qrcode(0, "M");
      qr.addData(String(text));
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) {
      return null;
    }
  }

  const api = { ALPHABET, CODE_LEN, normalizeLinkCode, isLinkCode, codeFromInput, linkUrl, openDappUrl, parseLinkHash, svgQr };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_DEVICE_LINK = api;
})();
