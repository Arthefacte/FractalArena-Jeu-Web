// relic-models.js — chargement + cache + instances teintées des modèles de reliques.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(function () {
  const A = window.FA_RELIC_ASSETS;
  const loader = new GLTFLoader();
  const _loaded = {};   // type -> THREE.Group (normalisé, matériaux d'origine)
  const _loading = {};  // type -> Promise
  const _failed = {};   // type -> true (échec mémorisé, pas de re-fetch)

  // Centre le modèle sur l'origine et le met à l'échelle pour tenir dans une boîte ~2 unités.
  function _normalize(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.position.sub(center);
    const s = 2 / maxDim;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(s);
    return wrap;
  }

  function loadModel(type) {
    if (_loaded[type] || _failed[type]) return Promise.resolve();
    if (_loading[type]) return _loading[type];
    _loading[type] = new Promise((resolve) => {
      loader.load(
        A.path(type),
        (gltf) => {
          _loaded[type] = _normalize(gltf.scene);
          delete _loading[type];
          window.dispatchEvent(new CustomEvent("fa:relic-model-ready", { detail: { type } }));
          resolve();
        },
        undefined,
        () => { delete _loading[type]; _failed[type] = true; resolve(); } // échec mémorisé → repli, pas de re-fetch
      );
    });
    return _loading[type];
  }

  function preload() { A.TYPES.forEach(loadModel); }
  function isReady(type) { return !!_loaded[type]; }

  // Clone le modèle + ses matériaux, applique le glow de rareté (préserve la couleur/texture).
  function makeInstance(type, rarity) {
    if (!_loaded[type]) throw new Error("relic model not ready: " + type);
    const inst = _loaded[type].clone(true);
    const glow = A.RARITY_GLOW[rarity] || A.RARITY_GLOW.Common;
    inst.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const wasArray = Array.isArray(o.material);
      const mats = wasArray ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        if (c.emissive) { c.emissive = new THREE.Color(glow.color); c.emissiveIntensity = glow.intensity; }
        return c;
      });
      o.material = wasArray ? cloned : cloned[0];
    });
    return inst;
  }

  window.FA_RELIC_MODELS = { preload, isReady, makeInstance, loadModel };
})();
