// test/account-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// Le module est une IIFE qui écrit sur `window` : on lui fournit un window et des
// stockages factices, puis on l'évalue. Même approche que test/tour-ui.test.js.
function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  function mkStore() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      _map: m,
    };
  }
  const win = { localStorage: mkStore(), sessionStorage: mkStore() };
  const fn = new Function("window", "localStorage", "sessionStorage", src);
  fn(win, win.localStorage, win.sessionStorage);
  return { A: win.FA_ACCOUNT, win };
}

test("un compte UniSat garde sessionStorage (comportement d'avant inchange)", () => {
  const { A, win } = load();
  A.writeToken("tok-unisat", A.KIND_UNISAT);
  assert.strictEqual(win.sessionStorage.getItem("fa_auth_token"), "tok-unisat");
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null,
    "un token UniSat ne doit JAMAIS atterrir en localStorage (audit 2026-06-24)");
  assert.strictEqual(A.readToken(), "tok-unisat");
});

test("un compte genere persiste en localStorage", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), "tok-gen");
  assert.strictEqual(A.readToken(), "tok-gen");
  assert.strictEqual(A.readKind(), A.KIND_GENERATED);
});

test("changer de type purge l'autre stockage (jamais deux tokens en vie)", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.writeToken("tok-unisat", A.KIND_UNISAT);
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null);
  assert.strictEqual(A.readToken(), "tok-unisat");
});

test("clearToken efface les deux stockages et le type", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.clearToken();
  assert.strictEqual(A.readToken(), "");
  assert.strictEqual(A.readKind(), "");
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null);
  assert.strictEqual(win.sessionStorage.getItem("fa_auth_token"), null);
});

test("writeToken('') efface sans rien laisser", () => {
  const { A } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.writeToken("", A.KIND_GENERATED);
  assert.strictEqual(A.readToken(), "");
});

test("un stockage indisponible (mode prive) ne fait jamais planter", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  const boom = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  const win = { localStorage: boom, sessionStorage: boom };
  new Function("window", "localStorage", "sessionStorage", src)(win, boom, boom);
  assert.doesNotThrow(() => win.FA_ACCOUNT.writeToken("t", "generated"));
  assert.strictEqual(win.FA_ACCOUNT.readToken(), "");
});

test("code de recuperation : accepte le format du serveur, refuse le reste", () => {
  const { A } = load();
  // makeRecoveryCode() serveur = randomBytes(24).toString("base64url") → 32 caracteres URL-safe.
  assert.ok(A.isValidRecoveryCode("abcdefghij_klmnopqrst-uvwxyz01234"));
  assert.ok(A.isValidRecoveryCode("  abcdefghij_klmnopqrst-uvwxyz012  "), "les espaces autour sont tolerés");
  assert.ok(!A.isValidRecoveryCode("court"));
  assert.ok(!A.isValidRecoveryCode(""));
  assert.ok(!A.isValidRecoveryCode(null));
  assert.ok(!A.isValidRecoveryCode("a".repeat(300)), "borne haute : pas d'envoi demesure");
  assert.ok(!A.isValidRecoveryCode("abc def ghi jkl mno pqr stu vwx yza bcd efg hij"), "espaces internes = ce n'est pas un code");
});

test("looksLikeSeed detecte une phrase mnemonique (garde anti-phishing)", () => {
  const { A } = load();
  const seed12 = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  assert.ok(A.looksLikeSeed(seed12), "12 mots = seed");
  assert.ok(A.looksLikeSeed("  " + seed12 + "  "));
  assert.ok(!A.looksLikeSeed("abcdefghij_klmnopqrst-uvwxyz01234"), "un code de recuperation n'est pas une seed");
  assert.ok(!A.looksLikeSeed("deux mots"));
  assert.ok(!A.looksLikeSeed(""));
});

test("bandeau : visible pour tout compte non verifie on-chain, quel que soit son type", () => {
  const { A } = load();
  const now = 1_000_000_000_000;
  assert.ok(A.shouldShowLockedBanner({ kind: "generated", onchainVerified: false, dismissedAt: 0, now }));
  assert.ok(!A.shouldShowLockedBanner({ kind: "generated", onchainVerified: true, dismissedAt: 0, now }),
    "compte verifie : plus rien a rappeler");
  // Le serveur verrouille l'economie sur onchain_verified (colonne NOT NULL DEFAULT
  // FALSE, jamais renseignee a l'insertion d'un nouveau joueur) — PAS sur le type de
  // compte. Un joueur UniSat tout neuf a donc, lui aussi, ses gains verrouilles cote
  // serveur : sans le bandeau, il n'a ni explication ni acces au bouton "Verifier mon
  // activite on-chain" (qui vit dans sa modale). C'est un CHANGEMENT de comportement
  // assume (audit IMPORTANT 6, 2026-07-27) : les comptes deja existants ont ete
  // backfilles a onchain_verified=TRUE cote serveur, donc ne sont pas affectes.
  assert.ok(A.shouldShowLockedBanner({ kind: "unisat", onchainVerified: false, dismissedAt: 0, now }),
    "un joueur UniSat tout neuf, non encore verifie on-chain cote serveur, doit aussi voir le bandeau");
  assert.ok(!A.shouldShowLockedBanner({ kind: "unisat", onchainVerified: true, dismissedAt: 0, now }),
    "un joueur UniSat deja verifie (ou backfille) n'est pas concerne");
});

test("bandeau : ferme, il se tait 24 h puis revient", () => {
  const { A } = load();
  const now = 1_000_000_000_000;
  const base = { kind: "generated", onchainVerified: false, now };
  assert.ok(!A.shouldShowLockedBanner({ ...base, dismissedAt: now - 3600_000 }), "1 h après : silencieux");
  assert.ok(A.shouldShowLockedBanner({ ...base, dismissedAt: now - 25 * 3600_000 }), "25 h après : revient");
});

// ============================================================
// La fenêtre « Bien joué » (decision du user, 2026-07-29)
//
// Le volet crypto n'avait qu'une seule porte : un bandeau que le joueur peut
// fermer, et qui se tait alors 24 h. Un joueur qui l'avait ferme finissait ses
// six etapes sans qu'aucun ecran ne lui propose de lier son portefeuille — il ne
// lui restait plus que la console du navigateur. Cette fonction dit ce qu'il
// reste a faire, pour que la fenetre s'ouvre d'elle-meme au bon moment et que le
// panneau du parcours garde une porte permanente.
// ============================================================

test("l'etape crypto restante se deduit de l'etat serveur", () => {
  const { A } = load();
  const fini = { eligible: true, game_done: true, dust_sent: false, txid_verified: false };

  assert.strictEqual(A.discoveryNextAction(fini, ""), "link",
    "six etapes finies, aucun portefeuille lie : c'est le moment de le lier");
  assert.strictEqual(A.discoveryNextAction(fini, "bc1qjoueur"), "dust",
    "lie mais poussiere pas encore partie : on attend, il n'y a rien a coller");
  assert.strictEqual(A.discoveryNextAction({ ...fini, dust_sent: true }, "bc1qjoueur"), "txid",
    "la poussiere est arrivee : le joueur peut aller chercher son txid");
  assert.strictEqual(A.discoveryNextAction({ ...fini, dust_sent: true, txid_verified: true }, "bc1qjoueur"), null,
    "parcours termine : plus rien a demander, la fenetre ne doit plus surgir");
});

test("rien n'est propose tant que le volet jeu n'est pas fini", () => {
  const { A } = load();
  assert.strictEqual(
    A.discoveryNextAction({ eligible: true, game_done: false, dust_sent: false, txid_verified: false }, ""),
    null,
    "la barriere reste les six etapes : aucune fenetre ne doit les court-circuiter");
});

test("un compte hors parcours n'a jamais d'etape crypto", () => {
  const { A } = load();
  // Un joueur venu avec UniSat : le serveur rend {eligible:false}. Lui ouvrir
  // « Bien joue, lie ton portefeuille » l'enverrait vers un ecran qui refuse
  // (403 parcours_non_applicable) et redirigerait ses retraits s'il aboutissait.
  assert.strictEqual(A.discoveryNextAction({ eligible: false, steps: [] }, ""), null);
  assert.strictEqual(A.discoveryNextAction(null, ""), null, "etat pas encore charge : ne rien supposer");
});

// Liaison impossible depuis un mobile : l'extension UniSat n'y est pas injectée, donc
// aucune signature n'est possible. Le message d'échec « no-unisat » n'arrivait qu'APRÈS
// le clic ; on le dit avant, là où le joueur décide.
test("linkHintKey : prévient qu'il faut un ordinateur tant qu'UniSat n'est pas là", () => {
  const { A } = load();
  assert.strictEqual(A.linkHintKey(false), "ACC_LINK_DESKTOP_ONLY");
  assert.strictEqual(A.linkHintKey(true), null, "extension présente : aucune note à afficher");
});
