/* La CSP n'autorise plus les scripts en ligne.
 *
 * `'unsafe-inline'` sur script-src était le dernier vrai trou : tant qu'il est
 * accordé, la CSP ne protège pas contre l'injection de script — n'importe quel
 * <script> qu'un attaquant parviendrait à faire écrire dans la page
 * s'exécuterait avec tous les droits, dont l'accès au jeton de session.
 *
 * Le remède n'est pas d'ajouter des empreintes partout mais d'EXTERNALISER :
 * trois fichiers .js couverts par 'self'. Reste l'importmap, qui ne PEUT pas
 * être externe (la spec l'interdit) et vit donc sous empreinte.
 *
 * Piège majeur, payé d'avance : le contenu haché est celui SERVI. Ce dépôt
 * stocke des CRLF, et une machine en LF produirait une autre empreinte, donc
 * un script bloqué et une page morte — silencieusement. L'importmap est donc
 * tenu sur UNE SEULE LIGNE : sans saut de ligne à l'intérieur, l'empreinte est
 * la même partout.
 *
 * `style-src 'unsafe-inline'` reste, lui : le jeu pose des styles en ligne
 * partout via React (style={{...}}), et un style injecté ne s'exécute pas.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const csp = (HTML.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
const jetons = (d) => { const m = new RegExp(d + " ([^;]+)").exec(csp || ""); return m ? m[1].trim().split(/\s+/) : []; };

test("script-src n'accorde plus 'unsafe-inline'", () => {
  assert.ok(csp, "CSP introuvable");
  assert.ok(!jetons("script-src").includes("'unsafe-inline'"),
    "tant qu'il est là, la CSP ne protège pas du XSS : " + csp);
});

test("plus aucun <script> sans src dans la page, hormis l'importmap", () => {
  // Chaque balise script ouvrante, avec ses attributs.
  const balises = [...HTML.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
  const enLigne = balises.filter((a) => !/\bsrc=/.test(a));
  assert.deepEqual(enLigne.map((a) => a.trim()), ['type="importmap"'],
    "scripts en ligne restants : " + JSON.stringify(enLigne));
});

test("l'importmap tient sur une seule ligne", () => {
  /* Sinon son empreinte dépend des fins de ligne de la machine qui a écrit le
     fichier : CRLF ici, LF ailleurs, et la 3D casse sans message. */
  const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(HTML);
  assert.ok(m, "importmap introuvable");
  assert.ok(!/[\r\n]/.test(m[1]), "l'importmap contient un saut de ligne : son empreinte cesse d'être portable");
});

test("l'empreinte déclarée dans la CSP est bien celle de l'importmap", () => {
  /* Le garde-fou qui compte : modifier l'importmap sans refaire l'empreinte
     bloquerait le chargement de Three.js — donc toute la 3D — sans erreur
     parlante. Ce test attrape l'oubli. */
  const contenu = /<script type="importmap">([\s\S]*?)<\/script>/.exec(HTML)[1];
  const attendu = "'sha256-" + crypto.createHash("sha256").update(contenu, "utf8").digest("base64") + "'";
  assert.ok(jetons("script-src").includes(attendu),
    "empreinte absente ou périmée.\n  attendue : " + attendu + "\n  déclarées : " + jetons("script-src").join(" "));
});

test("les trois scripts externalisés existent et sont chargés", () => {
  for (const f of ["boot-hash.js", "boot-splash.js", "sw-register.js"]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), "fichier manquant : " + f);
    assert.match(HTML, new RegExp('src="' + f.replace(".", "\\.") + '\\?v='), f + " n'est pas chargé (ou pas cache-busté)");
  }
});

test("le retrait du splash reste APRÈS les écrans, l'amorce du boot AVANT", () => {
  // L'ordre porte le sens : le hash de minage doit tourner tout de suite,
  // le retrait du splash doit voir #root déjà peuplé.
  assert.ok(HTML.indexOf("boot-hash.js") < HTML.indexOf("build/components.js"));
  assert.ok(HTML.indexOf("boot-splash.js") > HTML.indexOf("build/app.js"));
});
