/* Généré par tools/precompile.mjs depuis cinematique.jsx — NE PAS ÉDITER. */
(function () {
// Cinématique d'ouverture — portage fidèle du design Claude (Cinematique Ouverture.dc.html).
// Timeline 20 s : fond qui s'éveille, éclairs, lore décrypté, convergence, emblème 3D (Three.js
// + GLB), titre prismatique, CTA. Joue à chaque visite tant que le joueur n'est pas connecté.
// Exposé sur window.Cinematique ; intégré dans app.jsx (branche !g.wallet).
const {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo
} = React;
const I18N = window.FA_I18N;
// Emblème de la cinématique, en URL versionnée (FA_ASSET_URL, data.js). Sans version,
// le CDN a servi un 404 mis en cache pendant un jour après l'ajout du fichier.
const EMBLEM_GLB = typeof window !== 'undefined' && window.FA_ASSET_URL ? window.FA_ASSET_URL('assets/emblem.glb') : 'assets/emblem.glb';

// Rend la main au navigateur, le temps qu'il peigne une image. L'initialisation
// 3D s'executait d'une traite : 502 ms mesurees sur un Mali-G68 (sonde v3,
// « 502 ms cinematique.js .import.then »), soit une trentaine d'images sautees
// pile au moment ou le logo apparait. Un setTimeout(0) ne suffirait pas : il ne
// garantit aucun rendu entre deux etapes, requestAnimationFrame si.
function cedeLeThread() {
  return new Promise(r => requestAnimationFrame(() => r()));
}
const CINE_DUR = 20.0;

// ——— Banc d'essai : ?sans=3d / ?sans=halo / ?sans=fond (cumulables : ?sans=3d,halo)
//
// Le gel mesure le 08/08 sur Mali-G68 dure ~13,4 s et commence 90 ms apres
// l'apparition de l'embleme. Il ne vient NI du script (22 ms sur une image de
// 9279 ms) NI du rendu (13 ms) : les setInterval continuent de tourner pendant
// que l'ecran est fige, donc c'est le compositeur qui ne rend plus la main.
// Trois correctifs cibles ont echoue parce qu'ils visaient le JavaScript.
//
// Trois suspects apparaissent ou changent a t = 8,4 s. Plutot que d'en deviner
// un quatrieme, chaque variante en retire UN, sans toucher au comportement par
// defaut (sans parametre, la cinematique est strictement inchangee) :
//   3d   — pas de canvas WebGL, embleme en image fixe
//   halo — pas de halo en mixBlendMode: screen
//   fond — image de fond sans son filtre anime image par image
const SANS = (() => {
  const m = typeof location !== 'undefined' && /[?&]sans=([a-z0-9,]+)/i.exec(location.search);
  return new Set(m ? m[1].toLowerCase().split(',') : []);
})();

// L'embleme de la CINEMATIQUE est une sequence bakee (assets/emblem-spin.webp),
// plus un canvas WebGL. Mesure du 08/08 sur Mali-G68, meme appareil, meme
// cinematique, seule la 3D changeant :
//
//                        avec canvas WebGL   avec image bakee
//   images > 100 ms                     14                  0
//   pire image                   12 161 ms              84 ms
//   hors JS (rendu/GPU)          14 083 ms             445 ms
//   fin de la cinematique     jamais atteinte          22 492 ms
//
// Composer un canvas WebGL anime est hors budget sur ce GPU ; decoder un WebP
// anime ne l'est pas — c'est une <img>, decodee hors du thread principal, et le
// fondu comme le zoom d'entree restent des proprietes composites.
// Le tableau ci-dessus date d'AVANT le plancher d'opacite (v142) : il explique
// pourquoi le bake a existe et reste la mesure de reference. Verdict du banc
// #114/#115 (09/08, meme Mali-G68) : avec la couche composee des la premiere
// image, la cinematique COMPLETE tient 47 fps, pire image 201 ms, 20,9 s
// vecues pour 20 s — le gel venait de la bascule d'opacite, pas du canvas.
// La 3D est donc redevenue LE RENDU PAR DEFAUT (rotation fluide, teinte
// prismatique vivante, et 397 Ko de WebP en moins au boot). `?cine=bake`
// force la sequence WebP : repli manuel, outil de comparaison, et destination
// du repli automatique si la 3D echoue (WebGL ou GLB — voir troisDKo).
// `?cine=3d` n'est plus lu : le defaut EST la 3D, les URLs des bancs rejouent.
const CINE_3D = !(typeof location !== 'undefined' && /[?&]cine=bake\b/i.test(location.search));
const EMBLEM_SPIN = typeof window !== 'undefined' && window.FA_ASSET_URL ? window.FA_ASSET_URL('assets/emblem-spin.webp') : 'assets/emblem-spin.webp';

// Libère TOUTES les ressources GPU d'une scène Three.js au démontage. Sans ça, le GLB
// (12 Mo, cloné ×2), le render target PMREM et les textures fuient en VRAM, et le contexte
// WebGL reste alloué → sur navigation répétée, perte de contexte (canvas 3D noir) et FPS qui
// s'effondrent, surtout sur mobile/GPU faible. `forceContextLoss` rend le slot de contexte.
function disposeThreeScene({
  scene,
  envTex,
  pmrem,
  renderer
}) {
  try {
    if (scene) scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? Array.isArray(o.material) ? o.material : [o.material] : [];
      for (const m of mats) {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        if (m.dispose) m.dispose();
      }
    });
    if (envTex) envTex.dispose();
    if (pmrem) pmrem.dispose();
    if (renderer) {
      renderer.forceContextLoss();
      renderer.dispose();
    }
  } catch (e) {/* best-effort cleanup */}
}

// ——— helpers timeline (identiques au design) ———
function seg(t, a, b) {
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}
function lerp(a, b, p) {
  return a + (b - a) * p;
}
function eOut(p) {
  return 1 - Math.pow(1 - p, 3);
}
function eInOut(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
function spike(t, c, w) {
  const d = Math.abs(t - c);
  return d > w ? 0 : 1 - d / w;
}
const SCRAMBLE_POOL = '0123456789ABCDEF<>/\\#$%&{}[]+=';
function scramble(text, p) {
  if (p <= 0) return text.replace(/[^ ]/g, () => SCRAMBLE_POOL[Math.random() * SCRAMBLE_POOL.length | 0]);
  if (p >= 1) return text;
  const n = text.length,
    front = p * (n + 3);
  let out = '';
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === ' ') out += ' ';else if (i < front - 2) out += ch;else out += SCRAMBLE_POOL[Math.random() * SCRAMBLE_POOL.length | 0];
  }
  return out;
}

// Calcule toutes les valeurs/styles animés pour un instant t donné (port de renderVals()).
function cineVals(t, opts) {
  const {
    accent,
    loreAnim,
    titleText,
    ctaText,
    tagline,
    loreLine1,
    loreLine2,
    ended,
    leaving,
    loading
  } = opts;
  const S = (a, b) => seg(t, a, b),
    L = lerp,
    eO = eOut,
    eI = eInOut,
    SP = (c, w) => spike(t, c, w);
  const isPrism = accent === 'prisme';
  const acc = {
    elec: '#00F0FF',
    forge: '#B026FF',
    fire: '#F7931A',
    gold: '#FFE600'
  }[accent] || '#00F0FF';
  const titleGradient = isPrism ? 'linear-gradient(90deg, #F7931A, #00F0FF, #FFE600, #F7931A)' : `linear-gradient(90deg, #F7931A, #ffffff 52%, ${acc})`;
  const ar = parseInt(acc.slice(1, 3), 16),
    ag = parseInt(acc.slice(3, 5), 16),
    ab = parseInt(acc.slice(5, 7), 16);
  const rgba = a => `rgba(${ar},${ag},${ab},${a})`;
  const bgScale = t < 4 ? L(1.18, 1.08, eI(S(0, 4))) : t < 8 ? L(1.08, 1.30, eI(S(4, 8))) : t < 11.5 ? L(1.30, 1.12, eI(S(8, 11.5))) : L(1.12, 1.2, S(11.5, 15.5));
  const lightning = SP(1.35, 0.07) * 1.3 + SP(1.5, 0.05) * 0.9 + SP(2.45, 0.08) * 1.0 + SP(3.2, 0.06) * 1.5 + SP(3.32, 0.05) * 1.1;
  let bright = t < 4 ? 0.13 : t < 7 ? L(0.13, 0.62, eO(S(4, 7))) : t < 8 ? 0.62 : t < 11.5 ? L(0.62, 0.32, S(8, 11.5)) : 0.34;
  bright += lightning * 1.6 + SP(4.7, 0.16) * 0.8 + SP(5.6, 0.13) * 0.6 + SP(6.8, 0.15) * 1.0 + SP(7.5, 0.3) * 2.0;
  const lightningStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    background: 'radial-gradient(140% 95% at 50% -5%, rgba(150,210,255,0.95), rgba(0,240,255,0.28) 32%, transparent 62%)',
    opacity: Math.min(1, lightning * 1.1)
  };
  const sat = t < 4 ? 0.45 : L(0.45, 1.12, S(4, 7));
  const bgStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transformOrigin: '50% 36%',
    transform: `translate(${Math.sin(t * 0.3) * 0.4}%, 0) scale(${bgScale})`,
    filter: SANS.has('fond') ? 'none' : `brightness(${bright}) saturate(${sat}) contrast(1.06)`,
    willChange: SANS.has('fond') ? 'transform' : 'transform,filter'
  };
  const dark = t < 4 ? 0.8 : t < 7 ? L(0.8, 0.4, S(4, 7)) : t < 8 ? 0.4 : t < 11.5 ? L(0.4, 0.62, S(8, 11.5)) : 0.62;
  const darkStyle = {
    position: 'absolute',
    inset: 0,
    background: '#05070f',
    opacity: dark,
    pointerEvents: 'none'
  };
  const scanStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,240,255,0.06) 0px, rgba(0,240,255,0.06) 1px, transparent 2px, transparent 4px)',
    opacity: S(4, 5) * (1 - S(7.8, 8.6)) * 0.6
  };
  const sweepStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '70px',
    top: L(-12, 112, S(4.6, 7.4)) + '%',
    opacity: S(4.6, 4.9) * (1 - S(7.1, 7.5)),
    background: `linear-gradient(180deg, transparent, ${rgba(0.85)} 50%, transparent)`,
    boxShadow: `0 0 40px 6px ${rgba(0.5)}`,
    mixBlendMode: 'screen',
    pointerEvents: 'none'
  };
  const burstStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    background: `radial-gradient(circle at 50% 40%, #ffffff, ${rgba(0.85)} 22%, transparent 62%)`,
    opacity: Math.min(1, SP(7.5, 0.5) * 1.5)
  };
  const cP = S(7.9, 9.6);
  const convergeStyle = {
    position: 'absolute',
    left: '50%',
    top: 'calc(44% - 3cm)',
    transform: `translate(-50%,-50%) scale(${L(3.4, 0.05, eO(cP))}) rotate(${L(0, 120, cP)}deg)`,
    opacity: Math.sin(Math.min(1, cP) * Math.PI) * 0.9,
    pointerEvents: 'none',
    mixBlendMode: 'screen'
  };
  const convergeLines = Array.from({
    length: 16
  }, (_, i) => ({
    id: i,
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '2px',
      height: '80vmin',
      marginLeft: '-1px',
      transformOrigin: '50% 0%',
      transform: `rotate(${i * 22.5}deg)`,
      background: `linear-gradient(to bottom, transparent, ${rgba(0.9)} 55%, ${acc})`
    }
  }));
  const inP = S(8.2, 10.4),
    opP = S(8.4, 9.7);
  const scaleE = L(2.5, 1.0, eO(inP));
  const settleY = L(0, -5, S(11.0, 12.2)) + (t > 11 ? Math.sin(t * 1.4) * 0.7 : 0);
  // AUCUN `filter` ici, et surtout pas anime : ce conteneur porte un canvas
  // WebGL. Un filtre CSS force le compositeur a rapatrier le canvas depuis le
  // GPU, appliquer le flou puis reconstruire une ombre depuis le canal alpha,
  // a chaque image. Mesure du 08/08 sur Mali-G68 (dpr 3) : `blur(18px→0)` +
  // `drop-shadow` posait UNE image de 13 931 ms — treize secondes d'ecran gele
  // a l'instant exact ou l'embleme apparait — dont 220 ms seulement de script.
  // Le drop-shadow survivait en plus a la fin du flou et plombait tout le reste
  // de la cinematique (44 img/s au lieu de 60). L'entree garde son fondu
  // (`opacity`) et son zoom (`scale`), qui eux sont composites gratuitement.
  // Banc d'essai du CONTENEUR (?sans=nu|perspective|zoom|fondu, avec ?cine=3d).
  // Le canvas WebGL de l'ecran de connexion tourne a 60 fps ; celui d'ici gele
  // 11 s, alors qu'ils font la meme taille, executent le meme code et rendent le
  // meme modele. Retirer le fond filtre et le halo n'y change rien (mesure du
  // 08/08). La seule difference restante est ce conteneur : l'embleme de
  // l'onboarding est pose dans un div nu, celui-ci vit dans un contexte 3D CSS
  // (`perspective`) avec une echelle et une opacite recalculees a chaque image.
  // Un canvas WebGL peut y perdre son accélération et se faire recopier image
  // par image — d'ou un cout qui n'apparait ni dans le script ni dans le rendu.
  const nu = SANS.has('nu');
  const emblemStyle = {
    position: 'absolute',
    left: '50%',
    top: 'calc(44% - 3cm)',
    width: 'min(50vmin,540px)',
    height: 'min(50vmin,540px)',
    ...(nu || SANS.has('perspective') ? {} : {
      perspective: '1600px'
    }),
    transform: nu || SANS.has('zoom') ? 'translate(-50%,-50%)' : `translate(-50%,-50%) translateY(${settleY}%) scale(${scaleE})`,
    // `apparition` : visible DES LE DEBUT, sans jamais basculer de 0 a 1.
    // Mesure du 08/08 : le gel demarre exactement a l'instant de cette bascule
    // (t = 8,2 s), et `nu`/`fondu` la conservaient tous les deux — je n'avais
    // donc jamais teste ce cas, qui est pourtant celui de l'ecran de connexion,
    // ou le canvas est visible des son montage. Un canvas WebGL laisse invisible
    // huit secondes puis reintegre par le compositeur est le suspect restant.
    // Verdict du banc #114 (09/08, meme Mali-G68) : canvas compose des t0 avec
    // TOUT le decor = 54 fps, pire image 401 ms, cinematique 20,9 s / 20 s ;
    // decor entierement retire mais bascule 0 -> 1 conservee = 0 image pendant
    // 6 s, pire image 7 451 ms, 8 214 ms hors JS. Le compositeur ignore une
    // couche a `opacity: 0` et s'effondre quand il doit la reintegrer huit
    // secondes plus tard. Le plancher 0.015 garde le canvas compose des la
    // premiere image — invisible a l'oeil sur fond sombre — et le fondu vers 1
    // reste une propriete composite, gratuite sur une couche deja vivante.
    // L'<img> du bake ne souffre pas de cette pathologie : elle garde son 0 -> 1.
    opacity: SANS.has('apparition') ? 1 : nu || SANS.has('fondu') ? t >= 8.2 ? 1 : 0 : CINE_3D ? Math.max(0.015, opP) : opP,
    pointerEvents: 'none',
    ...(nu ? {} : {
      willChange: 'transform'
    })
  };
  const glowStyle = {
    position: 'absolute',
    left: '50%',
    top: 'calc(44% - 3cm)',
    width: 'min(78vmin,820px)',
    height: 'min(78vmin,820px)',
    transform: `translate(-50%,-50%) translateY(${settleY}%) scale(${L(0.5, 1.2, S(8.4, 10.6)) + 0.05 * Math.sin(t * 2.2)})`,
    background: `radial-gradient(circle, ${rgba(0.5)} 0%, ${rgba(0.12)} 38%, transparent 68%)`,
    opacity: S(8.4, 9.8) * (0.65 + 0.35 * Math.sin(t * 2.0)),
    mixBlendMode: 'screen',
    pointerEvents: 'none'
  };
  const loreOut = 1 - S(4.3, 5.1);
  const loreStyle = {
    position: 'absolute',
    left: '50%',
    top: '45%',
    transform: 'translate(-50%,-50%)',
    width: 'min(88vw,840px)',
    textAlign: 'center',
    pointerEvents: 'none'
  };
  const mkLore = (op, mo, o2) => {
    o2 = o2 || {};
    const sec = o2.sec;
    const fz = sec ? 'clamp(11px,1.7vmin,18px)' : 'clamp(15px,2.5vmin,27px)';
    const col = sec ? '#9FB0CF' : '#EAF1FF';
    const ff = "'JetBrains Mono',monospace";
    const dim = sec ? 0.72 : 1;
    const mt = o2.mt || 0;
    const base = {
      fontFamily: ff,
      fontSize: fz,
      letterSpacing: o2.zh ? '0.12em' : '0.04em',
      color: col,
      lineHeight: 1.7,
      marginTop: mt,
      textShadow: '0 0 18px rgba(0,240,255,0.25)',
      display: 'block',
      willChange: 'transform,opacity,filter'
    };
    const o = op * loreOut * dim;
    if (loreAnim === 'decrypt') return {
      ...base,
      opacity: Math.min(1, op * 3) * loreOut * dim,
      letterSpacing: o2.zh ? '0.16em' : '0.08em',
      textShadow: `0 0 16px ${rgba(0.45)}`
    };
    if (loreAnim === 'fade') return {
      ...base,
      opacity: o,
      transform: `translateY(${L(12, 0, mo)}px)`
    };
    if (loreAnim === 'blur') return {
      ...base,
      opacity: o,
      filter: `blur(${L(14, 0, mo)}px)`,
      letterSpacing: L(0.55, 0.04, mo) + 'em'
    };
    if (loreAnim === 'reveal') return {
      ...base,
      opacity: Math.min(1, op * 2.2) * loreOut * dim,
      clipPath: `inset(0 ${L(100, 0, mo)}% 0 0)`
    };
    if (loreAnim === 'scale') return {
      ...base,
      opacity: o,
      transform: `scale(${L(1.18, 1, mo)})`,
      filter: `blur(${L(6, 0, mo)}px)`
    };
    return {
      ...base,
      opacity: o,
      filter: `blur(${L(8, 0, mo)}px)`,
      transform: `translateY(${L(24, 0, mo)}px)`
    };
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
  const titleStyle = {
    position: 'absolute',
    left: '50%',
    top: '63%',
    transform: `translate(-50%, calc(-50% + ${L(12, 0, eO(tP))}px))`,
    margin: 0,
    fontFamily: "'Chakra Petch',sans-serif",
    fontWeight: 700,
    fontSize: 'clamp(32px,8.2vmin,92px)',
    textTransform: 'uppercase',
    letterSpacing: L(0.5, 0.16, eO(tP)) + 'em',
    backgroundImage: titleGradient,
    backgroundSize: isPrism ? '220% 100%' : '100% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    whiteSpace: 'nowrap',
    opacity: tP,
    clipPath: isDecrypt ? 'none' : `inset(0 ${L(50, 0, eO(tP))}% 0 ${L(50, 0, eO(tP))}%)`,
    filter: `drop-shadow(0 2px 20px ${rgba(0.35)})`,
    pointerEvents: 'none'
  };
  const taglineStyle = {
    position: 'absolute',
    left: '50%',
    top: '71.5%',
    transform: 'translate(-50%,-50%)',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 'clamp(10px,1.5vmin,15px)',
    letterSpacing: '0.42em',
    color: '#7F8DAD',
    textTransform: 'uppercase',
    opacity: S(13.6, 14.8),
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
  };
  const btnP = S(15.0, 16.4);
  const btnStyle = {
    position: 'absolute',
    left: '50%',
    top: '81%',
    transform: `translate(-50%,-50%) translateY(${L(14, 0, eO(btnP))}px)`,
    opacity: btnP,
    '--cta': rgba(0.5),
    fontFamily: "'Chakra Petch',sans-serif",
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontSize: 'clamp(13px,1.8vmin,17px)',
    color: '#EAF1FF',
    padding: '15px 30px',
    border: `1px solid ${rgba(0.7)}`,
    background: `linear-gradient(180deg, ${rgba(0.16)}, rgba(10,15,30,0.6))`,
    clipPath: 'polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)',
    cursor: 'pointer',
    animation: btnP > 0.95 ? 'ctaPulse 1.9s ease-in-out infinite' + (isPrism ? ', ctaHue 5s linear infinite' : '') : 'none',
    pointerEvents: btnP > 0.9 ? 'auto' : 'none'
  };
  const btnHover = {
    ...btnStyle,
    background: `linear-gradient(180deg, ${rgba(0.3)}, rgba(10,15,30,0.6))`,
    transform: 'translate(-50%,-50%) translateY(-2px)',
    boxShadow: `0 8px 30px ${rgba(0.4)}`
  };
  const skipStyle = {
    position: 'absolute',
    top: '22px',
    right: '24px',
    padding: '8px 14px',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '12px',
    letterSpacing: '0.18em',
    color: '#7F8DAD',
    background: 'rgba(10,15,30,0.5)',
    border: '1px solid #1d2740',
    cursor: 'pointer',
    textTransform: 'uppercase',
    opacity: 1 - S(14.6, 15.4),
    pointerEvents: t < 14.9 ? 'auto' : 'none'
  };
  // Discret : fond transparent, bordure/couleur atténuées, petit ; révélé au survol (cf. render).
  const replayStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '22px',
    padding: '6px 10px',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#566380',
    background: 'transparent',
    border: '1px solid rgba(29,39,64,0.5)',
    borderRadius: '2px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    opacity: ended ? 0.38 : 0,
    transition: 'opacity .35s ease, color .2s ease, border-color .2s ease',
    pointerEvents: ended ? 'auto' : 'none'
  };
  const vignetteStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(125% 125% at 50% 44%, transparent 48%, rgba(3,5,11,0.88) 100%)'
  };
  const leaveStyle = {
    position: 'absolute',
    inset: 0,
    background: '#05070f',
    display: 'grid',
    placeItems: 'center',
    opacity: leaving ? 1 : 0,
    transition: 'opacity .6s ease',
    pointerEvents: leaving ? 'auto' : 'none',
    zIndex: 60
  };
  const loadStyle = {
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '13px',
    letterSpacing: '0.32em',
    color: acc,
    textTransform: 'uppercase',
    opacity: loading ? 1 : 0,
    transition: 'opacity .4s ease'
  };
  return {
    bgStyle,
    darkStyle,
    scanStyle,
    sweepStyle,
    lightningStyle,
    burstStyle,
    convergeStyle,
    convergeLines,
    emblemStyle,
    glowStyle,
    loreStyle,
    lore1Style,
    lore2Style,
    lore1Text,
    lore2Text,
    titleStyle,
    taglineStyle,
    titleText: titleTextOut,
    ctaText: ctaTextOut,
    taglineText: taglineTextOut,
    btnStyle,
    btnHover,
    skipStyle,
    replayStyle,
    vignetteStyle,
    leaveStyle,
    loadStyle,
    titleClass: isPrism ? 'title-shift' : '',
    glowClass: isPrism ? 'glow-shift' : ''
  };
}

// Emblème 3D réutilisable (même GLB + rotation que la cinématique). Remplit son conteneur.
// Utilisé tel quel sur l'écran de connexion (Onboarding) via window.Emblem3D.
function Emblem3D(props) {
  const accent = props.accent || 'prisme';
  const spin = props.spin != null ? props.spin : Math.PI * 2 / 11;
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false,
      raf = 0,
      renderer = null,
      group = null,
      rim = null,
      scene = null,
      pmrem = null,
      envTex = null;
    (async () => {
      try {
        // import() natif, résolu par l'<importmap> d'index.html (cf. plus bas :
        // le détour par `new Function` n'a plus lieu d'être et coûtait 'unsafe-eval').
        const THREE = await import('three');
        const {
          GLTFLoader
        } = await import('three/addons/loaders/GLTFLoader.js');
        const {
          RoomEnvironment
        } = await import('three/addons/environments/RoomEnvironment.js');
        if (disposed) return;
        window.FA_DIAG && window.FA_DIAG.marque('three-importe');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true
        });
        renderer.setPixelRatio(dpr);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        window.FA_DIAG && window.FA_DIAG.marque('renderer-cree');
        await cedeLeThread();
        if (disposed) return;
        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        camera.position.set(0, 0, 6);

        // Les lumieres d'abord : elles coutent quelques microsecondes et suffisent
        // a afficher l'embleme. L'environnement PMREM, lui, attend la premiere image.
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(2.5, 3, 4);
        scene.add(key);
        rim = new THREE.DirectionalLight(0x00f0ff, 1.4);
        rim.position.set(-3, 1.5, -2.5);
        scene.add(rim);
        scene.add(new THREE.AmbientLight(0xbfd8ff, 0.5));
        group = new THREE.Group();
        scene.add(group);
        await cedeLeThread();
        if (disposed) return;
        const loader = new GLTFLoader();
        loader.load(EMBLEM_GLB, gltf => {
          if (disposed) return;
          const m1 = gltf.scene;
          const box = new THREE.Box3().setFromObject(m1);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          m1.position.sub(center);
          const dz = size.z * 0.22;
          const wrap1 = new THREE.Group();
          wrap1.add(m1);
          wrap1.rotation.y = Math.PI;
          wrap1.position.z = -dz;
          const m2 = m1.clone();
          const wrap2 = new THREE.Group();
          wrap2.add(m2);
          wrap2.position.z = dz;
          group.add(wrap1);
          group.add(wrap2);
          group.scale.setScalar(2.6 / maxDim);
          window.FA_DIAG && window.FA_DIAG.marque('emblème-charge');
        }, undefined, err => {
          console.warn('GLB load error', err);
        });
        const clock = new THREE.Clock();
        const render = () => {
          raf = requestAnimationFrame(render);
          window.FA_DIAG && window.FA_DIAG.marque('1re-image');
          const w = canvas.clientWidth,
            h = canvas.clientHeight;
          if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
          if (group) group.rotation.y = -clock.getElapsedTime() * spin;
          if (accent === 'prisme' && rim) {
            const tri = Math.abs(clock.getElapsedTime() / 5 % 1 * 2 - 1);
            rim.color.setHSL(0.092 + (0.511 - 0.092) * tri, 1, 0.62);
          }
          renderer.render(scene, camera);
        };
        render();

        // L'environnement d'eclairage arrive maintenant que quelque chose est a
        // l'ecran : c'est l'etape la plus chere de l'init (+366 ms mesurees) et
        // elle n'apporte que des reflets, dont l'absence pendant une image ne se
        // voit pas. La construire avant, c'etait retarder le premier rendu d'autant.
        await cedeLeThread();
        if (disposed || !scene) return;
        pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        window.FA_DIAG && window.FA_DIAG.marque('pmrem-pret');
      } catch (e) {
        console.warn('three init failed', e);
      }
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      disposeThreeScene({
        scene,
        envTex,
        pmrem,
        renderer
      });
    };
  }, [accent, spin]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    draggable: false,
    style: {
      width: '100%',
      height: '100%',
      display: 'block',
      ...(props.style || {})
    }
  });
}
function Cinematique(props) {
  const accent = props.accent || 'prisme';
  const loreAnim = props.loreAnim || 'decrypt';
  const titleText = props.titleText || 'FRACTAL ARENA';
  const ctaText = props.ctaText || I18N.t('CINE_CTA');
  const tagline = props.tagline || I18N.t('CINE_TAGLINE');
  const loreLine1 = props.loreLine1 || I18N.t('CINE_LORE1');
  const loreLine2 = props.loreLine2 || I18N.t('CINE_LORE2');
  const [t, setT] = useState(0);
  const [ended, setEnded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [hover, setHover] = useState(false);
  const [replayHover, setReplayHover] = useState(false);
  // Repli : si la 3D echoue (contexte WebGL refuse, GLB introuvable), on bascule
  // sur la sequence bakee plutot que de laisser un trou noir a la place de
  // l'embleme. Meme regle que tout window.FA_* : un echec doit avoir un repli.
  const [troisDKo, setTroisDKo] = useState(false);
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
    setT(0);
    setEnded(false);
    setLeaving(false);
    setLoading(false);
    lastRef.current = performance.now();
    window.FA_DIAG && window.FA_DIAG.marque('cine-t0');
    const loop = now => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const nt = tRef.current + dt;
      // Jalons de timeline : `dt` est plafonne a 50 ms, donc une chute de
      // framerate n'accelere pas la fin — elle ALLONGE la cinematique en temps
      // reel. Comparer `cine-fin - cine-t0` aux 20 s theoriques le chiffre.
      if (nt >= 8.4) window.FA_DIAG && window.FA_DIAG.marque('cine-embleme');
      if (nt >= CINE_DUR) {
        tRef.current = CINE_DUR;
        setT(CINE_DUR);
        setEnded(true);
        window.FA_DIAG && window.FA_DIAG.marque('cine-fin');
        return;
      }
      tRef.current = nt;
      setT(nt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);
  const skip = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    tRef.current = CINE_DUR;
    setT(CINE_DUR);
    setEnded(true);
  }, []);
  const replay = useCallback(() => {
    start();
    const a = audioRef.current;
    if (a && audioStartedRef.current) {
      try {
        a.currentTime = 0;
        a.play().catch(() => {});
      } catch (e) {}
    }
  }, [start]);
  const enter = useCallback(() => {
    setLeaving(true);
    clearTimeout(enterT1.current);
    clearTimeout(enterT2.current);
    enterT1.current = setTimeout(() => setLoading(true), 650);
    enterT2.current = setTimeout(() => {
      if (onEnterRef.current) onEnterRef.current();
    }, 2200);
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
    if (p && p.then) p.then(() => {
      if (!audioStartedRef.current) {
        audioStartedRef.current = true;
        setAudioStarted(true);
      }
    }).catch(() => {});
  }, []);
  const toggleSound = useCallback(() => {
    const a = audioRef.current;
    const m = !audioMutedRef.current;
    audioMutedRef.current = m;
    setAudioMuted(m);
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
        const fd = 2.2,
          ct = a.currentTime,
          d = a.duration;
        let v = 1;
        if (ct < fd) v = ct / fd;else if (ct > d - fd) v = Math.max(0, (d - ct) / fd);
        a.volume = Math.max(0, Math.min(1, v));
      }
      audioFadeRef.current = requestAnimationFrame(fade);
    };
    audioFadeRef.current = requestAnimationFrame(fade);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(audioFadeRef.current);
      clearTimeout(enterT1.current);
      clearTimeout(enterT2.current);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [start, startAudio]);

  // ——— emblème 3D (Three.js + GLB) ———
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0,
      renderer = null,
      group = null,
      rim = null,
      scene = null,
      pmrem = null,
      envTex = null;
    (async () => {
      try {
        // import() natif, résolu par l'<importmap> d'index.html. Il passait autrefois
        // par un `new Function` pour être masqué au Babel du navigateur, qui le
        // réécrivait en require() ; ce transformeur ne tourne plus (build/), et le
        // détour coûtait 'unsafe-eval' dans la CSP.
        const THREE = await import('three');
        const {
          GLTFLoader
        } = await import('three/addons/loaders/GLTFLoader.js');
        const {
          RoomEnvironment
        } = await import('three/addons/environments/RoomEnvironment.js');
        if (disposed) return;
        window.FA_DIAG && window.FA_DIAG.marque('three-importe');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true
        });
        renderer.setPixelRatio(dpr);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        window.FA_DIAG && window.FA_DIAG.marque('renderer-cree');
        await cedeLeThread();
        if (disposed) return;
        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        camera.position.set(0, 0, 6);

        // Les lumieres d'abord : elles coutent quelques microsecondes et suffisent
        // a afficher l'embleme. L'environnement PMREM, lui, attend la premiere image.
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(2.5, 3, 4);
        scene.add(key);
        rim = new THREE.DirectionalLight(0x00f0ff, 1.4);
        rim.position.set(-3, 1.5, -2.5);
        scene.add(rim);
        scene.add(new THREE.AmbientLight(0xbfd8ff, 0.5));
        group = new THREE.Group();
        scene.add(group);
        await cedeLeThread();
        if (disposed) return;
        const loader = new GLTFLoader();
        loader.load(EMBLEM_GLB, gltf => {
          if (disposed) return;
          const m1 = gltf.scene;
          const box = new THREE.Box3().setFromObject(m1);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          m1.position.sub(center);
          const dz = size.z * 0.22;
          const wrap1 = new THREE.Group();
          wrap1.add(m1);
          wrap1.rotation.y = Math.PI;
          wrap1.position.z = -dz;
          const m2 = m1.clone();
          const wrap2 = new THREE.Group();
          wrap2.add(m2);
          wrap2.position.z = dz;
          group.add(wrap1);
          group.add(wrap2);
          group.scale.setScalar(2.6 / maxDim);
          window.FA_DIAG && window.FA_DIAG.marque('emblème-charge');
        }, undefined, err => {
          console.warn('GLB load error', err);
          // Sans modele il n'y aura jamais rien a montrer : repli sur le bake.
          if (!disposed) {
            cancelAnimationFrame(raf);
            setTroisDKo(true);
          }
        });
        const clock = new THREE.Clock();
        const render = () => {
          raf = requestAnimationFrame(render);
          window.FA_DIAG && window.FA_DIAG.marque('1re-image');
          const w = canvas.clientWidth,
            h = canvas.clientHeight;
          if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
          if (group) group.rotation.y = -clock.getElapsedTime() * (Math.PI * 2 / 11);
          if (accent === 'prisme' && rim) {
            const tri = Math.abs(clock.getElapsedTime() / 5 % 1 * 2 - 1);
            rim.color.setHSL(0.092 + (0.511 - 0.092) * tri, 1, 0.62);
          }
          renderer.render(scene, camera);
        };
        render();

        // L'environnement d'eclairage arrive maintenant que quelque chose est a
        // l'ecran : c'est l'etape la plus chere de l'init (+366 ms mesurees) et
        // elle n'apporte que des reflets, dont l'absence pendant une image ne se
        // voit pas. La construire avant, c'etait retarder le premier rendu d'autant.
        await cedeLeThread();
        if (disposed || !scene) return;
        pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        window.FA_DIAG && window.FA_DIAG.marque('pmrem-pret');
      } catch (e) {
        console.warn('three init failed', e);
        // Contexte WebGL refuse, import three en echec… : repli sur le bake.
        if (!disposed) {
          cancelAnimationFrame(raf);
          setTroisDKo(true);
        }
      }
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      disposeThreeScene({
        scene,
        envTex,
        pmrem,
        renderer
      });
    };
  }, [accent]);
  const v = useMemo(() => cineVals(t, {
    accent,
    loreAnim,
    titleText,
    ctaText,
    tagline,
    loreLine1,
    loreLine2,
    ended,
    leaving,
    loading
  }), [t, accent, loreAnim, titleText, ctaText, tagline, loreLine1, loreLine2, ended, leaving, loading]);
  const soundOn = !audioMuted; // intention : son activé par défaut (le 1er geste le démarre réellement)
  const soundLabel = `${I18N.t('CINE_SOUND')} ${soundOn ? '◉' : '○'}`;
  const accColor = {
    elec: '#00F0FF',
    forge: '#B026FF',
    fire: '#F7931A',
    gold: '#FFE600'
  }[accent] || '#00F0FF';
  const ar = parseInt(accColor.slice(1, 3), 16),
    ag = parseInt(accColor.slice(3, 5), 16),
    ab = parseInt(accColor.slice(5, 7), 16);
  const soundBtnStyle = {
    position: 'absolute',
    top: '22px',
    left: '24px',
    padding: '8px 14px',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '12px',
    letterSpacing: '0.18em',
    color: soundOn ? accColor : '#7F8DAD',
    background: 'rgba(10,15,30,0.5)',
    border: `1px solid ${soundOn ? `rgba(${ar},${ag},${ab},0.5)` : '#1d2740'}`,
    cursor: 'pointer',
    textTransform: 'uppercase'
  };

  // embers (générés une fois, comme dans le design)
  const embers = useMemo(() => Array.from({
    length: 30
  }, (_, i) => {
    const cy = Math.random() < 0.42;
    const s = 2 + Math.random() * 3.2;
    const left = Math.random() * 100;
    const dur = 6 + Math.random() * 7;
    const delay = -Math.random() * 12;
    const drift = (Math.random() * 2 - 1) * 60;
    return {
      id: i,
      style: {
        position: 'absolute',
        left: left + '%',
        bottom: '-12px',
        width: s + 'px',
        height: s + 'px',
        borderRadius: '50%',
        background: cy ? '#00F0FF' : '#F7931A',
        boxShadow: `0 0 ${s * 2.2}px ${s * 0.7}px ${cy ? 'rgba(0,240,255,.55)' : 'rgba(247,147,26,.7)'}`,
        animation: `cineRise ${dur}s linear ${delay}s infinite`,
        '--drift': drift + 'px',
        pointerEvents: 'none'
      }
    };
  }), []);
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": "cinematique-ouverture",
    onContextMenu: e => e.preventDefault(),
    onDragStart: e => e.preventDefault(),
    style: {
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      background: '#05070f',
      fontFamily: "'Chakra Petch',sans-serif",
      color: '#EAF1FF',
      zIndex: 1000,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/BACKGROUND.webp",
    alt: "",
    draggable: false,
    style: v.bgStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: v.darkStyle
  }), !SANS.has('deco') && /*#__PURE__*/React.createElement("div", {
    style: v.scanStyle
  }), !SANS.has('deco') && /*#__PURE__*/React.createElement("div", {
    style: v.sweepStyle
  }), !SANS.has('deco') && /*#__PURE__*/React.createElement("div", {
    style: v.lightningStyle
  }), !SANS.has('deco') && /*#__PURE__*/React.createElement("div", {
    style: v.convergeStyle
  }, v.convergeLines.map(ln => /*#__PURE__*/React.createElement("span", {
    key: ln.id,
    style: ln.style
  }))), !SANS.has('halo') && /*#__PURE__*/React.createElement("div", {
    className: v.glowClass,
    style: v.glowStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: v.emblemStyle
  }, CINE_3D && !troisDKo ? /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    draggable: false,
    style: {
      width: '100%',
      height: '100%',
      display: 'block'
    }
  }) : /*#__PURE__*/React.createElement("img", {
    src: EMBLEM_SPIN,
    alt: "",
    draggable: false,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none'
    }
  }, !SANS.has('deco') && embers.map(e => /*#__PURE__*/React.createElement("span", {
    key: e.id,
    style: e.style
  }))), /*#__PURE__*/React.createElement("div", {
    style: v.burstStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: v.loreStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: v.lore1Style
  }, v.lore1Text), /*#__PURE__*/React.createElement("div", {
    style: v.lore2Style
  }, v.lore2Text)), /*#__PURE__*/React.createElement("h1", {
    className: v.titleClass,
    style: v.titleStyle
  }, v.titleText), /*#__PURE__*/React.createElement("div", {
    style: v.taglineStyle
  }, v.taglineText), /*#__PURE__*/React.createElement("button", {
    style: hover ? v.btnHover : v.btnStyle,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onClick: enter
  }, v.ctaText), /*#__PURE__*/React.createElement("audio", {
    ref: audioRef,
    src: "assets/FA_intro.mp3",
    preload: "auto"
  }), /*#__PURE__*/React.createElement("button", {
    style: soundBtnStyle,
    onClick: toggleSound
  }, soundLabel), /*#__PURE__*/React.createElement("button", {
    style: v.skipStyle,
    onClick: skip
  }, I18N.t('CINE_SKIP')), /*#__PURE__*/React.createElement("button", {
    style: replayHover && v.replayStyle.pointerEvents === 'auto' ? {
      ...v.replayStyle,
      opacity: 0.92,
      color: '#9FB0CF',
      borderColor: 'rgba(0,240,255,0.28)'
    } : v.replayStyle,
    onMouseEnter: () => setReplayHover(true),
    onMouseLeave: () => setReplayHover(false),
    onClick: replay
  }, I18N.t('CINE_REPLAY')), /*#__PURE__*/React.createElement("div", {
    style: v.vignetteStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: v.leaveStyle
  }, /*#__PURE__*/React.createElement("span", {
    style: v.loadStyle
  }, I18N.t('CINE_LOADING'))));
}
window.Cinematique = Cinematique;
window.Emblem3D = Emblem3D;
})();
