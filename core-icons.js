// core-icons.js — vignettes des cores : modèle .glb si prêt, sinon primitive (repli).
import * as THREE from "three";
(function () {
  const CACHE = new Map();               // "type|rarity|size" -> dataURL (modèle uniquement)
  const RARITY_HEX = { Common: 0x9CA3AF, Rare: 0x3B82F6, Epic: 0xB026FF, Legendary: 0xF7931A };
  let renderer = null, scene = null, camera = null, key = null, amb = null, rar = null, ok = true;

  function geoFor(type) {
    switch (type) {
      case "fury_core":      return new THREE.OctahedronGeometry(1);
      case "guardian_core":  return new THREE.IcosahedronGeometry(1);
      case "overclock_core": return new THREE.TorusGeometry(0.75, 0.3, 14, 28);
      case "regen_core":     return new THREE.SphereGeometry(1, 24, 16);
      case "feedback_core":  return new THREE.ConeGeometry(1, 1.7, 6);
      case "last_stand_core": return new THREE.BoxGeometry(1.2, 1.2, 1.2);
      default:               return new THREE.OctahedronGeometry(1);
    }
  }

  function init() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 4);
      key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 4); scene.add(key);
      amb = new THREE.AmbientLight(0xffffff, 0.55); scene.add(amb);
      // Lampe de rareté : elle ne sert QUE pour les modèles dont le matériau ne
      // canalise pas le halo (pas d'emissiveMap). Repeindre leur émissif les
      // délavait ; une lumière colorée touche les reflets et laisse la texture
      // intacte. Éteinte par défaut, allumée le temps d'un rendu.
      // decay 0 : l'intensité ne dépend pas de la distance, donc le réglage se
      // lit tel quel (même correctif que relic-icons.js).
      rar = new THREE.PointLight(0xffffff, 0, 12); rar.decay = 0;
      rar.position.set(-1.6, 0.8, 2.2); scene.add(rar);
      return true;
    } catch (e) { ok = false; return false; }
  }

  function _renderObject(obj, size) {
    renderer.setSize(size, size);
    scene.add(obj);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    scene.remove(obj);
    if (rar) rar.intensity = 0;   // scène partagée : ne pas teinter le rendu suivant
    return url;
  }

  function _primitive(type, rarity) {
    const hex = RARITY_HEX[rarity] || 0x9CA3AF;
    const geo = geoFor(type);
    const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0.5, 0.7, 0);
    return { obj: mesh, dispose: () => { geo.dispose(); mat.dispose(); } };
  }

  function _model(type, rarity) {
    const inst = window.FA_CORE_MODELS.makeInstance(type, rarity);
    inst.rotation.set(0.35, 0.7, 0);
    // makeInstance n'a pas pu porter la rareté sur la matière : on la porte ici.
    // L'intensité suit la MÊME échelle que le halo émissif (RARITY_GLOW), ×8
    // pour passer de l'unité « emissiveIntensity » aux candelas.
    if (rar) {
      const tinted = inst.userData && inst.userData.rarityTinted;
      const glow = (window.FA_CORE_ASSETS.RARITY_GLOW[rarity]) || window.FA_CORE_ASSETS.RARITY_GLOW.Common;
      rar.color.setHex(glow.color);
      rar.intensity = tinted ? 0 : glow.intensity * 8;
    }
    const dispose = () => inst.traverse((o) => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m && m.dispose());
      }
    });
    return { obj: inst, dispose };
  }

  function get(type, rarity, size) {
    size = size || 56;
    if (!ok) return null;
    const k = type + "|" + rarity + "|" + size;
    if (CACHE.has(k)) return CACHE.get(k);
    if (!init()) return null;

    const M = window.FA_CORE_MODELS;
    try {
      if (M && M.isReady(type)) {
        const { obj, dispose } = _model(type, rarity);
        const url = _renderObject(obj, size);
        dispose();
        CACHE.set(k, url);          // seul le rendu modèle est mis en cache définitivement
        return url;
      }
      if (M) M.loadModel(type);     // lance le chargement ; re-render à l'event ready
      const { obj, dispose } = _primitive(type, rarity);
      const url = _renderObject(obj, size);
      dispose();
      return url;                    // repli non caché
    } catch (e) { return null; }     // erreur ponctuelle → pastille pour cet appel, ne pas tuer le renderer partagé
  }

  // Pas de préchargement au boot (même raison que relic-icons.js) : les écrans
  // qui montrent des cores appellent FA_CORE_MODELS.preloadWhenIdle() ; à défaut,
  // get() charge à la demande et affiche un repli en attendant.
  window.FA_CORE_ICON = { get };
})();
