/* ============================================================
   FRACTAL ARENA — SFX UI procéduraux (Web Audio API).
   Aucun fichier audio : chaque son est synthétisé par code
   (oscillateurs + enveloppes). Léger, sur-thème « numérique »,
   aucune entrée CSP media-src, aucun fetch. Branché sur
   options.sound via window.FA_SFX.setEnabled().
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  let ctx = null, master = null, enabled = true;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;           // discret, jamais agressif
    master.connect(ctx.destination);
    return ctx;
  }

  // Une voix = oscillateur + gain enveloppé (attaque courte, chute expo).
  // Rampes exponentielles → toutes les valeurs restent > 0.
  function tone(t0, o) {
    const type = o.type || "sine";
    const f = o.f || 440;
    const dur = o.dur || 0.12;
    const peak = o.peak == null ? 0.7 : o.peak;
    const a = o.a == null ? 0.004 : o.a;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    osc.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Recettes : t = temps de départ (ctx.currentTime).
  const RECIPES = {
    click:   (t) => tone(t, { type: "triangle", f: 300, dur: 0.05, peak: 0.42 }),
    // blip cristallin montant (fondamentale + octave)
    tab:     (t) => { tone(t, { type: "sine", f: 520, f2: 880, dur: 0.10, peak: 0.55 });
                      tone(t + 0.004, { type: "sine", f: 1040, f2: 1760, dur: 0.09, peak: 0.18 }); },
    open:    (t) => tone(t, { type: "sine", f: 300, f2: 640, dur: 0.15, peak: 0.42 }),
    close:   (t) => tone(t, { type: "sine", f: 640, f2: 260, dur: 0.13, peak: 0.38 }),
    // deux notes montantes, doré
    success: (t) => { tone(t, { type: "triangle", f: 660, dur: 0.11, peak: 0.5 });
                      tone(t + 0.085, { type: "triangle", f: 990, dur: 0.16, peak: 0.5 }); },
    error:   (t) => tone(t, { type: "sawtooth", f: 180, f2: 110, dur: 0.18, peak: 0.4 }),
    // arpège Do majeur montant, triomphant
    victory: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.10, { type: "triangle", f, dur: 0.22, peak: 0.5 })),
    // descente mate
    defeat:  (t) => [440, 349, 262].forEach((f, i) => tone(t + i * 0.12, { type: "sine", f, dur: 0.28, peak: 0.45 })),
    // --- Combat (courts, calés sous le master 0.22 ; cadence ~165 ms) ---
    hit:     (t) => tone(t, { type: "square", f: 220, f2: 90, dur: 0.06, peak: 0.34 }),
    crit:    (t) => { tone(t, { type: "square", f: 520, f2: 180, dur: 0.09, peak: 0.5 });
                      tone(t, { type: "sine", f: 90, f2: 55, dur: 0.12, peak: 0.4 }); },
    special: (t) => { tone(t, { type: "sawtooth", f: 300, f2: 900, dur: 0.14, peak: 0.34 });
                      tone(t + 0.02, { type: "sine", f: 700, f2: 1300, dur: 0.12, peak: 0.2 }); },
    heal:    (t) => tone(t, { type: "sine", f: 500, f2: 760, dur: 0.13, peak: 0.32 }),
    ko:      (t) => { tone(t, { type: "sawtooth", f: 160, f2: 60, dur: 0.22, peak: 0.44 });
                      tone(t + 0.04, { type: "sine", f: 80, f2: 45, dur: 0.26, peak: 0.34 }); },
    // frappe de forge : impact grave + claquement métallique bref
    forge_strike: (t) => { tone(t, { type: "sine", f: 90, f2: 55, dur: 0.30, peak: 0.8 });
                           tone(t + 0.01, { type: "square", f: 1400, f2: 700, dur: 0.06, peak: 0.2 }); },
    // carillon de naissance : arpège dont la richesse monte avec lvl (0..3)
    forge_born: (t, lvl) => { const notes = [523, 659, 784, 1047, 1319].slice(0, 2 + (Number(lvl) || 0));
                              notes.forEach((f, i) => tone(t + i * 0.09, { type: "triangle", f, dur: 0.20, peak: 0.5 })); },
    // échec de fusion : retombée mate, deux chutes graves
    forge_fizzle: (t) => { tone(t, { type: "sawtooth", f: 220, f2: 70, dur: 0.35, peak: 0.38 });
                           tone(t + 0.12, { type: "sine", f: 160, f2: 60, dur: 0.30, peak: 0.3 }); },
    // « ka-ching » du rachat (#7 header vivant, différé depuis l'étape 1) :
    // deux frappes métalliques brillantes (Sol6 puis Do7 + quinte) sur une
    // assise grave qui retombe — la caisse enregistreuse, version griffe.
    kaching: (t) => { tone(t, { type: "triangle", f: 1568, dur: 0.07, peak: 0.34 });
                      tone(t, { type: "sine", f: 196, f2: 98, dur: 0.20, peak: 0.3 });
                      tone(t + 0.08, { type: "triangle", f: 2093, dur: 0.24, peak: 0.5 });
                      tone(t + 0.08, { type: "sine", f: 3136, dur: 0.16, peak: 0.16 }); },
  };

  function play(name, arg) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    const fn = RECIPES[name];
    if (fn) try { fn(c.currentTime + 0.001, arg); } catch (e) {}
  }

  function setEnabled(v) { enabled = !!v; }

  // Déverrouille l'audio au premier geste (politique navigateur).
  window.addEventListener("pointerdown", function unlock() {
    const c = ensureCtx();
    if (c && c.state === "suspended") c.resume();
  }, { once: true, capture: true });

  // Clic générique : tick doux sur tout <button>, sauf la nav (son « tab » dédié)
  // ou un bouton opt-out via data-sfx="off".
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest("button");
    if (!btn) return;
    if (btn.closest(".nav-tab")) return;
    if (btn.dataset && btn.dataset.sfx === "off") return;
    play("click");
  }, true);

  window.FA_SFX = { play, setEnabled, has: (n) => Object.prototype.hasOwnProperty.call(RECIPES, n) };
})();
