/* ============================================================
   FRACTAL ARENA — Juice de combat (couche de peinture DOM).
   API impérative hors React (modèle FA_FINISHER) : chaque coup
   déclenche chiffre flottant + flash/shake carte + gerbe
   d'étincelles + screen-shake du board + son. Tout en try/catch
   silencieux : un effet raté ne casse jamais la boucle de combat.
   Intensités pures → FA_JUICE_UI (testable). Son → FA_SFX.
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const UI = window.FA_JUICE_UI;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sfx(name) {
    if (window.FA_SFX) { try { window.FA_SFX.play(name); } catch (e) {} }
  }
  function artOf(cardEl) {
    return cardEl && cardEl.querySelector ? cardEl.querySelector(".art") : null;
  }

  // Chiffre flottant (reprend .dmg-float ; classe .crit pour l'emphase).
  function floatText(cardEl, text, color, crit, extraClass) {
    const art = artOf(cardEl);
    if (!art) return;
    const el = document.createElement("div");
    el.className = (crit ? "dmg-float crit" : "dmg-float") + (extraClass ? " " + extraClass : "");
    el.textContent = text;
    el.style.color = color;
    el.style.left = (30 + Math.random() * 40) + "%";
    el.style.top = "40%";
    art.appendChild(el);
    setTimeout(() => el.remove(), crit ? 1100 : 980);
  }

  function flashShake(cardEl) {
    if (!cardEl || reduced()) return;
    cardEl.classList.remove("shake", "flash"); void cardEl.offsetWidth;
    cardEl.classList.add("shake", "flash");
    setTimeout(() => cardEl.classList.remove("shake", "flash"), 360);
  }

  // Gerbe d'étincelles au point d'impact (divs CSS auto-détruits).
  function sparks(cardEl, spec) {
    if (reduced()) return;
    const art = artOf(cardEl);
    if (!art) return;
    for (let i = 0; i < spec.count; i++) {
      const p = document.createElement("div");
      p.className = "jspark";
      const ang = (i / spec.count) * Math.PI * 2 + Math.random() * 0.6;
      const d = spec.spread * (0.5 + Math.random() * 0.5);
      p.style.setProperty("--dx", (Math.cos(ang) * d).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * d).toFixed(1) + "px");
      p.style.background = spec.color;
      p.style.boxShadow = "0 0 6px 1px " + spec.color;
      art.appendChild(p);
      setTimeout(() => p.remove(), 460);
    }
  }

  // Screen-shake du board, intensité ∈ [0,1] → amplitude px via --shake.
  function screenShake(boardEl, intensity) {
    if (!boardEl || reduced() || intensity <= 0) return;
    const amp = (3 + intensity * 7).toFixed(1); // 3..10 px
    boardEl.style.setProperty("--shake", amp + "px");
    boardEl.classList.remove("arena-shake"); void boardEl.offsetWidth;
    boardEl.classList.add("arena-shake");
    setTimeout(() => boardEl.classList.remove("arena-shake"), 320);
  }

  // Fente de l'attaquant (remplace l'ancien animLunge dupliqué).
  function lunge(cardEl, side) {
    try {
      if (!cardEl || reduced()) return;
      const cls = side === "p1" ? "lunge-l" : "lunge-r";
      cardEl.classList.remove(cls); void cardEl.offsetWidth; cardEl.classList.add(cls);
      setTimeout(() => cardEl.classList.remove(cls), 380);
    } catch (e) {}
  }

  function hit(cardEl, o) {
    try {
      o = o || {};
      const crit = !!o.crit;
      const kind = o.kind === "sp" ? "sp" : "atk";
      const color = crit ? "var(--gold)" : kind === "sp" ? "var(--forge)" : "var(--alert)";
      floatText(cardEl, "-" + o.dmg, color, crit);
      flashShake(cardEl);
      const spec = UI ? UI.particleSpec(kind, crit) : { count: 6, color: color, spread: 22 };
      sparks(cardEl, spec);
      const inten = UI ? UI.shakeIntensity(o.dmg, o.maxHp, crit) : (crit ? 1 : 0);
      screenShake(o.boardEl, inten);
      sfx(crit ? "crit" : kind === "sp" ? "special" : "hit");
    } catch (e) {}
  }

  function heal(cardEl, o) {
    try {
      o = o || {};
      floatText(cardEl, "+" + o.amount, "var(--success)", false);
      const art = artOf(cardEl);
      if (art && !reduced()) {
        art.classList.remove("heal-glow"); void art.offsetWidth; art.classList.add("heal-glow");
        setTimeout(() => art.classList.remove("heal-glow"), 620);
      }
      sfx("heal");
    } catch (e) {}
  }

  // Gain d'XP : chiffre flottant cyan + lueur — même langage visuel que les
  // dégâts/soins, déclenché au règlement de la victoire (pas pendant le replay).
  function xp(cardEl, o) {
    try {
      o = o || {};
      floatText(cardEl, "+" + o.amount + " XP", "var(--elec)", false, "xp-float");
      const art = artOf(cardEl);
      if (art && !reduced()) {
        art.classList.remove("xp-glow"); void art.offsetWidth; art.classList.add("xp-glow");
        setTimeout(() => art.classList.remove("xp-glow"), 720);
      }
    } catch (e) {}
  }

  function ko(cardEl) {
    try {
      const art = artOf(cardEl);
      if (art && !reduced()) {
        art.classList.remove("ko-burst"); void art.offsetWidth; art.classList.add("ko-burst");
        setTimeout(() => art.classList.remove("ko-burst"), 520);
      }
      sfx("ko");
    } catch (e) {}
  }

  // ms de hit-stop à ajouter au delay du stepper (0 si reduced-motion / non-crit).
  function hitStopMs(crit) {
    try { return (crit && !reduced()) ? 90 : 0; } catch (e) { return 0; }
  }

  window.FA_JUICE = { hit, heal, xp, ko, lunge, hitStopMs };
})();
