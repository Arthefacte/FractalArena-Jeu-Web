// test/exp-fx-cards.test.js
// Les animations d'expédition doivent montrer LES cartes du joueur (visuel réel
// via D.artFor, cadre par rang), pas des tuiles génériques glyphe+nom — à
// l'ALLER comme au RETOUR, qui partagent le même markup (fxCard).
// Verrouillage au niveau source, comme finisher-hooks.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "expeditions.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const fnBody = (name) => {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i >= 0, name + " introuvable");
  const j = src.indexOf("\n  }", i);
  assert.ok(j > i, name + " : fin de fonction introuvable");
  return src.slice(i, j);
};

test("la carte animée porte le vrai visuel des entités (artFor)", () => {
  const card = fnBody("fxCard");
  assert.match(card, /D\.artFor\(b\)/, "les cartes de l'animation doivent porter le visuel réel (D.artFor)");
  assert.match(card, /D\.ART\[b\.image_key\]/, "le repli d'image (onError → D.ART) doit exister, comme sur les autres cartes");
});

test("le glyphe générique ne subsiste qu'en repli (entité introuvable)", () => {
  const glyphes = [...fnBody("fxCard").matchAll(/EXP_GLYPH/g)];
  assert.ok(glyphes.length <= 1, "le glyphe ne doit servir que de repli, pas de visuel principal");
});

test("l'aller ET le retour réutilisent la même carte", () => {
  for (const fn of ["renderFx", "renderReturnFx"]) {
    assert.match(fnBody(fn), /cards\.map\(fxCard\)/, fn + " doit rendre les cartes via fxCard");
  }
});

test("le retour est le miroir de l'aller (aspiration ↔ éjection)", () => {
  // Même point de fuite : le centre du portail. Si l'un des deux dérive, le
  // sens « elles y rentrent / elles en sortent » se casse en silence.
  const vanish = /calc\(var\(--fx-x, 0\) \* -114%\),-157%,0\) scale\(\.08\)/g;
  assert.strictEqual([...css.matchAll(vanish)].length, 2, "exqSuck et exqSpit doivent viser le même point de fuite");
  assert.match(css, /\.exq-rfx \.exq-fx-card \{ animation: exqSpit/, "le retour doit rejouer la carte en éjection");
});

test("les 3 cartes sont aspirées ENSEMBLE, après une entrée décalée", () => {
  // L'entrée est décalée carte par carte (délai inline sur le slot) mais
  // l'aspiration part d'un délai FIXE en CSS : sinon elles repartent en file.
  assert.match(fnBody("fxCard"), /className="exq-fx-slot" style=\{\{ animationDelay: \(0\.2 \+ i \* 0\.26\)/, "l'entrée doit être décalée par carte");
  assert.match(css, /\.exq-fx-card \{[\s\S]*?animation: exqSuck [^;]*? 1\.24s both; \}/, "l'aspiration doit avoir un délai fixe (départ simultané)");
});

test("le retour respecte prefers-reduced-motion", () => {
  assert.match(src, /if \(!reducedMotion\(\)\) \{\s*\n\s*if \(rfxTimer\.current\)/, "claim() doit sauter l'animation en mouvement réduit");
  assert.match(css, /\.exq-fx, \.exq-claimfx, \.exq-rfx \{ display: none !important; \}/, "l'overlay de retour doit être masqué en mouvement réduit");
});
