// test/tour-badge-langue.test.js
"use strict";
// ============================================================
// Badge hebdomadaire de la Tour (« 2026-W43 · … »).
//
// Signalé : le badge restait à moitié français quelle que soit la langue —
// « Resets in 1j 7h », « 1j 7h后重置 ». Cause : la durée venait de
// `TAU.fmtCountdown` (arene-ui.js), qui écrit des unités FR codées en dur
// (« 1j 7h ») ; on l'injectait dans un gabarit déjà traduit. Le gabarit était
// donc réactif, la DURÉE ne l'était pas. Correctif : `I18N.dur(ms)` lit la
// langue À CHAQUE APPEL (aucun cache) et porte les pluriels + l'ordre des mots.
//
// Ce fichier verrouille : les trois phrases demandées, les pluriels, les
// durées < 1 h et échues, l'absence d'unités françaises en EN/ZH, la
// réactivité à la bascule de langue, et le câblage source + bundle servi.
// ============================================================
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../i18n.js");
const I = globalThis.window.FA_I18N;

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const TOUR = read("tour.jsx");

const H = 3600000, J = 24 * H;
// La durée dépend de la LANGUE COURANTE : on la fixe à chaque mesure.
const badge = (l, ms) => { I.setLang(l); return I.t("TOUR_WEEK_ENDS", I.dur(ms)); };
const duree = (l, ms) => { I.setLang(l); return I.dur(ms); };

test("badge hebdo : les trois phrases demandées (1 jour 7 heures)", () => {
  const ms = 1 * J + 7 * H;
  assert.strictEqual(badge("FR", ms), "Réinitialisation dans 1 jour 7 heures");
  assert.strictEqual(badge("EN", ms), "Restart in 1 day 7 hours");
  assert.strictEqual(badge("ZH", ms), "距离重置还有1天7小时");
});

test("pluriels localisés : singulier à 1, pluriel au-delà (jours, heures, minutes)", () => {
  assert.strictEqual(duree("FR", 1 * J), "1 jour");
  assert.strictEqual(duree("FR", 2 * J), "2 jours");
  assert.strictEqual(duree("EN", 1 * J), "1 day");
  assert.strictEqual(duree("EN", 3 * J), "3 days");
  assert.strictEqual(duree("ZH", 2 * J), "2天");
  assert.strictEqual(duree("FR", 1 * H), "1 heure");
  assert.strictEqual(duree("FR", 5 * H), "5 heures");
  assert.strictEqual(duree("EN", 1 * H), "1 hour");
  assert.strictEqual(duree("EN", 5 * H), "5 hours");
  assert.strictEqual(duree("ZH", 5 * H), "5小时");
  assert.strictEqual(duree("FR", 1 * 60000), "1 minute");
  assert.strictEqual(duree("EN", 42 * 60000), "42 minutes");
  assert.strictEqual(duree("ZH", 1 * 60000), "1分钟");
  // Jour + heure : les deux parties restent accordées (25 h ne dit pas « 1 jours »).
  assert.strictEqual(duree("FR", 25 * H), "1 jour 1 heure");
  assert.strictEqual(duree("EN", 49 * H), "2 days 1 hour");
  assert.strictEqual(duree("ZH", 49 * H), "2天1小时");
});

test("durées courtes et échues : minutes seules, puis « moins d'une minute »", () => {
  assert.strictEqual(duree("FR", 42 * 60000 + 30 * 1000), "42 minutes", "les secondes ne s'affichent pas");
  assert.strictEqual(duree("EN", 59 * 1000), "less than a minute");
  assert.strictEqual(duree("FR", 0), "moins d'une minute");
  assert.strictEqual(duree("FR", -5000), "moins d'une minute", "semaine échue : jamais de durée négative");
  assert.strictEqual(duree("EN", -5000), "less than a minute");
  assert.strictEqual(duree("ZH", -5000), "不到1分钟");
  assert.strictEqual(duree("FR", NaN), "moins d'une minute", "valeur serveur illisible : pas de NaN à l'écran");
  assert.strictEqual(duree("FR", undefined), "moins d'une minute");
});

test("aucune unité française (j / h) ne fuit en EN ni en ZH", () => {
  const echantillons = [1 * J + 7 * H, 2 * J, 25 * H, 7 * H + 20 * 60000, 42 * 60000, 30 * 1000];
  for (const ms of echantillons) {
    for (const l of ["EN", "ZH"]) {
      const s = duree(l, ms);
      // Unité française = lettre SEULE après le nombre (« 1j », « 7h ») : « 1 hour »
      // ne doit pas être pris pour une unité « h », d'où la borne de mot.
      assert.doesNotMatch(s, /\d+\s*[jh]\b/, `${l} garde une unité FR (j/h) : ${s}`);
    }
  }
  // ZH n'écrit aucune lettre latine dans une durée.
  for (const ms of echantillons) assert.doesNotMatch(duree("ZH", ms), /[a-z]/i, "durée ZH en lettres latines");
});

test("réactivité : la durée suit la langue sans remonter l'écran, et revient à l'identique", () => {
  const ms = 1 * J + 7 * H;
  const fr = badge("FR", ms);
  const en = badge("EN", ms);
  const zh = badge("ZH", ms);
  assert.notStrictEqual(fr, en);
  assert.notStrictEqual(en, zh);
  assert.strictEqual(badge("FR", ms), fr, "retour en FR : la valeur ne doit pas être mémorisée");
  // Le gabarit seul (sans durée) suit déjà la langue : c'est la DURÉE qui était figée.
  assert.match(I.T.TOUR_WEEK_ENDS.EN, /^Restart in %s$/);
  assert.match(I.T.TOUR_WEEK_ENDS.ZH, /^距离重置还有%s$/, "en ZH la valeur précède le verbe");
});

test("le badge de la Tour utilise la durée localisée, pas le formateur français", () => {
  // `TAU.fmtCountdown` produit « 1j 7h » : injecté dans un gabarit EN/ZH, il rend
  // le badge à moitié français. Il ne doit plus approcher le badge.
  assert.match(TOUR, /I18N\.t\("TOUR_WEEK_ENDS",\s*I18N\.dur\(st\.weekEndsAt - Date\.now\(\)\)\)/);
  // Le commentaire de tour.jsx cite le formateur pour expliquer la cause : on
  // cherche l'APPEL, pas la mention.
  assert.ok(!/TAU\.fmtCountdown\(/.test(TOUR), "tour.jsx appelle encore fmtCountdown");
  assert.ok(!/FA_ARENE_UI/.test(TOUR), "l'écran Tour n'a plus besoin du formateur de l'Arène");
});

test("le bundle servi (build/tour.js) porte le même correctif", () => {
  // Les joueurs chargent build/*.js : une source corrigée sans build laisse le
  // badge français en production (le test de pré-transpilation le dit aussi).
  const BUILD = read(path.join("build", "tour.js"));
  assert.match(BUILD, /I18N\.dur\(/, "le build ne connaît pas I18N.dur : relancer npm run build");
  assert.ok(!/fmtCountdown/.test(BUILD), "le build appelle encore fmtCountdown");
});

// ---- Affichage hors run / pendant le run -------------------------------

test("hors run : aucune rangée « Champions alliés » (elle ne sert qu'en run)", () => {
  const iNoRun = TOUR.indexOf("{!run ? (");
  const iRun = TOUR.indexOf(") : (", iNoRun);
  assert.ok(iNoRun > 0 && iRun > iNoRun, "les deux branches !run / run de l'écran sont introuvables");
  const horsRun = TOUR.slice(iNoRun, iRun);
  assert.ok(!/ChampionRow/.test(horsRun), "la rangée champions s'affiche avant le lancement du run");
  assert.ok(!/CHAMP_ACTIVE/.test(horsRun), "un « Champion actif » traîne hors run");
});

test("en run : la rangée revient, et reste masquée pendant l'auto-combat", () => {
  const iRun = TOUR.indexOf(") : (", TOUR.indexOf("{!run ? ("));
  const fin = TOUR.indexOf("<TourLeaderboard />", iRun);
  assert.ok(iRun > 0 && fin > iRun, "branche « run » de l'écran introuvable");
  const vueRun = TOUR.slice(iRun, fin);
  assert.match(vueRun, /ChampionRow/, "la rangée champions a disparu de la vue du run");
  assert.match(vueRun, /CHAMP_ACTIVE/, "l'emprunt actif n'est plus annoncé pendant le run");
  // Règle de masquage conservée : pas de rangée cliquable pendant l'auto-combat.
  const iMasque = vueRun.indexOf("!autoRunning && (");
  assert.ok(iMasque > 0, "la rangée n'est plus masquée pendant l'auto-combat");
  assert.match(vueRun.slice(iMasque, iMasque + 400), /ChampionRow/, "le masquage ne couvre plus la rangée");
});
