// test/tape-wiring.test.js — câblage de la tape boursière et de la pluie d'or
// (#7 header vivant). La logique pure est testée par tape-ui.test.js ; ici on
// verrouille ce qui casse en silence : les gardes de repli, l'ordre de
// chargement, les clés i18n des trois langues, et les coupes reduced-motion.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const BUYBACK = lire("buyback.jsx");
const HTML = lire("index.html");
const CSS = lire("styles.css");
const SFX = lire("sfx.js");
const I18N = lire("i18n.js");

test("la tape et la detection de rachat se replient si FA_TAPE est absent", () => {
  // Un 404 sur tape-ui.js en cours de deploiement GH Pages ne doit pas casser
  // le ticker (meme invariant que tout window.FA_* : garder + replier).
  assert.match(BUYBACK, /if \(!window\.FA_TAPE\) return null;/,
    "TapeBoursiere doit rendre null sans FA_TAPE");
  assert.match(BUYBACK, /window\.FA_TAPE\s*\r?\n?\s*\? window\.FA_TAPE\.rachatsDetectes/,
    "la detection de rachat doit etre gardee par window.FA_TAPE");
});

test("la detection compare l'ANCIEN releve, avant l'ecrasement de prevPools", () => {
  const iDetect = BUYBACK.indexOf("rachatsDetectes(prevPools.current");
  const iEcrase = BUYBACK.indexOf("prevPools.current = rb.buyback.pools");
  assert.ok(iDetect > 0 && iDetect < iEcrase,
    "rachatsDetectes doit lire prevPools AVANT sa mise a jour, sinon aucun rachat n'est jamais detecte");
});

test("le ka-ching ne part que derriere la garde FA_SFX", () => {
  assert.match(BUYBACK, /if \(window\.FA_SFX\) window\.FA_SFX\.play\("kaching"\)/,
    "le son du rachat doit exister et rester optionnel");
  assert.match(SFX, /kaching: \(t\) =>/, "recette kaching absente de sfx.js");
});

test("tape-ui.js est charge avant build/buyback.js", () => {
  const iTape = HTML.indexOf("tape-ui.js");
  const iBuy = HTML.indexOf("build/buyback.js");
  assert.ok(iTape > 0 && iTape < iBuy,
    "buyback.js lit window.FA_TAPE au rendu : tape-ui.js doit etre deja la");
});

test("les cles i18n de la tape existent dans les trois langues", () => {
  for (const cle of ["TAPE_RACHAT", "TAPE_ENTREE", "TAPE_POOL", "TAPE_CUMUL",
    "TAPE_AGE_NOW", "TAPE_AGE_MIN", "TAPE_AGE_H", "TAPE_AGE_J"]) {
    const i = I18N.indexOf(cle + ":");
    assert.ok(i > 0, "cle absente : " + cle);
    const decl = I18N.slice(i, I18N.indexOf("}", i));
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(decl.includes(lang), cle + " : langue manquante " + lang);
    }
  }
});

test("les montants de la tape passent par FaText (jamais « FA » ecrit)", () => {
  assert.match(BUYBACK, /<FaText text=\{texteTape\(I, it\)\}/,
    "les items de la tape doivent etre rendus via FaText (convention logo+nombre)");
});

test("la tape defile en transform pur, sans filtre (lecon Mali-G68)", () => {
  assert.match(CSS, /@keyframes faTapeDefile \{ to \{ transform: translateX\(-50%\); \} \}/,
    "le defilement doit rester un translateX de piste dupliquee");
  const bloc = CSS.slice(CSS.indexOf(".fa-tape {"), CSS.indexOf("@keyframes faOrTombe"));
  assert.ok(!/filter:/.test(bloc), "un filter est apparu sur la tape ou la pluie");
});

test("mobile : la tape est repliee par defaut, depliee seulement si fraiche", () => {
  const i640 = CSS.indexOf("@media (max-width: 640px)");
  const bloc = CSS.slice(i640, i640 + 800);
  assert.match(bloc, /\.fa-tape \{ display: none; \}/);
  assert.match(bloc, /\.fa-tape\.fraiche \{ display: block; \}/);
});

test("reduced-motion : pas de defilement, pas de pluie", () => {
  const i = CSS.indexOf(".fa-tape-track { animation: none; }");
  assert.ok(i > 0, "la tape doit s'immobiliser en prefers-reduced-motion");
  const avant = CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)", i);
  assert.ok(avant > 0 && i - avant < 400, "l'immobilisation doit vivre dans un bloc reduced-motion");
  assert.match(CSS.slice(avant, i + 200), /\.fa-or \{ display: none; \}/);
});

test("la pluie d'or ne rejoue pas les rachats passes a la connexion", () => {
  // La garde est dans tape-ui (initialise=false au premier releve) ; ici on
  // verrouille que le composant passe bien poolsPret et non `true`.
  assert.match(BUYBACK, /rachatsDetectes\(prevPools\.current, rb\.buyback\.pools, poolsPret\.current\)/);
});
