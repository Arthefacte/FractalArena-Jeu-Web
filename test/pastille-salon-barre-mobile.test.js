// Le salon doit s'annoncer sur la barre mobile, pas seulement dans le tiroir.
//
// Sur téléphone, la rangée d'outils du header (ou vivent les boutons quiz/support/
// salon et leur pastille) est cachée et rerendue DANS le tiroir « Plus » : la pastille
// n'était donc visible qu'une fois le tiroir ouvert, c'est-à-dire après le geste qu'elle
// devait éviter. Constat fondateur 31/10/2026 : « il faut que j'ouvre pour voir si
// quelqu'un a parlé ».
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const MOBILE = fs.readFileSync(path.join(__dirname, "..", "mobile.css"), "utf8");

test("le logement « Plus » de la barre mobile porte les messages non lus du salon", () => {
  const i = APP.indexOf('label={I18N.t("NAV_MORE")}');
  assert.ok(i > 0, "logement Plus introuvable");
  const bloc = APP.slice(i, i + 600);
  assert.match(bloc, /badge=\{roomUnread > 0/, "les non-lus du salon alimentent le badge du logement");
  assert.match(bloc, /expReady/, "les expéditions prêtes ne disparaissent pas pour autant");
});

test("MnavSlot affiche aussi un badge TEXTE (« 9+ »), pas seulement un nombre", () => {
  const i = APP.indexOf("function MnavSlot(");
  const bloc = APP.slice(i, i + 900);
  assert.match(bloc, /\{badge \? <span className="fa-mnav-badge">\{badge\}<\/span> : null\}/,
    "un badge texte doit s'afficher (une comparaison numérique l'effacerait)");
});

test("la pastille de la barre mobile a un style (elle existe en CSS)", () => {
  assert.match(MOBILE, /\.fa-mnav-badge\s*\{/);
  assert.match(MOBILE, /\.fa-mnav-badge\s*\{[^}]*background/, "la pastille doit être colorée");
});
