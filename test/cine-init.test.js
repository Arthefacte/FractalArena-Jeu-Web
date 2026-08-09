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

// emblemStyle s'ecrit sur plusieurs lignes depuis le banc du conteneur : le lire
// jusqu'a son accolade fermante, sinon les tests ne voient que la premiere ligne.
function declEmblemStyle() {
  const i = SRC.indexOf("const emblemStyle = {");
  return SRC.slice(i, SRC.indexOf("\n  };", i) + 5);
}

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
  const decl = declEmblemStyle();
  assert.ok(decl && decl.length > 20, "emblemStyle introuvable");
  assert.ok(
    !/filter:/.test(decl),
    "un `filter` est revenu sur emblemStyle : le compositeur doit rapatrier le canvas "
      + "depuis le GPU a chaque image (13,9 s d'ecran gele mesurees sur Mali-G68)",
  );
});

test("l'entree de l'embleme reste animee sans filtre", () => {
  // Retirer le filtre ne doit pas retirer l'effet d'apparition : `opacity` et
  // `scale` sont composites par le GPU sans relecture, eux.
  const decl = declEmblemStyle();
  // `: opP` et non `opacity: opP` : le banc du conteneur place l'opacite
  // derriere un ternaire, mais le fondu par defaut reste bien `opP`.
  assert.match(decl, /: opP,/, "l'embleme n'a plus de fondu d'entree");
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
  for (const v of ["halo", "fond"]) {
    assert.ok(SRC.includes(`SANS.has('${v}')`), `variante ${v} absente`);
  }
});

// ————————————————————————————————————————————————————————————————
// Le banc a tranche : le canvas WebGL EST la cause. Meme appareil, meme
// cinematique, seule la 3D changeant — 14 images > 100 ms contre 0, une pire
// image de 12 161 ms contre 84 ms, 14 083 ms hors JS contre 445 ms, et une
// cinematique qui atteint enfin sa fin. L'embleme est donc une sequence bakee.
test("la cinematique ne rend pas de canvas WebGL par defaut", () => {
  assert.match(SRC, /CINE_3D\s*\n?\s*\?\s*<canvas/,
    "le canvas ne doit apparaitre que derriere ?cine=3d");
  assert.match(SRC, /:\s*<img src=\{EMBLEM_SPIN\}/,
    "le rendu par defaut doit etre la sequence bakee");
  assert.match(SRC, /const canvas = canvasRef\.current;\s*\n\s*if \(!canvas\) return;/,
    "la garde qui neutralise l'init 3D sans canvas a disparu");
});

test("la sequence bakee passe par FA_ASSET_URL", () => {
  // Sans empreinte de contenu, le CDN peut servir une version perimee — et une
  // URL versionnee par le numero de jeu la retelechargerait a chaque livraison.
  assert.match(SRC, /window\.FA_ASSET_URL\('assets\/emblem-spin\.webp'\)/);
});

test("l'ancien rendu 3D reste joignable pour comparaison", () => {
  // Trois hypotheses fausses ont ete eliminees par comparaison A/B ; garder le
  // chemin WebGL accessible coute une ligne et evite un redeploiement le jour
  // ou il faudra remesurer.
  assert.match(SRC, /\/\[\?&\]cine=3d\\b\/i/);
});

test("la sonde etiquette la variante mesuree", () => {
  // Un rapport de banc d'essai sans etiquette ne se rattache a rien.
  const DIAG = fs.readFileSync(path.join(__dirname, "..", "diag.js"), "utf8");
  assert.match(DIAG, /VARIANTE : /);
});

// ————————————————————————————————————————————————————————————————
// Banc du CONTENEUR. Le canvas de l'ecran de connexion (app.jsx:2032) tourne a
// 60 fps ; celui de la cinematique gele 11 s, meme taille, meme code, meme
// modele. `?cine=3d&sans=fond,halo` a montre que ni le fond filtre ni le halo
// n'y sont pour rien : la difference restante est le conteneur lui-meme.
test("le conteneur de l'embleme est demontable propriete par propriete", () => {
  for (const v of ["nu", "perspective", "zoom", "fondu"]) {
    assert.ok(SRC.includes(`SANS.has('${v}')`), `variante ${v} absente du banc`);
  }
});

test("sans=nu reproduit les conditions de l'ecran de connexion", () => {
  // Un div sans contexte 3D CSS, sans echelle animee, sans willChange : c'est
  // exactement le cadre dans lequel le meme composant tourne sans faiblir.
  assert.match(SRC, /const nu = SANS\.has\('nu'\)/);
  assert.match(SRC, /nu \|\| SANS\.has\('perspective'\) \? \{\} : \{ perspective/);
  assert.match(SRC, /\(nu \|\| SANS\.has\('zoom'\)\)/);
  assert.match(SRC, /\.\.\.\(nu \? \{\} : \{ willChange: 'transform' \}\)/);
});

test("le conteneur par defaut garde son animation d'entree", () => {
  // Le banc ne doit rien degrader tant qu'aucun parametre n'est passe.
  assert.match(SRC, /: `translate\(-50%,-50%\) translateY\(\$\{settleY\}%\) scale\(\$\{scaleE\}\)`/);
  assert.match(SRC, /: opP,/);
});

// ————————————————————————————————————————————————————————————————
// Deux angles morts du banc precedent, decouverts en lisant la mesure de
// `?cine=3d&sans=nu` : le gel demarre exactement a la bascule d'opacite
// (t = 8,2 s), or `nu` ET `fondu` la conservaient tous les deux — le cas
// « visible des le debut », qui est celui de l'ecran de connexion, n'avait
// jamais ete teste. Et `sans=fond,halo` ne retirait que deux calques sur sept.
test("le canvas peut etre visible des le debut, sans bascule d'opacite", () => {
  assert.match(SRC, /SANS\.has\('apparition'\) \? 1/,
    "aucune variante ne teste un canvas visible sans transition 0 -> 1");
});

test("sans=deco laisse le canvas seul, sans les calques d'ambiance", () => {
  // Test symetrique de `sans=3d` : au lieu de retirer la 3D, on retire tout le
  // reste. Doit couvrir scan, sweep, lightning, convergence et embers.
  const n = (SRC.match(/SANS\.has\('deco'\)/g) || []).length;
  assert.ok(n >= 5, `deco ne couvre que ${n} calques, il en faut au moins 5`);
});

// ————————————————————————————————————————————————————————————————
// Verdict des deux tests du banc #114 (09/08, Mali-G68 du joueur) :
//   sans=apparition (canvas compose des t0, decor COMPLET) : 54 fps, pire
//     image 401 ms, cinematique 20,9 s pour 20 s — gel disparu ;
//   sans=deco (decor retire, bascule 0 -> 1 CONSERVEE) : 0 image pendant 6 s,
//     pire image 7 451 ms, 8 214 ms hors JS — gel reproduit sans le decor.
// Le coupable est donc la bascule d'opacite du canvas, pas le decor. Le
// compositeur ignore une couche a `opacity: 0` ; la reintegrer en cours de
// cinematique lui coute des secondes. Correctif verrouille ici : en 3D,
// l'opacite du conteneur a un PLANCHER (jamais 0), le canvas est compose des
// la premiere image et le fondu opere sur une couche deja vivante.
test("en 3D, l'opacite du canvas ne descend jamais a 0", () => {
  assert.match(SRC, /: CINE_3D \? Math\.max\(0\.015, opP\)\r?\n\s+: opP,/,
    "le plancher d'opacite de la voie 3D a disparu : la bascule 0 -> 1 " +
    "regele 6 a 13 s sur Mali-G68 (mesures des 08-09/08)");
});

test("le bake garde son fondu entier, il n'a pas la pathologie du canvas", () => {
  // L'<img> du bake n'est pas une couche WebGL : son 0 -> 1 est inoffensif et
  // le plancher ne doit PAS s'y appliquer (le dernier terme reste `: opP`).
  assert.match(SRC, /: opP,/);
});
