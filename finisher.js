/* ============================================================
   FRACTAL ARENA — Finisher de fin de combat.
   Overlay canvas singleton, API impérative hors React (modèle
   totem-cine.js) : FA_FINISHER.play({ win, onDone }).
   Tout le timing vient de finisher-ui.js ; ici on ne fait que
   peindre. Contrat : onDone est appelé exactement une fois,
   toujours — la modale de résultat ne doit jamais être perdue.
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  let cv = null, cx = null, raf = null, pending = null, t0 = 0, opts = null;
  const HEX = "0123456789abcdef";

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensure() {
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.id = "fa-finisher";
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9990;pointer-events:none;display:none";
    document.body.appendChild(cv);
    cx = cv.getContext("2d");
    return cv;
  }

  function accent() {
    try {
      const v = getComputedStyle(document.body).getPropertyValue("--accent").trim();
      if (v) return v;
    } catch (e) {}
    return "#00F0FF"; // repli = cyan de marque
  }

  // Appelle le onDone en attente, une fois et une seule.
  function flush() {
    const d = pending;
    pending = null;
    if (d) d();
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (cv) cv.style.display = "none";
  }

  // Distance du centre au bord de l'écran le long d'un angle donné (pas le rayon
  // du cercle circonscrit) : à dist=1 un éclat est pile sur le bord visible,
  // quel que soit l'angle, au lieu d'être hors-cadre pour la plupart d'entre eux.
  function edgeRadius(angle, W, H) {
    const hw = W / 2, hh = H / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    const tx = c !== 0 ? hw / Math.abs(c) : Infinity;
    const ty = s !== 0 ? hh / Math.abs(s) : Infinity;
    return Math.min(tx, ty);
  }

  function hexToRgb(hex) {
    let h = (hex || "").replace("#", "").trim();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 240, 255];
  }

  // Mélange l'accent (frac=1) vers un ton ardoise éteint (frac=0), en rgb() —
  // pas de dépendance à color-mix() du canvas (support moins sûr que pour le CSS).
  const SLATE = [58, 68, 96];
  function mixAccent(acc, frac) {
    const [ar, ag, ab] = hexToRgb(acc);
    const r = Math.round(ar * frac + SLATE[0] * (1 - frac));
    const g = Math.round(ag * frac + SLATE[1] * (1 - frac));
    const b = Math.round(ab * frac + SLATE[2] * (1 - frac));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function hexLine(scramble, n) {
    // Le hash perd ses caractères à mesure que scramble monte. Déterministe.
    let s = "0x";
    for (let i = 0; i < n; i++) {
      const gone = (((i * 5) % 17) / 17) < scramble;
      s += gone ? " " : HEX[(i * 7 + Math.floor(scramble * 16)) % 16];
    }
    return s;
  }

  function drawWin(v, W, H, acc) {
    const ccx = W / 2, ccy = H / 2;
    cx.fillStyle = "rgba(3,5,11," + v.veil.toFixed(3) + ")";
    cx.fillRect(0, 0, W, H);
    cx.lineWidth = 2;
    cx.strokeStyle = acc;
    cx.shadowColor = acc;
    for (let i = 0; i < v.shards.length; i++) {
      const s = v.shards[i];
      const R = edgeRadius(s.angle, W, H);
      const x = ccx + Math.cos(s.angle) * s.dist * R;
      const y = ccy + Math.sin(s.angle) * s.dist * R;
      const r = 26 + 54 * s.scale;
      cx.save();
      cx.translate(x, y);
      cx.rotate(s.rot);
      cx.globalAlpha = s.alpha;
      cx.shadowBlur = 18 * v.energy;
      cx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (j) cx.lineTo(px, py); else cx.moveTo(px, py);
      }
      cx.closePath();
      cx.stroke();
      cx.restore();
    }
    if (v.flash > 0) {
      cx.globalAlpha = 1;
      cx.shadowBlur = 0;
      cx.fillStyle = "rgba(255,255,255," + v.flash.toFixed(3) + ")";
      cx.fillRect(0, 0, W, H);
    }
  }

  function drawLose(v, W, H, acc) {
    const UI = window.FA_FINISHER_UI;
    cx.fillStyle = "rgba(3,5,11," + v.veil.toFixed(3) + ")";
    cx.fillRect(0, 0, W, H);
    const bw = W / UI.BLOCK_COLS, bh = H / UI.BLOCK_ROWS;
    cx.shadowBlur = 0;
    for (let i = 0; i < v.blocks.length; i++) {
      const b = v.blocks[i];
      const x = b.col * bw + b.dx, y = b.row * bh + b.dy;
      // Panneau clair (dérivé de l'accent, éteint vers l'ardoise) : lisible sur le
      // fond navy du jeu, contrairement à un remplissage sombre sur fond sombre.
      cx.globalAlpha = b.alpha * 0.34;
      cx.fillStyle = mixAccent(acc, 0.16 + 0.16 * b.sat);
      cx.fillRect(x, y, bw + 1, bh + 1);
      cx.globalAlpha = b.alpha * (0.3 + 0.4 * b.sat);
      cx.strokeStyle = acc;
      cx.lineWidth = 1;
      cx.strokeRect(x, y, bw, bh);
    }
    // Le hash se dé-mine.
    cx.globalAlpha = (1 - v.scramble) * 0.8;
    cx.fillStyle = acc;
    cx.font = "600 " + Math.max(11, Math.round(W / 70)) + "px ui-monospace, monospace";
    cx.textAlign = "center";
    cx.fillText(hexLine(v.scramble, 24), W / 2, H / 2);
    cx.globalAlpha = 1;
  }

  function frame() {
    const UI = window.FA_FINISHER_UI;
    const t = (performance.now() - t0) / 1000;
    const W = cv.width, H = cv.height;
    cx.clearRect(0, 0, W, H);
    const v = UI.finisherVals(t, opts);
    if (v.win) drawWin(v, W, H, opts.acc); else drawLose(v, W, H, opts.acc);
    if (t >= UI.FIN_DUR) { stop(); flush(); return; }
    raf = requestAnimationFrame(frame);
  }

  function play(o) {
    const win = !!(o && o.win);
    // Un play() pendant un play() : on coupe le précédent mais on honore SON onDone
    // (sinon sa modale de résultat serait perdue).
    if (raf) { stop(); flush(); }
    pending = (o && o.onDone) || null;

    if (window.FA_SFX) { try { window.FA_SFX.play(win ? "victory" : "defeat"); } catch (e) {} }

    const UI = window.FA_FINISHER_UI;
    if (reduced() || !UI || !window.requestAnimationFrame) { flush(); return; }

    try { ensure(); } catch (e) { flush(); return; }
    if (!cx) { flush(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    cv.style.display = "block";
    opts = { win, acc: accent() };
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  window.FA_FINISHER = { play };
})();
