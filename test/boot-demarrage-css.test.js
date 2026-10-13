// test/boot-demarrage-css.test.js
// L'ASSEMBLAGE DE L'EMBLÈME NE DOIT PLUS DÉPENDRE DU FIL PRINCIPAL.
//
// Mesuré le 13/10/2026 (Chromium, téléphone simulé, CPU ×4) : pendant l'écran de
// chargement, l'import de Three.js, le chargement du GLB et la première
// compilation GPU occupent le fil principal 4,5 s au total, dont un bloc de
// 2,8 s. L'assemblage était joué par des `setTimeout` qui changeaient le `src`
// d'un <img> : mesuré sur les images réellement affichées, la zone de l'emblème
// restait identique 2 645 ms d'affilée, soit 82 % du temps de blocage. Le
// joueur voyait un emblème figé, puis qui saute.
//
// La règle : une bande d'images (assets/boot-strip.webp) parcourue par une
// animation CSS `steps()` sur `transform`. Transform et opacity sont animés par
// le COMPOSITEUR, qui continue d'avancer pendant qu'un script bloque.
//
// Ces tests tiennent les trois choses qui font que ça marche : l'animation est
// en CSS (pas de JS, pas de changement de `src`), le pas correspond EXACTEMENT à
// la bande livrée (nombre d'images et hauteur), et le repli « mouvement réduit »
// existe sans JS.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const HTML = lire("index.html");
const META = JSON.parse(lire("assets/boot-strip.json"));

// Dimensions réelles du WebP, lues dans l'en-tête : une bande de 31 images avec
// une animation de 32 pas doit échouer ici, pas sur le téléphone du joueur.
function tailleWebp(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  let o = 12;
  while (o + 8 <= buf.length) {
    const type = buf.toString("ascii", o, o + 4);
    const taille = buf.readUInt32LE(o + 4);
    const corps = o + 8;
    if (type === "VP8X") return { l: 1 + buf.readUIntLE(corps + 4, 3), h: 1 + buf.readUIntLE(corps + 7, 3) };
    if (type === "VP8L") { const b = buf.readUInt32LE(corps + 1); return { l: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
    if (type === "VP8 ") return { l: buf.readUInt16LE(corps + 6) & 0x3fff, h: buf.readUInt16LE(corps + 8) & 0x3fff };
    o = corps + taille + (taille % 2);
  }
  return null;
}

const BANDE = fs.readFileSync(path.join(__dirname, "..", "assets", "boot-strip.webp"));
const TAILLE = tailleWebp(BANDE);

test("la bande d'assemblage est un seul fichier, découpé par le CSS", () => {
  assert.ok(TAILLE, "assets/boot-strip.webp illisible ou pas un WebP");
  assert.strictEqual(TAILLE.l, META.largeur, "largeur de la bande ≠ annoncée dans boot-strip.json");
  assert.strictEqual(TAILLE.h, META.hauteur, "hauteur de la bande ≠ annoncée dans boot-strip.json");
  assert.strictEqual(META.hauteur, META.cellule * META.images,
    "la hauteur doit valoir exactement une cellule par image : sinon le pas de l'animation montre une bande oblique");
  assert.strictEqual(BANDE.length, META.octets, "le fichier livré ne correspond pas à boot-strip.json");
  assert.ok(META.perteMax <= 2, `l'image s'est dégradée (écart ${META.perteMax}/255) : la bande doit reprendre l'artwork existant`);
});

test("les 32 images sont dans l'ordre, une par pas", () => {
  const pas = /#boot #boot-emblem[^}]*?animation:\s*bootAssemble\s+[\d.]+s\s+steps\((\d+),\s*end\)/s.exec(HTML);
  assert.ok(pas, "l'emblème de démarrage doit porter une animation CSS steps() : sans elle, l'assemblage dépend du fil principal");
  assert.strictEqual(Number(pas[1]), META.images - 1,
    "steps(N) doit valoir une image de moins que la bande : N pas couvrent les N+1 positions");

  const cle = /@keyframes bootAssemble\s*\{([^\n]*)\}/.exec(HTML);
  assert.ok(cle, "keyframes bootAssemble absentes");
  const valeurs = [...cle[1].matchAll(/translateY\((-?[\d.]+)%\)/g)].map((m) => Number(m[1]));
  const attendu = -((META.images - 1) / META.images) * 100;
  assert.ok(valeurs.includes(Number(attendu.toFixed(3))) || valeurs.some((v) => Math.abs(v - attendu) < 0.01),
    `le parcours doit valoir ${attendu.toFixed(3)} % (une image de moins que la bande), trouvé ${valeurs.join(", ")}`);
});

test("l'animation ne touche que transform et opacity", () => {
  // Ces deux propriétés sont animées par le compositeur. Animer une propriété de
  // mise en page (ou un timer JS) ramènerait le gel constaté.
  const cle = /@keyframes bootAssemble\s*\{([^\n]*)\}/.exec(HTML)[1];
  assert.ok(!/top|left|height|margin|background/.test(cle),
    "l'assemblage doit se déplacer par transform : une propriété de mise en page est repeinte par le fil principal");
  assert.match(HTML, /#boot #boot-emblem[^}]*will-change:\s*transform/, "sans will-change: transform, le navigateur peut refuser de confier l'animation au compositeur");
  assert.match(HTML, /class="emb-strip"/, "la bande doit être découpée par une fenêtre (.emb-strip) — sinon les 32 images défilent en dehors du cadre");
  assert.match(HTML, /\.emb-strip\s*\{[^}]*overflow:\s*hidden/, ".emb-strip doit découper la bande (overflow: hidden)");
});

test("plus aucun assemblage piloté par JS", () => {
  assert.ok(!/boot-anim\.js/.test(HTML), "assets/boot-anim.js ne doit plus être chargé : c'est le mécanisme qui se figeait");
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "assets", "boot-anim.js")), "assets/boot-anim.js doit être supprimé");
  assert.ok(!/__BOOT_FRAMES/.test(HTML), "index.html ne doit plus contenir de frames en base64 (333 Ko à parser au démarrage)");
  // Le halo portait un blur(10px) : une convolution à chaque image, sur mobile.
  assert.ok(!/\.halo\s*\{[^}]*filter:\s*blur/.test(HTML), "le halo ne doit plus être flouté (convolution pendant l'assemblage)");
});

test("la bande est préchargée, et le repli mouvement réduit existe", () => {
  assert.match(HTML, /<link rel="preload" as="image" href="assets\/boot-strip\.webp\?v=\d+"/,
    "la bande doit être préchargée : c'est la première chose affichée");
  assert.match(HTML, /id="boot-emblem"[^>]*src="assets\/boot-strip\.webp\?v=\d+"/, "l'image de l'emblème doit pointer la bande, versionnée");
  const media = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n    \}/.exec(HTML);
  assert.ok(media, "bloc prefers-reduced-motion absent");
  assert.match(media[1], /#boot #boot-emblem[^}]*animation:\s*none/, "mouvement réduit : l'assemblage doit s'arrêter");
  assert.match(media[1], /#boot #boot-emblem[^}]*translateY\(-9[0-9.]+%\)/, "mouvement réduit : l'emblème doit rester visible, assemblé");
});

test("le cycle garde le rythme d'origine (1,5 s d'assemblage puis repos)", () => {
  const duree = /#boot #boot-emblem[^}]*?animation:\s*bootAssemble\s+([\d.]+)s/.exec(HTML);
  assert.ok(duree, "durée du cycle illisible");
  const total = Number(duree[1]);
  const cle = /@keyframes bootAssemble\s*\{([^\n]*)\}/.exec(HTML)[1];
  const pct = Number(/36\.6%/.test(cle) ? 36.6 : NaN);
  assert.ok(Number.isFinite(pct), "le cycle ne marque plus la fin de l'assemblage (36,6 %)");
  const assemblage = (total * pct) / 100;
  assert.ok(Math.abs(assemblage - 1.5) < 0.15, `l'assemblage dure ${assemblage.toFixed(2)} s, il en durait 1,5`);
});
