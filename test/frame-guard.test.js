/* Anti-clickjacking.
 *
 * La CSP du jeu déclare `frame-ancestors 'none'`, mais elle est délivrée par
 * une balise <meta> — et les navigateurs IGNORENT cette directive quand elle
 * vient d'un <meta> (l'avertissement est visible dans toutes les consoles du
 * projet). GitHub Pages ne permet pas d'ajouter un en-tête HTTP : la
 * protection ne peut donc être que du JavaScript.
 *
 * L'enjeu : un site tiers pourrait charger le jeu dans une iframe invisible et
 * faire cliquer un joueur, à son insu, sur des actions qu'il n'a pas voulues.
 *
 * Le module est pur pour être éprouvé ici ; frame-guard.js n'en est que
 * l'application, chargée en tête de page.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const G = fs.readFileSync(path.join(ROOT, "frame-guard.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Le fichier s'exécute au chargement : on l'évalue dans un faux document. */
function joue({ encadre }) {
  const doc = { documentElement: { style: {}, innerHTML: "" }, body: null,
    write(s) { this.ecrit = s; }, close() {}, addEventListener() {} };
  const top = encadre ? { nom: "autre" } : null;
  const win = { self: {}, document: doc, location: { href: "https://fractalarena.com/" } };
  win.top = encadre ? top : win.self;
  win.self = win.self;
  win.stop = () => { doc.stoppe = true; };
  const fn = new Function("window", "document", "top", "self", G);
  fn(win, doc, win.top, win.self);
  return doc;
}

test("hors iframe, le jeu s'affiche normalement", () => {
  const doc = joue({ encadre: false });
  assert.equal(doc.documentElement.innerHTML, "", "le jeu ne doit pas se réécrire tout seul");
  assert.ok(!doc.stoppe, "le chargement ne doit pas être interrompu");
});

test("dans une iframe, le CHARGEMENT est interrompu et le document remplacé", () => {
  /* Constaté en encadrant vraiment le jeu : écrire un message ne suffit pas,
     le reste de la page continuait de se charger et le jeu se montait
     derrière — donc restait cliquable, ce qu'on voulait justement empêcher. */
  const doc = joue({ encadre: true });
  assert.ok(doc.stoppe, "window.stop() doit interrompre le chargement du jeu");
  assert.ok(doc.documentElement.innerHTML.length > 0, "le document doit être remplacé");
  assert.ok(!/id="root"/.test(doc.documentElement.innerHTML), "le point de montage du jeu ne doit pas subsister");
});

test("la neutralisation explique et renvoie vers le vrai site", () => {
  // Une page blanche laisserait le joueur croire à une panne.
  const doc = joue({ encadre: true });
  assert.match(doc.documentElement.innerHTML, /fractalarena\.com/, "il faut un lien vers le site légitime");
  assert.match(doc.documentElement.innerHTML, /Fractal Arena/);
});

test("le garde est chargé EN TÊTE, avant tout le reste", () => {
  /* Chargé tard, la page serait déjà peinte et cliquable : le détournement
     aurait eu lieu. */
  const i = HTML.indexOf("frame-guard.js");
  assert.ok(i > 0, "frame-guard.js n'est pas chargé");
  assert.ok(i < HTML.indexOf("</head>"), "il doit être dans le <head>");
  assert.ok(i < HTML.indexOf("boot-hash.js"), "il doit précéder les scripts d'affichage");
});

test("il n'essaie pas de forcer la navigation du parent", () => {
  // top.location = ... est bloqué dans une iframe sandboxée et lève une
  // exception : on neutralise NOTRE page, on ne touche pas à celle d'autrui.
  // On regarde le CODE, pas les commentaires — qui parlent justement de ce
  // qu'il ne faut pas faire, et faisaient échouer ce test à tort.
  const code = G.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/top\.location\s*=/.test(code), "ne pas tenter de réécrire la page parente");
});
