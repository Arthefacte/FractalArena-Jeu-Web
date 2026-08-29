// core-viewer.jsx — viewer 3D interactif d'un core (rotation auto + drag), dispose GPU strict.
// Miroir de relic-viewer.jsx sur FA_CORE_MODELS ; réutilise window.__FA_THREE (relic-viewer-boot).
function CoreViewer({ type, rarity, size }) {
  const px = size || 220;
  const ref = React.useRef(null);
  React.useEffect(() => {
    const THREE = window.__FA_THREE; // exposé par relic-viewer-boot (import module)
    if (!THREE || !window.FA_CORE_MODELS) return;
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
        case "fury_core":       return new THREE.OctahedronGeometry(1);
        case "guardian_core":   return new THREE.IcosahedronGeometry(1);
        case "overclock_core":  return new THREE.TorusGeometry(0.75, 0.3, 14, 28);
        case "regen_core":      return new THREE.SphereGeometry(1, 24, 16);
        case "feedback_core":   return new THREE.ConeGeometry(1, 1.7, 6);
        case "last_stand_core": return new THREE.BoxGeometry(1.2, 1.2, 1.2);
        default:                return new THREE.OctahedronGeometry(1);
      }
    }
    function mountObj() {
      obj = window.FA_CORE_MODELS.makeInstance(type, rarity);
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
      if (window.FA_CORE_MODELS.isReady(type)) { mountObj(); return; }
      // Les .glb de cores font jusqu'à ~3 Mo : sans repli synchrone, le canvas
      // resterait VIDE pendant tout le chargement. Primitive tout de suite,
      // remplacée par le modèle dès qu'il est prêt (rotation conservée).
      mountPrimitive();
      window.FA_CORE_MODELS.loadModel(type).then(() => {
        if (disposed || !window.FA_CORE_MODELS.isReady(type)) return;
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
window.CoreViewer = CoreViewer;
