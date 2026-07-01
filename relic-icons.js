// relic-icons.js — icônes 3D des reliques (Three.js), renderer partagé + cache vignettes.
// Exposé via window.FA_RELIC_ICON.get(type, rarity, size) -> dataURL | null (null = repli pastille).
import * as THREE from 'three';
(function () {
  const CACHE = new Map();               // "type|rarity|size" -> dataURL
  const RARITY_HEX = { Common: 0x9CA3AF, Rare: 0x3B82F6, Epic: 0xB026FF, Legendary: 0xF7931A };
  let renderer = null, scene = null, camera = null, key = null, amb = null, ok = true;

  function geoFor(type) {
    switch (type) {
      case 'ruby_shard':     return new THREE.OctahedronGeometry(1);
      case 'sapphire_plate': return new THREE.BoxGeometry(1.3, 1.3, 0.55);
      case 'quartz_lens':    return new THREE.IcosahedronGeometry(1);
      case 'amber_cell':     return new THREE.DodecahedronGeometry(1);
      case 'cobalt_spring':  return new THREE.TorusGeometry(0.75, 0.3, 14, 28);
      case 'onyx_membrane':  return new THREE.TetrahedronGeometry(1.25);
      case 'jade_circuit':   return new THREE.TorusKnotGeometry(0.6, 0.22, 80, 10);
      case 'prism_matrix':   return new THREE.ConeGeometry(1, 1.7, 6);
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
      return true;
    } catch (e) { ok = false; return false; }
  }
  function get(type, rarity, size) {
    size = size || 56;
    if (!ok) return null;
    const k = type + '|' + rarity + '|' + size;
    if (CACHE.has(k)) return CACHE.get(k);
    if (!init()) return null;
    try {
      renderer.setSize(size, size);
      const hex = RARITY_HEX[rarity] || 0x9CA3AF;
      const geo = geoFor(type);
      const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.25 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(0.5, 0.7, 0);
      scene.add(mesh);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh); geo.dispose(); mat.dispose();
      CACHE.set(k, url);
      return url;
    } catch (e) { ok = false; return null; }
  }
  window.FA_RELIC_ICON = { get };
})();
