// totem-cine.js — cinématique d'invocation du Totem (module ESM, three.js).
// Exposé via window.FA_TOTEM_CINE.play({ imageUrl, fallbackUrl, glbUrl?, onDone? }).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Médaillon = jeton FA+FB (assets/jeton.glb). Versionné via FA_ASSET_URL (data.js) :
// une URL nue reste servie par le CDN longtemps après que le fichier a changé.
const DEFAULT_GLB = (typeof window !== 'undefined' && window.FA_ASSET_URL)
  ? window.FA_ASSET_URL('assets/jeton.glb') : 'assets/jeton.glb';
const INTRO_DUR = 1.5, WIND_DUR = 4.5, WIND_TURNS = 3, SPIN_DUR = 2.8;
const CAM_FAR = 9.5, CAM_NEAR = 5.6;
const easeOut = x => 1 - Math.pow(1 - x, 3);

// Aberration chromatique maison (le vendor ne fournit pas RGBShiftShader) :
// frange rouge/cyan radiale autour du centre, pilotée par `amount`.
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform vec2 uCenter;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - uCenter;
      vec2 off = dir * amount;
      float r = texture2D(tDiffuse, vUv - off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + off).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

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
  img.style.cssText = 'max-width:min(42vw,42vh);max-height:min(42vw,42vh);border-radius:14px;box-shadow:0 0 30px rgba(0,240,255,.3);';
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
  // onde de choc : anneau qui éclate du médaillon au flash
  const ringGeo = new THREE.TorusGeometry(1, 0.02, 16, 80);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.renderOrder = 999; scene.add(ring);
  // composer : render → bloom → aberration chromatique → output
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 0.85);
  composer.addPass(bloom);
  const ca = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(ca);
  composer.addPass(new OutputPass());
  addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
  ctx = { renderer, scene, camera, pivot, composer, bloom, ca, orange, cyan, sGeo, sMat, pos, vel, N, seed, dom, ring, ringMat, ringT0: 0, energy: 0, gltf: null, loading: null };
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
      ctx.pivot.add(wrap); ctx.gltf = g; res();
    }, undefined, e => rej(e));
  });
  return ctx.loading;
}

function applyEnergy(e) {
  ctx.energy = e;
  ctx.bloom.strength = 0.10 + 2.6 * e;
  ctx.orange.intensity = 5 + 70 * e; ctx.cyan.intensity = 5 + 70 * e;
  ctx.sMat.opacity = Math.min(1, e * 1.25); ctx.sMat.size = 0.03 + 0.05 * e;
  // aberration chromatique : nulle au repos, crescendo pendant le spin (pic ~0.006)
  ctx.ca.uniforms.amount.value = e > 0.3 ? (e - 0.3) * 0.008 : 0;
}

function finish(onDone) {
  if (ctx) ctx.running = false; // stoppe la boucle de rendu
  if (ctx && ctx.dom) { ctx.dom.root.style.display = 'none'; ctx.dom.reveal.style.opacity = 0; ctx.dom.reveal.style.transform = 'scale(.85)'; }
  if (typeof onDone === 'function') onDone();
}

function runTimeline(onDone) {
  const c = ctx; let phase = 'intro', t0 = performance.now(), windT0 = 0, spinT0 = 0, settleT0 = 0, last = t0;
  c.running = true;
  c.pivot.rotation.y = 0; c.renderer.toneMappingExposure = 0.08; c.camera.position.set(0, 0, CAM_FAR); c.camera.lookAt(0, 0, 0); applyEnergy(0.04);
  function burstSparks() { for (let i = 0; i < c.N; i++) c.seed(i); }
  function doFlash(cb) {
    // le médaillon tourne ENCORE (phase 'flash') pendant que le blanc monte → jamais figé à l'écran.
    c.dom.flash.style.transition = 'opacity .16s ease-out'; c.dom.flash.style.opacity = 1;
    // onde de choc + bouffée d'étincelles au pic
    c.ring.scale.setScalar(0.2); c.ringMat.opacity = 0.9; c.ringT0 = performance.now();
    burstSparks();
    // image prête à pleine opacité tout de suite, MASQUÉE par le blanc (flash z au-dessus du reveal).
    c.dom.reveal.style.transition = 'none';
    c.dom.reveal.style.opacity = 1; c.dom.reveal.style.transform = 'scale(1)';
    setTimeout(() => {
      // le blanc s'estompe → l'image (réduite) apparaît, le médaillon REVIENT en rotation lente
      c.dom.flash.style.transition = 'opacity .55s ease-in'; c.dom.flash.style.opacity = 0;
      phase = 'settle'; settleT0 = performance.now();
      setTimeout(() => finish(cb), 3200);
    }, 170);
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = 0; i < c.N; i++) {
      const ix = i * 3;
      c.pos[ix]   += c.vel[i].x * dt;
      c.pos[ix+1] += c.vel[i].y * dt;
      c.pos[ix+2] += c.vel[i].z * dt;
      // tourbillon autour de l'axe Y + aspiration vers le médaillon (scalés par l'énergie)
      const sx = c.pos[ix], sz = c.pos[ix+2];
      const rXZ = Math.hypot(sx, sz) + 1e-4;
      const swirl = (0.5 + 3.5 * c.energy) * dt;
      c.pos[ix]   += (-sz / rXZ) * swirl;
      c.pos[ix+2] += ( sx / rXZ) * swirl;
      const pull = 1.2 * c.energy * dt;
      c.pos[ix]   -= (sx / rXZ) * pull;
      c.pos[ix+2] -= (sz / rXZ) * pull;
      if (Math.hypot(c.pos[ix], c.pos[ix+1], c.pos[ix+2]) > 2.6) c.seed(i);
    }
    c.sGeo.attributes.position.needsUpdate = true;
    // onde de choc : expansion + fondu
    if (c.ringT0) {
      const t = (now - c.ringT0) / 1000;
      if (t >= 0.7) { c.ringT0 = 0; c.ringMat.opacity = 0; }
      else { c.ring.scale.setScalar(0.2 + t * 6); c.ringMat.opacity = 0.9 * (1 - t / 0.7); }
    }
    if (phase === 'intro') {
      const k = Math.min((now - t0)/1000/INTRO_DUR, 1), e = easeOut(k);
      c.camera.position.z = CAM_FAR + (CAM_NEAR - CAM_FAR) * e; c.camera.lookAt(0,0,0);
      c.renderer.toneMappingExposure = 0.08 + (1.15 - 0.08) * e;
      c.pivot.rotation.y = 0.15 * e; applyEnergy(0.04 + 0.04 * e);
      if (k >= 1) { phase = 'wind'; windT0 = now; }
    } else if (phase === 'wind') {
      const t = (now - windT0)/1000, k = Math.min(t / WIND_DUR, 1);
      // quelques tours complets (rotation continue) avant l'accélération du spin
      c.pivot.rotation.y = 0.15 + WIND_TURNS * Math.PI * 2 * k;
      // dérive caméra lente (arc) pendant la rotation
      c.camera.position.x = Math.sin((t / WIND_DUR) * Math.PI * 2) * 0.5;
      c.camera.position.y = Math.sin((t / WIND_DUR) * Math.PI * 4) * 0.25;
      c.camera.lookAt(0, 0, 0);
      applyEnergy(0.08 + 0.20 * (t/WIND_DUR));
      if (t >= WIND_DUR) { phase = 'spin'; spinT0 = now; }
    } else if (phase === 'spin') {
      const t = (now - spinT0)/1000, k = Math.min(t/SPIN_DUR, 1);
      c.pivot.rotation.y += (WIND_TURNS * Math.PI * 2 / WIND_DUR + 20 * (k*k)) * dt; // continue la vitesse du wind puis accélère
      // léger push-in + tremblement de caméra pendant le crescendo
      c.camera.position.x = (Math.random() - 0.5) * 0.06 * (k * k);
      c.camera.position.y = (Math.random() - 0.5) * 0.06 * (k * k);
      c.camera.position.z = CAM_NEAR - 0.6 * k;
      c.camera.lookAt(0, 0, 0);
      applyEnergy(0.28 + 0.72 * (k*k));
      if (t >= SPIN_DUR) { phase = 'flash'; doFlash(onDone); }
    } else if (phase === 'flash') {
      c.pivot.rotation.y += 24 * dt; // continue de tourner vite jusqu'à être masqué par le blanc (jamais figé)
    } else if (phase === 'settle') {
      // le médaillon revient à sa rotation lente de début (vitesse du wind), caméra recentrée, énergie apaisée
      c.pivot.rotation.y += (WIND_TURNS * Math.PI * 2 / WIND_DUR) * dt;
      c.camera.position.x += (0 - c.camera.position.x) * 0.08;
      c.camera.position.y += (0 - c.camera.position.y) * 0.08;
      c.camera.position.z += (CAM_NEAR - c.camera.position.z) * 0.06;
      c.camera.lookAt(0, 0, 0);
      applyEnergy(0.12);
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
  dom.img.src = imageUrl || fallbackUrl || 'assets/HASHBYTE.webp';
  if (dom.img.decode) dom.img.decode().catch(() => {}); // décode l'image AVANT le reveal → pas d'à-coup
  dom.root.style.display = 'block';
  dom.flash.style.transition = 'none'; dom.flash.style.opacity = 0;
  dom.reveal.style.opacity = 0; dom.reveal.style.transform = 'scale(.85)';
  loadModel(glbUrl).then(() => runTimeline(onDone)).catch(() => finish(onDone));
}

if (typeof window !== 'undefined') window.FA_TOTEM_CINE = { play };
