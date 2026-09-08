// test/totem-cine-dispose.test.js
// Audit web du 2026-09-08 (P1#5) : la cinématique du Totem gardait son renderer
// WebGL plein écran, ses cibles de post-traitement (composer + mips du bloom),
// sa texture PMREM et le GLB en VRAM pour TOUTE la session, et son listener
// `resize` anonyme continuait de réallouer ces cibles à chaque rotation, overlay
// caché — jusqu'à faire perdre son contexte à l'emblème 3D du header. Ces tests
// épinglent le ménage complet dans finish() et le redémarrage propre au play() suivant.
// totem-cine.js est un module ESM three.js servi tel quel : on le lit comme du texte.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "totem-cine.js"), "utf8");
const bloc = (debut, fin) => {
  const i = SRC.indexOf(debut);
  assert.ok(i >= 0, `${debut} introuvable`);
  const j = SRC.indexOf(fin, i);
  return SRC.slice(i, j > 0 ? j : undefined);
};

test("le handler resize est nomme, pose ET retire (pas d'anonyme qui survit)", () => {
  assert.doesNotMatch(SRC, /addEventListener\('resize',\s*\(\)\s*=>/,
    "listener resize anonyme : impossible a retirer, il survit a la cinematique");
  assert.match(SRC, /window\.addEventListener\('resize',\s*onResize\)/);
  assert.match(SRC, /window\.removeEventListener\('resize',\s*c\.onResize\)/);
});

test("finish() dispose tout et remet le singleton a null", () => {
  const fin = bloc("function finish(", "function runTimeline(");
  assert.match(fin, /disposeCtx\(\)/, "finish doit passer par le menage complet");
  const d = bloc("function disposeCtx(", "function loadModel(");
  assert.match(d, /ctx = null/, "le singleton doit etre remis a null");
  for (const attendu of [
    /c\.composer\.dispose\(\)/, /c\.bloom\.dispose\(\)/, /c\.ca\.dispose\(\)/, /c\.output\.dispose\(\)/,
    /c\.pmrem\.dispose\(\)/, /c\.envRT\.dispose\(\)/,
    /geometry\.dispose\(\)/, /m\.dispose\(\)/,
    /c\.renderer\.forceContextLoss\(\)/, /c\.renderer\.dispose\(\)/,
    /c\.dom\.root, c\.dom\.flash, c\.dom\.reveal/,
  ]) assert.match(d, attendu, `disposeCtx : ${attendu} manquant`);
  // forceContextLoss AVANT dispose : c'est la perte de contexte qui rend la VRAM.
  assert.ok(d.indexOf("forceContextLoss") < d.indexOf("c.renderer.dispose()"));
});

test("la boucle de rendu ne touche plus a rien une fois finish() passe", () => {
  const t = bloc("function tick(now)", "c.composer.render()");
  assert.match(t, /if \(!c\.running\) return;/,
    "un rAF deja en file d'attente rendrait sur un composer dispose");
});

test("le play() suivant recree tout via initCtx()", () => {
  const p = bloc("export function play(", "window.FA_TOTEM_CINE");
  assert.match(p, /if \(!ctx\) initCtx\(\);/);
  // initCtx reconstruit aussi l'overlay DOM (retire par disposeCtx).
  const init = bloc("function initCtx(", "function disposeCtx(");
  assert.match(init, /buildOverlay\(\)/);
});
