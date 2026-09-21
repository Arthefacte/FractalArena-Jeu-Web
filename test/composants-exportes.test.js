/* Un composant utilisé depuis un AUTRE fichier doit être exporté vers window.
   ---------------------------------------------------------------------------
   Incident du 21/09 (v273) : `PotLigne`, appelé depuis fosse.jsx / buyback.jsx /
   screens.jsx, ne figurait pas dans l'`Object.assign(window, {...})` de
   components.jsx. Rien ne le signalait : le bundler compile sans broncher, les
   tests lisent du texte, et au runtime React lève simplement « Element type is
   invalid » au PREMIER rendu du header. #root reste vide, boot-splash.js n'enlève
   jamais l'écran de démarrage : le jeu n'ouvre plus, sans le moindre message.

   Ce test est statique (pas de navigateur) : il liste les balises JSX en
   majuscule utilisées dans chaque fichier, écarte celles définies sur place, et
   exige que les autres soient atteignables globalement. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

// Tous les .jsx de la racine (hors build/) : c'est là qu'on écrit du JSX.
const FICHIERS = fs
  .readdirSync(RACINE)
  .filter((f) => f.endsWith(".jsx"))
  .sort();

/** Noms atteignables globalement : listes `Object.assign(window, {...})`
    et affectations directes `window.QuelqueChose = ...`. */
function nomsGlobaux() {
  const noms = new Set();
  const sources = [...FICHIERS, "index.html"];
  for (const f of sources) {
    if (!fs.existsSync(path.join(RACINE, f))) continue;
    const src = lire(f);
    for (const m of src.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/g)) {
      for (const nom of m[1].split(",")) {
        const n = nom.trim().split(":")[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(n)) noms.add(n);
      }
    }
    for (const m of src.matchAll(/window\.([A-Z][\w$]*)\s*=/g)) noms.add(m[1]);
  }
  return noms;
}

/** Balises JSX majuscules utilisées dans un fichier — on écarte les expressions
    membres (`<React.Fragment>`, `<Foo.Bar>`) : non résolubles statiquement. */
function balisesUtilisees(src) {
  const noms = new Set();
  for (const m of src.matchAll(/<([A-Z][\w$]*)(?![\w$.])/g)) noms.add(m[1]);
  return noms;
}

/** Le nom est-il défini dans ce fichier même ? */
function definiSurPlace(src, nom) {
  const motifs = [
    new RegExp(`function\\s+${nom}\\s*\\(`),
    new RegExp(`(const|let|var)\\s+${nom}\\s*=`),
    new RegExp(`class\\s+${nom}\\b`),
  ];
  return motifs.some((r) => r.test(src));
}

test("les composants.jsx n'oublient personne dans la liste d'exports", () => {
  const globaux = nomsGlobaux();
  const manquants = [];
  for (const f of FICHIERS) {
    const src = lire(f);
    for (const nom of balisesUtilisees(src)) {
      if (definiSurPlace(src, nom)) continue; // composant local au fichier
      if (globaux.has(nom)) continue; // exporté ailleurs, atteignable
      manquants.push(`${f} : <${nom}> n'est défini nulle part et n'est pas exporté vers window`);
    }
  }
  assert.deepEqual(manquants, [], `Composants injoignables (le jeu ne s'ouvrira plus) :\n  ${manquants.join("\n  ")}`);
});

test("PotLigne et usePotEligibility sont bien exportés (verrou de l'incident v273)", () => {
  const src = lire("components.jsx");
  const liste = [...src.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/g)].map((m) => m[1]).join(",");
  for (const nom of ["PotLigne", "usePotEligibility"]) {
    assert.match(liste, new RegExp(`\\b${nom}\\b`), `${nom} doit figurer dans l'export de components.jsx`);
  }
  // Et les trois fichiers qui les appellent doivent bien les appeler avec ce nom exact.
  for (const f of ["fosse.jsx", "buyback.jsx", "screens.jsx"]) {
    assert.match(lire(f), /<PotLigne\b/, `${f} doit rendre <PotLigne>`);
  }
});
