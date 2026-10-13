const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'cinematique.jsx'), 'utf8');
const splash = fs.readFileSync(path.join(__dirname, '..', 'boot-splash.js'), 'utf8');

test('le splash attend la preparation de la cinematique, pas seulement React', () => {
  let tick, removed = false, ready = 'false';
  const boot = { style: {}, remove() { removed = true; } };
  const cine = { getAttribute: () => ready };
  let now = 0;
  vm.runInNewContext(splash, {
    Date: { now: () => now },
    document: { getElementById: (id) => id === 'root' ? { children: [cine], querySelector: () => cine } : boot },
    setInterval: (fn) => { tick = fn; return 1; }, clearInterval() {},
    setTimeout: (fn) => fn(),
  });
  now = 3000; tick(); assert.equal(removed, false);
  ready = 'true'; tick(); assert.equal(removed, true);
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
