/* ============================================================
   Point 4 — rafraîchissement de la liste d'adversaires (rotation) et le vrai levier pour faire
   POSER les défenses.

   Ce que ces gardes tiennent :
   - le bouton « Rafraîchir » de l'Arène relançait la MÊME requête : la liste ne changeait jamais.
     Il doit demander une rotation au serveur, et dire ce qu'elle coûte (gratuit, puis payant).
   - le bandeau annonçait « pour entrer dans l'Arène » alors que le serveur laisse jouer sans
     défense : il doit dire la règle réelle (on combat avec ses 3 meilleures) ET l'enjeu
     (classement + prix), parce que c'est l'enjeu qui fait poser une défense, pas l'interdiction.
   - un compte sans défense doit l'apprendre là où il subit des attaques — c'est le seul endroit
     du jeu où il peut le voir.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const racine = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");

test("le bouton Rafraîchir demande une ROTATION (il ne relisait que la même liste)", () => {
  const src = lire("arene.jsx");
  assert.match(src, /onClick=\{onRefreshList\}/, "le bouton doit appeler la rotation");
  assert.match(src, /async function onRefreshList\(\)/, "le handler doit exister");
  assert.ok(!/onClick=\{\(\) => actions\.pvpRefresh\(\)\}/.test(src),
    "le bouton mort (simple re-fetch de la même liste) ne doit plus exister");
});

test("le bouton dit ce que le tour coûte : gratuit, puis le prix du serveur", () => {
  const src = lire("arene.jsx");
  assert.match(src, /AR2_REFRESH_FREE/, "le tour gratuit doit être annoncé");
  assert.match(src, /refresh_cost \|\| 100/, "le prix affiché vient du serveur (une constante, pas un chiffre en dur)");
});

test("l'action parle au serveur et applique le débit optimiste", () => {
  const src = lire("app.jsx");
  assert.match(src, /async pvpRefreshList\(\)/);
  assert.match(src, /\/pvp\/refresh/, "la route serveur");
  assert.match(src, /j\.charged > 0/, "un tour payant doit débiter le solde affiché");
});

test("pvpRefresh retient l'état du rafraîchissement renvoyé par le serveur", () => {
  const src = lire("app.jsx");
  assert.match(src, /refresh_free: opp\.refresh_free_remaining/);
  assert.match(src, /refresh_cost: opp\.refresh_cost/);
});

test("le bandeau ne promet plus une porte qui n'existe pas", () => {
  assert.match(lire("arene.jsx"), /AR2_DEFENSE_HINT/, "l'explication réelle doit être affichée");
  assert.ok(!/pour entrer dans l'Arène/.test(lire("i18n.js")),
    "l'ancien texte (faux : le serveur laisse jouer sans défense) ne doit pas revenir");
});

test("un compte sans défense l'apprend là où il est attaqué", () => {
  const src = lire("arene.jsx");
  assert.match(src, /AR2_ATTACKS_NO_DEFENSE/);
  assert.match(src, /!myDefensePosted && \(pvp\.attacks \|\| \[\]\)\.length > 0/,
    "l'avertissement ne vise que les comptes sans défense, et seulement s'ils sont attaqués");
  assert.match(src, /setMyDefensePosted\(!!\(r && r\.team && r\.team\.length === 3\) && !r\.implicit\)/,
    "l'état vient du SERVEUR (`implicit`), pas d'une supposition du client");
});

test("les libellés existent dans les trois langues", () => {
  const src = lire("i18n.js");
  for (const cle of ["AR2_DEFENSE_HINT", "AR2_REFRESH_FREE", "AR2_REFRESH_OK", "AR2_REFRESH_PAID", "AR2_ATTACKS_NO_DEFENSE"]) {
    assert.ok(new RegExp(cle + ": \\{ FR: [^}]*EN: [^}]*ZH: [^}]* \\}").test(src),
      cle + " doit porter FR, EN et ZH");
  }
});
