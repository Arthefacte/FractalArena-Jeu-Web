/* FRACTAL ARENA — Moment Forge : overlay canvas 2D plein écran.
   window.FA_FORGE_CINE.play({ mode:'fuse'|'summon', success, tier, color, premium, onDone }).
   L'état de chaque frame vient de FA_FORGE_CINE_UI.forgeVals (pur) ; ici on ne fait que
   dessiner. Le résultat (toast/carte) reste géré par l'appelant dans onDone — garanti 1x
   dans TOUS les cas : fin, skip, erreur, reduced-motion, module absent, double play. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const GOLD = "#FACC15", EMBER = "#FB923C", ASH = "#6B7280";
  const GOLDEN = 2.399963; // angle d'or — positionnement déterministe des éclats
  let dom = null, raf = 0, current = null;

  function once(fn) {
    let called = false;
    return function () { if (called) return; called = true; try { fn(); } catch (e) {} };
  }

  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function col(h1, h2, k, a) {
    const A = hexRGB(h1), B = hexRGB(h2);
    const r = Math.round(A[0] + (B[0] - A[0]) * k), g = Math.round(A[1] + (B[1] - A[1]) * k), b = Math.round(A[2] + (B[2] - A[2]) * k);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  const rgba = (h, a) => col(h, h, 0, a);
  function octPath(ctx, cx, cy, r, rot) {
    rot = rot === undefined ? Math.PI / 8 : rot;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + i * Math.PI / 4, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // Ne fait que LIRE les vals du module pur.
  function drawFrame(ctx, w, h, v) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h);
    const tc = v.color;
    ctx.save();
    ctx.globalAlpha = 1 - (v.fade || 0);
    if (v.success && (v.gemScale > 0 || v.rings.length)) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
      g.addColorStop(0, rgba(tc, 0.10 * v.I)); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (v.core > 0) { // cœur en fusion
      const cr = R * (0.04 + 0.07 * v.core * v.I);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 3.2);
      g.addColorStop(0, "rgba(255,244,230," + (0.95 * v.core * (1 - (v.ash || 0) * 0.7)) + ")");
      g.addColorStop(0.3, col(EMBER, ASH, v.ash || 0, 0.8 * v.core));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cr * 3.2, 0, 7); ctx.fill();
    }
    if (v.strikeFlash > 0) { // flare d'impact (marteau/enclume)
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const len = R * 0.28 * v.strikeFlash * (0.6 + 0.4 * v.I);
      for (const d of [[1, 0], [0, 1]]) {
        const g = ctx.createLinearGradient(cx - d[0] * len, cy - d[1] * len, cx + d[0] * len, cy + d[1] * len);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,240,220," + 0.85 * v.strikeFlash + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx - d[0] * len, cy - d[1] * len); ctx.lineTo(cx + d[0] * len, cy + d[1] * len); ctx.stroke();
      }
      ctx.restore();
    }
    for (const r of (v.rings || [])) { // ondes de choc octogonales
      const rad = R * 0.06 + r.p * R * 0.52;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(tc, r.a);
      ctx.lineWidth = Math.max(1, (1 - r.p) * R * 0.016 * v.I);
      ctx.shadowColor = rgba(tc, 0.9); ctx.shadowBlur = 18 * v.I;
      octPath(ctx, cx, cy, rad); ctx.stroke(); ctx.restore();
    }
    if (v.gemScale > 0 && v.gemAlpha > 0) { // gemme octogonale facettée
      const r = R * 0.10 * (0.75 + 0.25 * v.I) * v.gemScale;
      ctx.save(); ctx.globalAlpha *= v.gemAlpha;
      ctx.shadowColor = rgba(tc, 0.9); ctx.shadowBlur = 30 * v.I * (0.6 + 0.4 * v.gemPulse);
      const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      g.addColorStop(0, col(tc, "#FFFFFF", 0.55, 1));
      g.addColorStop(0.5, rgba(tc, 1));
      g.addColorStop(1, col(tc, "#04070C", 0.45, 1));
      octPath(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = col(tc, "#FFFFFF", 0.6, 0.9); ctx.lineWidth = 1.5;
      octPath(ctx, cx, cy, r); ctx.stroke();
      octPath(ctx, cx, cy, r * 0.55); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 8; i++) { // facettes
        const a = Math.PI / 8 + i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.18, r * 0.08, -0.6, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (v.shardP > 0 && v.shardA > 0) { // éclats radiaux (angle d'or)
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < v.shardN; i++) {
        const ang = i * GOLDEN;
        const sp = 0.55 + ((i * 0.6180339) % 1) * 0.7;
        const d = R * 0.06 + v.shardP * R * 0.46 * sp;
        const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d;
        const len = R * 0.028 * (0.6 + ((i * 0.381966) % 1) * 0.8) * (1 - 0.5 * v.shardP);
        const c = v.premium && i % 3 === 0 ? GOLD : (i % 5 === 0 ? "#FFFFFF" : tc);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = rgba(c, v.shardA);
        ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(0, len * 0.28); ctx.lineTo(-len * 0.7, 0); ctx.lineTo(0, -len * 0.28); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    if (!v.success && v.sparks > 0) { // étincelles → cendres grises retombantes
      for (let i = 0; i < 16; i++) {
        const ang = -Math.PI / 2 + (((i * GOLDEN) % 2.4) - 1.2);
        const sp = 0.5 + ((i * 0.6180339) % 1) * 0.8;
        const p = Math.min(1, v.sparks * (0.7 + ((i * 0.381966) % 1) * 0.5));
        const x = cx + Math.cos(ang) * p * sp * R * 0.20;
        const y = cy + Math.sin(ang) * p * sp * R * 0.28 + p * p * R * 0.34;
        const sz = Math.max(0.6, R * 0.007 * (1 - 0.55 * p));
        ctx.fillStyle = col(EMBER, ASH, Math.min(1, v.ash + p * 0.5), Math.max(0, 1 - p * 0.85));
        ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill();
      }
    }
    if (v.flash > 0) { // éclat final
      ctx.fillStyle = "rgba(255,255,255," + 0.75 * v.flash + ")"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgba(v.premium ? GOLD : tc, 0.35 * v.flash); ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function build() {
    if (dom) return dom;
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;z-index:9990;display:none;background:rgba(4,7,12,.9);cursor:pointer;";
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    root.appendChild(cv);
    root.addEventListener("pointerdown", skip, true);
    document.body.appendChild(root);
    dom = { root, cv };
    return dom;
  }

  function finish() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (dom) dom.root.style.display = "none";
    const cb = current && current.done;
    current = null;
    if (cb) cb();
  }
  function skip() { if (current) finish(); }

  function play(opts) {
    opts = opts || {};
    const done = once(typeof opts.onDone === "function" ? opts.onDone : function () {});
    try {
      const ui = window.FA_FORGE_CINE_UI;
      const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (!ui || reduced) { done(); return; }
      if (current) finish(); // coupe la cinématique en cours (son onDone est appelé)
      const d = build();
      const success = opts.mode === "fuse" ? !!opts.success : true;
      const vopts = { mode: opts.mode, success, tier: opts.tier, color: opts.color || "#38BDF8", premium: !!opts.premium };
      const dur = ui.duration(vopts);
      const lvl = ui.tierIndex(opts.tier);
      current = { done };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      d.cv.width = Math.round(innerWidth * dpr); d.cv.height = Math.round(innerHeight * dpr);
      d.root.style.display = "block";
      const g = d.cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (window.FA_SFX) window.FA_SFX.play("forge_strike");
      let endSfx = false;
      const t0 = performance.now();
      function tick(now) {
        try {
          if (!current || current.done !== done) return; // un autre play a pris la main
          const t = Math.min(1, (now - t0) / dur);
          const v = ui.forgeVals(t, vopts);
          drawFrame(g, innerWidth, innerHeight, v);
          if (!endSfx && (v.phase === "eclat" || v.phase === "cendres") && window.FA_SFX) {
            endSfx = true;
            window.FA_SFX.play(v.success ? "forge_born" : "forge_fizzle", lvl);
          }
          if (t >= 1) { finish(); return; }
          raf = requestAnimationFrame(tick);
        } catch (e) { finish(); }
      }
      raf = requestAnimationFrame(tick);
    } catch (e) { done(); }
  }

  window.FA_FORGE_CINE = { play };
})();
