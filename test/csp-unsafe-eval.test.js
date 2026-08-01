/* La CSP n'autorise plus 'unsafe-eval'.
 *
 * Historique : Babel transpilait dans le navigateur, ce qui l'imposait. Puis,
 * même après le passage aux .jsx pré-transpilés, il restait dû à un seul
 * contournement — `new Function('m','return import(m)')` dans cinematique.jsx,
 * qui masquait l'import dynamique de Three.js à Babel (le transformeur
 * in-browser le réécrivait en require()). Ce transformeur ne tourne plus, et
 * la pré-transpilation laisse `import()` intact : le contournement est devenu
 * inutile, et la directive avec lui.
 *
 * Ce que ça vaut : 'unsafe-eval' rend exploitable toute injection qui parvient
 * à faire passer une chaîne de caractères pour du code. La retirer ferme cette
 * porte pour de bon.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const csp = () => (HTML.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
// Attention : 'wasm-unsafe-eval' CONTIENT la sous-chaîne « unsafe-eval ». Il faut
// comparer des jetons, pas chercher un morceau de texte — sinon le test se croit
// rouge alors que seule la directive WebAssembly est présente, ou pire, se croit
// vert alors que le vrai 'unsafe-eval' est revenu.
const jetons = (directive) => {
  const m = new RegExp(directive + " ([^;]+)").exec(csp() || "");
  return m ? m[1].trim().split(/\s+/) : [];
};

test("la CSP n'autorise plus 'unsafe-eval'", () => {
  assert.ok(csp(), "CSP introuvable");
  assert.ok(!jetons("script-src").includes("'unsafe-eval'"), "'unsafe-eval' est encore accordé : " + csp());
});

test("mais WebAssembly reste permis : les reliques 3D en dépendent", () => {
  /* Découvert en le retirant : le décodeur meshopt des .glb (relic-models.js)
     instancie un module WebAssembly. Sans 'wasm-unsafe-eval', Chrome lève
     « CompileError: WebAssembly.instantiate() violates CSP » et les reliques
     retombent SILENCIEUSEMENT sur leur rendu primitif — vérifié : décodage
     false sans la directive, true avec. Cette directive-ci n'autorise que
     WebAssembly, ni eval() ni new Function. */
  assert.ok(jetons("script-src").includes("'wasm-unsafe-eval'"),
    "sans cette directive, les 8 reliques 3D ne se décodent plus : " + csp());
});

test("plus aucun code servi ne construit de fonction depuis une chaîne", () => {
  // Une seule occurrence oubliée et la page casse à l'exécution, pas au test :
  // on ratisse tout ce que le navigateur charge.
  const servis = fs.readdirSync(ROOT).filter((f) => /\.(js|jsx)$/.test(f))
    .concat(fs.readdirSync(path.join(ROOT, "build")).filter((f) => f.endsWith(".js")).map((f) => "build/" + f));
  const fautifs = [];
  for (const f of servis) {
    const code = fs.readFileSync(path.join(ROOT, f), "utf8");
    if (/new Function\s*\(/.test(code) || /(^|[^.\w])eval\s*\(/.test(code)) fautifs.push(f);
  }
  assert.deepEqual(fautifs, [], "ces fichiers exigeraient encore 'unsafe-eval' : " + fautifs.join(", "));
});

test("cinematique.jsx importe Three.js directement", () => {
  const C = fs.readFileSync(path.join(ROOT, "cinematique.jsx"), "utf8");
  assert.match(C, /await import\(/, "l'import dynamique doit être écrit tel quel");
  assert.ok(!/dynImport/.test(C), "le contournement dynImport subsiste");
});
