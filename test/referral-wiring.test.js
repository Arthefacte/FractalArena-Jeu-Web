// test/referral-wiring.test.js — câblage du parrainage côté web (spec 2026-09-07).
//
// Contrat serveur (fractal-arena-server/referral.js, testé) :
//  - POST /save/:wallet, POST /claim-airdrop, POST /account/create : body `ref`
//    optionnel, pris en compte UNIQUEMENT à la création de la ligne.
//  - GET /referral/:wallet (Bearer, wallet propre) → { code, referrer,
//    earned_total, referees: [{ name, wallet, earned_total }] }.
//
// Règles : le code ?ref= est lu UNE fois au boot, transmis aux TROIS points de
// création seulement (jamais sur les resyncs), jamais persisté dans le blob.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");
const SCREENS = read("screens.jsx");
const HTML = read("index.html");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}
// Bloc d'une action de `actions` : jusqu'à la prochaine `async xxx(` du même niveau.
function action(src, name) {
  const i = src.indexOf("async " + name + "(");
  assert.ok(i >= 0, "action " + name + " absente");
  const j = src.indexOf("\n    async ", i + 10);
  return src.slice(i, j > 0 ? j : i + 3000);
}

test("index.html charge referral-ui.js (logique pure) et build/referral.js (écran)", () => {
  assert.match(HTML, /<script src="referral-ui\.js\?v=\d+"><\/script>/, "referral-ui.js non chargé");
  assert.match(HTML, /<script src="build\/referral\.js\?v=\d+"><\/script>/, "build/referral.js non chargé");
  // L'écran dépend de components (SectionHead) et doit précéder app.js.
  assert.ok(HTML.indexOf("build/components.js") < HTML.indexOf("build/referral.js"), "referral avant components");
  assert.ok(HTML.indexOf("build/referral.js") < HTML.indexOf("build/app.js"), "referral après app");
  assert.ok(HTML.indexOf("referral-ui.js") < HTML.indexOf("build/app.js"), "referral-ui après app");
});

test("app.jsx : le code ?ref= est lu UNE fois au boot depuis location.search, via FA_REFERRAL", () => {
  const b = bloc(APP, "let BOOT_REF_CODE", 600);
  assert.match(b, /FA_REFERRAL/, "la lecture doit passer par la logique pure (parseRefSearch)");
  assert.match(b, /parseRefSearch\(window\.location\.search\)/, "lecture de ?ref= manquante");
  // `let` : le code est consommé (remis à null) après la création — pas de rattachement différé.
  assert.match(APP, /BOOT_REF_CODE = null/, "le code doit être consommé après la création");
  // Jamais dans le blob localStorage (pas d'état React, pas de champ persisté).
  assert.doesNotMatch(APP, /refCode:\s*BOOT_REF_CODE/, "le code ne doit pas entrer dans l'état persisté");
  assert.doesNotMatch(APP, /localStorage\.setItem\([^)]*ref/i, "jamais persisté");
});

test("app.jsx : POST /account/create transmet `ref` (compte généré)", () => {
  const b = action(APP, "createAccount");
  assert.match(b, /\/account\/create/, "route manquante");
  assert.match(b, /body: JSON\.stringify\(refBody\(\)\)/, "le body doit être refBody() ({ ref } ou {})");
  assert.doesNotMatch(b, /body: "\{\}"/, "l'ancien body vide doit disparaître");
});

test("app.jsx : POST /claim-airdrop transmet `ref` (chemin de création UniSat)", () => {
  const b = action(APP, "claimAirdropIfNew");
  assert.match(b, /\/claim-airdrop/, "route manquante");
  assert.match(b, /body: JSON\.stringify\(\{ wallet: addr, \.\.\.refBody\(\) \}\)/, "le body doit porter wallet + ref");
});

test("app.jsx : l'autosave POST /save ne transmet `ref` QUE pour un joueur nouveau (404 à la connexion)", () => {
  const b = bloc(APP, "// server save debounced", 1400);
  assert.match(b, /body: JSON\.stringify\(\{ \.\.\.stateToServer\(s\), \.\.\.\(newPlayerRef\.current \? refBody\(\) : \{\}\) \}\)/,
    "le body /save doit porter ref seulement quand newPlayerRef est levé");
  // Le drapeau est levé dans la branche 404 de connectWallet (SEUL endroit qui fabrique un nouveau joueur).
  const cw = action(APP, "connectWallet");
  const i404 = cw.indexOf("saveResp.status === 404");
  assert.ok(i404 > 0, "branche 404 introuvable");
  assert.match(cw.slice(i404, i404 + 400), /newPlayerRef\.current = true/, "drapeau nouveau joueur non levé en 404");
  // Et pas dans la branche « joueur existant » ni dans le repli réseau.
  assert.ok(!/newPlayerRef\.current = true/.test(cw.slice(0, i404)), "le drapeau ne doit pas être levé pour un joueur existant");
  // resyncSave (lecture GET) ne touche pas au ref.
  assert.doesNotMatch(action(APP, "resyncSave"), /refBody|BOOT_REF_CODE/, "resyncSave ne transmet jamais de ref");
});

test("app.jsx : le code est consommé après une création acceptée par le serveur", () => {
  // Une réponse OK sur l'un des trois points de création = ligne créée : le code n'a plus d'usage.
  assert.match(action(APP, "createAccount"), /refConsumed\(\)/, "createAccount ne consomme pas le code");
  assert.match(action(APP, "claimAirdropIfNew"), /refConsumed\(\)/, "claimAirdropIfNew ne consomme pas le code");
  assert.match(bloc(APP, "// server save debounced", 1400), /refConsumed\(\)/, "l'autosave ne consomme pas le code");
});

test("app.jsx : fetchReferral lit GET /referral/:wallet avec le Bearer de session (svOpts) et distingue 403/404", () => {
  const b = action(APP, "fetchReferral");
  assert.match(b, /\$\{API_URL\}\/referral\/\$\{[^}]*wallet[^}]*\}/, "route /referral/:wallet manquante");
  assert.match(b, /svOpts\(\)/, "Bearer de session manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /ok: true, data/, "la réponse doit être rendue à l'écran");
  assert.match(b, /reason: "network"/, "erreur réseau non distinguée");
  assert.match(b, /r\.status/, "le statut HTTP (403/404) doit être remonté");
  // Pas dans le blob global : aucun setG ici (état local de l'écran).
  assert.doesNotMatch(b, /setG\(/, "l'écran garde son état local, rien dans le blob");
});

test("app.jsx : l'écran Parrainage est branché dans VIEWS sous la vue `parrainage`", () => {
  const b = bloc(APP, "const VIEWS = {", 500);
  assert.match(b, /parrainage: Referral/, "vue parrainage absente de VIEWS");
  assert.match(APP, /const \{[^}]*\bReferral\b[^}]*\} = window;/, "Referral doit être importé depuis window");
});

test("referral.jsx : l'écran affiche code, lien, total, filleuls, parrain, et ne bloque pas le jeu en erreur", () => {
  const R = read("referral.jsx");
  assert.match(R, /function Referral\(/, "composant Referral manquant");
  assert.match(R, /Object\.assign\(window, \{ Referral \}\)/, "export window manquant");
  assert.match(R, /actions\.fetchReferral\(\)/, "fetch du contrat manquant");
  assert.match(R, /FA_REFERRAL\.referralLink\(/, "le lien doit venir de la logique pure");
  assert.match(R, /navigator\.clipboard/, "bouton Copier manquant");
  for (const k of ["REF_TITLE", "REF_CODE_LABEL", "REF_COPY", "REF_COPIED", "REF_LINK_LABEL", "REF_EARNED",
                   "REF_REFEREES", "REF_NONE", "REF_REFERRER", "REF_HINT", "REF_ERROR", "REF_LOADING", "REF_BACK"]) {
    assert.match(R, new RegExp("I18N\\.t\\(\"" + k + "\""), "clé " + k + " non utilisée");
  }
  assert.match(R, /earned_total/, "earned_total non affiché");
  assert.match(R, /referees/, "liste des filleuls non affichée");
  assert.match(R, /referrer/, "parrain non affiché");
  // Garde de démontage : la réponse d'un fetch en vol ne doit pas écrire dans un écran fermé.
  assert.match(R, /vivant/, "garde de démontage manquante (pattern `vivant` du repo)");
  // Retour : l'écran est atteint depuis Options, il y renvoie.
  assert.match(R, /actions\.setView\("options"\)/, "retour vers Options manquant");
});

test("screens.jsx : Options offre l'accès à l'écran Parrainage", () => {
  const b = bloc(SCREENS, "function Options()", 12000);
  assert.match(b, /actions\.setView\("parrainage"\)/, "bouton vers l'écran Parrainage manquant");
  assert.match(b, /OP_REFERRAL_BTN/, "libellé du bouton manquant");
});
