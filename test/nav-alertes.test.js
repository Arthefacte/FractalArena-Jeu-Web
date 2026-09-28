// Garde de la refonte de navigation : les alertes de JEU doivent rester visibles en BUREAU.
// Le rework a regroupe Arene sous « Fosse » et Expeditions sous « Campagne » ; le code des
// pastilles est reste accroche aux onglets arene/expeditions, qui ne sont plus dans PRIMARY.
// Les deux alertes etaient donc calculees puis jamais rendues, et la barre mobile (qui les
// portait) est masquee en bureau (.fa-mnav) : un joueur sur ordinateur ne voyait plus qu'on
// l'attaquait ni qu'une expedition etait prete. Ces trois controles refusent ce mode de panne.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(RACINE, "app.jsx"), "utf8");

test("la barre de bureau rend une pastille", () => {
  const debut = APP.indexOf("PRIMARY.map(");
  const fin = APP.indexOf("</nav>", debut);
  assert.ok(debut > 0 && fin > debut, "barre de bureau introuvable dans app.jsx");
  const barre = APP.slice(debut, fin);
  assert.match(barre, /pastilleDe\(/, "la barre de bureau ne rend plus aucune pastille d'alerte");
});

test("les deux alertes de jeu sont branchees sur cette pastille", () => {
  const i = APP.indexOf("pastilleDe =");
  assert.ok(i > 0, "l'aide de pastille a disparu de app.jsx");
  const aide = APP.slice(i, APP.indexOf("\n", APP.indexOf("=> {", i) > 0 ? APP.indexOf("\n", i + 200) : i + 400));
  assert.match(aide, /areneBadge/, "l'alerte d'attaques non vues n'est plus branchee");
  assert.match(aide, /expReady/, "l'alerte d'expeditions pretes n'est plus branchee");
});

test("la carte de campagne marque les mondes termines", () => {
  const c = fs.readFileSync(path.join(RACINE, "campaign.jsx"), "utf8");
  assert.match(c, /total === D\.STARS_PER_WORLD/, "plus aucun monde n'est marque comme termine");
  assert.match(c, /100 % ✓/, "le marqueur de monde termine n'est plus rendu");
});
