/* PWA — inviter à installer, et dire la vérité quand le réseau tombe.
   Logique pure dans pwa-ui.js (modèle des autres *-ui.js), câblage vérifié au
   niveau source. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../pwa-ui.js");
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/* --- Qui doit voir quoi --- */

test("déjà installé : on ne propose plus rien", () => {
  // Reproposer l'installation à quelqu'un qui joue DANS l'app est absurde.
  assert.equal(P.installMode({ ua: UA_ANDROID, standalone: true, prompt: true }), "aucun");
  assert.equal(P.installMode({ ua: UA_IOS, standalone: true }), "aucun");
});

test("Android : on attend l'invite du navigateur, on ne la devine pas", () => {
  // Sans beforeinstallprompt, Chrome refuserait install() : proposer un bouton
  // mort serait pire que se taire.
  assert.equal(P.installMode({ ua: UA_ANDROID, standalone: false, prompt: false }), "aucun");
  assert.equal(P.installMode({ ua: UA_ANDROID, standalone: false, prompt: true }), "invite");
});

test("iOS : jamais de beforeinstallprompt, donc on explique le geste", () => {
  assert.equal(P.installMode({ ua: UA_IOS, standalone: false, prompt: false }), "ios");
});

test("ordinateur : hors sujet tant que le navigateur ne propose rien", () => {
  assert.equal(P.installMode({ ua: UA_DESKTOP, standalone: false, prompt: false }), "aucun");
  assert.equal(P.installMode({ ua: UA_DESKTOP, standalone: false, prompt: true }), "invite");
});

/* --- Quand la proposer --- */

test("on ne propose pas l'installation à quelqu'un qui vient d'arriver", () => {
  // Une bannière avant même d'avoir joué, c'est du harcèlement : le joueur ne
  // sait pas encore s'il veut ce jeu sur son écran d'accueil.
  assert.equal(P.doitProposer({ mode: "invite", combats: 0, refusLe: null, maintenant: 0 }), false);
  assert.equal(P.doitProposer({ mode: "invite", combats: 3, refusLe: null, maintenant: 0 }), true);
});

test("un refus est respecté longtemps, pas jusqu'au prochain écran", () => {
  const JOUR = 86400000;
  assert.equal(P.doitProposer({ mode: "invite", combats: 9, refusLe: 1000, maintenant: 1000 + JOUR }), false);
  assert.equal(P.doitProposer({ mode: "invite", combats: 9, refusLe: 1000, maintenant: 1000 + 31 * JOUR }), true);
});

test("rien à proposer = rien affiché", () => {
  assert.equal(P.doitProposer({ mode: "aucun", combats: 50, refusLe: null, maintenant: 0 }), false);
});

/* --- Réseau perdu --- */

test("hors ligne : on le dit dès que le navigateur le sait", () => {
  assert.equal(P.etatReseau({ online: false, echecsApi: 0 }), "hors-ligne");
});

test("en ligne mais l'API ne répond plus : on ne crie pas au premier raté", () => {
  // Un timeout isolé arrive ; trois d'affilée, c'est le serveur ou le réseau.
  assert.equal(P.etatReseau({ online: true, echecsApi: 1 }), "ok");
  assert.equal(P.etatReseau({ online: true, echecsApi: 3 }), "serveur-injoignable");
});

/* --- Textes --- */

test("les clés d'installation et de perte de réseau existent dans les 3 langues", () => {
  const cles = ["PWA_INSTALL_TITRE", "PWA_INSTALL_TEXTE", "PWA_INSTALL_OUI", "PWA_INSTALL_NON",
    "PWA_IOS_GESTE", "PWA_OFFLINE_TITRE", "PWA_OFFLINE_TEXTE", "PWA_OFFLINE_REESSAYER"];
  for (const c of cles) {
    const bloc = new RegExp(c + ":\\s*\\{([^}]*)\\}").exec(I18N);
    assert.ok(bloc, "clé absente : " + c);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(bloc[1].includes(lang), c + " n'a pas de " + lang);
    }
  }
});

test("le texte hors-ligne dit POURQUOI, et rassure sur la progression", () => {
  const bloc = /PWA_OFFLINE_TEXTE:\s*\{([^}]*)\}/.exec(I18N)[1];
  assert.match(bloc, /serveur/i, "il faut dire que le combat est calculé côté serveur");
  assert.match(bloc, /perdu|progression/i, "il faut dire que rien n'est perdu");
});

/* --- Câblage --- */

test("app.jsx capte beforeinstallprompt et s'en sert", () => {
  assert.match(APP, /beforeinstallprompt/, "sans capture, l'invite d'installation est perdue");
  assert.match(APP, /preventDefault/, "il faut retenir l'événement pour le rejouer au bon moment");
  assert.match(APP, /FA_PWA/, "app.jsx doit s'appuyer sur pwa-ui.js");
});

test("app.jsx suit la perte de réseau", () => {
  assert.match(APP, /"offline"|'offline'/, "l'événement offline n'est pas écouté");
  assert.match(APP, /"online"|'online'/, "le retour du réseau doit refermer l'écran");
});

test("pwa-ui.js est chargé avant app.js", () => {
  const iUi = HTML.indexOf("pwa-ui.js");
  assert.ok(iUi > 0, "pwa-ui.js n'est pas chargé");
  assert.ok(iUi < HTML.indexOf("build/app.js"), "app.jsx lit window.FA_PWA à l'évaluation");
});
