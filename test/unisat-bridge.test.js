// On ne peut RIEN coller dans la recherche de l'app UniSat, et le jeu n'étant
// pas listé au DApp Center, elle ne le trouve pas non plus (constaté par le
// user, 2026-08-20). Le pont proposait pourtant « le lien est copié : colle-le
// dans le navigateur de l'app UniSat » — un conseil qui envoyait le joueur dans
// une impasse, sur l'écran Wallet au moment de retirer.
//
// Le lien universel (la vraie ancre <a>) est le SEUL chemin vers l'app. Ce test
// empêche le conseil de revenir, dans les trois langues.
//
// Il couvre aussi le parcours : le chemin courant doit être UN SEUL toucher —
// un lien statique, prêt sans appel serveur — et le pont à code, qui n'est
// qu'un secours, doit rester replié.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// Les lignes des clés du pont app UniSat.
const uappLines = () =>
  read("i18n.js").split("\n").filter((l) => l.includes("UAPP_"));

test("aucun texte du pont ne demande de coller quoi que ce soit", () => {
  const verbes = ["colle", "Colle", "paste", "Paste", "粘贴"];
  for (const l of uappLines()) {
    for (const v of verbes) {
      assert.ok(!l.includes(v), "impossible chez UniSat, ce conseil mène à une impasse : " + l.trim().slice(0, 90));
    }
  }
});

test("le pont ne touche plus au presse-papier", () => {
  // La copie silencieuse n'avait de sens que pour un collage qui n'existe pas.
  const src = read("account.jsx");
  const i = src.indexOf("function UnisatAppBridge");
  assert.ok(i > 0, "UnisatAppBridge introuvable");
  const bloc = src.slice(i, src.indexOf("\n/* Le geste de liaison", i));
  assert.doesNotMatch(bloc, /clipboard/, "le pont ne doit plus copier le lien");
});

test("le chemin réel reste une vraie ancre, pas une navigation par script", () => {
  // Leçon du 2026-08-18 : après un await, le geste utilisateur est consommé et
  // l'OS refuse d'ouvrir l'app. Deux codes avaient été créés, jamais réclamés.
  const src = read("account.jsx");
  const i = src.indexOf("function UnisatAppBridge");
  const bloc = src.slice(i, src.indexOf("\n/* Le geste de liaison", i));
  assert.match(bloc, /<a className="btn btn-elec block"[\s\S]*?href=\{link\.open\}/, "l'ouverture doit rester une ancre");
  assert.doesNotMatch(bloc, /location\.href\s*=|window\.open\(/, "pas de navigation par script vers l'app");
});

test("le panneau « Connecter un téléphone » garde son bouton Copier", () => {
  // Là, copier a du sens : le lien part du PC vers le téléphone.
  assert.match(read("screens.jsx"), /OP_DEVLINK_COPY/, "ce bouton-là doit rester");
});

/* ---- Le parcours : un seul toucher pour qui est déjà passé par l'app ---- */

require("../device-link-ui.js");
const DL = global.window.FA_DEVICE_LINK;
const cibleDe = (url) =>
  JSON.parse(Buffer.from(decodeURIComponent(url.split("data=")[1]), "base64").toString());

const pont = () => {
  const src = read("account.jsx");
  const i = src.indexOf("function UnisatAppBridge");
  assert.ok(i > 0, "UnisatAppBridge introuvable");
  return src.slice(i, src.indexOf("/* Le geste de liaison", i));
};

test("openDappUrl sans code vise le jeu nu (pas d'ancre #link= vide)", () => {
  assert.deepStrictEqual(cibleDe(DL.openDappUrl("https://fractalarena.com")), ["https://fractalarena.com/"]);
  assert.deepStrictEqual(cibleDe(DL.openDappUrl("https://fractalarena.com", "ABCD-2345-JKMN-PQRS")),
    ["https://fractalarena.com/#link=ABCD-2345-JKMN-PQRS"]);
});

test("le chemin courant est un lien STATIQUE, donc un seul toucher", () => {
  // Sans appel serveur, l'ancre existe dès l'affichage : pas de premier clic
  // pour « préparer », pas de code de 2 minutes à faire expirer, et rien qui
  // compte contre le plafond de 3 codes actifs du serveur.
  const b = pont();
  assert.match(b, /const direct = window\.FA_DEVICE_LINK\.openDappUrl\(window\.location\.origin\)/,
    "le lien direct doit être construit sans code");
  assert.ok(b.indexOf("href={direct}") > 0, "il doit être rendu comme une ancre");
});

test("le pont à code reste un secours, replié", () => {
  const b = pont();
  assert.match(b, /const \[secours, setSecours\] = useState\(false\)/, "replié par défaut");
  assert.ok(b.indexOf("href={direct}") < b.indexOf("setSecours(true)"),
    "le chemin d'un toucher doit précéder le secours");
  assert.ok(b.indexOf("UAPP_STEP1") > b.indexOf("setSecours(true)"),
    "le mode d'emploi d'installation ne doit plus s'imposer à qui est déjà lié");
});
