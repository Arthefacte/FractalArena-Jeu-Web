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
  root.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9990;display:none;';
  const flash = document.createElement('div');
  // blanc PLEIN écran (opaque) → masque totalement le médaillon au pic ; z au-dessus du reveal
  flash.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:9996;background:radial-gradient(circle at 50% 50%,#ffffff 0%,#eaf4ff 62%,#bfe0ff 100%);';
  const reveal = document.createElement('div');
  reveal.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;z-index:9995;transition:opacity .9s ease,transform .9s ease;transform:scale(.85);';
  const img = document.createElement('img');
  img.style.cssText = 'max-width:min(80vw,80vh);max-height:min(80vw,80vh);border-radius:14px;box-shadow:0 0 30px rgba(0,240,255,.3);';
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

function finish(onDone) {
  if (ctx) ctx.running = false; // stoppe la boucle de rendu
  if (ctx && ctx.dom) { ctx.dom.root.style.display = 'none'; ctx.dom.reveal.style.opacity = 0; ctx.dom.reveal.style.transform = 'scale(.85)'; }
  if (typeof onDone === 'function') onDone();
}

function runTimeline(onDone) {
  const c = ctx; let phase = 'intro', t0 = performance.now(), windT0 = 0, spinT0 = 0, last = t0;
  c.running = true;
  c.pivot.rotation.y = 0; c.renderer.toneMappingExposure = 0.08; c.camera.position.set(0, 0, CAM_FAR); applyEnergy(0.04);
  function doFlash(cb) {
    // le médaillon tourne ENCORE (phase 'flash') pendant que le blanc monte → jamais figé à l'écran.
    c.dom.flash.style.transition = 'opacity .16s ease-out'; c.dom.flash.style.opacity = 1;
    // image prête à pleine opacité tout de suite, MASQUÉE par le blanc (flash z au-dessus du reveal).
    c.dom.reveal.style.transition = 'none';
    c.dom.reveal.style.opacity = 1; c.dom.reveal.style.transform = 'scale(1)';
    setTimeout(() => {
      // écran tout blanc : on coupe le 3D et on masque le canvas → le médaillon disparaît DANS le blanc.
      c.running = false;
      c.renderer.domElement.style.display = 'none';
      // le blanc s'estompe → l'image apparaît dessous, nette, sans médaillon figé derrière.
      c.dom.flash.style.transition = 'opacity .55s ease-in'; c.dom.flash.style.opacity = 0;
      phase = 'done';
      setTimeout(() => finish(cb), 2800); // tenir l'image bien plus longtemps
    }, 170);
  }
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
    } else if (phase === 'flash') {
      c.pivot.rotation.y += 24 * dt; // continue de tourner vite jusqu'à être masqué par le blanc (jamais figé)
    }
    c.composer.render();
    if (c.running) requestAnimationFrame(tick); // on continue de rendre PENDANT le flash + le reveal (pas de gel)
  }
  requestAnimationFrame(tick);
}

export function play({ imageUrl, fallbackUrl, glbUrl = DEFAULT_GLB, onDone } = {}) {
  if (!ctx) initCtx();
  const { dom } = ctx;
  ctx.renderer.domElement.style.display = ''; // ré-affiche le canvas (un play précédent a pu le cacher)
  dom.img.onerror = () => { dom.img.onerror = null; if (fallbackUrl) dom.img.src = fallbackUrl; };
  dom.img.src = imageUrl || fallbackUrl || 'assets/HASHBYTE.png';
  if (dom.img.decode) dom.img.decode().catch(() => {}); // décode l'image AVANT le reveal → pas d'à-coup
  dom.root.style.display = 'block';
  dom.flash.style.transition = 'none'; dom.flash.style.opacity = 0;
  dom.reveal.style.opacity = 0; dom.reveal.style.transform = 'scale(.85)';
  loadModel(glbUrl).then(() => runTimeline(onDone)).catch(() => finish(onDone));
}

if (typeof window !== 'undefined') window.FA_TOTEM_CINE = { play };
