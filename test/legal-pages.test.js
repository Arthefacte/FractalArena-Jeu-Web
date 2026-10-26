// test/legal-pages.test.js
// Garde-fou conformité du domaine fractalarena.com : les pages légales doivent
// exister, rester liées depuis l'interface, et ne charger aucune ressource tierce.
// Elles vivent sur CE domaine (LCEN art. 6-III, RGPD art. 13) — celles de la
// vitrine arthefacte.com ne couvrent pas le jeu.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const PAGES = ["mentions-legales.html", "confidentialite.html", "cgu.html"];

test("les trois pages légales existent et sont liées depuis l'interface", () => {
  const app = lire("app.jsx");
  for (const page of PAGES) {
    assert.ok(fs.existsSync(path.join(RACINE, page)), `${page} manquante`);
    // Deux points d'accès : l'écran d'entrée (avant tout compte) et le tiroir « Plus ».
    const liens = app.split(`href="${page}"`).length - 1;
    assert.ok(liens >= 2, `${page} doit être liée depuis l'écran d'entrée ET le tiroir « Plus » (${liens})`);
  }
});

test("chaque page légale est autonome : aucun script, aucune sous-ressource externe", () => {
  for (const page of PAGES) {
    const html = lire(page);
    assert.match(html, /script-src 'none'/, `${page} : la CSP doit interdire les scripts`);
    assert.match(html, /default-src 'self'/);
    assert.doesNotMatch(html, /<script/i, `${page} : aucune balise script`);
    assert.doesNotMatch(html, /<form/i, `${page} : aucun formulaire`);
    // Aucune police ni script chargé depuis un CDN.
    assert.doesNotMatch(html, /(?:href|src)="https?:\/\/(?:fonts\.googleapis|fonts\.gstatic|unpkg)\.com/,
      `${page} : ressource tierce chargée`);
    // Les liens sortants sont des <a>, jamais des sous-ressources.
    for (const m of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      const url = m[1];
      if (url.startsWith("https://fractalarena.com")) continue;
      const i = html.indexOf(url);
      const avant = html.slice(Math.max(0, i - 120), i);
      assert.match(avant, /<a [^>]*$/, `${page} : ${url} doit être un simple lien <a>`);
    }
  }
});

test("le jeu ne charge plus de police tierce", () => {
  const styles = lire("styles.css");
  const html = lire("index.html");
  assert.doesNotMatch(styles, /fonts\.googleapis\.com|fonts\.gstatic\.com/,
    "styles.css : plus d'@import Google Fonts");
  assert.doesNotMatch(html, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/,
    "index.html : la CSP ne doit plus autoriser Google Fonts");
  assert.match(html, /font-src 'self' data:;/);
  for (const f of ["assets/fonts/chakra-petch-400-latin.woff2",
                   "assets/fonts/chakra-petch-700-latin.woff2",
                   "assets/fonts/jetbrains-mono-latin.woff2",
                   "legal.css"]) {
    assert.ok(fs.existsSync(path.join(RACINE, f)), `${f} manquant`);
  }
});

test("mentions légales : éditeur, hébergeurs du jeu et nature du site", () => {
  const html = lire("mentions-legales.html");
  assert.match(html, /contact@arthefacte\.com/);
  assert.match(html, /6-III-2/);
  assert.match(html, /GitHub, Inc\./);
  assert.match(html, /Cloudflare, Inc\./);
  assert.match(html, /Railway Corp\./);
  assert.match(html, /PSAN/, "le statut non-PSAN doit être écrit noir sur blanc");
});

test("confidentialité : données réelles du compte portefeuille, RGPD et CNIL", () => {
  const html = lire("confidentialite.html");
  assert.match(html, /2016\/679|RGPD/);
  assert.match(html, /adresse de portefeuille/i);
  assert.match(html, /art\. 6\.1\.b/);
  assert.match(html, /CNIL/);
  assert.match(html, /3 place de Fontenoy/);
  assert.match(html, /hors Union européenne|hors UE/i);
  // L'effacement doit dire la vérité : une transaction on-chain ne s'efface pas.
  assert.match(html, /blockchain[\s\S]{0,200}(ne peuvent|définitives|publiques)/i);
});

test("CGU : retraits, mises, agents IA et avertissement actifs numériques", () => {
  const html = lire("cgu.html");
  assert.match(html, /code de récupération/i);
  assert.match(html, /retrait/i);
  assert.match(html, /agents? IA/i);
  assert.match(html, /actif numérique|jeton/i);
  assert.match(html, /droit français/i);
  assert.match(html, /PSAN/);
});

test("aucun marqueur provisoire dans les pages légales", () => {
  for (const page of PAGES) {
    assert.doesNotMatch(lire(page), /TODO|FIXME|Lorem ipsum|\[à compléter\]|XXX/i,
      `${page} contient un texte provisoire`);
  }
});

test("le sitemap déclare les pages légales", () => {
  const sitemap = lire("sitemap.xml");
  for (const page of PAGES) assert.ok(sitemap.includes(page), `${page} absente du sitemap`);
});
