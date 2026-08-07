// test/cine-init.test.js
// Mesure du 07/08/2026 sur un Mali-G68, section QUI BLOQUE de la sonde v3 :
//
//   512 ms a 4064 ms :
//       502 ms  cinematique.js  .import.then
//
// Toute l'initialisation 3D (renderer, scène, PMREM/RoomEnvironment, lumières)
// s'exécutait d'une traite après l'import dynamique, sans jamais rendre la main
// au navigateur : ~30 images sautées d'affilée, au moment précis où le logo
// apparaît. Le joueur l'avait situé a l'oeil nu — « c'est quand le logo apparait
// que ça se fige » — avant que la mesure ne le nomme.
//
// Deux corrections, verrouillées ici :
//   1. l'init cède le thread entre ses étapes (cedeLeThread) ;
//   2. l'environnement PMREM, l'étape la plus chère (+366 ms mesurées), est
//      construit APRÈS la première image, pas avant.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "cinematique.jsx"), "utf8");

test("l'init 3D cede le thread entre ses etapes", () => {
  assert.match(SRC, /cedeLeThread/, "aucun point de respiration dans l'init");
  // Les deux composants 3D du fichier doivent en beneficier, pas seulement le premier.
  const blocs = (SRC.match(/const \{ RoomEnvironment \} = await import/g) || []).length;
  const cessions = (SRC.match(/await cedeLeThread\(\)/g) || []).length;
  assert.ok(cessions >= blocs * 2,
    `${blocs} blocs d'init pour seulement ${cessions} cessions : une init reste monolithique`);
});

test("l'environnement PMREM est construit apres la premiere image", () => {
  // Avant : `envTex = pmrem.fromScene(...)` etait appele dans la meme tache que la
  // creation du renderer, donc AVANT tout affichage. Le rendu doit demarrer sans lui.
  const iPmrem = SRC.indexOf("fromScene");
  const iRender = SRC.indexOf("const render = ");
  assert.ok(iPmrem > iRender,
    "PMREM doit etre construit apres la boucle de rendu, sinon il bloque la premiere image");
});

test("cedeLeThread laisse vraiment le navigateur peindre", () => {
  // Un setTimeout(0) ne suffit pas : il ne garantit pas qu'une image soit peinte.
  // requestAnimationFrame, si.
  const def = SRC.slice(SRC.indexOf("function cedeLeThread"), SRC.indexOf("function cedeLeThread") + 400);
  assert.match(def, /requestAnimationFrame/);
});

test("les jalons de diagnostic survivent au decoupage", () => {
  for (const jalon of ["three-importe", "renderer-cree", "pmrem-pret", "emblème-charge", "1re-image"]) {
    assert.ok(SRC.includes(jalon), "jalon perdu : " + jalon);
  }
});
