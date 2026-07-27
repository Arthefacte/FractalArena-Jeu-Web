// test/account-wiring.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");

test("app.jsx delegue le stockage du jeton a FA_ACCOUNT", () => {
  assert.match(APP, /FA_ACCOUNT/, "app.jsx doit consommer les helpers testes, pas redefinir les siens");
  assert.ok(!/function writeToken\(t\)\s*\{\s*try\s*\{\s*if \(t\) sessionStorage\.setItem/.test(APP),
    "l'ancien writeToken code en dur sur sessionStorage subsiste");
});

test("les trois routes de compte sont appelees", () => {
  assert.match(APP, /\/account\/create/);
  assert.match(APP, /\/auth\/recover/);
  assert.match(APP, /\/account\/verify-onchain/);
});

test("la seed et le code ne sont jamais persistes", () => {
  // Aucun stockage ne doit contenir de seed ni de code : ils vivent en etat React.
  assert.ok(!/setItem\([^)]*seed/i.test(APP), "une seed est ecrite dans un stockage");
  assert.ok(!/setItem\([^)]*recovery/i.test(APP), "un code de recuperation est ecrit dans un stockage");
  const blob = APP.match(/localStorage\.setItem\(SAVE_KEY[^;]*/);
  assert.ok(blob, "la persistance du blob est introuvable");
  assert.ok(!/seed|recovery_code/.test(blob[0]), "la seed ou le code fuient dans le blob de sauvegarde");
});

test("un compte genere ne declenche jamais de signature UniSat au boot", () => {
  const i = APP.indexOf("didAutoConnectRef");
  assert.ok(i > 0, "bloc de reconnexion introuvable");
  const bloc = APP.slice(i, i + 1400);
  assert.match(bloc, /KIND_GENERATED|accountKind/,
    "la reconnexion doit distinguer un compte genere : authenticate() n'a rien a signer sans UniSat");
});

test("recoverAccount refuse une seed avant tout appel reseau", () => {
  const i = APP.indexOf("async recoverAccount");
  assert.ok(i > 0, "recoverAccount introuvable");
  const bloc = APP.slice(i, i + 900);
  const iSeed = bloc.indexOf("looksLikeSeed");
  const iFetch = bloc.indexOf("fetch(");
  assert.ok(iSeed > 0, "la garde anti-phishing est absente");
  assert.ok(iSeed < iFetch, "la seed doit etre refusee AVANT de partir sur le reseau");
});

test("connectWallet (branche 404, compte tout juste cree) preserve accountKind", () => {
  // createAccount() met accountKind a jour AVANT d'appeler connectWallet(), qui pour un
  // compte tout juste cree tombe dans la branche 404 (aucune save serveur encore). Cette
  // branche part de {...freshState(), ...} : freshState() remet accountKind a "" si la
  // branche ne le reinjecte pas explicitement depuis l'etat courant -> accountKind resterait
  // "" en memoire pendant toute la session live qui suit une creation de compte.
  const i = APP.indexOf("saveResp.status === 404");
  assert.ok(i > 0, "branche 404 de connectWallet introuvable");
  const bloc = APP.slice(i, i + 700);
  assert.match(bloc, /accountKind:\s*s\.accountKind/,
    "la branche 404 doit reinjecter accountKind depuis l'etat courant (s), sinon freshState() l'ecrase a \"\"");
});

const ACCJSX = read("account.jsx");

test("l'ecran de recuperation ne suggere jamais la seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  assert.ok(i > 0, "RecoverScreen introuvable");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_PLACEHOLDER/, "le champ doit annoncer un CODE");
  assert.ok(!/ACC_SEED_LABEL|12 mots|mnemonic/i.test(bloc),
    "l'ecran de recuperation ne doit ni demander ni evoquer une saisie de seed");
});

test("l'ecran de recuperation traite le refus de seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_SEED_REFUSED/,
    "coller une seed doit produire un avertissement explicite, pas un 'code invalide' muet");
});

test("l'onboarding propose de jouer sans wallet dans tous les cas", () => {
  const i = APP.indexOf("function Onboarding");
  assert.ok(i > 0, "Onboarding introuvable");
  const bloc = APP.slice(i, APP.indexOf("function Toasts"));
  assert.match(bloc, /ACC_PLAY_NOW/, "l'action principale « Jouer maintenant » est absente");
  assert.match(bloc, /createAccount/, "le bouton doit appeler createAccount");
  assert.match(bloc, /ACC_RECOVER_LINK/, "l'acces a la recuperation est absent de l'accueil");
});

test("le mobile n'est plus un cul-de-sac : le CTA jouer-maintenant n'est jamais cache derriere `mobile`", () => {
  // Avant #45/v68, un joueur mobile (pas d'extension UniSat possible) tombait sur un
  // message "arrive bientot" sans aucune action possible. Depuis, playNow()/createAccount()
  // est l'action principale de l'ecran, offerte a TOUT joueur, mobile ou non — seul le lien
  // d'installation de l'extension UniSat (inutile sur mobile) reste conditionne par `mobile`.
  const i = APP.indexOf("function Onboarding");
  assert.ok(i > 0, "Onboarding introuvable");
  const bloc = APP.slice(i, APP.indexOf("function Toasts"));
  const iMobileVar = bloc.indexOf("const mobile = IS_MOBILE()");
  assert.ok(iMobileVar > 0, "detection mobile introuvable");
  const playBtnIdx = bloc.indexOf("onClick={playNow}");
  assert.ok(playBtnIdx > 0, "le bouton « jouer maintenant » est introuvable");
  assert.ok(playBtnIdx > iMobileVar, "mobile doit etre determine avant le rendu du CTA");
  // Le CTA ne doit pas etre a l'interieur d'un bloc conditionne par `!mobile` / `mobile &&` :
  // on verifie qu'aucun garde de ce type n'apparait entre la definition de `mobile` et le bouton.
  const between = bloc.slice(iMobileVar, playBtnIdx);
  assert.ok(!/!mobile|mobile\s*&&|mobile\s*\?/.test(between),
    "le CTA jouer-maintenant est conditionne par `mobile` : un joueur mobile pourrait ne pas le voir");
});

test("SecretsGate est monte au niveau du shell (App), pas seulement dans Onboarding", () => {
  // Piege central de la tache : createAccount() pose g.wallet AVANT que playNow() ait fini,
  // donc App bascule hors d'Onboarding au rendu suivant. Si SecretsGate n'est monte qu'a
  // l'interieur d'Onboarding, l'ecran des secrets ne s'affiche jamais et le joueur perd son
  // compte au premier vidage de cache, sans recours.
  const iApp = APP.indexOf("function App(");
  const iOnboarding = APP.indexOf("function Onboarding");
  assert.ok(iApp > 0 && iOnboarding > iApp, "structure App/Onboarding introuvable");
  const appBloc = APP.slice(iApp, iOnboarding);
  assert.match(appBloc, /window\.SecretsGate/,
    "SecretsGate doit etre rendu par App (avant la definition d'Onboarding), pas seulement par Onboarding");

  const onboardingBloc = APP.slice(iOnboarding, APP.indexOf("function Toasts"));
  assert.ok(!/window\.SecretsGate/.test(onboardingBloc),
    "SecretsGate ne doit pas etre rendu depuis Onboarding : il serait demonte des que g.wallet se remplit");
});

const HTML = read("index.html");

test("les deux nouveaux fichiers sont declares", () => {
  assert.match(HTML, /account-ui\.js\?v=/, "account-ui.js n'est pas charge");
  assert.match(HTML, /account\.jsx\?v=/, "account.jsx n'est pas charge");
});

test("account-ui.js est charge avant app.jsx (lu au niveau module)", () => {
  assert.ok(HTML.indexOf("account-ui.js") < HTML.indexOf("app.jsx"),
    "app.jsx lit window.FA_ACCOUNT a l'evaluation : le helper doit exister avant");
});

test("account.jsx est charge apres components.jsx et avant app.jsx", () => {
  const iComp = HTML.indexOf("components.jsx");
  const iAcc = HTML.indexOf("account.jsx");
  const iApp = HTML.indexOf("app.jsx");
  assert.ok(iComp < iAcc && iAcc < iApp, "account.jsx utilise Modal/SectionHead de components.jsx");
});

test("cache-bust homogene : aucune balise ne reste sur l'ancienne version", () => {
  const versions = [...HTML.matchAll(/\?v=(\d+)/g)].map((m) => m[1]).filter((v) => v !== "1");
  const uniques = [...new Set(versions)];
  assert.deepStrictEqual(uniques, ["92"],
    `versions heterogenes trouvees : ${uniques.join(", ")} — une seule balise oubliee sert du code perime`);
});
