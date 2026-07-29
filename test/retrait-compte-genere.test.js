// test/retrait-compte-genere.test.js
"use strict";
// ============================================================
// Retrait depuis un compte cree sans wallet.
//
// L'adresse d'un compte genere est produite par le serveur, qui seul en detient
// la seed : le joueur ne peut PAS la signer. authForWithdraw demandait pourtant
// un challenge sur cette adresse et le faisait signer par UniSat — qui signe
// forcement avec le portefeuille du joueur. La verification echouait toujours :
// 401, « Signature requise pour retirer », sur un ecran qui venait de promettre
// « tes retraits partiront vers ce portefeuille ».
//
// Le serveur (PR #72) emet desormais un jeton POUR LE COMPTE sur signature du
// PORTEFEUILLE LIE, via le parametre `account`. Ce volet-ci branche le client.
// ============================================================
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");
const SCREENS = read("screens.jsx");
const I18N = read("i18n.js");
const INDEX = read("index.html");

// account-ui.js s'installe sur window : on le charge dans un window factice.
function chargerACC() {
  global.window = { localStorage: null, sessionStorage: null };
  delete require.cache[require.resolve("../account-ui.js")];
  require("../account-ui.js");
  return global.window.FA_ACCOUNT;
}
const ACC = chargerACC();

const COMPTE = "bc1qcomptegenere00000000000000000000000000";
const PORTEFEUILLE = "bc1qportefeuilledujoueur000000000000000000";

// ---------- Qui signe, pour quel compte ----------

test("compte genere avec portefeuille lie : c'est le portefeuille qui signe, pour le compte", () => {
  const r = ACC.withdrawSigner({ accountKind: ACC.KIND_GENERATED, wallet: COMPTE, linkedWallet: PORTEFEUILLE });
  assert.strictEqual(r.signer, PORTEFEUILLE, "UniSat ne peut signer que le portefeuille du joueur");
  assert.strictEqual(r.account, COMPTE, "le jeton doit porter le compte : c'est lui qui detient le solde");
});

test("compte genere SANS portefeuille lie : aucun retrait possible", () => {
  // Le dire ici plutot que de laisser partir une signature vouee a l'echec : le
  // joueur doit lire « lie ton portefeuille », pas « signature requise ».
  assert.strictEqual(
    ACC.withdrawSigner({ accountKind: ACC.KIND_GENERATED, wallet: COMPTE, linkedWallet: "" }), null);
});

test("joueur venu avec UniSat : il signe sous sa propre adresse, sans compte vise", () => {
  const r = ACC.withdrawSigner({ accountKind: ACC.KIND_UNISAT, wallet: PORTEFEUILLE, linkedWallet: "" });
  assert.strictEqual(r.signer, PORTEFEUILLE);
  assert.strictEqual(r.account, null, "un compte vise inutile changerait le message a signer pour rien");
});

test("un compte genere qui aurait son propre wallet pour lie ne vise pas de compte", () => {
  // Le serveur refuse deja wallet === account (« portefeuille identique ») : le
  // client ne doit pas construire une demande qu'il sait vouee au refus.
  const r = ACC.withdrawSigner({ accountKind: ACC.KIND_GENERATED, wallet: COMPTE, linkedWallet: COMPTE });
  assert.strictEqual(r.account, null);
});

// ---------- Ou partent les retraits ----------

test("la destination affichee est le portefeuille lie quand il existe", () => {
  // Meme regle que le serveur : destination = linked_wallet || wallet.
  assert.strictEqual(
    ACC.withdrawDestination({ wallet: COMPTE, linkedWallet: PORTEFEUILLE }), PORTEFEUILLE);
  assert.strictEqual(
    ACC.withdrawDestination({ wallet: PORTEFEUILLE, linkedWallet: "" }), PORTEFEUILLE);
});

// ---------- Branchement ----------

test("authForWithdraw signe avec le signataire calcule, pas avec l'adresse du compte", () => {
  const i = APP.indexOf("async authForWithdraw");
  assert.ok(i > 0, "authForWithdraw introuvable");
  const bloc = APP.slice(i, i + 1800);
  assert.match(bloc, /withdrawSigner/,
    "sans ce calcul, le client redemande une signature de l'adresse du compte — impossible a produire");
  assert.ok(!/challenge\?wallet=\$\{encodeURIComponent\(s\.wallet\)\}/.test(bloc),
    "le challenge ne doit plus porter en dur sur l'adresse du compte");
});

test("le compte vise accompagne le challenge ET le verify", () => {
  // Le compte fait partie du texte signe : demande au challenge mais omis au
  // verify (ou l'inverse), le serveur reconstruit un autre message et refuse.
  const i = APP.indexOf("async authForWithdraw");
  const bloc = APP.slice(i, i + 1800);
  const iChallenge = bloc.indexOf("/auth/challenge");
  const iVerify = bloc.indexOf("/auth/verify");
  assert.ok(iChallenge > -1 && iVerify > iChallenge, "les deux appels doivent subsister dans cet ordre");
  assert.match(bloc.slice(iChallenge, iVerify), /account=/, "le challenge doit transmettre le compte vise");
  assert.match(bloc.slice(iVerify), /account/, "le verify doit transmettre le meme compte vise");
});

test("un compte genere sans portefeuille lie ne declenche aucun appel reseau", () => {
  const i = APP.indexOf("async authForWithdraw");
  const bloc = APP.slice(i, i + 1800);
  const iGarde = bloc.indexOf("withdrawSigner");
  const iFetch = bloc.indexOf("fetch(");
  assert.ok(iGarde > -1 && iGarde < iFetch,
    "la garde doit passer avant tout appel : inutile de demander un challenge qu'on ne pourra pas signer");
  assert.match(bloc, /not-linked|non_lie|notLinked/,
    "le refus doit avoir un motif distinct, pour que l'UI dise quoi faire");
});

test("la modale de retrait distingue « portefeuille non lie » de « signature refusee »", () => {
  const i = SCREENS.indexOf("function WithdrawModal");
  assert.ok(i > 0, "WithdrawModal introuvable");
  const bloc = SCREENS.slice(i, i + 3000);
  assert.match(bloc, /not-linked|notLinked/,
    "sans ce cas, un compte non lie lit « Signature requise » et ne sait pas qu'il doit lier son portefeuille");
  assert.match(bloc, /WL_WD_NOT_LINKED/, "libelle dedie attendu");
});

test("l'ecran Portefeuille montre ou partiront les retraits", () => {
  // Le joueur n'avait nulle part ou verifier l'adresse de destination : le champ
  // existait en etat (linkedWallet) et n'etait lu par aucune vue.
  const i = SCREENS.indexOf("function Wallet()");
  assert.ok(i > 0, "ecran Wallet introuvable");
  const bloc = SCREENS.slice(i, i + 3000);
  assert.match(bloc, /withdrawDestination/, "la destination doit venir du helper, pas d'un calcul recopie");
  assert.match(bloc, /WL_WD_DEST/, "libelle dedie attendu");
});

test("le serveur reste seul juge : le client ne decide jamais de la liaison", () => {
  // linkedWallet vient de /save (save.linked_wallet) ou de la reponse de liaison.
  // Aucune valeur fabriquee localement, sinon on repete l'erreur du repli roster.
  assert.match(APP, /linkedWallet\s*=\s*save\.linked_wallet/,
    "le portefeuille lie doit etre hydrate depuis le serveur");
});

// ---------- Libelles ----------

test("les nouveaux libelles existent en FR/EN/ZH et ne sont pas vides", () => {
  for (const cle of ["WL_WD_NOT_LINKED", "WL_WD_DEST", "WL_WD_DEST_NONE"]) {
    const m = I18N.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
    assert.ok(m, cle + " absente");
    for (const lang of ["FR", "EN", "ZH"]) {
      const t = m[0].match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(t && t[1].trim().length > 0, cle + " → " + lang + " vide");
    }
  }
});

test("le cache-busting est incremente", () => {
  // Sans bump, les joueurs gardent l'ancien app.jsx en cache et le retrait reste casse.
  const vs = [...INDEX.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 1);
  assert.ok(vs.length > 0, "aucune version trouvee dans index.html");
  assert.ok(Math.min(...vs) >= 97, "index.html doit passer en v97 (v96 est deja en prod)");
});
