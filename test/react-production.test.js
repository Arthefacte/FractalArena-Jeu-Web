/* React servi en version de PRODUCTION.
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
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("React et ReactDOM sont servis en production, minifiés", () => {
  assert.match(HTML, /react@18\.3\.1\/umd\/react\.production\.min\.js/, "React est encore en build de développement");
  assert.match(HTML, /react-dom@18\.3\.1\/umd\/react-dom\.production\.min\.js/, "ReactDOM est encore en build de développement");
  assert.ok(!/react(-dom)?\.development\.js/.test(HTML), "un build de développement subsiste");
});

test("les deux restent protégés par SRI", () => {
  // unpkg est un tiers : sans intégrité, un fichier substitué s'exécuterait
  // avec tous les droits de la page — dont l'accès au jeton de session.
  const scripts = [...HTML.matchAll(/<script src="https:\/\/unpkg\.com\/([^"]+)"([^>]*)>/g)];
  assert.ok(scripts.length >= 2, "les deux scripts unpkg doivent être présents");
  for (const [, url, attrs] of scripts) {
    assert.match(attrs, /integrity="sha384-[A-Za-z0-9+/=]+"/, "SRI absent pour " + url);
    assert.match(attrs, /crossorigin="anonymous"/, "sans crossorigin, l'intégrité n'est pas vérifiée : " + url);
  }
});

test("les empreintes sont celles des fichiers 18.3.1 publiés", () => {
  // Empreintes calculées depuis unpkg et vérifiées : celles des builds de
  // développement qu'elles remplacent correspondaient déjà à l'octet près.
  const attendu = {
    "react@18.3.1/umd/react.production.min.js": "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z",
    "react-dom@18.3.1/umd/react-dom.production.min.js": "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1",
  };
  for (const [url, sri] of Object.entries(attendu)) {
    const m = new RegExp('src="https://unpkg\\.com/' + url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*integrity="([^"]+)"').exec(HTML);
    assert.ok(m, "script introuvable : " + url);
    assert.equal(m[1], sri, "empreinte inattendue pour " + url);
  }
});
