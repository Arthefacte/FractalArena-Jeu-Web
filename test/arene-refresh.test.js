/* Arène V2 : il faut poser sa défense pour entrer. La rotation reste pilotée par
 * le serveur et aucun prix de secours n'est recopié dans l'interface.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const racine = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");

test("le bouton Rafraîchir demande une rotation", () => {
  const src = lire("arene.jsx");
  assert.match(src, /onClick=\{onRefreshList\}/);
  assert.match(src, /async function onRefreshList\(\)/);
  assert.doesNotMatch(src, /onClick=\{\(\) => actions\.pvpRefresh\(\)\}/);
});

test("le prix de rotation est celui du serveur, sans prix de secours", () => {
  const src = lire("arene.jsx");
  assert.match(src, /AR2_REFRESH_FREE/);
  assert.match(src, /pvp\.refresh_cost/);
  assert.doesNotMatch(src, /refresh_cost\s*(?:\|\||\?\?)\s*\d/);
  assert.match(src, /disabled=\{[^}]*!refreshCostKnown[^}]*\}/);
});

test("l'action de rotation parle au serveur et applique le coût renvoyé", () => {
  const src = lire("app.jsx");
  assert.match(src, /async pvpRefreshList\(\)/);
  assert.match(src, /\/pvp\/refresh/);
  assert.match(src, /j\.charged > 0/);
});

test("pvpRefresh conserve l'état du rafraîchissement serveur", () => {
  const src = lire("app.jsx");
  assert.match(src, /refresh_free: opp\.refresh_free_remaining/);
  assert.match(src, /refresh_cost: opp\.refresh_cost/);
});

test("Arène V2 : l'entrée explique les trois conséquences d'une défense absente", () => {
  const src = lire("arene.jsx");
  assert.match(src, /AR2_ENTRY_TITLE/);
  assert.match(src, /AR2_ENTRY_HINT/);
  const i18n = lire("i18n.js");
  assert.match(i18n, /Pose ta défense pour entrer dans l'Arène/);
  assert.doesNotMatch(src, /AR2_ATTACKS_NO_DEFENSE|r\.implicit/);
});

test("Arène V2 : l'entrée permet de choisir sur place ou d'ouvrir Équipe", () => {
  const src = lire("arene.jsx");
  assert.match(src, /onClick=\{\(\) => actions\.setView\("team"\)\}>\{I18N\.t\("AR2_OPEN_TEAM"\)\}/);
  assert.match(src, /onClick=\{\(\) => setReplacementIndex\(0\)\}>\{I18N\.t\("AR2_CHOOSE_THREE"\)\}/);
});

test("les libellés de rotation et d'entrée existent dans les trois langues", () => {
  const src = lire("i18n.js");
  for (const cle of ["AR2_ENTRY_TITLE", "AR2_ENTRY_HINT", "AR2_REFRESH_FREE", "AR2_REFRESH_OK", "AR2_REFRESH_PAID"]) {
    assert.ok(new RegExp(cle + ": \\{ FR: [^}]*EN: [^}]*ZH: [^}]* \\}").test(src), cle);
  }
});
