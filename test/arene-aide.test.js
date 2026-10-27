// Bandeau « Comment marche l'Arène » (27/10/2026).
//
// Le déclencheur : l'Arène a été lancée sans mode d'emploi, et un joueur à
// 14 victoires / 3 défaites demandait pourquoi il n'était que 6e avec 1 029
// d'ELO. Rien à l'écran ne disait que l'ELO paie selon l'adversaire et non
// selon le nombre de victoires.
//
// Ce que ces tests verrouillent, au niveau SOURCE (les .jsx ne sont pas
// requirables en node:test, même convention que arene-replay-spoiler.test.js) :
//   1. les clés du bandeau existent dans les trois langues, avec les mêmes
//      paramètres — sans quoi le ZH afficherait un « %d » brut ;
//   2. la copie ne contient AUCUN nombre de règle en dur : les prix et les
//      plafonds viennent du serveur, sinon le bandeau ment dès qu'on les règle ;
//   3. le bandeau se ferme pour de bon, et la fermeture est poussée sur le
//      COMPTE (ui_state.arene_help_seen) — pas seulement dans localStorage.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];

const SRC = fs.readFileSync(path.join(__dirname, "..", "arene.jsx"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

const KEYS = [
  "AR2_HELP_TITLE", "AR2_HELP_CLOSE", "AR2_HELP_SHOW", "AR2_HELP_DEFENSE",
  "AR2_HELP_ATTACKS", "AR2_HELP_POOL", "AR2_HELP_ELO", "AR2_HELP_LADDER",
  // Carte servie hors bande (repli du 27/10/2026) : l'étiquette est visible par le joueur.
  "AR2_OUT_OF_BAND",
];

test("bandeau Arène : les clés existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of LANGS) {
      assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
    }
  }
});

test("bandeau Arène : mêmes paramètres dans les 3 langues", () => {
  const expected = {
    AR2_HELP_TITLE: null, AR2_HELP_CLOSE: null, AR2_HELP_SHOW: null,
    AR2_HELP_DEFENSE: ["%d"], AR2_HELP_ATTACKS: ["%d", "%d"],
    AR2_HELP_POOL: ["%d"], AR2_HELP_ELO: ["%d"], AR2_HELP_LADDER: ["%d"],
  };
  for (const [key, params] of Object.entries(expected)) {
    for (const lang of LANGS) {
      assert.deepStrictEqual(T[key][lang].match(/%[sd]/g), params, `${key}.${lang}`);
    }
  }
});

test("bandeau Arène : aucun prix ni plafond écrit en dur dans la copie", () => {
  // Les nombres de règle sont publiés par le serveur (free_per_day, fa_cost,
  // heal_cost, refresh_cost, elo_daily_limit, elo_start). Une valeur recopiée ici
  // survivrait à un réglage serveur et le bandeau expliquerait alors une règle morte.
  const INTERDITS = /\b(25|50|80|100|1000|2000|5000)\b/;
  for (const k of KEYS) {
    for (const lg of LANGS) {
      assert.doesNotMatch(T[k][lg], INTERDITS, `${k}.${lg} cite un nombre en dur`);
    }
  }
});

test("bandeau Arène : les nombres affichés viennent du serveur", () => {
  for (const champ of ["pvp.heal_cost", "pvp.fa_cost", "pvp.refresh_cost",
    "s.free_per_day", "s.elo_daily_limit", "s.elo_start"]) {
    assert.ok(SRC.includes(champ), `arene.jsx ne lit pas ${champ}`);
  }
});

test("bandeau Arène : affiché tant que le compte ne l'a pas fermé, refermable", () => {
  assert.ok(SRC.includes('data-fa="arene-aide"'), "le bandeau n'a pas de marqueur data-fa");
  assert.match(SRC, /\{!helpSeen && <AreneHelp pvp=\{pvp\} onClose=\{closeHelp\} \/>\}/,
    "le bandeau doit être rendu conditionné à helpSeen");
  assert.match(SRC, /data-fa="arene-aide-open"/,
    "il faut un bouton « Règles » pour rouvrir une règle fermée");
});

test("bandeau Arène : la fermeture est retenue sur le COMPTE, pas seulement en local", () => {
  assert.match(SRC, /actions\.pushUiState\(\{ arene_help_seen: true \}\)/,
    "arene.jsx doit pousser arene_help_seen sur le compte (ui_state)");
  assert.ok(SRC.includes("helpLsSet(HELP_SEEN_KEY, true)"),
    "repli localStorage pour la seconde où l'état du compte n'est pas arrivé");
  assert.match(APP, /next\.arene_help_seen = cur\.arene_help_seen === true \|\| patch\.arene_help_seen/,
    "app.jsx doit fusionner arene_help_seen en OR, comme tutorial_seen");
});

test("carte hors bande : le repli du serveur est étiqueté à l'écran, jamais déguisé en normal", () => {
  // Sans étiquette, un combat contre une défense très inférieure passerait pour un
  // appariement normal — c'est exactement ce que le joueur doit pouvoir juger.
  assert.match(SRC, /\{o\.out_of_band && <span[^>]*>\{I18N\.t\("AR2_OUT_OF_BAND"\)\}<\/span>\}/,
    "arene.jsx doit afficher AR2_OUT_OF_BAND quand le serveur marque la carte");
  assert.ok(T.AR2_OUT_OF_BAND && T.AR2_OUT_OF_BAND.FR && T.AR2_OUT_OF_BAND.EN && T.AR2_OUT_OF_BAND.ZH);
});

test("bandeau Arène : l'état du compte ne referme pas un bandeau rouvert à la main", () => {
  // helpFromAccount.current : sans ce garde, « Règles » se refermerait au prochain
  // re-render de g.uiState pour un compte qui a déjà fermé le bandeau.
  assert.match(SRC, /if \(helpFromAccount\.current\) return;/,
    "la lecture de ui_state.arene_help_seen doit être appliquée une seule fois");
});
