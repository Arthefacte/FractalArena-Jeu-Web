/* Lisibilité de la liste d'adversaires de l'Arène (panne de compréhension du 01/10/2026).
 *
 * Le joueur voyait dans ADVERSAIRES des comptes étiquetés « Diamant », « Or », « Argent » —
 * alors qu'il ne pouvait pas les rencontrer dans ces ligues : `/pvp/opponents` sert trois
 * populations sous un même badge. La mesure en base prod a montré que sa ligue (diamant) ne
 * comptait que DEUX comptes, dont l'autre n'avait aucune défense enregistrée : la liste était
 * donc entièrement remplie par le vivier « sans défense », dont la « ligue » n'est qu'une
 * ESTIMATION calculée sur la puissance des 3 entités (seuils leagueOf : 5000/2000/700).
 *
 * Relevé de ce que font les autres jeux (skill serveur, references/matchmaking-industrie.md) :
 * le badge de rang dit une position GAGNÉE — aucun jeu consulté n'affiche de rang sur un compte
 * non classé. D'où : plus de badge sur les non-classés, liste groupée, et écart nommé quand le
 * pourcentage sature.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ARENE = lire("arene.jsx");
const I18N = lire("i18n.js");

test("le badge de ligue n'est plus affiché sur un compte non classé", () => {
  // Un non-classé n'a pas de position dans une ligue : son badge serait une estimation.
  assert.match(ARENE, /\{!o\.implicit && <span[^>]*>\{AU\.leagueLabel\(o\.league\)\}<\/span>\}/,
    "le libellé de ligue doit être conditionné à !o.implicit");
  assert.ok(!/<span[^>]*>\{AU\.leagueLabel\(o\.league\)\}<\/span>\}/.test(ARENE.replace(/\{!o\.implicit &&[^\n]*/g, "")),
    "un badge de ligue reste affiché sans condition");
  // « non classé » reste, lui, affiché : c'est la seule étiquette vraie pour ces comptes.
  assert.match(ARENE, /I18N\.t\("AR2_UNRANKED"\)/);
});

test("la liste est groupée : ma ligue, ligues voisines, sans défense", () => {
  for (const cle of ["AR2_GROUP_MINE", "AR2_GROUP_OTHER", "AR2_GROUP_UNRANKED"]) {
    assert.ok(ARENE.includes(`"${cle}"`), cle + " absent du groupement de la liste");
  }
  // Le groupe des non-classés explique POURQUOI ils sont là.
  assert.ok(ARENE.includes('"AR2_GROUP_UNRANKED_HINT"'), "l'explication du groupe manque");
  // Chaque carte reste rendue par le même composant (une seule façon d'afficher un adversaire).
  assert.ok(/const carte = \(o\) => \{/.test(ARENE), "la carte adversaire doit être une fonction unique");
});

test("l'écart de puissance saturé est nommé via le helper testé", () => {
  assert.match(ARENE, /const ecart = AU\.powerGapLabel\(gap\)/,
    "l'écart doit passer par powerGapLabel (testé dans arene-power-gap.test.js)");
  assert.match(ARENE, /I18N\.t\(ecart\)/, "le libellé d'écart doit être rendu traduit");
});

test("les nouveaux libellés existent dans les TROIS langues (FR/EN/ZH)", () => {
  for (const cle of ["AR2_GAP_FAR_WEAKER", "AR2_GAP_FAR_STRONGER", "AR2_GROUP_MINE",
                     "AR2_GROUP_OTHER", "AR2_GROUP_UNRANKED", "AR2_GROUP_UNRANKED_HINT"]) {
    const m = new RegExp(cle + ":\\s*\\{[^}]*\\}").exec(I18N);
    assert.ok(m, cle + " absent de i18n.js");
    for (const lg of ["FR", "EN", "ZH"]) {
      assert.ok(m[0].includes(lg + ":"), cle + " : traduction " + lg + " manquante");
    }
  }
});
