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
  // Le serveur verrouille l'economie sur onchain_verified (colonne NOT NULL DEFAULT
  // FALSE, jamais renseignee a l'insertion d'un nouveau joueur) — PAS sur le type de
  // compte. Un joueur UniSat tout neuf a donc, lui aussi, ses gains verrouilles cote
  // serveur ; sans ce bandeau il n'a ni explication ni acces au bouton de verification
  // on-chain (qui vit dans sa modale). Les comptes deja existants ont ete backfilles a
  // TRUE cote serveur : ce changement ne les affecte pas (audit IMPORTANT 6, 2026-07-27).
  function shouldShowLockedBanner(o) {
    const s = o || {};
    if (s.onchainVerified !== false) return false;
    const now = s.now || 0;
    const dismissed = s.dismissedAt || 0;
    return now - dismissed >= BANNER_SNOOZE_MS;
  }

  // Qui signe une demande de retrait, et pour quel compte.
  //
  // Un compte genere ne peut PAS signer sous sa propre adresse : elle est produite
  // par le serveur, qui seul en detient la seed. UniSat, lui, ne sait signer que le
  // portefeuille du joueur. Le joueur signe donc avec son PORTEFEUILLE LIE, et le
  // serveur emet le jeton pour son COMPTE (parametre `account`, serveur PR #72).
  //
  // Renvoie null quand aucun retrait n'est possible — un compte genere qui n'a lie
  // aucun portefeuille. L'appelant doit alors dire quoi faire (lier son
  // portefeuille), pas laisser partir une signature vouee au refus.
  function withdrawSigner(state) {
    const s = state || {};
    const wallet = s.wallet || "";
    const linked = s.linkedWallet || "";
    if (!wallet) return null;
    if (s.accountKind !== KIND_GENERATED) return { signer: wallet, account: null };
    if (!linked) return null;
    // linked === wallet : le serveur refuse deja (« portefeuille identique »), et
    // viser un compte egal au signataire ne changerait rien au message signe.
    return linked === wallet ? { signer: wallet, account: null } : { signer: linked, account: wallet };
  }

  // Adresse vers laquelle partiront reellement les jetons. Meme regle que le
  // serveur (`destination = linked_wallet || wallet`) : le joueur doit pouvoir la
  // verifier avant de retirer, elle n'etait affichee nulle part.
  function withdrawDestination(state) {
    const s = state || {};
    return s.linkedWallet || s.wallet || "";
  }

  // Ce qu'il reste a faire du volet crypto, ou null s'il n'y a rien a demander.
  // Tout vient du serveur (/discovery/state) : le client ne decide jamais si un
  // parcours est fini, il le lit.
  //
  // Sert deux affichages : la fenetre « Bien joue » qui s'ouvre d'elle-meme quand
  // la sixieme etape vient d'etre reclamee, et la porte permanente du panneau du
  // parcours. Avant, la seule porte etait un bandeau fermable qui se taisait
  // ensuite 24 h : un joueur qui l'avait ferme finissait ses six etapes sans
  // qu'aucun ecran ne lui propose de lier son portefeuille.
  function discoveryNextAction(disc, linkedWallet) {
    if (!disc || !disc.eligible || !disc.game_done) return null;
    if (disc.txid_verified) return null;
    if (!linkedWallet) return "link";
    return disc.dust_sent ? "txid" : "dust";
  }

  window.FA_ACCOUNT = {
    KIND_GENERATED, KIND_UNISAT, TOKEN_KEY, KIND_KEY, BANNER_SNOOZE_MS,
    readToken, writeToken, clearToken, readKind,
    isValidRecoveryCode, looksLikeSeed, shouldShowLockedBanner, discoveryNextAction,
    withdrawSigner, withdrawDestination,
  };
})();
