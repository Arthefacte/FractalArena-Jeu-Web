# Totem — Invocation (Partie B : client web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
> **NOTE D'EXÉCUTION** : les tâches 4–6 sont **visuelles/intégration** → vérification **manuelle dans le navigateur** (un subagent ne peut pas voir le rendu). L'exécution **inline** (avec le serveur local + l'œil de l'utilisateur) est recommandée pour ces tâches. Les tâches 1–2 sont du TDD pur (`node:test`).

**Goal:** Côté client, donner vie à l'invocation du Totem : une cinématique 3D (médaillon qui émerge, tourne, s'illumine, flash, reveal), un bouton « Invoquer » qui la déclenche, et une galerie pour choisir cosmétiquement l'image affichée.

**Architecture:** Le serveur (Partie A, déjà livrée) expose déjà `canInvoke`, `artByTier`, `displayArtUrl`, `revealedTier`, et `POST /totem/invoke` + `POST /totem/display`. Côté client : (1) un **module ESM `totem-cine.js`** (three.js via importmap) exposant `window.FA_TOTEM_CINE.play(opts)` — porté du prototype validé `_totem-cine-proto.html` ; (2) `totem-ui.js` + `link.jsx` + `app.jsx` consomment les nouveaux champs, ajoutent le bouton « Invoquer » (gated sur `canInvoke`) et la galerie (POST display) ; (3) le GLB 48 Mo est **optimisé** avant d'être embarqué.

**Tech Stack:** React 18 (UMD) + Babel standalone (pas de bundler), three.js 0.160 (ESM via importmap CDN), `node:test` pour la logique pure, gltf-transform (npx) pour l'optimisation du GLB.

## Global Constraints

- Repo : `fractal-arena-web` uniquement (la Partie A serveur est livrée). `API_URL = "https://fractal-arena-server-production.up.railway.app"` (défini dans `app.jsx:9` et `screens.jsx:7`).
- Pas de bundler : nouveau JS pur (`window.FA_*`) chargé **avant** les `type=text/babel` ; nouveau `.jsx` **avant** `app.jsx` ; `totem-cine.js` est un **module ESM** chargé via `<script type="module">` + `<script type="importmap">`.
- Auth : POST authentifiés envoient `headers: { "Content-Type":"application/json", "Authorization": \`Bearer ${s.authToken}\` }` avec `s = gRef.current` ; sur **401** → `actions.authenticate(gRef.current.wallet)` puis retry (pattern existant `/fight` app.jsx:424-433).
- **Anti-pay-to-win** : l'image affichée (`displayTier`/`displayArtUrl`) est **cosmétique** — ne jamais s'en servir pour une stat. (La puissance est serveur-only.)
- Cinématique = **médaillon 3D** (pas de vidéo). Matériau du GLB **intact** (ne PAS modifier metalness/roughness/émissif). Recto-verso = 2 instances **décalées sur Z**. Crescendo via éclairage de scène (expo + lumières + bloom), pas via le matériau. Étincelles orange/cyan. Paramètres validés (cf. `_totem-cine-proto.html`) : `INTRO_DUR=1.5`, `WIND_DUR=3.8`, `WIND_AMP=1.05`, `SPIN_DUR=2.8`, `CAM_FAR=9.5`, `CAM_NEAR=5.6`.
- i18n : ajouter chaque clé en **FR/EN/ZH** (objet `T` dans `i18n.js`, lu via `I18N.t(key, ...args)`).
- Tests : `node --test test/<fichier>` (Node v24, par fichier). Les modules JS purs exportent via la branche `module.exports` de leur IIFE.
- Cache-bust : au déploiement, incrémenter `?v=30 → 31` sur TOUS les scripts de `index.html` (hors tâches ici ; noté pour le déploiement).
- Spec source : `../fractal-arena-server/docs/superpowers/specs/2026-06-20-totem-invocation-cinematic-design.md`. Référence cinématique : `_totem-cine-proto.html` (prototype validé).

---

## File Structure

- **Modify** `totem-ui.js` : `totemArt(t)` privilégie `t.displayArtUrl` ; nouveau `galleryItems(t)` (liste des paliers révélés → `{tier, url}`). (JS pur, testable.)
- **Modify** `i18n.js` : 4 clés `TOTEM_*` (FR/EN/ZH).
- **Optimize** `assets/logo3d.glb` : 48 Mo → < 5 Mo (sauvegarde de l'original en `assets/logo3d.src.glb`).
- **Create** `totem-cine.js` : module ESM three.js, `window.FA_TOTEM_CINE.play(opts)`. Porté du prototype.
- **Modify** `index.html` : importmap + `<script type="module" src="totem-cine.js">`.
- **Modify** `app.jsx` : actions `invokeTotem(tier)` + `pickTotemImage(tier)` (POST authentifiés, MAJ `g.totem`).
- **Modify** `link.jsx` : bouton « Invoquer » (si `canInvoke`) qui lance la cinématique puis `invokeTotem` ; galerie des images révélées (→ `pickTotemImage`).
- **Test** `test/totem-ui.test.js` (étendu), `test/totem-invocation-i18n.test.js` (nouveau).

---

### Task 1 : `totem-ui.js` — image affichée cosmétique + items de galerie

**Files:**
- Modify: `totem-ui.js`
- Test: `test/totem-ui.test.js`

**Interfaces:**
- Consumes : objet totem `t` (du serveur) avec `type, tier, artUrl, displayArtUrl, displayTier, revealedTier, artByTier` (`{ "<tier>": url }`).
- Produces : `totemArt(t)` → URL (priorité `displayArtUrl` > `artUrl` > fallback type) ; `galleryItems(t)` → `[{ tier, url }]` triés (paliers révélés ayant une image), `[]` si aucun.

- [ ] **Step 1 : Étendre les tests (échouent)**

Ajouter à la fin de `test/totem-ui.test.js` :

```js
test("totemArt : privilégie displayArtUrl (image cosmétique choisie)", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:"d.webp" }), "d.webp");
});
test("totemArt : sans displayArtUrl, retombe sur artUrl", () => {
  assert.strictEqual(TU.totemArt({ type:"HASH", artUrl:"a.webp", displayArtUrl:null }), "a.webp");
});
test("totemArt : sans image, fallback du type", () => {
  assert.strictEqual(TU.totemArt({ type:"GENESIS" }), "assets/GENESIS.png");
});
test("galleryItems : paliers révélés triés, [] si aucun", () => {
  assert.deepStrictEqual(
    TU.galleryItems({ revealedTier:3, artByTier:{ "1":"u1", "3":"u3" } }),
    [{ tier:1, url:"u1" }, { tier:3, url:"u3" }]
  );
  assert.deepStrictEqual(TU.galleryItems({ revealedTier:0, artByTier:{} }), []);
  assert.deepStrictEqual(TU.galleryItems(null), []);
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node --test test/totem-ui.test.js`
Expected: FAIL (`galleryItems` indéfini ; `totemArt` ignore `displayArtUrl`).

- [ ] **Step 3 : Implémenter dans `totem-ui.js`**

Remplacer la fonction `totemArt` existante par :

```js
  function totemArt(t) {
    if (!t) return "assets/HASHBYTE.png";
    return t.displayArtUrl || t.artUrl || totemArtFallback(t.type);
  }
  // Images de palier révélées, pour la galerie cosmétique. Trié par palier croissant.
  function galleryItems(t) {
    if (!t || !t.artByTier) return [];
    return Object.keys(t.artByTier)
      .map(Number)
      .filter(n => n >= 1 && n <= (t.revealedTier || 0))
      .sort((a, b) => a - b)
      .map(tier => ({ tier, url: t.artByTier[tier] }));
  }
```

Et ajouter `galleryItems` à l'objet `api` exporté :

```js
  const api = { totemArtFallback, totemArt, galleryItems, tierName, auraSummary, TIER_NAMES };
```

- [ ] **Step 4 : Vérifier le succès**

Run: `node --test test/totem-ui.test.js`
Expected: PASS (tests existants + 4 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add totem-ui.js test/totem-ui.test.js
git commit -m "feat(totem-ui): image cosmétique (displayArtUrl) + galleryItems"
```

---

### Task 2 : i18n — clés d'invocation (FR/EN/ZH)

**Files:**
- Modify: `i18n.js`
- Test: `test/totem-invocation-i18n.test.js`

**Interfaces:**
- Produces : clés `TOTEM_INVOKE_BTN`, `TOTEM_PREPARING`, `TOTEM_GALLERY_TITLE`, `TOTEM_GALLERY_COSMETIC` dans l'objet `T`, chacune avec `FR`/`EN`/`ZH`.

- [ ] **Step 1 : Écrire le test (échoue)**

Créer `test/totem-invocation-i18n.test.js` :

```js
const { test } = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

test("clés d'invocation présentes en FR/EN/ZH", () => {
  for (const k of ["TOTEM_INVOKE_BTN","TOTEM_PREPARING","TOTEM_GALLERY_TITLE","TOTEM_GALLERY_COSMETIC"]) {
    assert.ok(T[k], `clé manquante: ${k}`);
    for (const lang of ["FR","EN","ZH"]) {
      assert.ok(T[k][lang] && T[k][lang].length > 0, `${k}.${lang} manquant`);
    }
  }
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node --test test/totem-invocation-i18n.test.js`
Expected: FAIL (clés absentes).

- [ ] **Step 3 : Ajouter les clés dans `i18n.js`**

Juste après la clé `LINK_DORMANT_HINT` (≈ ligne 120), ajouter :

```js
  TOTEM_INVOKE_BTN:    { FR: "✨ Invoquer mon Totem", EN: "✨ Invoke my Totem", ZH: "✨ 召唤我的图腾" },
  TOTEM_PREPARING:     { FR: "Totem en préparation…", EN: "Totem preparing…", ZH: "图腾准备中…" },
  TOTEM_GALLERY_TITLE: { FR: "Galerie", EN: "Gallery", ZH: "画廊" },
  TOTEM_GALLERY_COSMETIC: { FR: "Image cosmétique — tes stats restent celles de ton palier réel.",
                            EN: "Cosmetic image — your stats stay those of your real tier.",
                            ZH: "装饰图像 — 你的属性仍取决于你的真实阶位。" },
```

- [ ] **Step 4 : Vérifier le succès**

Run: `node --test test/totem-invocation-i18n.test.js`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add i18n.js test/totem-invocation-i18n.test.js
git commit -m "feat(i18n): clés invocation Totem (FR/EN/ZH)"
```

---

### Task 3 : Optimiser le GLB (48 Mo → < 5 Mo)

**Files:**
- Modify: `assets/logo3d.glb` (optimisé) ; Create: `assets/logo3d.src.glb` (sauvegarde de l'original)

**Interfaces:** Produces : `assets/logo3d.glb` optimisé (textures webp redimensionnées), chargeable par `GLTFLoader` **sans** décodeur spécial (pas de Draco/meshopt → on garde le loader simple).

- [ ] **Step 1 : Sauvegarder l'original**

```bash
cp assets/logo3d.glb assets/logo3d.src.glb
ls -la assets/logo3d.src.glb   # ~48 Mo
```

- [ ] **Step 2 : Optimiser (textures webp + redimension, sans compression géométrie)**

```bash
npx --yes @gltf-transform/cli optimize assets/logo3d.src.glb assets/logo3d.glb --compress false --texture-compress webp --texture-size 1024
```

Si `--compress false` est refusé par la version du CLI, utiliser la voie en 2 étapes :

```bash
npx --yes @gltf-transform/cli resize assets/logo3d.src.glb /tmp/_t.glb --width 1024 --height 1024
npx --yes @gltf-transform/cli webp /tmp/_t.glb assets/logo3d.glb --slots "*"
```

- [ ] **Step 3 : Vérifier la taille + l'entête GLB**

```bash
ls -la assets/logo3d.glb
node -e "const b=require('fs').readFileSync('assets/logo3d.glb');console.log('magic',b.toString('ascii',0,4),'Mo',(b.length/1048576).toFixed(2));"
```

Expected : `magic glTF`, taille **< 5 Mo** (idéalement 1–3 Mo). Si toujours > 8 Mo, réduire `--texture-size` à `512` et relancer Step 2.

- [ ] **Step 4 : Vérifier le rendu (manuel, navigateur)**

Lancer le serveur local et ouvrir le prototype (il charge `assets/logo3d.glb`) :

```bash
python -m http.server 8123 --bind 127.0.0.1
```
Ouvrir `http://127.0.0.1:8123/_totem-cine-proto.html` → le médaillon doit s'afficher **identique** (textures intactes), juste plus léger. Cocher « inspecter » pour vérifier les deux faces et la netteté.

- [ ] **Step 5 : Commit**

```bash
git add assets/logo3d.glb assets/logo3d.src.glb
git commit -m "chore(totem): optimise logo3d.glb (textures webp 1024) — 48Mo -> léger ; garde l'original en .src"
```

---

### Task 4 : Module cinématique `totem-cine.js` + câblage `index.html`

**Files:**
- Create: `totem-cine.js`
- Modify: `index.html` (importmap + module script)

**Interfaces:**
- Produces : `window.FA_TOTEM_CINE.play(opts)` où `opts = { imageUrl, fallbackUrl, glbUrl?, onDone? }`. Joue la cinématique plein écran (overlay créé/géré par le module), révèle `imageUrl` (avec `onerror → fallbackUrl`), puis ferme l'overlay et appelle `onDone()`. Réutilise la scène three.js et le GLB en cache entre les appels.

- [ ] **Step 1 : Créer `totem-cine.js`** (porté du prototype validé `_totem-cine-proto.html`, paramétré)

```js
// totem-cine.js — cinématique d'invocation du Totem (module ESM, three.js).
// Exposé via window.FA_TOTEM_CINE.play({ imageUrl, fallbackUrl, glbUrl?, onDone? }).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DEFAULT_GLB = 'assets/logo3d.glb';
const INTRO_DUR = 1.5, WIND_DUR = 3.8, WIND_AMP = 1.05, SPIN_DUR = 2.8;
const CAM_FAR = 9.5, CAM_NEAR = 5.6;
const easeOut = x => 1 - Math.pow(1 - x, 3);

let ctx = null; // singleton three.js (renderer, scene, …)

function buildOverlay() {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:none;';
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:2;background:radial-gradient(circle at 50% 50%,#fff 0%,#cfe9ff 35%,#6fb7ff 60%,rgba(0,0,0,0) 80%);';
  const reveal = document.createElement('div');
  reveal.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;opacity:0;z-index:3;transition:opacity .9s ease,transform .9s ease;transform:scale(.85);';
  const img = document.createElement('img');
  img.style.cssText = 'max-width:min(80vw,80vh);max-height:min(80vw,80vh);border-radius:14px;box-shadow:0 0 40px rgba(0,240,255,.35),0 0 80px rgba(247,147,26,.2);';
  reveal.appendChild(img);
  document.body.appendChild(root); document.body.appendChild(flash); document.body.appendChild(reveal);
  return { root, flash, reveal, img };
}

function initCtx() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const dom = buildOverlay(); dom.root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100); camera.position.set(0, 0, CAM_FAR);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.AmbientLight(0x404858, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  const orange = new THREE.PointLight(0xff7a1a, 5, 30); orange.position.set(-4, -1, 3); scene.add(orange);
  const cyan = new THREE.PointLight(0x00f0ff, 5, 30); cyan.position.set(4, 2, 2); scene.add(cyan);
  const pivot = new THREE.Group(); scene.add(pivot);
  // étincelles
  const N = 240, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const cO = new THREE.Color(0xff8a2a), cC = new THREE.Color(0x46e6ff);
  const seed = i => { const r = 0.15 + Math.random() * 0.35, a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
    pos[i*3]=Math.cos(a)*Math.cos(b)*r; pos[i*3+1]=Math.sin(b)*r; pos[i*3+2]=Math.sin(a)*Math.cos(b)*r;
    vel[i]=new THREE.Vector3(Math.random()-0.5,Math.random()*0.7+0.15,Math.random()-0.5).normalize().multiplyScalar(0.5+Math.random()*1.3);
    const c=Math.random()<0.5?cO:cC; col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; };
  for (let i = 0; i < N; i++) seed(i);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(sGeo, sMat));
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 0.85);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
  ctx = { renderer, scene, camera, pivot, composer, bloom, orange, cyan, sGeo, sMat, pos, vel, N, seed, dom, gltf: null, loading: null };
}

function loadModel(glbUrl) {
  if (ctx.gltf) return Promise.resolve();
  if (ctx.loading) return ctx.loading;
  ctx.loading = new Promise((res, rej) => {
    new GLTFLoader().load(glbUrl, g => {
      const root = g.scene; // MATÉRIAU INTACT — on ne touche à rien
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const scale = 2.6 / (Math.max(size.x, size.y, size.z) || 1);
      root.position.sub(center);
      const wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(scale);
      const depth = (size.z * scale) || 0.2;
      const back = wrap.clone(true);
      wrap.position.z = depth / 2; back.position.z = -depth / 2; back.rotation.y = Math.PI;
      ctx.pivot.add(wrap); ctx.pivot.add(back); ctx.gltf = g; res();
    }, undefined, e => rej(e));
  });
  return ctx.loading;
}

function applyEnergy(e) {
  ctx.bloom.strength = 0.10 + 2.6 * e;
  ctx.orange.intensity = 5 + 70 * e; ctx.cyan.intensity = 5 + 70 * e;
  ctx.sMat.opacity = Math.min(1, e * 1.25); ctx.sMat.size = 0.03 + 0.05 * e;
}

export function play({ imageUrl, fallbackUrl, glbUrl = DEFAULT_GLB, onDone } = {}) {
  if (!ctx) initCtx();
  const { dom } = ctx;
  dom.img.onerror = () => { dom.img.onerror = null; if (fallbackUrl) dom.img.src = fallbackUrl; };
  dom.img.src = imageUrl || fallbackUrl || 'assets/HASHBYTE.png';
  dom.root.style.display = 'block';
  dom.flash.style.transition = 'none'; dom.flash.style.opacity = 0;
  dom.reveal.style.opacity = 0; dom.reveal.style.transform = 'scale(.85)';
  loadModel(glbUrl).then(() => runTimeline(onDone)).catch(() => finish(onDone)); // si GLB échoue → on clôt proprement
}

function runTimeline(onDone) {
  const c = ctx; let phase = 'intro', t0 = performance.now(), windT0 = 0, spinT0 = 0, last = t0;
  c.pivot.rotation.y = 0; c.renderer.toneMappingExposure = 0.08; c.camera.position.set(0, 0, CAM_FAR); applyEnergy(0.04);
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = 0; i < c.N; i++) { c.pos[i*3]+=c.vel[i].x*dt; c.pos[i*3+1]+=c.vel[i].y*dt; c.pos[i*3+2]+=c.vel[i].z*dt;
      if (Math.hypot(c.pos[i*3],c.pos[i*3+1],c.pos[i*3+2]) > 2.6) c.seed(i); }
    c.sGeo.attributes.position.needsUpdate = true;
    if (phase === 'intro') {
      const k = Math.min((now - t0)/1000/INTRO_DUR, 1), e = easeOut(k);
      c.camera.position.z = CAM_FAR + (CAM_NEAR - CAM_FAR) * e; c.camera.lookAt(0,0,0);
      c.renderer.toneMappingExposure = 0.08 + (1.15 - 0.08) * e;
      c.pivot.rotation.y = 0.15 * e; applyEnergy(0.04 + 0.04 * e);
      if (k >= 1) { phase = 'wind'; windT0 = now; }
    } else if (phase === 'wind') {
      const t = (now - windT0)/1000;
      c.pivot.rotation.y = 0.15 + WIND_AMP * Math.sin((t/WIND_DUR) * Math.PI * 2 * 2);
      applyEnergy(0.08 + 0.20 * (t/WIND_DUR));
      if (t >= WIND_DUR) { phase = 'spin'; spinT0 = now; }
    } else if (phase === 'spin') {
      const t = (now - spinT0)/1000, k = Math.min(t/SPIN_DUR, 1);
      c.pivot.rotation.y += (0.8 + 24 * (k*k)) * dt; applyEnergy(0.28 + 0.72 * (k*k));
      if (t >= SPIN_DUR) { phase = 'flash'; doFlash(onDone); }
    }
    c.composer.render();
    if (phase !== 'done') requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  function doFlash(cb) {
    c.dom.flash.style.transition = 'opacity .18s ease-out'; c.dom.flash.style.opacity = 1;
    setTimeout(() => {
      c.dom.reveal.style.opacity = 1; c.dom.reveal.style.transform = 'scale(1)';
      c.dom.flash.style.transition = 'opacity .8s ease-in'; c.dom.flash.style.opacity = 0;
      phase = 'done';
      setTimeout(() => finish(cb), 1800); // tenir le reveal ~1.8s puis fermer
    }, 200);
  }
}

function finish(onDone) {
  if (ctx && ctx.dom) { ctx.dom.root.style.display = 'none'; ctx.dom.reveal.style.opacity = 0; ctx.dom.reveal.style.transform = 'scale(.85)'; }
  if (typeof onDone === 'function') onDone();
}

if (typeof window !== 'undefined') window.FA_TOTEM_CINE = { play };
```

- [ ] **Step 2 : Câbler `index.html`** — ajouter, dans `<head>` (avant la fermeture `</head>`), l'importmap ; et juste après le `<script src="totem-ui.js?v=30"></script>` (ligne 50), le module :

Dans `<head>` :
```html
  <script type="importmap">
  { "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }}
  </script>
```
Après `totem-ui.js` :
```html
  <script type="module" src="totem-cine.js?v=30"></script>
```

- [ ] **Step 3 : Vérifier (manuel, navigateur)**

Serveur local (`python -m http.server 8123 --bind 127.0.0.1`), puis dans la console de `http://127.0.0.1:8123/` (après connexion d'un wallet ou non) exécuter :
```js
FA_TOTEM_CINE.play({ imageUrl: "assets/GENESIS.png", fallbackUrl: "assets/HASHBYTE.png", onDone: () => console.log("cine done") });
```
Expected : la cinématique complète se joue (émergence → 2 allers-retours → accélération+crescendo+étincelles → flash → reveal de GENESIS.png), puis l'overlay se ferme et `"cine done"` s'affiche. Identique au prototype validé.

- [ ] **Step 4 : Commit**

```bash
git add totem-cine.js index.html
git commit -m "feat(totem): cinématique 3D totem-cine.js (window.FA_TOTEM_CINE) + importmap three.js"
```

---

### Task 5 : Action `invokeTotem` + bouton « Invoquer »

**Files:**
- Modify: `app.jsx` (action `invokeTotem` dans le `useMemo` des actions) ; `link.jsx` (bouton)

**Interfaces:**
- Consumes : `window.FA_TOTEM_CINE.play`, `window.FA_TOTEM_UI`, `g.totem` (`canInvoke`, `tier`, `artByTier`, `displayArtUrl`), `gRef.current.authToken`, pattern auth/401.
- Produces : `actions.invokeTotem(tier)` → `Promise` ; POST `/totem/invoke {wallet,tier}` authentifié ; en cas de succès, `setG(s => ({...s, totem: <réponse>}))`.

- [ ] **Step 1 : Ajouter l'action dans `app.jsx`** — dans l'objet d'actions du `useMemo` (à côté de `setView`, `buyBoost`, etc.), ajouter :

```js
    async invokeTotem(tier) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      const doPost = async () => fetch(`${API_URL}/totem/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gRef.current.authToken}` },
        body: JSON.stringify({ wallet: s.wallet, tier }),
      });
      let resp = await doPost();
      if (resp.status === 401) { const re = await actions.authenticate(s.wallet); if (!re) return { ok: false }; resp = await doPost(); }
      if (!resp.ok) return { ok: false };
      const totem = await resp.json();
      setG((st) => ({ ...st, totem }));
      return { ok: true };
    },
```

- [ ] **Step 2 : Ajouter le bouton dans `link.jsx`** — dans le composant `Link`, juste après le bloc `<img>`/infos et avant la liste `<ul>`, insérer :

```jsx
      {t && t.canInvoke && (
        <button
          style={{ margin:"8px 0", padding:"12px 18px", fontWeight:800, fontSize:16,
                   background:"linear-gradient(90deg,#F7931A,#00F0FF)", color:"#05070f",
                   border:"none", borderRadius:10, cursor:"pointer" }}
          onClick={() => {
            const TU = window.FA_TOTEM_UI;
            const img = (t.artByTier && t.artByTier[t.tier]) || TU.totemArtFallback(t.type);
            const tier = t.tier;
            window.FA_TOTEM_CINE.play({
              imageUrl: img,
              fallbackUrl: TU.totemArtFallback(t.type),
              onDone: () => actions.invokeTotem(tier),
            });
          }}
        >{I18N.t("TOTEM_INVOKE_BTN")}</button>
      )}
```

- [ ] **Step 3 : Vérifier (manuel, navigateur)**

Avec un wallet dont le serveur renvoie `canInvoke:true` (palier ≥ 1, art `done`, non révélé) : aller dans l'écran « Lien » → le bouton **« ✨ Invoquer mon Totem »** apparaît → clic → la cinématique se joue → à la fin, `POST /totem/invoke` part (vérifier l'onglet Réseau : 200) → `g.totem` se met à jour (`revealedTier` monte, le bouton disparaît). Si le serveur n'est pas déployé, simuler en mockant la réponse, OU vérifier seulement le déclenchement de la cinématique. (La vérif réseau réelle se fera au déploiement de la Partie A.)

- [ ] **Step 4 : Commit**

```bash
git add app.jsx link.jsx
git commit -m "feat(totem): bouton Invoquer (gated canInvoke) → cinématique → POST /totem/invoke"
```

---

### Task 6 : Galerie cosmétique + action `pickTotemImage`

**Files:**
- Modify: `app.jsx` (action `pickTotemImage`) ; `link.jsx` (galerie)

**Interfaces:**
- Consumes : `window.FA_TOTEM_UI.galleryItems(t)`, `g.totem` (`displayTier`, `artByTier`, `revealedTier`), auth pattern.
- Produces : `actions.pickTotemImage(tier)` → POST `/totem/display {wallet,tier}` authentifié, `setG(s => ({...s, totem: <réponse>}))`.

- [ ] **Step 1 : Ajouter l'action dans `app.jsx`** — à côté de `invokeTotem` :

```js
    async pickTotemImage(tier) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      const doPost = async () => fetch(`${API_URL}/totem/display`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gRef.current.authToken}` },
        body: JSON.stringify({ wallet: s.wallet, tier }),
      });
      let resp = await doPost();
      if (resp.status === 401) { const re = await actions.authenticate(s.wallet); if (!re) return { ok: false }; resp = await doPost(); }
      if (!resp.ok) return { ok: false };
      const totem = await resp.json();
      setG((st) => ({ ...st, totem }));
      return { ok: true };
    },
```

- [ ] **Step 2 : Ajouter la galerie dans `link.jsx`** — après la liste `<ul>` et avant le bouton « Retour », insérer :

```jsx
      {(() => {
        const TU = window.FA_TOTEM_UI;
        const items = TU.galleryItems(t);
        if (items.length < 2) return null;   // galerie utile à partir de 2 images révélées
        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700 }}>{I18N.t("TOTEM_GALLERY_TITLE")}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{I18N.t("TOTEM_GALLERY_COSMETIC")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {items.map(it => (
                <img key={it.tier} alt={TU.tierName(it.tier)} src={it.url}
                     onClick={() => actions.pickTotemImage(it.tier)}
                     style={{ width: 64, height: 64, borderRadius: 8, cursor: "pointer",
                              border: (t.displayTier === it.tier) ? "2px solid var(--gold,#F7931A)" : "2px solid transparent" }} />
              ))}
            </div>
          </div>
        );
      })()}
```

- [ ] **Step 3 : Vérifier (manuel, navigateur)**

Avec un wallet ayant ≥ 2 paliers révélés (`artByTier` à 2+ entrées, `revealedTier ≥ 2`) : écran « Lien » → la **galerie** affiche les vignettes ; clic sur une vignette → `POST /totem/display` (Réseau : 200) → `g.totem.displayTier` change → la bordure dorée se déplace, et le grand visuel + le slot Capitaine adoptent l'image choisie (via `totemArt` qui privilégie `displayArtUrl`). Les stats affichées (palier/aura) **ne changent pas**. (Vérif réseau réelle au déploiement Partie A.)

- [ ] **Step 4 : Commit**

```bash
git add app.jsx link.jsx
git commit -m "feat(totem): galerie cosmétique → POST /totem/display (image affichée ≠ puissance)"
```

---

## Self-Review

**1. Spec coverage (Partie B) :**
- Cinématique (émergence/zoom/wind/crescendo/étincelles/flash/reveal, recto-verso, matériau intact) → Task 4 (porté du prototype validé) ✅
- Bouton « Invoquer » gated `canInvoke` + préchargement image (la cinématique précharge `img.src`) + POST invoke → Task 5 ✅
- Galerie cosmétique (choisir l'image, stats inchangées) + POST display → Task 6 ✅
- `displayArtUrl` consommé (slot + écran Lien via `totemArt`) → Task 1 ✅
- i18n FR/EN/ZH → Task 2 ✅
- Optimisation GLB (48 Mo trop lourd) → Task 3 ✅
- three.js en dépendance (importmap, pas de bundler) → Task 4 ✅
- Anti-P2W (image ≠ puissance) → galerie cosmétique, aucune stat dérivée de displayTier ✅

**2. Placeholder scan :** aucun TODO/TBD ; code complet pour chaque step. Les vérifs des tâches 4–6 sont **manuelles** (navigateur) car visuelles/réseau — explicitement marquées, pas des placeholders.

**3. Type consistency :** `totemArt(t)`/`galleryItems(t)` (Task 1) consommés par `link.jsx` (Tasks 5/6) et le slot ; `window.FA_TOTEM_CINE.play({imageUrl,fallbackUrl,onDone})` (Task 4) appelé identiquement par le bouton (Task 5) ; `actions.invokeTotem(tier)`/`pickTotemImage(tier)` (Tasks 5/6) renvoient `{ok}` et font `setG(...totem)` ; clés i18n (Task 2) utilisées par `link.jsx`. Champs serveur (`canInvoke`, `artByTier`, `displayArtUrl`, `displayTier`, `revealedTier`) = ceux produits par la Partie A. Cohérent.

**Note exécution :** Tasks 1–2 = TDD pur (subagent OK). Tasks 3–6 = tooling/visuel/réseau → **vérification manuelle navigateur** ; exécution **inline** recommandée (serveur local + œil humain). La vérif réseau réelle des POST nécessite la Partie A **déployée** (sinon mock/observation du déclenchement seulement).
