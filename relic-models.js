// relic-models.js — chargement + cache + instances teintées des modèles de reliques.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

(function () {
  const A = window.FA_RELIC_ASSETS;
  const loader = new GLTFLoader();
  // Les .glb des reliques sont compressés en EXT_meshopt_compression (gltf-transform) :
  // sans ce décodeur, GLTFLoader échoue au chargement → repli primitive. Requis.
  loader.setMeshoptDecoder(MeshoptDecoder);
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

  // Préchargement des écrans qui affichent une grille de reliques : utile pour
  // éviter huit replis qui clignotent, mais jamais au prix d'un rendu en cours.
  // requestIdleCallback attend que le navigateur n'ait plus rien d'urgent à faire ;
  // appelable autant de fois qu'on veut, loadModel dédoublonne.
  let _idle = null;
  function preloadWhenIdle() {
    if (_idle !== null) return;
    const differer = (typeof requestIdleCallback === "function")
      ? requestIdleCallback
      : (fn) => setTimeout(fn, 1200); // Safari : pas d'idle callback
    _idle = differer(() => { _idle = null; preload(); });
  }
  function isReady(type) { return !!_loaded[type]; }

  // Clone le modèle + ses matériaux, applique le glow de rareté (préserve la couleur/texture).
  //
  // Le halo est MULTIPLIÉ par l'emissiveMap : là où elle existe, il n'allume que
  // les zones prévues par l'artiste (veines, circuits). Là où elle MANQUE, il
  // s'étale uniformément sur toute la surface et délave le modèle — voile blanc
  // signalé sur la Membrane d'Onyx le 2026-08-20, où, le modèle étant noir, le
  // halo devenait la seule chose visible. Trois des huit .glb sont dans ce cas :
  // sapphire_plate, cobalt_spring, onyx_membrane.
  //
  // On ne repeint donc pas la matière de ceux-là. makeInstance signale le cas
  // (`tinted`) pour que l'appelant porte la rareté autrement — la vignette le
  // fait avec sa lumière d'appoint, qui touche les reflets sans laver la texture.
  function makeInstance(type, rarity) {
    if (!_loaded[type]) throw new Error("relic model not ready: " + type);
    const inst = _loaded[type].clone(true);
    const glow = A.RARITY_GLOW[rarity] || A.RARITY_GLOW.Common;
    let tinted = false;
    inst.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const wasArray = Array.isArray(o.material);
      const mats = wasArray ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        if (c.emissive && c.emissiveMap) {
          c.emissive = new THREE.Color(glow.color);
          c.emissiveIntensity = glow.intensity;
          tinted = true;
        }
        return c;
      });
      o.material = wasArray ? cloned : cloned[0];
    });
    inst.userData.rarityTinted = tinted;
    return inst;
  }

  window.FA_RELIC_MODELS = { preload, preloadWhenIdle, isReady, makeInstance, loadModel };
})();
