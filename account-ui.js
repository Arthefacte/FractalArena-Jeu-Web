/* ============================================================
   FRACTAL ARENA — Compte sans wallet : helpers purs (testables Node)
   Le serveur fait foi (accounts.js) : ici, seulement les decisions
   d'affichage et la regle de stockage du jeton de session.
   ============================================================ */
(function () {
  const TOKEN_KEY = "fa_auth_token";
  const KIND_KEY = "fa_account_kind";
  const KIND_GENERATED = "generated";
  const KIND_UNISAT = "unisat";

  // Un compte UniSat peut re-signer silencieusement a tout moment : son jeton
  // reste en sessionStorage (efface a la fermeture de l'onglet), comme decide a
  // l'audit 2026-06-24. Un compte genere, lui, n'a rien a re-signer — sans
  // persistance il faudrait ressaisir le code de recuperation a chaque fois.
  // L'exposition XSS reste donc bornee aux comptes generes.
  function store(kind) {
    return kind === KIND_GENERATED ? window.localStorage : window.sessionStorage;
  }
  function get(s, k) { try { return s.getItem(k) || ""; } catch (e) { return ""; } }
  function set(s, k, v) { try { s.setItem(k, v); } catch (e) {} }
  function del(s, k) { try { s.removeItem(k); } catch (e) {} }

  function readKind() { return get(window.localStorage, KIND_KEY); }

  function readToken() {
    return get(window.sessionStorage, TOKEN_KEY) || get(window.localStorage, TOKEN_KEY);
  }

  function writeToken(token, kind) {
    const k = kind || readKind() || KIND_UNISAT;
    if (!token) { clearToken(); return; }
    // Purger l'autre stockage AVANT d'ecrire : jamais deux jetons en vie, sinon
    // readToken pourrait rendre le perime apres un changement de compte.
    del(k === KIND_GENERATED ? window.sessionStorage : window.localStorage, TOKEN_KEY);
    set(store(k), TOKEN_KEY, token);
    set(window.localStorage, KIND_KEY, k);
  }

  function clearToken() {
    del(window.sessionStorage, TOKEN_KEY);
    del(window.localStorage, TOKEN_KEY);
    del(window.localStorage, KIND_KEY);
  }

  // makeRecoveryCode() serveur : randomBytes(24).toString("base64url") → 32
  // caracteres de l'alphabet base64url. On borne large mais on borne (le serveur
  // refuse au-dela de 256).
  const CODE_RE = /^[A-Za-z0-9_-]{24,256}$/;
  function isValidRecoveryCode(s) {
    return typeof s === "string" && CODE_RE.test(s.trim());
  }

  // Garde anti-phishing : si le joueur colle sa seed dans le champ du code, on
  // refuse AVANT tout envoi reseau et on l'avertit. La seed ne doit jamais
  // quitter sa machine, y compris vers nous.
  function looksLikeSeed(s) {
    if (typeof s !== "string") return false;
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.length >= 11 && words.every((w) => /^[a-zA-Z]+$/.test(w));
  }

  const BANNER_SNOOZE_MS = 24 * 3600 * 1000;
  function shouldShowLockedBanner(o) {
    const s = o || {};
    if (s.kind !== KIND_GENERATED) return false;
    if (s.onchainVerified) return false;
    const now = s.now || 0;
    const dismissed = s.dismissedAt || 0;
    return now - dismissed >= BANNER_SNOOZE_MS;
  }

  window.FA_ACCOUNT = {
    KIND_GENERATED, KIND_UNISAT, TOKEN_KEY, KIND_KEY, BANNER_SNOOZE_MS,
    readToken, writeToken, clearToken, readKind,
    isValidRecoveryCode, looksLikeSeed, shouldShowLockedBanner,
  };
})();
