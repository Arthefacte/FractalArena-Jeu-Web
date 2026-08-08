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

// ————————————————————————————————————————————————————————————————
// Mesure du 08/08/2026, meme appareil, sonde v133 (fenetre 32 s) :
//
//   cine-embleme : 20304 ms          <- l'embleme devient visible
//   13931 ms a 20457 ms (script 220 ms | rendu 251 ms)
//   21s..33s : 0 image
//
// Une seule image de 13,9 SECONDES, declenchee 150 ms apres l'apparition de
// l'embleme, dont 220 ms de script : le blocage n'etait pas dans le JavaScript
// mais dans le compositeur. Le conteneur du canvas WebGL portait
// `filter: blur(18px→0) drop-shadow(...)`, recalcule a chaque image ; le
// drop-shadow survivait au flou et plombait toute la fin de la cinematique.
//
// Les trois calques en mixBlendMode: screen actifs de 4 a 8 s tournaient, eux,
// a 58-60 images/s — c'est ce qui a isole le filtre comme seul coupable.
test("aucun filtre CSS sur le conteneur du canvas 3D", () => {
  const decl = /const emblemStyle = .*/.exec(SRC);
  assert.ok(decl, "emblemStyle introuvable");
  assert.ok(
    !/filter:/.test(decl[0]),
    "un `filter` est revenu sur emblemStyle : le compositeur doit rapatrier le canvas "
      + "depuis le GPU a chaque image (13,9 s d'ecran gele mesurees sur Mali-G68)",
  );
});

test("l'entree de l'embleme reste animee sans filtre", () => {
  // Retirer le filtre ne doit pas retirer l'effet d'apparition : `opacity` et
  // `scale` sont composites par le GPU sans relecture, eux.
  const decl = /const emblemStyle = .*/.exec(SRC)[0];
  assert.match(decl, /opacity: opP/, "l'embleme n'a plus de fondu d'entree");
  assert.match(decl, /scale\(\$\{scaleE\}\)/, "l'embleme n'a plus son zoom d'entree");
});

// ————————————————————————————————————————————————————————————————
// Banc d'essai ?sans=... . Trois correctifs cibles ont echoue (init 3D
// decoupee, filtre CSS retire, hypothese des deux contextes WebGL) parce
// qu'ils visaient le JavaScript, alors que la mesure dit que le blocage n'est
// ni du script ni du rendu. On isole donc par elimination, en UNE livraison.
test("le banc d'essai n'est actif que sur parametre explicite", () => {
  // Le defaut doit rester la cinematique complete : un banc d'essai qui degrade
  // le rendu de tous les joueurs serait pire que le bug qu'il diagnostique.
  assert.match(SRC, /\/\[\?&\]sans=\(\[a-z0-9,\]\+\)\/i/,
    "le banc doit se lire depuis l'URL, pas d'un etat global");
  for (const v of ["3d", "halo", "fond"]) {
    assert.ok(SRC.includes(`SANS.has('${v}')`), `variante ${v} absente`);
  }
});

test("sans=3d ne rend aucun canvas, donc n'initialise aucun contexte WebGL", () => {
  // L'init 3D commence par `if (!canvas) return` : ne pas rendre le canvas
  // suffit a la neutraliser entierement.
  assert.match(SRC, /SANS\.has\('3d'\)\s*\?\s*<img/,
    "sans=3d doit remplacer le canvas par une image, pas seulement le masquer");
  assert.match(SRC, /const canvas = canvasRef\.current;\s*\n\s*if \(!canvas\) return;/,
    "la garde qui rend sans=3d efficace a disparu");
});

test("la sonde etiquette la variante mesuree", () => {
  // Un rapport de banc d'essai sans etiquette ne se rattache a rien.
  const DIAG = fs.readFileSync(path.join(__dirname, "..", "diag.js"), "utf8");
  assert.match(DIAG, /VARIANTE : /);
});
