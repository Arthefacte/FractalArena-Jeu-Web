// relic-viewer.jsx — viewer 3D interactif d'une relique (rotation auto + drag), dispose GPU strict.
function RelicViewer({ type, rarity, size }) {
  const px = size || 220;
  const ref = React.useRef(null);
  React.useEffect(() => {
    const THREE = window.__FA_THREE; // exposé par relic-viewer-boot (import module)
    if (!THREE || !window.FA_RELIC_MODELS) return;
    const mount = ref.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(px, px);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 4); scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    let obj = null, objIsPrimitive = false, raf = 0, dragging = false, lastX = 0, autoRot = true, disposed = false;
    function geoFor(t) {
      switch (t) {
        case "ruby_shard":     return new THREE.OctahedronGeometry(1);
        case "sapphire_plate": return new THREE.BoxGeometry(1.3, 1.3, 0.55);
        case "quartz_lens":    return new THREE.IcosahedronGeometry(1);
        case "amber_cell":     return new THREE.DodecahedronGeometry(1);
        case "cobalt_spring":  return new THREE.TorusGeometry(0.75, 0.3, 14, 28);
        case "onyx_membrane":  return new THREE.TetrahedronGeometry(1.25);
        case "jade_circuit":   return new THREE.TorusKnotGeometry(0.6, 0.22, 80, 10);
        case "prism_matrix":   return new THREE.ConeGeometry(1, 1.7, 6);
        default:               return new THREE.OctahedronGeometry(1);
      }
    }
    function mountObj() {
      obj = window.FA_RELIC_MODELS.makeInstance(type, rarity);
      objIsPrimitive = false;
      obj.rotation.set(0.3, 0.6, 0);
      scene.add(obj);
    }
    function mountPrimitive() {
      const hex = { Common: 0x9CA3AF, Rare: 0x3B82F6, Epic: 0xB026FF, Legendary: 0xF7931A }[rarity] || 0x9CA3AF;
      const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.25 });
      obj = new THREE.Mesh(geoFor(type), mat);
      objIsPrimitive = true;
      obj.rotation.set(0.3, 0.6, 0);
      scene.add(obj);
    }
    function unmountObj() {
      if (!obj) return;
      scene.remove(obj);
      obj.traverse((o) => {
        if (o.isMesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m && m.dispose());
          if (objIsPrimitive && o.geometry) o.geometry.dispose(); // primitive = géométrie propre → à disposer (le modèle partage la sienne avec le cache)
        }
      });
      obj = null;
    }
    function ensure() {
      if (window.FA_RELIC_MODELS.isReady(type)) { mountObj(); return; }
      // Repli synchrone : sans lui le canvas reste VIDE pendant tout le
      // chargement du .glb. Primitive tout de suite, remplacée par le modèle
      // dès qu'il est prêt (rotation conservée). Même logique que CoreViewer.
      mountPrimitive();
      window.FA_RELIC_MODELS.loadModel(type).then(() => {
        if (disposed || !window.FA_RELIC_MODELS.isReady(type)) return;
        const ry = obj ? obj.rotation.y : 0.6;
        unmountObj();
        mountObj();
        obj.rotation.y = ry;
      });
    }
    ensure();
    function loop() {
      raf = requestAnimationFrame(loop);
      if (obj && autoRot && !dragging) obj.rotation.y += 0.012;
      renderer.render(scene, camera);
    }
    loop();

    const el = renderer.domElement;
    const onDown = (e) => { dragging = true; autoRot = false; lastX = e.clientX; };
    const onMove = (e) => { if (dragging && obj) obj.rotation.y += (e.clientX - lastX) * 0.01, lastX = e.clientX; };
    const onUp = () => { dragging = false; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      unmountObj();
      renderer.dispose();
      renderer.forceContextLoss();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [type, rarity, px]);

  return <div ref={ref} style={{ width: px, height: px, margin: "0 auto" }} />;
}
window.RelicViewer = RelicViewer;
