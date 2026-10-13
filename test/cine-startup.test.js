const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'cinematique.jsx'), 'utf8');
const splash = fs.readFileSync(path.join(__dirname, '..', 'boot-splash.js'), 'utf8');

test('le splash attend que TOUT soit pret, pas seulement React ni la cinematique', () => {
  let tick, removed = false, ready = 'false';
  const boot = { style: {}, remove() { removed = true; } };
  const cine = { getAttribute: () => ready };
  let now = 0;
  const bac = {
    Date: { now: () => now },
    document: { getElementById: (id) => id === 'root' ? { children: [cine], querySelector: () => cine } : boot },
    setInterval: (fn) => { tick = fn; return 1; }, clearInterval() {},
    setTimeout: (fn) => fn(),
  };
  vm.runInNewContext(splash, bac);
  now = 3000; tick(); assert.equal(removed, false);       // cinematique pas prete : on attend
  ready = 'true'; tick(); assert.equal(removed, false);   // prete, mais tout n'est pas prepare
  // Decision du fondateur (13/10) : l'attente vaut mieux qu'une sequence qui se fige.
  ['react', 'three', 'glb', 'environnement', 'shaders', 'textures', 'images', 'audio', 'polices']
    .forEach((e) => bac.FA_PREP.etape(e));
  tick(); assert.equal(removed, true);                    // tout est pret : on entre en jeu
});

test('le splash a un plafond : il ne peut pas enfermer le joueur', () => {
  let tick, removed = false;
  const boot = { style: {}, remove() { removed = true; } };
  const cine = { getAttribute: () => 'false' };           // cinematique jamais prete
  let now = 0;
  vm.runInNewContext(splash, {
    Date: { now: () => now },
    document: { getElementById: (id) => id === 'root' ? { children: [cine], querySelector: () => cine } : boot },
    setInterval: (fn) => { tick = fn; return 1; }, clearInterval() {},
    setTimeout: (fn) => fn(),
  });
  now = 16000; tick(); assert.equal(removed, true);       // au-dela du plafond : on entre quand meme
});

test('le splash ne bloque pas un ecran sans cinematique', () => {
  let tick, removed = false, now = 0;
  vm.runInNewContext(splash, {
    Date: { now: () => now },
    document: { getElementById: (id) => id === 'root' ? { children: [{}], querySelector: () => null } : { style: {}, remove() { removed = true; } } },
    setInterval: (fn) => { tick = fn; }, clearInterval() {}, setTimeout: (fn) => fn(),
  });
  now = 3000; tick(); assert.equal(removed, true);
});

test('la timeline attend les ressources et le retrait effectif du splash', () => {
  assert.match(src, /data-cine-ready=\{prepared\s*\?/);
  assert.match(src, /if \(!prepared\) return;/);
  assert.match(src, /MutationObserver/);
  assert.match(src, /getElementById\('boot'\)/);
  assert.match(src, /observer\.disconnect\(\)/);
  assert.match(src, /bgRef/);
  assert.match(src, /image\.decode\(\)/);
});

test('la preparation 3D a une borne et acquitte un vrai rendu du modele', () => {
  const cine = src.slice(src.indexOf('function Cinematique('));
  assert.match(cine, /setTimeout\([\s\S]*?setTroisDKo\(true\)[\s\S]*?, 8000\)/);
  assert.match(cine, /setModelReady\(true\)/);
  assert.match(cine, /renderer\.render\(scene, camera\);[\s\S]*?setModelReady\(true\)/);
  assert.match(cine, /clearTimeout\(prepareTimer\)/);
});
