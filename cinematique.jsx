// Cinématique d'ouverture — portage fidèle du design Claude (Cinematique Ouverture.dc.html).
// Timeline 20 s : fond qui s'éveille, éclairs, lore décrypté, convergence, emblème 3D (Three.js
// + GLB), titre prismatique, CTA. Joue à chaque visite tant que le joueur n'est pas connecté.
// Exposé sur window.Cinematique ; intégré dans app.jsx (branche !g.wallet).
const { useState, useRef, useEffect, useCallback, useMemo } = React;

const CINE_DUR = 20.0;

// Libère TOUTES les ressources GPU d'une scène Three.js au démontage. Sans ça, le GLB
// (12 Mo, cloné ×2), le render target PMREM et les textures fuient en VRAM, et le contexte
// WebGL reste alloué → sur navigation répétée, perte de contexte (canvas 3D noir) et FPS qui
// s'effondrent, surtout sur mobile/GPU faible. `forceContextLoss` rend le slot de contexte.
function disposeThreeScene({ scene, envTex, pmrem, renderer }) {
  try {
    if (scene) scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        if (m.dispose) m.dispose();
      }
    });
    if (envTex) envTex.dispose();
    if (pmrem) pmrem.dispose();
    if (renderer) { renderer.forceContextLoss(); renderer.dispose(); }
  } catch (e) { /* best-effort cleanup */ }
}

// ——— helpers timeline (identiques au design) ———
function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
function lerp(a, b, p) { return a + (b - a) * p; }
function eOut(p) { return 1 - Math.pow(1 - p, 3); }
function eInOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
function spike(t, c, w) { const d = Math.abs(t - c); return d > w ? 0 : 1 - d / w; }

const SCRAMBLE_POOL = '0123456789ABCDEF<>/\\#$%&{}[]+=';
function scramble(text, p) {
  if (p <= 0) return text.replace(/[^ ]/g, () => SCRAMBLE_POOL[(Math.random() * SCRAMBLE_POOL.length) | 0]);
  if (p >= 1) return text;
  const n = text.length, front = p * (n + 3);
  let out = '';
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === ' ') out += ' ';
    else if (i < front - 2) out += ch;
    else out += SCRAMBLE_POOL[(Math.random() * SCRAMBLE_POOL.length) | 0];
  }
  return out;
}

// Calcule toutes les valeurs/styles animés pour un instant t donné (port de renderVals()).
function cineVals(t, opts) {
  const { accent, loreAnim, titleText, ctaText, tagline, loreLine1, loreLine2,
          ended, leaving, loading } = opts;
  const S = (a, b) => seg(t, a, b), L = lerp, eO = eOut, eI = eInOut, SP = (c, w) => spike(t, c, w);

  const isPrism = accent === 'prisme';
  const acc = ({ elec: '#00F0FF', forge: '#B026FF', fire: '#F7931A', gold: '#FFE600' })[accent] || '#00F0FF';
  const titleGradient = isPrism
    ? 'linear-gradient(90deg, #F7931A, #00F0FF, #FFE600, #F7931A)'
    : `linear-gradient(90deg, #F7931A, #ffffff 52%, ${acc})`;
  const ar = parseInt(acc.slice(1, 3), 16), ag = parseInt(acc.slice(3, 5), 16), ab = parseInt(acc.slice(5, 7), 16);
  const rgba = (a) => `rgba(${ar},${ag},${ab},${a})`;

  const bgScale = t < 4 ? L(1.18, 1.08, eI(S(0, 4)))
    : t < 8 ? L(1.08, 1.30, eI(S(4, 8)))
    : t < 11.5 ? L(1.30, 1.12, eI(S(8, 11.5)))
    : L(1.12, 1.2, S(11.5, 15.5));
  const lightning = SP(1.35, 0.07) * 1.3 + SP(1.5, 0.05) * 0.9 + SP(2.45, 0.08) * 1.0 + SP(3.2, 0.06) * 1.5 + SP(3.32, 0.05) * 1.1;
  let bright = t < 4 ? 0.13 : t < 7 ? L(0.13, 0.62, eO(S(4, 7))) : t < 8 ? 0.62 : t < 11.5 ? L(0.62, 0.32, S(8, 11.5)) : 0.34;
  bright += lightning * 1.6 + SP(4.7, 0.16) * 0.8 + SP(5.6, 0.13) * 0.6 + SP(6.8, 0.15) * 1.0 + SP(7.5, 0.3) * 2.0;
  const lightningStyle = { position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: 'radial-gradient(140% 95% at 50% -5%, rgba(150,210,255,0.95), rgba(0,240,255,0.28) 32%, transparent 62%)', opacity: Math.min(1, lightning * 1.1) };
  const sat = t < 4 ? 0.45 : L(0.45, 1.12, S(4, 7));
  const bgStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '50% 36%', transform: `translate(${Math.sin(t * 0.3) * 0.4}%, 0) scale(${bgScale})`, filter: `brightness(${bright}) saturate(${sat}) contrast(1.06)`, willChange: 'transform,filter' };

  const dark = t < 4 ? 0.8 : t < 7 ? L(0.8, 0.4, S(4, 7)) : t < 8 ? 0.4 : t < 11.5 ? L(0.4, 0.62, S(8, 11.5)) : 0.62;
  const darkStyle = { position: 'absolute', inset: 0, background: '#05070f', opacity: dark, pointerEvents: 'none' };

  const scanStyle = { position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,240,255,0.06) 0px, rgba(0,240,255,0.06) 1px, transparent 2px, transparent 4px)', opacity: S(4, 5) * (1 - S(7.8, 8.6)) * 0.6 };

  const sweepStyle = { position: 'absolute', left: 0, right: 0, height: '70px', top: L(-12, 112, S(4.6, 7.4)) + '%', opacity: S(4.6, 4.9) * (1 - S(7.1, 7.5)), background: `linear-gradient(180deg, transparent, ${rgba(0.85)} 50%, transparent)`, boxShadow: `0 0 40px 6px ${rgba(0.5)}`, mixBlendMode: 'screen', pointerEvents: 'none' };

  const burstStyle = { position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(circle at 50% 40%, #ffffff, ${rgba(0.85)} 22%, transparent 62%)`, opacity: Math.min(1, SP(7.5, 0.5) * 1.5) };

  const cP = S(7.9, 9.6);
  const convergeStyle = { position: 'absolute', left: '50%', top: 'calc(44% - 3cm)', transform: `translate(-50%,-50%) scale(${L(3.4, 0.05, eO(cP))}) rotate(${L(0, 120, cP)}deg)`, opacity: Math.sin(Math.min(1, cP) * Math.PI) * 0.9, pointerEvents: 'none', mixBlendMode: 'screen' };
  const convergeLines = Array.from({ length: 16 }, (_, i) => ({ id: i, style: { position: 'absolute', left: '50%', top: '50%', width: '2px', height: '80vmin', marginLeft: '-1px', transformOrigin: '50% 0%', transform: `rotate(${i * 22.5}deg)`, background: `linear-gradient(to bottom, transparent, ${rgba(0.9)} 55%, ${acc})` } }));

  const inP = S(8.2, 10.4), opP = S(8.4, 9.7);
  const scaleE = L(2.5, 1.0, eO(inP));
  const blurE = L(18, 0, S(8.4, 9.9));
  const settleY = L(0, -5, S(11.0, 12.2)) + (t > 11 ? Math.sin(t * 1.4) * 0.7 : 0);
  const emblemStyle = { position: 'absolute', left: '50%', top: 'calc(44% - 3cm)', width: 'min(50vmin,540px)', height: 'min(50vmin,540px)', perspective: '1600px', transform: `translate(-50%,-50%) translateY(${settleY}%) scale(${scaleE})`, opacity: opP, filter: `blur(${blurE}px) drop-shadow(0 4px 16px rgba(0,0,0,0.5))`, pointerEvents: 'none', willChange: 'transform' };
  const glowStyle = { position: 'absolute', left: '50%', top: 'calc(44% - 3cm)', width: 'min(78vmin,820px)', height: 'min(78vmin,820px)', transform: `translate(-50%,-50%) translateY(${settleY}%) scale(${L(0.5, 1.2, S(8.4, 10.6)) + 0.05 * Math.sin(t * 2.2)})`, background: `radial-gradient(circle, ${rgba(0.5)} 0%, ${rgba(0.12)} 38%, transparent 68%)`, opacity: S(8.4, 9.8) * (0.65 + 0.35 * Math.sin(t * 2.0)), filter: 'blur(14px)', mixBlendMode: 'screen', pointerEvents: 'none' };

  const loreOut = 1 - S(4.3, 5.1);
  const loreStyle = { position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)', width: 'min(88vw,840px)', textAlign: 'center', pointerEvents: 'none' };
  const mkLore = (op, mo, o2) => {
    o2 = o2 || {};
    const sec = o2.sec;
    const fz = sec ? 'clamp(11px,1.7vmin,18px)' : 'clamp(15px,2.5vmin,27px)';
    const col = sec ? '#9FB0CF' : '#EAF1FF';
    const ff = "'JetBrains Mono',monospace";
    const dim = sec ? 0.72 : 1;
    const mt = o2.mt || 0;
    const base = { fontFamily: ff, fontSize: fz, letterSpacing: o2.zh ? '0.12em' : '0.04em', color: col, lineHeight: 1.7, marginTop: mt, textShadow: '0 0 18px rgba(0,240,255,0.25)', display: 'block', willChange: 'transform,opacity,filter' };
    const o = op * loreOut * dim;
    if (loreAnim === 'decrypt') return { ...base, opacity: Math.min(1, op * 3) * loreOut * dim, letterSpacing: o2.zh ? '0.16em' : '0.08em', textShadow: `0 0 16px ${rgba(0.45)}` };
    if (loreAnim === 'fade') return { ...base, opacity: o, transform: `translateY(${L(12, 0, mo)}px)` };
    if (loreAnim === 'blur') return { ...base, opacity: o, filter: `blur(${L(14, 0, mo)}px)`, letterSpacing: L(0.55, 0.04, mo) + 'em' };
    if (loreAnim === 'reveal') return { ...base, opacity: Math.min(1, op * 2.2) * loreOut * dim, clipPath: `inset(0 ${L(100, 0, mo)}% 0 0)` };
    if (loreAnim === 'scale') return { ...base, opacity: o, transform: `scale(${L(1.18, 1, mo)})`, filter: `blur(${L(6, 0, mo)}px)` };
    return { ...base, opacity: o, filter: `blur(${L(8, 0, mo)}px)`, transform: `translateY(${L(24, 0, mo)}px)` };
  };
  const lore1Style = mkLore(S(0.7, 1.8), eO(S(0.7, 3.0)));
  const lore2Style = mkLore(S(1.0, 2.1), eO(S(1.0, 3.3)));

  const isDecrypt = loreAnim === 'decrypt';
  const lore1Text = isDecrypt ? scramble(loreLine1, S(0.7, 3.0)) : loreLine1;
  const lore2Text = isDecrypt ? scramble(loreLine2, S(1.0, 3.3)) : loreLine2;

  const titleTextOut = isDecrypt ? scramble(titleText, S(11.3, 15.8)) : titleText;
  const ctaTextOut = isDecrypt ? scramble(ctaText, S(14.8, 18.8)) : ctaText;
  const taglineTextOut = isDecrypt ? scramble(tagline, S(13.4, 17.4)) : tagline;

  const tP = S(11.4, 13.6);
  const titleStyle = { position: 'absolute', left: '50%', top: '63%', transform: `translate(-50%, calc(-50% + ${L(12, 0, eO(tP))}px))`, margin: 0, fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 'clamp(32px,8.2vmin,92px)', textTransform: 'uppercase', letterSpacing: L(0.5, 0.16, eO(tP)) + 'em', backgroundImage: titleGradient, backgroundSize: isPrism ? '220% 100%' : '100% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', whiteSpace: 'nowrap', opacity: tP, clipPath: isDecrypt ? 'none' : `inset(0 ${L(50, 0, eO(tP))}% 0 ${L(50, 0, eO(tP))}%)`, filter: `drop-shadow(0 2px 20px ${rgba(0.35)})`, pointerEvents: 'none' };
  const taglineStyle = { position: 'absolute', left: '50%', top: '71.5%', transform: 'translate(-50%,-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: 'clamp(10px,1.5vmin,15px)', letterSpacing: '0.42em', color: '#7F8DAD', textTransform: 'uppercase', opacity: S(13.6, 14.8), whiteSpace: 'nowrap', pointerEvents: 'none' };

  const btnP = S(15.0, 16.4);
  const btnStyle = { position: 'absolute', left: '50%', top: '81%', transform: `translate(-50%,-50%) translateY(${L(14, 0, eO(btnP))}px)`, opacity: btnP, '--cta': rgba(0.5), fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 'clamp(13px,1.8vmin,17px)', color: '#EAF1FF', padding: '15px 30px', border: `1px solid ${rgba(0.7)}`, background: `linear-gradient(180deg, ${rgba(0.16)}, rgba(10,15,30,0.6))`, clipPath: 'polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)', cursor: 'pointer', animation: btnP > 0.95 ? ('ctaPulse 1.9s ease-in-out infinite' + (isPrism ? ', ctaHue 5s linear infinite' : '')) : 'none', pointerEvents: btnP > 0.9 ? 'auto' : 'none' };
  const btnHover = { ...btnStyle, background: `linear-gradient(180deg, ${rgba(0.3)}, rgba(10,15,30,0.6))`, transform: 'translate(-50%,-50%) translateY(-2px)', boxShadow: `0 8px 30px ${rgba(0.4)}` };

  const skipStyle = { position: 'absolute', top: '22px', right: '24px', padding: '8px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', letterSpacing: '0.18em', color: '#7F8DAD', background: 'rgba(10,15,30,0.5)', border: '1px solid #1d2740', cursor: 'pointer', textTransform: 'uppercase', opacity: (1 - S(14.6, 15.4)), pointerEvents: t < 14.9 ? 'auto' : 'none' };
  // Discret : fond transparent, bordure/couleur atténuées, petit ; révélé au survol (cf. render).
  const replayStyle = { position: 'absolute', bottom: '20px', left: '22px', padding: '6px 10px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.16em', color: '#566380', background: 'transparent', border: '1px solid rgba(29,39,64,0.5)', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', opacity: ended ? 0.38 : 0, transition: 'opacity .35s ease, color .2s ease, border-color .2s ease', pointerEvents: ended ? 'auto' : 'none' };

  const vignetteStyle = { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(125% 125% at 50% 44%, transparent 48%, rgba(3,5,11,0.88) 100%)' };

  const leaveStyle = { position: 'absolute', inset: 0, background: '#05070f', display: 'grid', placeItems: 'center', opacity: leaving ? 1 : 0, transition: 'opacity .6s ease', pointerEvents: leaving ? 'auto' : 'none', zIndex: 60 };
  const loadStyle = { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.32em', color: acc, textTransform: 'uppercase', opacity: loading ? 1 : 0, transition: 'opacity .4s ease' };

  return {
    bgStyle, darkStyle, scanStyle, sweepStyle, lightningStyle, burstStyle,
    convergeStyle, convergeLines, emblemStyle, glowStyle,
    loreStyle, lore1Style, lore2Style, lore1Text, lore2Text,
    titleStyle, taglineStyle, titleText: titleTextOut, ctaText: ctaTextOut, taglineText: taglineTextOut,
    btnStyle, btnHover, skipStyle, replayStyle, vignetteStyle, leaveStyle, loadStyle,
    titleClass: isPrism ? 'title-shift' : '', glowClass: isPrism ? 'glow-shift' : '',
  };
}

// Emblème 3D réutilisable (même GLB + rotation que la cinématique). Remplit son conteneur.
// Utilisé tel quel sur l'écran de connexion (Onboarding) via window.Emblem3D.
function Emblem3D(props) {
  const accent = props.accent || 'prisme';
  const spin = props.spin != null ? props.spin : (Math.PI * 2 / 11);
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false, raf = 0, renderer = null, group = null, rim = null, scene = null, pmrem = null, envTex = null;
    (async () => {
      try {
        const dynImport = (m) => (new Function('m', 'return import(m)'))(m);
        const THREE = await dynImport('three');
        const { GLTFLoader } = await dynImport('three/addons/loaders/GLTFLoader.js');
        const { RoomEnvironment } = await dynImport('three/addons/environments/RoomEnvironment.js');
        if (disposed) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(dpr);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        camera.position.set(0, 0, 6);

        pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;

        const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 3, 4); scene.add(key);
        rim = new THREE.DirectionalLight(0x00f0ff, 1.4); rim.position.set(-3, 1.5, -2.5); scene.add(rim);
        scene.add(new THREE.AmbientLight(0xbfd8ff, 0.5));

        group = new THREE.Group();
        scene.add(group);

        const loader = new GLTFLoader();
        loader.load('assets/Emblem_optimise_12Mo.glb', (gltf) => {
          if (disposed) return;
          const m1 = gltf.scene;
          const box = new THREE.Box3().setFromObject(m1);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          m1.position.sub(center);
          const dz = size.z * 0.22;
          const wrap1 = new THREE.Group(); wrap1.add(m1); wrap1.rotation.y = Math.PI; wrap1.position.z = -dz;
          const m2 = m1.clone();
          const wrap2 = new THREE.Group(); wrap2.add(m2); wrap2.position.z = dz;
          group.add(wrap1); group.add(wrap2);
          group.scale.setScalar(2.6 / maxDim);
        }, undefined, (err) => { console.warn('GLB load error', err); });

        const clock = new THREE.Clock();
        const render = () => {
          raf = requestAnimationFrame(render);
          const w = canvas.clientWidth, h = canvas.clientHeight;
          if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h; camera.updateProjectionMatrix();
          }
          if (group) group.rotation.y = -clock.getElapsedTime() * spin;
          if (accent === 'prisme' && rim) { const tri = Math.abs(((clock.getElapsedTime() / 5) % 1) * 2 - 1); rim.color.setHSL(0.092 + (0.511 - 0.092) * tri, 1, 0.62); }
          renderer.render(scene, camera);
        };
        render();
      } catch (e) { console.warn('three init failed', e); }
    })();
    return () => { disposed = true; cancelAnimationFrame(raf); disposeThreeScene({ scene, envTex, pmrem, renderer }); };
  }, [accent, spin]);
  return <canvas ref={canvasRef} draggable={false} style={{ width: '100%', height: '100%', display: 'block', ...(props.style || {}) }} />;
}

function Cinematique(props) {
  const accent = props.accent || 'prisme';
  const loreAnim = props.loreAnim || 'decrypt';
  const titleText = props.titleText || 'FRACTAL ARENA';
  const ctaText = props.ctaText || 'APPUYER POUR COMMENCER';
  const tagline = props.tagline || 'Protocole éveillé · Fractal Arena';
  const loreLine1 = props.loreLine1 || 'Aux confins de la blockchain fractal,';
  const loreLine2 = props.loreLine2 || "une arène s'éveille.";

  const [t, setT] = useState(0);
  const [ended, setEnded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [hover, setHover] = useState(false);
  const [replayHover, setReplayHover] = useState(false);

  const tRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const audioFadeRef = useRef(0);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const enterT1 = useRef(0);
  const enterT2 = useRef(0);
  const onEnterRef = useRef(props.onEnter);
  onEnterRef.current = props.onEnter;
  const audioStartedRef = useRef(false);
  const audioMutedRef = useRef(false);
  audioMutedRef.current = audioMuted;

  // ——— boucle timeline ———
  const start = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    tRef.current = 0;
    setT(0); setEnded(false); setLeaving(false); setLoading(false);
    lastRef.current = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const nt = tRef.current + dt;
      if (nt >= CINE_DUR) { tRef.current = CINE_DUR; setT(CINE_DUR); setEnded(true); return; }
      tRef.current = nt; setT(nt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const skip = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    tRef.current = CINE_DUR; setT(CINE_DUR); setEnded(true);
  }, []);

  const replay = useCallback(() => {
    start();
    const a = audioRef.current;
    if (a && audioStartedRef.current) { try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {} }
  }, [start]);

  const enter = useCallback(() => {
    setLeaving(true);
    clearTimeout(enterT1.current); clearTimeout(enterT2.current);
    enterT1.current = setTimeout(() => setLoading(true), 650);
    enterT2.current = setTimeout(() => { if (onEnterRef.current) onEnterRef.current(); }, 2200);
  }, []);

  // ——— audio (démarre au premier geste, fondu entrée/sortie) ———
  const startAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (audioStartedRef.current) return; // déjà démarré
    a.loop = false;
    a.muted = audioMutedRef.current;
    a.volume = 0;
    const p = a.play();
    if (p && p.then) p.then(() => { if (!audioStartedRef.current) { audioStartedRef.current = true; setAudioStarted(true); } }).catch(() => {});
  }, []);

  const toggleSound = useCallback(() => {
    const a = audioRef.current;
    const m = !audioMutedRef.current;
    audioMutedRef.current = m; setAudioMuted(m);
    if (a) a.muted = m;
    if (!m && !audioStartedRef.current) startAudio(); // on réactive → (re)tente le démarrage
  }, [startAudio]);

  // démarrage timeline + listeners audio
  useEffect(() => {
    start();
    startAudio(); // tentative d'autoplay au montage ; bloquée sans geste par le navigateur → fallback sur le 1er clic
    const onGesture = () => startAudio();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    const fade = () => {
      const a = audioRef.current;
      if (a && !a.paused && a.duration) {
        const fd = 2.2, ct = a.currentTime, d = a.duration;
        let v = 1;
        if (ct < fd) v = ct / fd;
        else if (ct > d - fd) v = Math.max(0, (d - ct) / fd);
        a.volume = Math.max(0, Math.min(1, v));
      }
      audioFadeRef.current = requestAnimationFrame(fade);
    };
    audioFadeRef.current = requestAnimationFrame(fade);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(audioFadeRef.current);
      clearTimeout(enterT1.current); clearTimeout(enterT2.current);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [start, startAudio]);

  // ——— emblème 3D (Three.js + GLB) ———
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0, renderer = null, group = null, rim = null, scene = null, pmrem = null, envTex = null;
    (async () => {
      try {
        // import() natif masqué à Babel (le transformeur in-browser le réécrirait en require()).
        // Résolu via l'<importmap> de index.html au runtime.
        const dynImport = (m) => (new Function('m', 'return import(m)'))(m);
        const THREE = await dynImport('three');
        const { GLTFLoader } = await dynImport('three/addons/loaders/GLTFLoader.js');
        const { RoomEnvironment } = await dynImport('three/addons/environments/RoomEnvironment.js');
        if (disposed) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(dpr);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        camera.position.set(0, 0, 6);

        pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;

        const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 3, 4); scene.add(key);
        rim = new THREE.DirectionalLight(0x00f0ff, 1.4); rim.position.set(-3, 1.5, -2.5); scene.add(rim);
        scene.add(new THREE.AmbientLight(0xbfd8ff, 0.5));

        group = new THREE.Group();
        scene.add(group);

        const loader = new GLTFLoader();
        loader.load('assets/Emblem_optimise_12Mo.glb', (gltf) => {
          if (disposed) return;
          const m1 = gltf.scene;
          const box = new THREE.Box3().setFromObject(m1);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          m1.position.sub(center);
          const dz = size.z * 0.22;
          const wrap1 = new THREE.Group(); wrap1.add(m1); wrap1.rotation.y = Math.PI; wrap1.position.z = -dz;
          const m2 = m1.clone();
          const wrap2 = new THREE.Group(); wrap2.add(m2); wrap2.position.z = dz;
          group.add(wrap1); group.add(wrap2);
          group.scale.setScalar(2.6 / maxDim);
        }, undefined, (err) => { console.warn('GLB load error', err); });

        const clock = new THREE.Clock();
        const render = () => {
          raf = requestAnimationFrame(render);
          const w = canvas.clientWidth, h = canvas.clientHeight;
          if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h; camera.updateProjectionMatrix();
          }
          if (group) group.rotation.y = -clock.getElapsedTime() * (Math.PI * 2 / 11);
          if (accent === 'prisme' && rim) { const tri = Math.abs(((clock.getElapsedTime() / 5) % 1) * 2 - 1); rim.color.setHSL(0.092 + (0.511 - 0.092) * tri, 1, 0.62); }
          renderer.render(scene, camera);
        };
        render();
      } catch (e) { console.warn('three init failed', e); }
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      disposeThreeScene({ scene, envTex, pmrem, renderer });
    };
  }, [accent]);

  const v = useMemo(() => cineVals(t, {
    accent, loreAnim, titleText, ctaText, tagline, loreLine1, loreLine2, ended, leaving, loading,
  }), [t, accent, loreAnim, titleText, ctaText, tagline, loreLine1, loreLine2, ended, leaving, loading]);

  const soundOn = !audioMuted; // intention : son activé par défaut (le 1er geste le démarre réellement)
  const soundLabel = soundOn ? 'SON ◉' : 'SON ○';
  const accColor = ({ elec: '#00F0FF', forge: '#B026FF', fire: '#F7931A', gold: '#FFE600' })[accent] || '#00F0FF';
  const ar = parseInt(accColor.slice(1, 3), 16), ag = parseInt(accColor.slice(3, 5), 16), ab = parseInt(accColor.slice(5, 7), 16);
  const soundBtnStyle = { position: 'absolute', top: '22px', left: '24px', padding: '8px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', letterSpacing: '0.18em', color: soundOn ? accColor : '#7F8DAD', background: 'rgba(10,15,30,0.5)', border: `1px solid ${soundOn ? `rgba(${ar},${ag},${ab},0.5)` : '#1d2740'}`, cursor: 'pointer', textTransform: 'uppercase' };

  // embers (générés une fois, comme dans le design)
  const embers = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const cy = Math.random() < 0.42;
    const s = 2 + Math.random() * 3.2;
    const left = Math.random() * 100;
    const dur = 6 + Math.random() * 7;
    const delay = -Math.random() * 12;
    const drift = (Math.random() * 2 - 1) * 60;
    return { id: i, style: {
      position: 'absolute', left: left + '%', bottom: '-12px',
      width: s + 'px', height: s + 'px', borderRadius: '50%',
      background: cy ? '#00F0FF' : '#F7931A',
      boxShadow: `0 0 ${s * 2.2}px ${s * 0.7}px ${cy ? 'rgba(0,240,255,.55)' : 'rgba(247,147,26,.7)'}`,
      animation: `cineRise ${dur}s linear ${delay}s infinite`,
      '--drift': drift + 'px', pointerEvents: 'none',
    } };
  }), []);

  return (
    <div
      data-screen-label="cinematique-ouverture"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#05070f', fontFamily: "'Chakra Petch',sans-serif", color: '#EAF1FF', zIndex: 1000, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <img src="assets/BACKGROUND.png" alt="" draggable={false} style={v.bgStyle} />
      <div style={v.darkStyle} />
      <div style={v.scanStyle} />
      <div style={v.sweepStyle} />
      <div style={v.lightningStyle} />

      <div style={v.convergeStyle}>
        {v.convergeLines.map((ln) => <span key={ln.id} style={ln.style} />)}
      </div>

      <div className={v.glowClass} style={v.glowStyle} />
      <div style={v.emblemStyle}>
        <canvas ref={canvasRef} draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {embers.map((e) => <span key={e.id} style={e.style} />)}
      </div>

      <div style={v.burstStyle} />

      <div style={v.loreStyle}>
        <div style={v.lore1Style}>{v.lore1Text}</div>
        <div style={v.lore2Style}>{v.lore2Text}</div>
      </div>

      <h1 className={v.titleClass} style={v.titleStyle}>{v.titleText}</h1>
      <div style={v.taglineStyle}>{v.taglineText}</div>

      <button
        style={hover ? v.btnHover : v.btnStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={enter}
      >{v.ctaText}</button>

      <audio ref={audioRef} src="assets/FA_intro.mp3" preload="auto" />
      <button style={soundBtnStyle} onClick={toggleSound}>{soundLabel}</button>
      <button style={v.skipStyle} onClick={skip}>Passer ▸</button>
      <button
        style={replayHover && v.replayStyle.pointerEvents === 'auto'
          ? { ...v.replayStyle, opacity: 0.92, color: '#9FB0CF', borderColor: 'rgba(0,240,255,0.28)' }
          : v.replayStyle}
        onMouseEnter={() => setReplayHover(true)}
        onMouseLeave={() => setReplayHover(false)}
        onClick={replay}
      >⟳ Revoir</button>

      <div style={v.vignetteStyle} />

      <div style={v.leaveStyle}>
        <span style={v.loadStyle}>Initialisation du protocole…</span>
      </div>
    </div>
  );
}

window.Cinematique = Cinematique;
window.Emblem3D = Emblem3D;
