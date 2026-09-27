/* React servi en version de PRODUCTION — et désormais AUTO-HÉBERGÉ.
 *
 * Le site sert des joueurs, pas des développeurs. Les builds `development`
 * pèsent 1,19 Mo à eux deux (contre 143 Ko) et, surtout, refont à CHAQUE rendu
 * un travail de validation destiné au développement : vérification des
 * propTypes, avertissements, traces de composants. C'est payé par le téléphone
 * du joueur, à chaque combat.
 *
 * Le prix à payer : plus d'avertissements React dans la console. C'est le
 * comportement attendu d'un site en production, et le développement local peut
 * les retrouver en repassant les deux URL en `development`.
 *
 * E8 (audit D10, finding F6) : les deux fichiers venaient de `unpkg.com`,
 * autorisé en bloc dans `script-src`. Une source CSP n'accepte pas de chemin —
 * `https://unpkg.com` autorisait donc N'IMPORTE QUEL script de ce CDN, pas
 * seulement React ; le SRI protégeait les deux balises présentes, pas une
 * balise ajoutée demain par une faille d'injection. Three.js avait déjà été
 * auto-hébergé pour cette raison ; React est rentré dans le rang : les fichiers
 * sont servis par le site (`vendor/`), et `https://unpkg.com` a quitté la CSP.
 *
 * Le test recalcule l'empreinte sha384 du fichier LIVRÉ et la confronte au SRI
 * de la balise : un `vendor/react.production.min.js` remplacé en douce ne passe
 * pas. La version annoncée par le paquet et la taille sont vérifiées en plus —
 * le nom du fichier, lui, ne dit rien de son contenu.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RACINE = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");

function attrsDe(src) {
  const echappe = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`<script src="${echappe}"([^>]*)>`).exec(HTML);
  assert.ok(m, "balise introuvable dans index.html : " + src);
  return m[1];
}

test("React et ReactDOM sont servis en production, minifiés et LOCAUX", () => {
  assert.match(HTML, /src="vendor\/react\.production\.min\.js"/, "React n'est pas auto-hébergé");
  assert.match(HTML, /src="vendor\/react-dom\.production\.min\.js"/, "ReactDOM n'est pas auto-hébergé");
  assert.ok(!/react(-dom)?\.development\.js/.test(HTML), "un build de développement subsiste");
});

test("plus aucune balise ne charge React depuis un CDN tiers", () => {
  // On juge le HTML SERVI : un commentaire peut bien raconter d'où venaient les fichiers,
  // ce sont les balises et la CSP qui décident de ce que le navigateur charge.
  const servi = HTML.replace(/<!--[\s\S]*?-->/g, "");
  assert.ok(!/unpkg\.com/.test(servi), "unpkg est encore référencé dans une balise d'index.html");
  assert.ok(
    !/script-src[^;]*https:\/\//.test(servi),
    "la CSP autorise encore un hôte de script tiers : une source CSP n'accepte pas de chemin, " +
      "donc elle autorise tout ce que cet hôte sert"
  );
});

test("l'empreinte SRI déclarée est bien celle du fichier livré", () => {
  for (const f of ["vendor/react.production.min.js", "vendor/react-dom.production.min.js"]) {
    const attrs = attrsDe(f);
    const m = /integrity="(sha384-[A-Za-z0-9+/=]+)"/.exec(attrs);
    assert.ok(m, "SRI absent pour " + f);
    assert.match(attrs, /crossorigin="anonymous"/, "sans crossorigin, l'intégrité n'est pas vérifiée : " + f);
    const calcule = "sha384-" + crypto.createHash("sha384").update(fs.readFileSync(path.join(RACINE, f))).digest("base64");
    assert.equal(m[1], calcule, `l'empreinte de ${f} ne correspond pas à son SRI — le fichier livré n'est plus celui attendu`);
  }
});

test("les fichiers auto-hébergés sont bien ceux de React 18.3.1, minifiés", () => {
  const react = fs.readFileSync(path.join(RACINE, "vendor/react.production.min.js"), "utf8");
  const dom = fs.readFileSync(path.join(RACINE, "vendor/react-dom.production.min.js"), "utf8");
  assert.match(react, /version="18\.3\.1"/, "le React livré n'annonce pas la version 18.3.1");
  assert.match(dom, /18\.3\.1/, "le ReactDOM livré n'annonce pas la version 18.3.1");
  // Un build de développement pèse ~1,19 Mo à lui seul : la taille est le garde-fou le
  // moins contournable quand le nom du fichier ne dit rien du contenu.
  assert.ok(react.length < 200000, `React livré trop lourd (${react.length} o) : build de développement ?`);
  assert.ok(dom.length < 400000, `ReactDOM livré trop lourd (${dom.length} o) : build de développement ?`);
});
