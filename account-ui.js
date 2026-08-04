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

  // L'app tourne-t-elle en fenetre installee (PWA) plutot que dans un onglet ?
  // Gardes larges : ces API manquent dans les environnements de test et sur
  // certains navigateurs — l'absence de reponse doit valoir "onglet", jamais une
  // exception au chargement du module.
  function estAppInstallee() {
    try {
      if (window.navigator && window.navigator.standalone === true) return true;
      return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    } catch (e) { return false; }
  }

  // Ou vit le jeton de session.
  //
  // Un compte genere n'a rien a re-signer : son jeton persiste en localStorage,
  // sinon il faudrait ressaisir le code de recuperation a chaque fois.
  //
  // Un compte UniSat gardait le sien en sessionStorage (efface a la fermeture,
  // audit 2026-06-24), au motif qu'il « peut re-signer silencieusement a tout
  // moment ». EN APPLICATION INSTALLEE, CE MOTIF EST FAUX : la popup
  // d'approbation d'UniSat ne s'affiche pas dans une fenetre standalone, et il
  // n'y a ni barre d'adresse ni barre d'extensions pour aller la chercher. Le
  // joueur ne pouvait donc plus combattre des la deuxieme ouverture (constate en
  // conditions reelles le 2026-08-02).
  //
  // On persiste donc aussi le jeton UniSat quand on est en fenetre installee.
  // Ce que ca coute, dit franchement : un jeton qui survit a la fermeture est un
  // jeton qu'une XSS pourrait voler. Ce qui le borne : la CSP est stricte depuis
  // le 2026-08-01 (ni script en ligne, ni eval), et ce jeton est de portee
  // `session` — IL NE PERMET PAS DE RETIRER DES FONDS, un retrait exige une
  // signature separee en portee `withdraw`. C'est deja le traitement des
  // comptes generes. En onglet, ou la popup fonctionne, rien ne change.
  function store(kind) {
    if (kind === KIND_GENERATED) return window.localStorage;
    return estAppInstallee() ? window.localStorage : window.sessionStorage;
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
    // On deduit "l'autre" de la cible reellement choisie par store() — le
    // deduire du `kind` seul etait juste tant qu'UniSat signifiait
    // sessionStorage, ce qui n'est plus vrai en application installee.
    const cible = store(k);
    del(cible === window.localStorage ? window.sessionStorage : window.localStorage, TOKEN_KEY);
    set(cible, TOKEN_KEY, token);
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

  // Le portefeuille UniSat à interroger — JAMAIS window.unisat en direct.
  //
  // UniSat a introduit `window.unisat_wallet` parce que de nombreux portefeuilles
  // forkent leur code et injectent eux aussi `window.unisat` (docs/api/browser-detection.md
  // de unisat-wallet/wallet). Sur une machine où un fork est installé, `window.unisat`
  // peut donc désigner un AUTRE portefeuille que celui que le joueur croit utiliser.
  // Or lier un portefeuille est IRRÉVERSIBLE côté jeu (incident du 2026-07-30) et la
  // signature engage les retraits : on prend le global dédié en premier, et on ne
  // retombe sur l'ancien que parce que les versions installées aujourd'hui n'exposent
  // que celui-là.
  function provider() {
    return (typeof window.unisat_wallet !== "undefined" && window.unisat_wallet)
        || (typeof window.unisat !== "undefined" && window.unisat)
        || null;
  }

  function hasProvider() {
    return !!provider();
  }

  // Nom à afficher quand le serveur n'a PAS répondu (404, réseau coupé) : lui seul
  // fournit `display_name`. Pour un compte généré, l'adresse du compte a été fabriquée
  // par le serveur — l'afficher présenterait au joueur, comme sien, un portefeuille
  // dont il n'a pas la clé. On préfère ne rien afficher : le nom arrive à la synchro.
  // Pour un compte UniSat, l'adresse EST le portefeuille du joueur : on l'abrège.
  function localDisplayName(addr, kind) {
    if (!addr || kind === KIND_GENERATED) return "";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  // Note à afficher sous le bouton de liaison. Sans extension UniSat injectée, lier
  // est impossible — c'est TOUJOURS le cas dans un navigateur mobile, qui ne sait pas
  // signer. Le joueur ne l'apprenait qu'après avoir cliqué (échec « no-unisat ») ;
  // autant le dire au moment où il décide, avec la marche à suivre.
  function linkHintKey(hasUnisat) {
    return hasUnisat ? null : "ACC_LINK_DESKTOP_ONLY";
  }

  // Nommer un échec d'authentification.
  //
  // `authenticate()` attrapait TOUTE erreur et rendait "" sans rien dire :
  // extension absente, extension verrouillée, signature refusée, serveur en
  // panne — quatre causes appelant quatre gestes différents, réduites au même
  // silence. On a diagnostiqué à l'aveugle, et ça a coûté une régression
  // (v111 : le combat restait suspendu, v112 pour revenir en arrière).
  //
  // Rend { cle, detail } : `cle` est une clé i18n montrable au joueur, `detail`
  // la trace brute (message de l'extension, code HTTP) pour la console.
  function authFailure(etape, err, status) {
    const msg = (err && (err.message || err.reason || String(err))) || "";
    const code = Number(status) || 0;
    const detail = [etape, msg, code ? "HTTP " + code : ""].filter(Boolean).join(" · ");
    let cle;
    if (etape === "extension") {
      cle = "AUTHDIAG_NO_EXTENSION";
    } else if (etape === "challenge") {
      cle = "AUTHDIAG_CHALLENGE";
    } else if (etape === "signature") {
      // Verrouillé et refusé demandent deux gestes DIFFÉRENTS au joueur
      // (déverrouiller vs accepter) : les confondre le laisse sans solution.
      if (/lock/i.test(msg)) cle = "AUTHDIAG_LOCKED";
      else if (/reject|denied|refus|cancel/i.test(msg)) cle = "AUTHDIAG_REJECTED";
      else cle = "AUTHDIAG_SIGN_FAILED";
    } else if (etape === "verify") {
      cle = "AUTHDIAG_VERIFY";
    } else {
      // Une étape imprévue reste NOMMÉE : c'est tout l'objet de cette fonction.
      cle = "AUTHDIAG_UNKNOWN";
    }
    return { cle, detail };
  }

  window.FA_ACCOUNT = {
    KIND_GENERATED, KIND_UNISAT, TOKEN_KEY, KIND_KEY, BANNER_SNOOZE_MS,
    readToken, writeToken, clearToken, readKind,
    isValidRecoveryCode, looksLikeSeed, shouldShowLockedBanner, discoveryNextAction,
    withdrawSigner, withdrawDestination, linkHintKey, authFailure, estAppInstallee,
    provider, hasProvider, localDisplayName,
  };
})();
