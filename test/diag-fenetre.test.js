/* La sonde ?diag=1 doit couvrir l'evenement qu'on lui demande de mesurer.
   Ces tests existent parce que la v3 s'arretait a 12 s « pour voir le
   demarrage » : l'embleme n'entre qu'a 8,4 s de timeline (~10 s de page) et la
   cinematique dure 20 s, si bien que la sonde rendait son verdict AVANT le gel
   a diagnostiquer et affirmait 47 fps pendant que l'ecran du joueur figeait.
   Une journee de correctifs a l'aveugle en a decoule. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const racine = path.join(__dirname, "..");
const DIAG = fs.readFileSync(path.join(racine, "diag.js"), "utf8");
const CINE = fs.readFileSync(path.join(racine, "cinematique.jsx"), "utf8");

const cineDur = Number(/const CINE_DUR = ([\d.]+)/.exec(CINE)[1]);

test("la fenetre de la sonde couvre toute la cinematique, avec de la marge", () => {
  const defaut = Number(/demande <= 120 \? demande : (\d+)\)/.exec(DIAG)[1]);
  assert.ok(
    defaut >= cineDur + 8,
    `fenetre de ${defaut} s pour une cinematique de ${cineDur} s : la sonde s'arreterait `
      + "avant la fin, or son pas de temps est plafonne donc la cinematique peut s'etirer",
  );
});

test("la frise seconde par seconde est dans le rapport", () => {
  // Sans elle, un gel de dix secondes se dilue dans une moyenne calculee sur
  // toute la fenetre — c'est ce qui a masque le probleme dans la v3.
  assert.match(DIAG, /FRISE \(par seconde/);
});

test("les images longues distinguent le script du rendu", () => {
  // Une image longue sans script attribue n'est pas un bug JS mais du style,
  // du layout ou de la composition GPU : aucun correctif cote JS ne la touche.
  assert.match(DIAG, /script " \+ js \+ " ms \| rendu/);
  assert.match(DIAG, /hors JS \(rendu\/GPU\)/);
});

test("la cinematique pose les jalons qui datent son deroule reel", () => {
  for (const jalon of ["cine-t0", "cine-embleme", "cine-fin"]) {
    assert.ok(CINE.includes(`marque('${jalon}')`), `jalon ${jalon} absent de cinematique.jsx`);
  }
});

test("le rapport chiffre l'etirement de la cinematique", () => {
  // `dt` est plafonne a 50 ms par image : une chute de framerate n'accelere pas
  // la fin de la timeline, elle l'allonge en temps reel. Le rapport doit le dire.
  assert.match(DIAG, /cinematique vecue/);
  assert.match(CINE, /const dt = Math\.min\(0\.05,/);
});

test("les jalons sont affiches dans l'ordre du temps, pas du code", () => {
  // La v3 listait `1re-image` apres `pmrem-pret` alors qu'elle le precede, ce
  // qui produisait un delta negatif (« +-374 ») illisible.
  assert.match(DIAG, /\.sort\(function \(a, b\) \{ return etapes\[a\] - etapes\[b\]; \}\)/);
});
