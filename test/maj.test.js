/* Bandeau « nouvelle version » : la sonde, la decision, et les gardes de cablage.
   ---------------------------------------------------------------------------
   Ce qui est verifie ici n'est pas une opinion sur le code : c'est ce qui casse
   en silence. 1) La comparaison (une version servie PLUS RECENTE, et seulement
   dans ce cas) ; 2) la sonde ne doit jamais pouvoir se faire repondre par le
   cache — `cache: "no-store"` + un parametre aleatoire, sinon elle compare la
   version du client avec elle-meme et ne voit jamais rien ; 3) `version.json`
   est une surface de plus a bumper avec les autres, et un oubli la laisserait
   annoncer une livraison qui n'existe pas ; 4) le bandeau doit etre monte AUSSI
   sur l'ecran de depart, sinon le joueur dont le client est perime — celui a qui
   le message s'adresse — ne le verrait jamais.

   La suite ne peint rien : les fichiers sont lus, decoupes sur une BORNE (un
   libelle, la section suivante) et jamais sur une taille devinee. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const MAJ = require("../maj-ui.js");

const HTML = lire("index.html");
const DATA = lire("data.js");
const APP = lire("app.jsx");
const MAJ_JSX = lire("maj.jsx");
const SCREENS = lire("screens.jsx");
const I18N = lire("i18n.js");

const versionDesBalises = () => {
  const v = [...HTML.matchAll(/\?v=(\d+)/g)].map((m) => m[1]).filter((x) => x !== "1");
  return [...new Set(v)][0];
};

// ---- 1. Lire la version servie -------------------------------------------------

test("parseVersion lit le JSON servi", () => {
  assert.equal(MAJ.parseVersion('{"v":343}'), 343);
  assert.equal(MAJ.parseVersion('{"v":343}\n'), 343);
  assert.equal(MAJ.parseVersion('{"version":343}'), 343);
});

test("parseVersion lit aussi un nombre nu, « vN » et la ligne de data.js", () => {
  assert.equal(MAJ.parseVersion("343"), 343);
  assert.equal(MAJ.parseVersion("v343"), 343);
  assert.equal(MAJ.parseVersion('window.FA_ASSET_V = "343";'), 343);
});

test("parseVersion rend null sur une forme inconnue, jamais 0", () => {
  // 0 serait pire que null : « plus ancien que tout » ferait clignoter la bande
  // a chaque sondage, y compris quand le serveur repond une page d'erreur HTML.
  for (const brut of ["", "   ", null, undefined, 0, -3, 3.5, "<!DOCTYPE html>", "abc", {}, []]) {
    assert.equal(MAJ.parseVersion(brut), null, `forme inconnue acceptee : ${JSON.stringify(brut)}`);
  }
});

// ---- 2. La decision ------------------------------------------------------------

test("une version servie strictement plus recente propose le rechargement", () => {
  assert.equal(MAJ.doitProposer({ servie: 344, locale: 343, vueLe: "", occupe: false }), true);
});

test("meme version, ou version servie plus vieille : rien a proposer", () => {
  assert.equal(MAJ.doitProposer({ servie: 343, locale: 343 }), false, "recharger ne changerait rien");
  assert.equal(MAJ.doitProposer({ servie: 342, locale: 343 }), false, "un cache plus vieux n'est pas un motif");
});

test("on ne devine pas quand une version est illisible", () => {
  assert.equal(MAJ.doitProposer({ servie: null, locale: 343 }), false);
  assert.equal(MAJ.doitProposer({ servie: 344, locale: null }), false);
  assert.equal(MAJ.doitProposer({}), false);
});

test("« plus tard » vaut pour cette version, pas pour la session entiere", () => {
  assert.equal(MAJ.doitProposer({ servie: 344, locale: 343, vueLe: "344" }), false);
  assert.equal(MAJ.doitProposer({ servie: 345, locale: 343, vueLe: "344" }), true,
    "une livraison suivante doit re-prevenir");
});

test("rien pendant une signature ou un combat en cours", () => {
  assert.equal(MAJ.doitProposer({ servie: 344, locale: 343, occupe: true }), false);
});

test("la memoire du « plus tard » passe par le stockage fourni", () => {
  const faux = {
    dedans: "",
    getItem() { return this.dedans; },
    setItem(k, v) { this.dedans = v; },
  };
  assert.equal(MAJ.vueLe(faux), "");
  MAJ.marquerVue(344, faux);
  assert.equal(MAJ.vueLe(faux), "344");
});

// ---- 3. version.json : une surface de plus a bump -------------------------------

test("version.json existe, est lisible, et annonce la version courante", () => {
  const brut = lire("version.json");
  const v = MAJ.parseVersion(brut);
  assert.equal(v, Number(versionDesBalises()),
    "version.json doit porter la meme version que les balises ?v= d'index.html");
  assert.equal(v, Number(DATA.match(/FA_ASSET_V\s*=\s*"(\d+)"/)[1]),
    "version.json doit porter la meme version que FA_ASSET_V de data.js");
});

// ---- 4. Cablage ----------------------------------------------------------------

test("maj-ui.js et build/maj.js sont servis, avec la version courante", () => {
  const v = versionDesBalises();
  assert.match(HTML, new RegExp(`<script src="maj-ui\\.js\\?v=${v}"></script>`),
    "maj-ui.js doit etre charge (les decisions avant la peinture)");
  assert.match(HTML, new RegExp(`<script src="build/maj\\.js\\?v=${v}"></script>`),
    "build/maj.js doit etre charge, sans quoi le bandeau n'existe pas");
  const iPure = HTML.indexOf("maj-ui.js");
  const iCompile = HTML.indexOf("build/maj.js");
  assert.ok(iPure !== -1 && iCompile !== -1 && iPure < iCompile,
    "maj-ui.js doit etre charge AVANT build/maj.js qui lit window.FA_MAJ");
});

test("la sonde ne peut pas se faire repondre par le cache", () => {
  assert.match(MAJ_JSX, /cache:\s*"no-store"/,
    "sans no-store, le webview repond avec la version qu'on cherche a detecter");
  assert.match(MAJ_JSX, /FICHIER \+ "\?cb=" \+ Date\.now\(\)/,
    "le parametre aleatoire sert les caches intermediaires (CDN)");
});

test("le bandeau est monte aussi sur l'ecran de depart", () => {
  const montages = [...APP.matchAll(/<window\.MiseAJourBanner\s*\/>/g)].length;
  assert.ok(montages >= 2,
    `monte ${montages} fois : il faut l'etre dans le shell ET sur l'ecran de depart, `
    + "sinon le joueur au client perime ne verrait jamais le message");
});

test("le bandeau recharge vraiment, et son « plus tard » est retenu", () => {
  assert.match(MAJ_JSX, /location\.reload\(\)/, "le bouton doit recharger la page");
  assert.match(MAJ_JSX, /MAJ\.marquerVue\(servie\)/,
    "un « plus tard » non memorise ferait revenir la bande a chaque sondage");
  assert.match(MAJ_JSX, /role="status"/, "l'annonce doit etre lisible par un lecteur d'ecran");
});

test("la version du client est lisible dans Options", () => {
  /* Borne reelle : de l'adresse du wallet (la ligne au-dessus) jusqu'a la section
     suivante de l'ecran. Aucune taille devinee. */
  const debut = SCREENS.indexOf('I18N.t("OP_WALLET_ADDR")');
  assert.ok(debut !== -1, "la ligne d'adresse du wallet a disparu : borne de ce test a reprendre");
  const fin = SCREENS.indexOf("<DeviceLinkPanel />", debut);
  assert.ok(fin > debut, "la section suivante de l'ecran Options a disparu : borne a reprendre");
  const bloc = SCREENS.slice(debut, fin);
  assert.match(bloc, /I18N\.t\("OP_VERSION"\)/, "la version doit etre affichee dans Options");
  assert.match(bloc, /FA_ASSET_V/, "et elle doit venir de la version REELLE du client");
});

test("les libelles du bandeau existent en FR, EN et ZH", () => {
  for (const cle of ["MAJ_DISPO", "MAJ_RECHARGER", "MAJ_PLUS_TARD", "OP_VERSION"]) {
    const m = new RegExp("\\b" + cle + ":\\s*\\{([^}]*)\\}").exec(I18N);
    assert.ok(m, `cle absente d'i18n.js : ${cle}`);
    for (const langue of ["FR", "EN", "ZH"]) {
      assert.match(m[1], new RegExp(langue + ":\\s*\"[^\"]+\""), `${cle} sans libelle ${langue}`);
    }
  }
});
