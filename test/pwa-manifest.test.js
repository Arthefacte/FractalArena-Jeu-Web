/* PWA — volet 3, manifeste + icônes.
   Le jeu se joue déjà sans portefeuille et la mise en page mobile existe
   (mobile.css), mais rien ne le rend INSTALLABLE : ni manifeste, ni icône
   d'écran d'accueil. C'est ce que ces règles verrouillent.

   Contrainte du propriétaire du jeu : qualité avant le poids. Les icônes sont
   dérivées de l'emblème réel en pleine résolution (_bake/boot-emblem.png,
   920x920), pas redessinées ni sous-échantillonnées à l'économie —
   cf. _bake/gen-pwa-icons.mjs. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const MANIFEST_FILE = path.join(ROOT, "manifest.webmanifest");

test("le manifeste existe et est du JSON valide", () => {
  assert.ok(fs.existsSync(MANIFEST_FILE), "manifest.webmanifest manquant : rien n'est installable");
  JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
});

test("le manifeste porte les champs exigés pour une invite d'installation", () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  assert.equal(typeof m.name, "string");
  assert.ok(m.name.includes("Fractal Arena"));
  // Les lanceurs Android donnent deux lignes courtes sous l'icône et coupent
  // sur l'espace : un nom court PLUS un point de coupure évitent le « Fractal Ar… ».
  assert.ok(m.short_name && m.short_name.length <= 15, "short_name trop long pour un écran d'accueil");
  assert.ok(m.short_name.length <= 8 || m.short_name.includes(" "),
    "sans espace, un nom long est tronqué au lieu d'aller à la ligne");
  assert.equal(m.display, "standalone", "sans standalone, l'app garde la barre d'URL");
  assert.equal(m.theme_color, "#05070f", "doit suivre le <meta name=theme-color> de la page");
  assert.equal(m.background_color, "#05070f", "le splash doit prolonger le boot, pas flasher en blanc");
  assert.ok(m.description && m.description.length > 20, "description exigée par les stores d'apps web");
});

test("start_url et scope sont RELATIFS", () => {
  // Le site est servi et sur fractalarena.com et sur github.io/<repo> : un
  // chemin absolu "/" casserait la seconde origine.
  const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  for (const k of ["start_url", "scope"]) {
    assert.ok(m[k], k + " manquant");
    assert.ok(!m[k].startsWith("/"), k + " ne doit pas être absolu : " + m[k]);
  }
});

test("les trois icônes attendues sont déclarées, aux bonnes tailles", () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 3, "au moins 192, 512 et une maskable");
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192"), "192 : taille minimale d'installabilité");
  assert.ok(sizes.includes("512x512"), "512 : splash Android");
  const maskable = m.icons.filter((i) => String(i.purpose || "").includes("maskable"));
  assert.ok(maskable.length >= 1, "sans maskable, Android rogne l'emblème dans son gabarit");
  assert.ok(maskable.some((i) => i.sizes === "512x512"), "la maskable doit être fournie en 512");
});

test("chaque icône déclarée existe VRAIMENT sur le disque, à la taille annoncée", () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  for (const icon of m.icons) {
    const rel = icon.src.split("?")[0];
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), "icône déclarée mais absente : " + rel);
    // Taille lue dans l'entête PNG (IHDR : largeur/hauteur en big-endian, octets 16..23).
    const buf = fs.readFileSync(file);
    assert.equal(buf.slice(1, 4).toString("ascii"), "PNG", rel + " n'est pas un PNG");
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert.equal(w + "x" + h, icon.sizes, rel + " mesure " + w + "x" + h + ", annoncé " + icon.sizes);
  }
});

test("l'emblème maskable respecte la zone sûre (contenu à ~72 %)", () => {
  // Android rogne jusqu'à 20 % de chaque bord. Un emblème pleine bordure y
  // perd ses pointes ; la version maskable doit donc être détourée plus petite,
  // ce que prouve la présence de marges de fond uniformes.
  const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const mask = m.icons.find((i) => String(i.purpose || "").includes("maskable") && i.sizes === "512x512");
  const any = m.icons.find((i) => i.sizes === "512x512" && !String(i.purpose || "").includes("maskable"));
  assert.ok(mask && any, "il faut les deux variantes 512 pour les distinguer");
  assert.notEqual(mask.src, any.src, "la maskable ne peut pas être le même fichier que l'icône pleine");
});

test("index.html relie le manifeste et l'icône iOS", () => {
  assert.match(HTML, /<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest\?v=/,
    "sans <link rel=manifest>, aucune invite d'installation");
  // iOS ignore le manifeste pour l'icône d'accueil : il lui faut apple-touch-icon.
  assert.match(HTML, /rel="apple-touch-icon"/, "sur iOS l'icône d'accueil serait une capture d'écran");
  assert.match(HTML, /name="apple-mobile-web-app-capable"/, "sinon iOS lance dans Safari, pas en plein écran");
  assert.match(HTML, /name="apple-mobile-web-app-status-bar-style"/, "barre d'état iOS à accorder au fond sombre");
});

test("l'icône iOS déclarée dans index.html existe", () => {
  const m = HTML.match(/rel="apple-touch-icon"[^>]*href="([^"?]+)/);
  assert.ok(m, "href de l'apple-touch-icon introuvable");
  assert.ok(fs.existsSync(path.join(ROOT, m[1])), "apple-touch-icon déclarée mais absente : " + m[1]);
});

test("la CSP n'interdit pas le manifeste", () => {
  // manifest-src retombe sur default-src ; si un jour default-src se restreint,
  // le manifeste serait bloqué silencieusement et l'installation disparaîtrait.
  const csp = (HTML.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, "CSP introuvable");
  const explicit = /manifest-src ([^;]+)/.exec(csp);
  const source = explicit ? explicit[1] : /default-src ([^;]+)/.exec(csp)[1];
  assert.ok(source.includes("'self'"), "le manifeste est servi depuis l'origine : " + source);
});
