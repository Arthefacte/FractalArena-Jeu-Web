/* Arène V2 : seules les défenses posées sont éligibles. Les trois groupes historiques,
 * dont « sans défense », disparaissent au profit d'une liste de six cartes maximum.
 * Le badge de ligue et l'écart de puissance restent des informations utiles.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ARENE = lire("arene.jsx");
const I18N = lire("i18n.js");

test("Arène V2 : les cartes n'ont plus de branche pour un adversaire implicite", () => {
  assert.doesNotMatch(ARENE, /\bo\.implicit\b|AR2_UNRANKED/);
  assert.match(ARENE, /AU\.leagueLabel\(o\.league\)/);
  assert.match(ARENE, /ELO \{o\.rating\}/);
});

test("Arène V2 : une liste unique limite le rendu à six cartes", () => {
  assert.doesNotMatch(ARENE, /AR2_GROUP_/);
  assert.doesNotMatch(I18N, /AR2_GROUP_/);
  assert.match(ARENE, /\(pvp\.opponents \|\| \[\]\)\.slice\(0,\s*6\)\.map\(carte\)/);
});

test("l'écart de puissance saturé reste nommé via le helper testé", () => {
  assert.match(ARENE, /AU\.powerGapLabel\(gap\)/);
  assert.match(ARENE, /I18N\.t\(ecart\)/);
});

test("les libellés d'écart existent dans les trois langues", () => {
  for (const cle of ["AR2_GAP_FAR_WEAKER", "AR2_GAP_FAR_STRONGER"]) {
    const m = new RegExp(cle + ":\\s*\\{[^}]*\\}").exec(I18N);
    assert.ok(m, cle + " absent de i18n.js");
    for (const lg of ["FR", "EN", "ZH"]) assert.ok(m[0].includes(lg + ":"));
  }
});
