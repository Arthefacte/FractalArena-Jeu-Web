/* FRACTAL ARENA — Fond blockchain vivante : canvas fixe derrière l'UI (au-dessus de .app-bg,
   sous les braises z-1). L'état de chaque frame vient de FA_CHAIN_BG_UI (pur) ; ici on ne fait
   que dessiner. Fond PERMANENT → sobriété stricte : ~24 fps, pause onglet caché, DPR ≤ 1,5,
   reduced-motion = une frame statique. Erreur de rendu → teardown, le fond statique reste. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const OPACITY = 0.1, CYCLE_MS = 8000, BLOCK_START = 841200, PREFILL = 40;
  let mounted = false, cv = null, g2 = null, raf = 0;
  let phase = 0, cycles = 0, last = 0, lastDraw = -1e9;
  let accent = "0,240,255"; // rgb du flash — relu à chaque nouveau cycle
  let accentCycle = -1;

  function rgbOf(hex) {
    const h = String(hex || "#00F0FF").trim().replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "0,240,245";
    return parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16);
  }
  function readAccent() {
    try {
      const v = getComputedStyle(document.body).getPropertyValue("--accent");
      accent = rgbOf(v || "#00F0FF");
    } catch (e) { accent = "0,240,255"; }
  }

  function oct(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = rot + Math.PI / 8 + k * Math.PI / 4;
      const vx = x + Math.cos(a) * r, vy = y + Math.sin(a) * r;
      if (k) ctx.lineTo(vx, vy); else ctx.moveTo(vx, vy);
    }
    ctx.closePath();
  }
  function drawMined(ctx, x, y, r, rot, i, a) {
    ctx.fillStyle = "rgba(0,150,190," + (0.09 * a) + ")";
    ctx.strokeStyle = "rgba(0,220,245," + (0.42 * a) + ")";
    ctx.lineWidth = 1.1;
    oct(ctx, x, y, r, rot); ctx.fill(); ctx.stroke();
    ctx.font = Math.max(7, Math.round(r * 0.26)) + 'px "JetBrains Mono", monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,220,245," + (0.3 * a) + ")";
    ctx.fillText("#" + (BLOCK_START + i), x, y);
  }
  function drawMining(ctx, x, y, r, rot, i, pulse, hexTick, a) {
    const U = window.FA_CHAIN_BG_UI;
    ctx.strokeStyle = "rgba(247,147,26," + ((0.45 + 0.4 * pulse) * a) + ")";
    ctx.lineWidth = 1.4 + 1.1 * pulse;
    oct(ctx, x, y, r, rot); ctx.stroke();
    ctx.strokeStyle = "rgba(247,147,26," + (0.16 * pulse * a) + ")";
    ctx.lineWidth = 5;
    oct(ctx, x, y, r + 4, rot); ctx.stroke();
    ctx.font = Math.max(8, Math.round(r * 0.3)) + 'px "JetBrains Mono", monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(247,147,26," + ((0.55 + 0.3 * pulse) * a) + ")";
    for (let row = 0; row < 2; row++) {
      let s = "";
      for (let col = 0; col < 3; col++) s += U.hexPair(i * 7 + row * 3 + col, hexTick) + (col < 2 ? " " : "");
      ctx.fillText(s, x, y + (row - 0.5) * r * 0.52);
    }
  }

  function draw() {
    const U = window.FA_CHAIN_BG_UI;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, W, H);

    const v = U.cycleVals(phase);
    if (cycles !== accentCycle) { accentCycle = cycles; readAccent(); }
    const size = Math.max(22, Math.min(H * 0.052, 46));
    const spacing = size * 2.7;
    const headX = W * 0.86, baseY = H * 0.8;
    const count = Math.ceil((headX + spacing) / spacing) + 1;
    const head = cycles;
    const px = (k) => headX - (k + v.slide) * spacing;
    const fade = (x) => Math.max(0, Math.min(1, (x + size) / (spacing * 1.3)));

    g2.lineWidth = 1; // liens sous les blocs
    for (let k = count; k >= 0; k--) {
      const iA = head - k; if (iA < 0) continue;
      const gA = U.blockGeom(iA), gB = U.blockGeom(iA + 1);
      const xA = px(k), xB = px(k - 1);
      let la = fade(xA) * 0.28;
      if (k === 0) la *= v.slide;
      if (la <= 0.004) continue;
      g2.strokeStyle = "rgba(0,220,245," + la + ")";
      g2.beginPath();
      g2.moveTo(xA + size * gA.scale * 0.95, baseY + gA.dy);
      g2.lineTo(xB - size * gB.scale * 0.95, baseY + gB.dy);
      g2.stroke();
    }
    for (let k = count; k >= 0; k--) { // blocs
      const i = head - k; if (i < 0) continue;
      const g = U.blockGeom(i);
      const x = px(k), y = baseY + g.dy, r = size * g.scale;
      const a = fade(x);
      if (a <= 0) continue;
      if (k === 0 && !v.mined) drawMining(g2, x, y, r, g.rot, i, v.pulse, v.hexTick, 1);
      else drawMined(g2, x, y, r, g.rot, i, a);
    }
    if (v.slide > 0.001) { // bloc entrant par la droite
      const i = head + 1, g = U.blockGeom(i);
      drawMining(g2, px(-1), baseY + g.dy, size * g.scale, g.rot, i, 0.3 * v.slide, 0, v.slide);
    }
    if (v.flash > 0.01 || (v.spark >= 0 && v.spark < 1)) { // flash + étincelles (accent)
      const g = U.blockGeom(head);
      const x = px(0), y = baseY + g.dy, r = size * g.scale;
      if (v.flash > 0.01) {
        const R = r * (2.2 + 1.8 * (1 - v.flash));
        const grad = g2.createRadialGradient(x, y, 0, x, y, R);
        grad.addColorStop(0, "rgba(" + accent + "," + (0.55 * v.flash) + ")");
        grad.addColorStop(1, "rgba(" + accent + ",0)");
        g2.fillStyle = grad;
        g2.fillRect(x - R, y - R, R * 2, R * 2);
      }
      if (v.spark >= 0 && v.spark < 1) {
        const GOLD = U.GOLD;
        for (let j = 0; j < 8; j++) {
          const ang = j * GOLD + head * 0.7;
          const fr = (((j * GOLD) % 1) + 1) % 1;
          const dist = r * (1 + v.spark * (1.6 + 1.4 * fr));
          const sa = (1 - v.spark) * (1 - v.spark);
          g2.fillStyle = "rgba(" + accent + "," + (0.8 * sa) + ")";
          g2.fillRect(x + Math.cos(ang) * dist - 1, y + Math.sin(ang) * dist * 0.65 - 1, 2, 2);
        }
      }
    }
  }

  function teardown() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (cv) { try { cv.remove(); } catch (e) {} }
    cv = null; g2 = null;
  }

  function step(ts) {
    try {
      raf = requestAnimationFrame(step);
      if (ts - lastDraw < 1000 / 24 - 2) return;
      const dt = Math.min(ts - last, 100);
      last = ts; lastDraw = ts;
      phase += dt / CYCLE_MS;
      while (phase >= 1) { phase -= 1; cycles++; }
      draw();
    } catch (e) { teardown(); }
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    try {
      if (!window.FA_CHAIN_BG_UI || !document.body) return;
      cv = document.createElement("canvas");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:" + OPACITY + ";";
      document.body.appendChild(cv);
      g2 = cv.getContext("2d");
      cycles = PREFILL; // chaîne pleine dès l'arrivée — le minage « tournait depuis toujours »
      const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (reduced) { phase = 0.3; try { draw(); } catch (e) { teardown(); } return; } // une frame statique
      last = performance.now();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
        else if (cv && !raf) { last = performance.now(); lastDraw = -1e9; raf = requestAnimationFrame(step); }
      });
      raf = requestAnimationFrame(step);
    } catch (e) { teardown(); }
  }

  window.FA_CHAIN_BG = { mount };
})();
