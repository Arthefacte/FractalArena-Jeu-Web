/* Généré par tools/precompile.mjs depuis expeditions.jsx — NE PAS ÉDITER. */
(function () {
// ============================================================
// FRACTAL ARENA — Écran Expéditions (idle, durée libre de 1 à 12 h)
// Port du proto Claude Design « Expeditions.dc.html » (4 vues +
// animation de lancement). Le serveur fait foi : l'état vient de
// GET /expeditions/state (g.expeditions), le taux affiché en
// config est un aperçu (FA_EXPEDITIONS_UI), le taux FIGÉ est
// celui renvoyé par /start. Résolution du butin AU CLAIM.
// ============================================================
const {
  useState,
  useEffect,
  useRef
} = React;
const I18N = window.FA_I18N;
const D = window.FA_DATA;
const XU = window.FA_EXPEDITIONS_UI;
const {
  useFA,
  SectionHead,
  Bar
} = window;
const EXP_GLYPH = {
  HASH: "#",
  MINING: "⛏",
  LEDGER: "▤",
  NETWORK: "❖",
  GENESIS: "✦",
  BLOCK: "▣"
};
const HEX_CLIP = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";
const expErr = XU.errText;
function modeLabel(mode) {
  return mode === "risquee" ? I18N.t("EXP_MODE_RISKY") : I18N.t("EXP_MODE_PRUDENT");
}
function rateColor(pct) {
  return pct >= 75 ? "var(--success)" : pct >= 55 ? "var(--gold)" : "var(--alert)";
}
// La durée est libre (1 -> 12 h) : plus de table de paliers à consulter.
function durLabel(durationS) {
  return Math.round(durationS / 3600) + " " + I18N.t("EXP_HOURS");
}
function typeMeta(type) {
  const w = XU.WORLDS.find(x => x.type === type);
  return w || {
    color: "var(--elec)",
    rgb: "0,240,255"
  };
}
function fmtClock(d) {
  try {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }
}
function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}
function Expeditions() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [view, setView] = useState("dest"); // dest | config | track | loot
  const [selWorld, setSelWorld] = useState(null);
  const [sel, setSel] = useState([]);
  const [durH, setDurH] = useState(8); // heures, curseur 1 -> 12
  const [mode, setMode] = useState("prudente");
  const [ticket, setTicket] = useState(null); // null | "argent" | "or"
  const [busyCall, setBusyCall] = useState(false);
  const [fx, setFx] = useState(null); // { worldId, rate, endsAt, ids } pendant l'animation
  const [justLaunched, setJustLaunched] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [rfx, setRfx] = useState(null); // { worldId, ids, success } : retour du portail
  const [loot, setLoot] = useState(null); // { success, rewards, fa_week, worldId, beastIds }
  const [confirmRecall, setConfirmRecall] = useState(false);
  // Fenêtres d'épuisement locales (échec Risquée : +30 min après ends_at),
  // CUMULÉES — deux échecs successifs sur des destinations différentes gardent
  // chacun leur fenêtre. Le serveur garde de toute façon ; ceci rend
  // l'indisponibilité VISIBLE dans le sélecteur au lieu d'un 409 sec (perdu au
  // rechargement ou au changement d'écran — acceptable v1).
  const [exhausted, setExhausted] = useState([]); // [{ ids: [], until: ms }]
  const [, setTick] = useState(0);
  const fxTimer = useRef(null);
  const fxWorldRef = useRef(null); // monde de l'anim en cours (lu par endFx, jamais périmé)
  const flashTimer = useRef(null); // pulse justLaunched 800 ms
  const claimTimer = useRef(null); // burst claiming 750 ms
  const rfxTimer = useRef(null); // overlay de retour 1,85 s

  // Tick 1 s seulement là où un compte à rebours est VISIBLE ET VIVANT :
  // dest/track avec au moins une expédition qui court encore.
  const nowPre = Date.now() + (g.expNowOffset || 0);
  const anyRunning = (Array.isArray(g.expeditions) ? g.expeditions : []).some(e => XU.statusOf(e, nowPre) === "running");
  const ticking = (view === "dest" || view === "track") && anyRunning;
  useEffect(() => {
    if (!ticking) return undefined;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [ticking]);
  // Rafraîchit à l'OUVERTURE de l'écran ; le changement de jeton est déjà
  // couvert par l'effet global d'app.jsx (sinon double requête au boot).
  useEffect(() => {
    if (g.authToken) actions.expeditionsState();
  }, []);
  useEffect(() => () => {
    if (fxTimer.current) clearTimeout(fxTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (claimTimer.current) clearTimeout(claimTimer.current);
    if (rfxTimer.current) clearTimeout(rfxTimer.current);
  }, []);
  const now = Date.now() + (g.expNowOffset || 0);
  const exps = Array.isArray(g.expeditions) ? g.expeditions : [];
  const byDest = {};
  exps.forEach(e => {
    byDest[e.destination] = e;
  });
  const busyIds = new Set(exps.flatMap(e => Array.isArray(e.beast_ids) ? e.beast_ids : []));
  const exhaustedIds = new Set(exhausted.flatMap(x => x.until > now ? x.ids : []));
  const roster = Array.isArray(g.roster) ? g.roster : [];
  const beastById = id => roster.find(b => b && b.id === id);

  // Une vue orpheline (expédition rappelée/réclamée ailleurs, butin absent)
  // retombe sur les destinations — via un effet, jamais en plein rendu.
  const trackOrphan = view === "track" && !byDest[selWorld];
  const lootOrphan = view === "loot" && !loot;
  useEffect(() => {
    if (trackOrphan || lootOrphan) setView("dest");
  }, [trackOrphan, lootOrphan]);
  if (!g.wallet || !g.authToken) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement(SectionHead, {
      eyebrow: "\u25C7 IDLE",
      title: I18N.t("EXP_TITLE"),
      sub: I18N.t("EXP_SUB")
    }), /*#__PURE__*/React.createElement("div", {
      className: "muted mono",
      style: {
        textAlign: "center",
        padding: 24
      }
    }, I18N.t("EXP_LOGIN")));
  }

  // ---- Lancement : serveur d'abord (taux figé), animation ensuite ----
  function endFx() {
    if (fxTimer.current) {
      clearTimeout(fxTimer.current);
      fxTimer.current = null;
    }
    // Le monde vient d'une ref (jamais périmée dans la closure du setTimeout) ;
    // l'updater de setFx reste PUR — pas de setState imbriqué dedans.
    const wid = fxWorldRef.current;
    fxWorldRef.current = null;
    setFx(null);
    if (wid) {
      setJustLaunched(wid);
      flashTimer.current = setTimeout(() => setJustLaunched(null), 800);
    }
    setView("dest");
    setSel([]);
  }
  async function launch() {
    if (busyCall || sel.length !== 3) return;
    setBusyCall(true);
    let r = await actions.expeditionsStart({
      destination: selWorld,
      beast_ids: sel,
      mode,
      duration_s: durH * 3600,
      ticket
    });
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsStart({
      destination: selWorld,
      beast_ids: sel,
      mode,
      duration_s: durH * 3600,
      ticket
    });
    setBusyCall(false);
    // reason "auth" : app.jsx a déjà affiché AUTH_EXPIRED — pas de second toast.
    if (!r.ok) {
      if (r.reason !== "auth") toast(expErr(r.reason), "bad");
      return;
    }
    if (reducedMotion()) {
      toast(I18N.t("EXP_STATUS_RUNNING") + " · " + r.expedition.success_rate + " %", "good");
      setView("dest");
      setSel([]);
      return;
    }
    fxWorldRef.current = selWorld;
    setFx({
      worldId: selWorld,
      ids: sel.slice(),
      endsAt: new Date(r.expedition.ends_at)
    });
    fxTimer.current = setTimeout(endFx, 2500);
  }

  // ---- Claim : résolution serveur puis vue butin ----
  async function claim(e) {
    if (busyCall) return;
    setBusyCall(true);
    setClaiming(true);
    let r = await actions.expeditionsClaim(e.id);
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsClaim(e.id);
    setBusyCall(false);
    if (!r.ok) {
      setClaiming(false);
      if (r.reason !== "auth") toast(expErr(r.reason), "bad");
      return;
    }
    setClaiming(false); // le portail de retour prend le relais (même batch React : pas de trou)
    if (r.success === false && e.mode === "risquee") {
      // Échec Risquée : le serveur tient les bêtes indisponibles jusqu'à
      // ends_at + 30 min — on AJOUTE cette fenêtre (les fenêtres échues sortent).
      const until = new Date(e.ends_at).getTime() + 30 * 60e3;
      setExhausted(xs => [...xs.filter(x => x.until > Date.now()), {
        ids: e.beast_ids || [],
        until
      }]);
    }
    setLoot({
      success: r.success,
      rewards: r.rewards,
      fa_week: r.fa_week,
      worldId: e.destination,
      beastIds: e.beast_ids || []
    });
    setSelWorld(e.destination);
    setView("loot");
    // Retour : le portail recrache l'équipe PAR-DESSUS la vue butin, qui se
    // découvre quand l'overlay fond. Miroir exact de l'aller ; en mouvement
    // réduit on saute droit au butin (comme launch()).
    if (!reducedMotion()) {
      if (rfxTimer.current) clearTimeout(rfxTimer.current);
      setRfx({
        worldId: e.destination,
        ids: e.beast_ids || [],
        success: r.success !== false
      });
      rfxTimer.current = setTimeout(() => {
        rfxTimer.current = null;
        setRfx(null);
      }, 1850);
    }
  }
  async function doRecall(e) {
    if (busyCall) return;
    setBusyCall(true);
    let r = await actions.expeditionsRecall(e.id);
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsRecall(e.id);
    setBusyCall(false);
    setConfirmRecall(false);
    if (!r.ok) {
      if (r.reason !== "auth") toast(expErr(r.reason), "bad");
      return;
    }
    setView("dest");
  }
  const world = XU.worldOf(selWorld) || XU.WORLDS[0];
  const wName = w => I18N.t(w.i18nKey);
  function WorldHead() {
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-headworld"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 22,
        background: world.color,
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        fontSize: 10,
        color: world.color
      }
    }, I18N.t("EXP_AFFINITY"), " ", world.type), /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 19
      }
    }, wName(world))));
  }

  // ============ VUE DESTINATIONS ============
  function renderDest() {
    let running = 0,
      ready = 0;
    XU.WORLDS.forEach(w => {
      const s = XU.statusOf(byDest[w.id], now);
      if (s === "running") running++;else if (s === "ready") ready++;
    });
    const fa = g.expFaWeek;
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-col"
    }, /*#__PURE__*/React.createElement(SectionHead, {
      eyebrow: "\u25C7 IDLE",
      title: I18N.t("EXP_TITLE"),
      sub: I18N.t("EXP_SUB")
    }), /*#__PURE__*/React.createElement("div", {
      className: "exq-summary"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono"
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--elec)"
      }
    }, running), " ", I18N.t("EXP_STATUS_RUNNING")), /*#__PURE__*/React.createElement("span", {
      className: "exq-vline"
    }), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, ready > 0 && /*#__PURE__*/React.createElement("span", {
      className: "exq-dot"
    }), /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--fire)"
      }
    }, ready), " ", I18N.t("EXP_STATUS_READY"))), fa && /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        padding: "10px 13px",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 10,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "exq-mono",
      style: {
        fontSize: 10,
        color: "var(--text-dim)",
        marginBottom: 5
      }
    }, I18N.t("EXP_FA_WEEK")), /*#__PURE__*/React.createElement(Bar, {
      frac: Math.min(1, (fa.granted || 0) / (fa.cap || 5000)),
      kind: "xp"
    })), /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        color: "var(--fire)"
      }
    }, fa.granted || 0, "/", fa.cap || 5000)), /*#__PURE__*/React.createElement("div", {
      className: "exq-worlds"
    }, XU.WORLDS.map(w => {
      const e = byDest[w.id];
      const s = XU.statusOf(e, now);
      const border = s === "ready" ? "rgba(247,147,26,.55)" : s === "running" ? `rgba(${w.rgb},.35)` : "var(--line)";
      const onClick = s === "free" ? () => {
        setSelWorld(w.id);
        setSel([]);
        setDurH(8);
        setMode("prudente");
        setTicket(null);
        setView("config");
      } : s === "ready" ? () => claim(e) : () => {
        setSelWorld(w.id);
        setConfirmRecall(false);
        setView("track");
      };
      return /*#__PURE__*/React.createElement("button", {
        key: w.id,
        className: "exq-world",
        onClick: onClick,
        style: {
          border: "1px solid " + border,
          boxShadow: s === "ready" ? "0 0 16px rgba(247,147,26,.22)" : "none"
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-worldbar",
        style: {
          background: w.color
        }
      }), justLaunched === w.id && /*#__PURE__*/React.createElement("span", {
        className: "exq-fresh",
        style: {
          borderColor: w.color
        }
      }), /*#__PURE__*/React.createElement("span", {
        className: "exq-worldhead"
      }, /*#__PURE__*/React.createElement("b", null, wName(w)), /*#__PURE__*/React.createElement("span", {
        className: "exq-aff exq-mono",
        style: {
          color: w.color,
          borderColor: `rgba(${w.rgb},.4)`,
          background: `rgba(${w.rgb},.08)`
        }
      }, w.type)), s === "free" && /*#__PURE__*/React.createElement("span", {
        className: "exq-mono exq-dim"
      }, I18N.t("EXP_STATUS_FREE"), " \xB7 \u203A"), s === "running" && /*#__PURE__*/React.createElement("span", {
        className: "exq-worldrow"
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-mono exq-dim"
      }, modeLabel(e.mode)), /*#__PURE__*/React.createElement("b", {
        className: "exq-mono",
        style: {
          color: "var(--elec)",
          fontVariantNumeric: "tabular-nums"
        }
      }, XU.fmtCountdown(new Date(e.ends_at).getTime() - now))), s === "ready" && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 7
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-dot"
      }), /*#__PURE__*/React.createElement("b", {
        className: "exq-mono",
        style: {
          color: "var(--fire)",
          fontSize: 12
        }
      }, I18N.t("EXP_CLAIM"), " \u203A")));
    })));
  }

  // ============ VUE CONFIGURATION ============
  function renderConfig() {
    const team = sel.map(beastById).filter(Boolean);
    const ready3 = sel.length === 3;
    const pow = XU.collectionPower(team);
    const affBonus = XU.affinityBonus(team, selWorld);
    // Le taux NE DÉPEND PLUS DU MODE : Prudente et Risquée affichent le même
    // chiffre, et c'est voulu. Le mode joue sur ce qu'on perd en échec, pas sur
    // les chances. Seul le ticket Or déplace le taux, à 100 %.
    const pct = XU.previewStartRate(team, selWorld, ticket);
    const successColor = rateColor(pct);
    const warnTeam = sel.some(id => (g.selected || []).includes(id));
    const allEpic = ready3 && team.every(b => b.rarity === "Epic");
    // Aperçu du butin dans les deux issues — c'est ce qui rend le choix de mode
    // lisible sans calcul : à droite, ce que la Risquée abandonne.
    const win = ready3 ? XU.previewLoot(selWorld, durH, mode, ticket, true) : null;
    const lose = ready3 ? XU.previewLoot(selWorld, durH, mode, ticket, false) : null;
    const silverLeft = g.ticketsSilver | 0;
    const goldLeft = g.ticketsGold | 0;
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-col"
    }, BackRow(), WorldHead(), /*#__PURE__*/React.createElement("div", {
      className: "exq-steprow"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow",
      style: {
        fontSize: 10
      }
    }, "1 \xB7 ", I18N.t("EXP_SELECT_3")), /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        color: ready3 ? "var(--success)" : "var(--text-dim)"
      }
    }, sel.length, " / 3")), /*#__PURE__*/React.createElement("div", {
      className: "exq-roster"
    }, roster.map(b => {
      const isTired = exhaustedIds.has(b.id);
      const isBusy = busyIds.has(b.id) || isTired;
      const selected = sel.includes(b.id);
      const tm = typeMeta(b.type);
      const toggle = () => {
        if (isBusy) return;
        setSel(s => s.includes(b.id) ? s.filter(x => x !== b.id) : s.length < 3 ? [...s, b.id] : s);
      };
      return /*#__PURE__*/React.createElement("button", {
        key: b.id,
        className: "exq-beast",
        onClick: toggle,
        style: {
          border: "1px solid " + (selected ? "var(--fire)" : isBusy ? "var(--line-soft)" : "var(--line)"),
          boxShadow: selected ? "0 0 12px rgba(247,147,26,.4)" : "none",
          cursor: isBusy ? "not-allowed" : "pointer"
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-beastart",
        style: {
          background: `linear-gradient(150deg, rgba(${tm.rgb},.14), rgba(6,9,18,.6))`,
          opacity: isBusy ? 0.4 : 1,
          filter: isBusy ? "grayscale(.85)" : "none"
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: D.artFor(b),
        alt: "",
        draggable: "false"
      }), /*#__PURE__*/React.createElement("span", {
        className: "exq-lvl exq-mono"
      }, "N", b.level), selected && /*#__PURE__*/React.createElement("span", {
        className: "exq-check"
      }, "\u2713")), /*#__PURE__*/React.createElement("span", {
        className: "exq-beastname",
        style: {
          color: isBusy ? "var(--text-dim)" : "var(--text)"
        }
      }, D.displayName(b)), /*#__PURE__*/React.createElement("span", {
        className: "exq-mono exq-beasttag",
        style: {
          color: isTired ? "var(--alert)" : isBusy ? "var(--text-dim)" : (g.selected || []).includes(b.id) ? "var(--fire)" : "var(--text-dim)"
        }
      }, isTired ? I18N.t("EXP_EXHAUSTED_TAG") : isBusy ? I18N.t("EXP_IN_EXPEDITION") : (g.selected || []).includes(b.id) ? I18N.t("EXP_ACTIVE_TEAM") : b.type + " · " + b.rarity));
    })), warnTeam && /*#__PURE__*/React.createElement("div", {
      className: "exq-warn"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fire)"
      }
    }, "\u26A0"), /*#__PURE__*/React.createElement("span", null, I18N.t("EXP_TEAM_WARN"))), /*#__PURE__*/React.createElement("span", {
      className: "eyebrow",
      style: {
        fontSize: 10
      }
    }, "2 \xB7 ", I18N.t("EXP_DURATION")), /*#__PURE__*/React.createElement("div", {
      className: "exq-durbox"
    }, /*#__PURE__*/React.createElement("div", {
      className: "exq-durhead"
    }, /*#__PURE__*/React.createElement("b", {
      className: "exq-mono exq-durval"
    }, durH, " ", I18N.t("EXP_HOURS")), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-dim",
      style: {
        fontSize: 10
      }
    }, I18N.t("EXP_BACK_AT", fmtClock(new Date(Date.now() + durH * 3600e3))))), /*#__PURE__*/React.createElement("input", {
      type: "range",
      className: "exq-slider",
      min: XU.DURATION_MIN_H,
      max: XU.DURATION_MAX_H,
      step: 1,
      value: durH,
      onChange: e => setDurH(parseInt(e.target.value, 10)),
      "aria-label": I18N.t("EXP_DURATION")
    }), /*#__PURE__*/React.createElement("div", {
      className: "exq-durticks exq-mono"
    }, /*#__PURE__*/React.createElement("span", null, XU.DURATION_MIN_H, "h"), /*#__PURE__*/React.createElement("span", null, "6h"), /*#__PURE__*/React.createElement("span", null, XU.DURATION_MAX_H, "h")), /*#__PURE__*/React.createElement("div", {
      className: "exq-mono exq-durnote"
    }, I18N.t("EXP_DURATION_NOTE"))), /*#__PURE__*/React.createElement("span", {
      className: "eyebrow",
      style: {
        fontSize: 10
      }
    }, "3 \xB7 ", I18N.t("EXP_MODE_PRUDENT"), " / ", I18N.t("EXP_MODE_RISKY")), /*#__PURE__*/React.createElement("div", {
      className: "exq-modes"
    }, [["prudente", "EXP_MODE_PRUDENT", "EXP_MODE_PRUDENT_SUB", "var(--elec)", "rgba(0,240,255,.08)"], ["risquee", "EXP_MODE_RISKY", "EXP_MODE_RISKY_SUB", "var(--alert)", "rgba(255,59,92,.1)"]].map(([k, tk, sk, accent, bgOn]) => {
      const on = mode === k;
      return /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => setMode(k),
        className: "exq-toggle",
        style: {
          alignItems: "flex-start",
          background: on ? bgOn : "var(--bg-panel)",
          borderColor: on ? accent : "var(--line)",
          color: on ? accent : "var(--text)"
        }
      }, /*#__PURE__*/React.createElement("b", {
        style: {
          fontSize: 13,
          letterSpacing: ".5px"
        }
      }, I18N.t(tk)), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          lineHeight: 1.35,
          color: "var(--text-dim)",
          textAlign: "left"
        }
      }, I18N.t(sk)));
    })), /*#__PURE__*/React.createElement("span", {
      className: "eyebrow",
      style: {
        fontSize: 10
      }
    }, "4 \xB7 ", I18N.t("EXP_TICKET_STEP")), /*#__PURE__*/React.createElement("div", {
      className: "exq-tickets"
    }, [[null, "EXP_TICKET_NONE", "EXP_TICKET_NONE_SUB", "var(--text-dim)", 999], ["argent", "EXP_TICKET_SILVER", "EXP_TICKET_SILVER_SUB", "var(--elec)", silverLeft], ["or", "EXP_TICKET_GOLD", "EXP_TICKET_GOLD_SUB", "var(--gold)", goldLeft]].map(([k, tk, sk, accent, left]) => {
      const on = ticket === k;
      const out = left <= 0;
      return /*#__PURE__*/React.createElement("button", {
        key: String(k),
        className: "exq-toggle exq-ticket",
        disabled: out,
        onClick: () => {
          if (!out) setTicket(k);
        },
        style: {
          alignItems: "flex-start",
          background: on ? "rgba(255,230,0,.08)" : "var(--bg-panel)",
          borderColor: on ? accent : "var(--line)",
          color: on ? accent : out ? "var(--text-faint)" : "var(--text)",
          opacity: out ? 0.5 : 1,
          cursor: out ? "not-allowed" : "pointer"
        }
      }, /*#__PURE__*/React.createElement("b", {
        style: {
          fontSize: 12,
          letterSpacing: ".4px"
        }
      }, I18N.t(tk), k !== null && /*#__PURE__*/React.createElement("span", {
        className: "exq-mono",
        style: {
          fontSize: 10,
          opacity: 0.7
        }
      }, " \xD7", left)), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          lineHeight: 1.35,
          color: "var(--text-dim)",
          textAlign: "left"
        }
      }, I18N.t(sk)));
    })), /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        padding: "13px 14px",
        border: "1px solid " + (ready3 ? successColor : "var(--line)")
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        fontSize: 10,
        marginBottom: 7
      }
    }, I18N.t("EXP_RATE")), ready3 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 44,
        lineHeight: 0.9,
        color: successColor,
        textShadow: "0 0 18px rgba(0,0,0,.4)"
      }
    }, pct, " %"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        fontSize: 11,
        lineHeight: 1.5,
        color: "var(--text-dim)"
      }
    }, I18N.t("EXP_POWER"), " ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text)"
      }
    }, pow.toLocaleString()), /*#__PURE__*/React.createElement("br", null), I18N.t("EXP_AFFINITY"), " ", world.type, " ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: world.color
      }
    }, "+", affBonus, " %"))) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)"
      }
    }, I18N.t("EXP_SELECT_3")), ready3 && ticket === "or" && /*#__PURE__*/React.createElement("div", {
      className: "exq-mono exq-goldnote"
    }, I18N.t("EXP_TICKET_GOLD_LOCKED")), ready3 && /*#__PURE__*/React.createElement("div", {
      className: "exq-mono",
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        marginTop: 6
      }
    }, I18N.t("EXP_RATE_NOTE")), ready3 && win && /*#__PURE__*/React.createElement("div", {
      className: "exq-lootprev"
    }, /*#__PURE__*/React.createElement("div", {
      className: "exq-lootcol"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-cap"
    }, I18N.t("EXP_LOOT_WIN")), /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        color: "var(--success)"
      }
    }, "+", win.fa, " FA"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-dim"
    }, "+", win.xp, " XP"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        color: world.color
      }
    }, "+", win.frags, " \xB7 ", I18N.t("EXP_FRAG"), " ", win.rank), win.core_frags > 0 && /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        color: world.color
      }
    }, "+", win.core_frags, " \xB7 \u2B21 ", I18N.t("EXP_FRAG_CORE"), " ", win.rank)), /*#__PURE__*/React.createElement("div", {
      className: "exq-lootsep"
    }), /*#__PURE__*/React.createElement("div", {
      className: "exq-lootcol"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-cap"
    }, I18N.t("EXP_LOOT_LOSE")), lose.fa > 0 ? /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        color: "var(--text-dim)"
      }
    }, "+", lose.fa, " FA") : /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        color: "var(--alert)"
      }
    }, "0 FA"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-dim"
    }, "+", lose.xp, " XP"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        color: lose.frags > 0 ? world.color : "var(--text-faint)"
      }
    }, "+", lose.frags, " \xB7 ", I18N.t("EXP_FRAG"), " ", lose.rank), lose.core_frags > 0 && /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        color: world.color
      }
    }, "+", lose.core_frags, " \xB7 \u2B21 ", I18N.t("EXP_FRAG_CORE"), " ", lose.rank))), allEpic && durH >= XU.DUST_MIN_H && /*#__PURE__*/React.createElement("div", {
      className: "exq-epicbox"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--gold)",
        fontSize: 15,
        flex: "none"
      }
    }, "\u25C8"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        lineHeight: 1.4
      }
    }, I18N.t("EXP_DUST"))), allEpic && durH < XU.DUST_MIN_H && /*#__PURE__*/React.createElement("div", {
      className: "exq-mono exq-dustnote"
    }, I18N.t("EXP_DUST_NEEDS_8H"))), /*#__PURE__*/React.createElement("button", {
      className: "exq-launch",
      disabled: !ready3 || busyCall,
      onClick: launch,
      style: ready3 ? {
        background: "linear-gradient(180deg, #14e0a0, #0fae7d)",
        border: "1px solid #6dffce",
        color: "#031a12",
        boxShadow: "0 0 22px rgba(39,224,138,.4)"
      } : {}
    }, "\u2B22 ", I18N.t("EXP_LAUNCH")), /*#__PURE__*/React.createElement("div", {
      className: "exq-mono",
      style: {
        textAlign: "center",
        fontSize: 11,
        color: "var(--text-dim)"
      }
    }, I18N.t("EXP_FREE_ENTRY")));
  }

  // ============ VUE SUIVI ============
  function renderTrack() {
    const e = byDest[selWorld];
    if (!e) return null; // l'effet trackOrphan ramène sur les destinations
    const endsAt = new Date(e.ends_at).getTime();
    const startedAt = new Date(e.started_at).getTime();
    const remain = Math.max(0, endsAt - now);
    // À 00:00 la vue bascule : RÉCLAMER remplace Rappeler (qui 409-erait,
    // le serveur refuse le rappel d'une expédition déjà arrivée à terme).
    const isReady = XU.statusOf(e, now) === "ready";
    const progPct = Math.round(Math.min(100, Math.max(0, (1 - remain / Math.max(1, endsAt - startedAt)) * 100)));
    const rate = e.success_rate;
    const crew = (e.beast_ids || []).map(beastById).filter(Boolean);
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-col"
    }, BackRow(), WorldHead(), /*#__PURE__*/React.createElement("div", {
      className: "exq-trackbox"
    }, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        fontSize: 10,
        color: isReady ? "var(--fire)" : "var(--elec)"
      }
    }, I18N.t(isReady ? "EXP_STATUS_READY" : "EXP_STATUS_RUNNING")), /*#__PURE__*/React.createElement("b", {
      className: "exq-mono exq-bigtime"
    }, XU.fmtCountdown(remain)), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-dim"
    }, I18N.t("EXP_BACK_AT", fmtClock(new Date(endsAt)))), /*#__PURE__*/React.createElement("div", {
      className: "exq-prog"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: progPct + "%"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "exq-statrow"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-cap"
    }, "MODE"), /*#__PURE__*/React.createElement("b", {
      style: {
        color: e.mode === "risquee" ? "var(--alert)" : "var(--elec)"
      }
    }, modeLabel(e.mode))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-cap"
    }, "\u23F1"), /*#__PURE__*/React.createElement("b", null, durLabel(e.duration_s))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-cap"
    }, "%"), /*#__PURE__*/React.createElement("b", {
      style: {
        color: rateColor(rate)
      }
    }, rate, " %"))), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        marginTop: -8
      }
    }, I18N.t("EXP_RATE_LOCKED")), /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        fontSize: 10
      }
    }, I18N.t("EXP_CREW")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7
      }
    }, crew.map(b => {
      const tm = typeMeta(b.type);
      return /*#__PURE__*/React.createElement("div", {
        key: b.id,
        className: "exq-crewrow"
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-crewart",
        style: {
          background: `linear-gradient(150deg, rgba(${tm.rgb},.16), rgba(6,9,18,.6))`
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: D.artFor(b),
        alt: "",
        draggable: "false"
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("b", {
        style: {
          display: "block",
          fontSize: 13,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, D.displayName(b)), /*#__PURE__*/React.createElement("span", {
        className: "exq-mono",
        style: {
          fontSize: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: tm.color
        }
      }, b.type), " ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: D.RARITY_COLORS[b.rarity] || "var(--text-dim)"
        }
      }, b.rarity))), /*#__PURE__*/React.createElement("b", {
        className: "exq-mono",
        style: {
          flex: "none",
          color: "var(--text-dim)",
          fontSize: 12
        }
      }, "NIV ", b.level));
    })), isReady ? /*#__PURE__*/React.createElement("button", {
      className: "exq-launch",
      disabled: busyCall,
      onClick: () => claim(e),
      style: {
        background: "linear-gradient(180deg, #ffb64d, #f7931a)",
        border: "1px solid #ffd08a",
        color: "#180a02",
        boxShadow: "0 0 22px rgba(247,147,26,.5)"
      }
    }, "\u25C8 ", I18N.t("EXP_CLAIM")) : !confirmRecall ? /*#__PURE__*/React.createElement("button", {
      className: "exq-recall",
      onClick: () => setConfirmRecall(true)
    }, I18N.t("EXP_RECALL")) : /*#__PURE__*/React.createElement("div", {
      className: "exq-recallbox"
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--alert)",
        fontSize: 14
      }
    }, I18N.t("EXP_RECALL")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        lineHeight: 1.45,
        color: "var(--text-dim)"
      }
    }, I18N.t("EXP_RECALL_CONFIRM")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn",
      onClick: () => setConfirmRecall(false)
    }, I18N.t("CANCEL")), /*#__PURE__*/React.createElement("button", {
      className: "btn",
      disabled: busyCall,
      style: {
        background: "var(--alert)",
        borderColor: "#ff8ba4",
        color: "#14030a",
        fontWeight: 700
      },
      onClick: () => doRecall(e)
    }, I18N.t("EXP_RECALL_YES")))));
  }

  // ============ VUE BUTIN ============
  function renderLoot() {
    if (!loot) return null; // l'effet lootOrphan ramène sur les destinations
    const rw = loot.rewards || {};
    const frags = rw.frags || {};
    const fragRanks = Object.keys(XU.FRAGMENT_COSTS).filter(rk => (frags[rk] || 0) > 0);
    // Fragments de core : absents des réponses d'un serveur antérieur — rien ne s'affiche alors.
    const coreFrags = rw.core_frags || {};
    const coreFragRanks = Object.keys(XU.CORE_FRAGMENT_COSTS).filter(rk => (coreFrags[rk] || 0) > 0);
    const failed = loot.success === false;
    const crew = (loot.beastIds || []).map(beastById).filter(Boolean);
    const fa = loot.fa_week || g.expFaWeek || {
      granted: 0,
      cap: 5000
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-col"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        fontSize: 10,
        color: failed ? "var(--alert)" : "var(--fire)"
      }
    }, wName(world)), /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 20
      }
    }, failed ? I18N.t("EXP_HARD_RETURN") : I18N.t("EXP_VICTORY"))), failed && /*#__PURE__*/React.createElement("div", {
      className: "exq-warn",
      style: {
        background: "rgba(255,59,92,.08)",
        borderColor: "rgba(255,59,92,.35)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--alert)"
      }
    }, "\u26A0"), /*#__PURE__*/React.createElement("span", null, I18N.t("EXP_EXHAUSTED"))), rw.dust && /*#__PURE__*/React.createElement("div", {
      className: "exq-dustbox"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-mono exq-goldchip"
    }, "\u25C8 ULTRA-RARE"), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--gold)",
        opacity: 0.85
      }
    }, "ON-CHAIN")), /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 19,
        color: "#ffe6a8",
        textShadow: "0 0 16px rgba(255,230,0,.5)"
      }
    }, I18N.t("EXP_DUST"))), rw.ticket && /*#__PURE__*/React.createElement("div", {
      className: "exq-ticketbox"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-hex",
      style: {
        color: "var(--gold)",
        borderColor: "var(--gold)",
        background: "rgba(255,230,0,.14)"
      }
    }, "\u2692"), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        display: "block",
        fontSize: 15
      }
    }, I18N.t("EXP_TICKET")))), fragRanks.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        padding: "12px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, fragRanks.map(rk => {
      const total = g.expFragments && g.expFragments[rk] || 0;
      const need = XU.FRAGMENT_COSTS[rk];
      const col = D.RANK_COLORS[rk];
      return /*#__PURE__*/React.createElement("div", {
        key: rk,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-hex",
        style: {
          color: col,
          borderColor: col,
          background: "rgba(255,255,255,.04)"
        }
      }, "\u2726"), /*#__PURE__*/React.createElement("b", {
        style: {
          flex: 1,
          minWidth: 0,
          fontSize: 13
        }
      }, I18N.t("EXP_FRAG_LINE", rk, frags[rk])), /*#__PURE__*/React.createElement("b", {
        className: "exq-mono",
        style: {
          color: col
        }
      }, total, " / ", need)), /*#__PURE__*/React.createElement(Bar, {
        frac: Math.min(1, total / need),
        kind: "xp"
      }));
    })), coreFragRanks.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        padding: "12px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, coreFragRanks.map(rk => {
      const total = g.expCoreFragments && g.expCoreFragments[rk] || 0;
      const need = XU.CORE_FRAGMENT_COSTS[rk];
      const col = D.RANK_COLORS[rk];
      return /*#__PURE__*/React.createElement("div", {
        key: rk,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "exq-hex",
        style: {
          color: col,
          borderColor: col,
          background: "rgba(255,255,255,.04)"
        }
      }, "\u2B21"), /*#__PURE__*/React.createElement("b", {
        style: {
          flex: 1,
          minWidth: 0,
          fontSize: 13
        }
      }, I18N.t("EXP_FRAG_CORE_LINE", rk, coreFrags[rk])), /*#__PURE__*/React.createElement("b", {
        className: "exq-mono",
        style: {
          color: col
        }
      }, total, " / ", need)), /*#__PURE__*/React.createElement(Bar, {
        frac: Math.min(1, total / need),
        kind: "xp"
      }));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6
      }
    }, crew.map(b => /*#__PURE__*/React.createElement("div", {
      key: b.id,
      className: "exq-xprow"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        background: "var(--success)",
        clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)",
        flex: "none"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, D.displayName(b))), /*#__PURE__*/React.createElement("b", {
      className: "exq-mono",
      style: {
        flex: "none",
        color: "var(--success)"
      }
    }, "+", rw.xp || 0, " XP")))), /*#__PURE__*/React.createElement("div", {
      className: "exq-farow"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--fire)",
        fontSize: 15
      }
    }, "\uD83D\uDD12 ", I18N.t("EXP_FA_LOCKED_GAIN", rw.fa || 0)), /*#__PURE__*/React.createElement("div", {
      className: "exq-mono",
      style: {
        fontSize: 10,
        color: "var(--text-dim)"
      }
    }, I18N.t("EXP_FA_CAP", fa.granted || 0, fa.cap || 5000))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "none",
        width: "38%",
        maxWidth: 150
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      frac: Math.min(1, (fa.granted || 0) / (fa.cap || 5000)),
      kind: "xp"
    }))), /*#__PURE__*/React.createElement("button", {
      className: "exq-launch",
      onClick: () => {
        setLoot(null);
        setView("dest");
      },
      style: {
        background: "linear-gradient(180deg, #ffb64d, #f7931a)",
        border: "1px solid #ffd08a",
        color: "#180a02",
        boxShadow: "0 0 22px rgba(247,147,26,.5)"
      }
    }, I18N.t("EXP_BACK")));
  }
  function BackRow() {
    return /*#__PURE__*/React.createElement("button", {
      className: "exq-back exq-mono",
      onClick: () => {
        setView("dest");
        setConfirmRecall(false);
      }
    }, I18N.t("EXP_BACK"));
  }

  // ============ PORTAIL : briques partagées par l'ALLER et le RETOUR ============
  function hexRing(size, col, delay) {
    return /*#__PURE__*/React.createElement("span", {
      key: size,
      className: "exq-ring",
      style: {
        width: size,
        height: size,
        margin: `-${size / 2}px 0 0 -${size / 2}px`,
        animationDelay: delay
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        background: col,
        clipPath: HEX_CLIP
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 3,
        background: "#05070f",
        clipPath: HEX_CLIP
      }
    }));
  }
  function hexShock(col) {
    return /*#__PURE__*/React.createElement("span", {
      className: "exq-shock"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        background: col,
        clipPath: HEX_CLIP
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        inset: 5,
        background: "#05070f",
        clipPath: HEX_CLIP
      }
    }));
  }
  // La carte animée porte le VRAI visuel du joueur (artFor + cadre par rang),
  // comme CreatureCard/CombatCard. Deux couches : le slot fait l'entrée (décalée
  // carte par carte), la carte fait le vol (simultané). L'aller aspire, le
  // retour recrache — seules les animations CSS changent, pas ce markup.
  function fxCard(b, i) {
    const tm = typeMeta(b && b.type);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "exq-fx-slot",
      style: {
        animationDelay: 0.2 + i * 0.26 + "s"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "exq-fx-card",
      style: {
        borderColor: tm.color,
        boxShadow: `0 0 16px rgba(${tm.rgb},.4)`,
        "--fx-x": i - 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-streak",
      style: {
        background: `linear-gradient(0deg, ${tm.color}, transparent)`,
        animationDelay: "1.3s"
      }
    }), b ? /*#__PURE__*/React.createElement("span", {
      className: "exq-fx-art",
      style: {
        borderColor: tm.color
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: D.artFor(b),
      alt: "",
      draggable: "false",
      onError: e => {
        const fb = D.ART[b.image_key];
        if (fb && !e.currentTarget.dataset.fb) {
          e.currentTarget.dataset.fb = "1";
          e.currentTarget.src = fb;
        }
      }
    })) : /*#__PURE__*/React.createElement("span", {
      className: "exq-hex",
      style: {
        color: tm.color,
        borderColor: tm.color,
        background: `linear-gradient(150deg, rgba(${tm.rgb},.22), rgba(6,9,18,.7))`
      }
    }, EXP_GLYPH[b && b.type] || "✦"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        padding: "0 4px"
      }
    }, b ? D.displayName(b) : ""), /*#__PURE__*/React.createElement("span", {
      className: "exq-mono",
      style: {
        fontSize: 9,
        color: tm.color
      }
    }, "NIV ", b ? b.level : "")));
  }

  // ============ OVERLAY DE LANCEMENT (aspiration dans le portail) ============
  function renderFx() {
    if (!fx) return null;
    const w = XU.worldOf(fx.worldId) || XU.WORLDS[0];
    const cards = fx.ids.map(beastById);
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-fx",
      onClick: endFx,
      role: "button"
    }, /*#__PURE__*/React.createElement("div", {
      className: "exq-fx-shake"
    }, [18, 78, 140, 205, 265, 325].map((deg, i) => /*#__PURE__*/React.createElement("span", {
      key: deg,
      className: "exq-fil",
      style: {
        transform: `rotate(${deg}deg)`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        background: `linear-gradient(90deg, ${i % 2 ? "#00F0FF" : w.color}, transparent)`,
        animationDelay: 0.12 + i * 0.05 + "s"
      }
    }))), /*#__PURE__*/React.createElement("span", {
      className: "exq-fx-glow",
      style: {
        background: `radial-gradient(circle, rgba(${w.rgb},.55), transparent 68%)`
      }
    }), [[232, w.color, "0s"], [172, "#00F0FF", ".08s"], [112, "#F7931A", ".16s"]].map(([size, col, delay]) => hexRing(size, col, delay)), /*#__PURE__*/React.createElement("div", {
      className: "exq-fx-cards"
    }, cards.map(fxCard)), hexShock(w.color), /*#__PURE__*/React.createElement("span", {
      className: "exq-flash"
    }), /*#__PURE__*/React.createElement("div", {
      className: "exq-fx-center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-stamp",
      style: {
        textShadow: `0 0 26px ${w.color}, 0 0 60px rgba(0,0,0,.9)`
      }
    }, wName(w).toUpperCase()), /*#__PURE__*/React.createElement("span", {
      className: "exq-eta exq-mono"
    }, I18N.t("EXP_BACK_AT", fmtClock(fx.endsAt)))), /*#__PURE__*/React.createElement("span", {
      className: "exq-skip exq-mono"
    }, "TAP \u203A")));
  }

  // ============ OVERLAY DE RETOUR (le portail recrache l'équipe) ============
  // Non cliquable : il dure 1,85 s et découvre la vue butin déjà montée dessous.
  function renderReturnFx() {
    if (!rfx) return null;
    const w = XU.worldOf(rfx.worldId) || XU.WORLDS[0];
    const cards = rfx.ids.map(beastById);
    const failed = rfx.success === false;
    const tint = failed ? "var(--alert)" : "var(--gold)";
    return /*#__PURE__*/React.createElement("div", {
      className: "exq-rfx"
    }, /*#__PURE__*/React.createElement("span", {
      className: "exq-fx-glow",
      style: {
        background: `radial-gradient(circle, rgba(${w.rgb},.55), transparent 68%)`
      }
    }), [[232, w.color, "0s"], [172, "#00F0FF", ".08s"], [112, tint, ".16s"]].map(([size, col, delay]) => hexRing(size, col, delay)), hexShock(w.color), /*#__PURE__*/React.createElement("span", {
      className: "exq-flash"
    }), /*#__PURE__*/React.createElement("div", {
      className: "exq-fx-cards"
    }, cards.map(fxCard)), /*#__PURE__*/React.createElement("span", {
      className: "exq-rfx-tag",
      style: {
        color: failed ? "var(--alert)" : "#fff",
        textShadow: `0 0 22px ${tint}, 0 0 60px rgba(0,0,0,.9)`
      }
    }, (failed ? I18N.t("EXP_HARD_RETURN") : I18N.t("EXP_VICTORY")).toUpperCase()));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, view === "dest" && renderDest(), view === "config" && renderConfig(), view === "track" && renderTrack(), view === "loot" && renderLoot(), renderFx(), renderReturnFx(), claiming && /*#__PURE__*/React.createElement("div", {
    className: "exq-claimfx"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "exq-burst",
    style: {
      borderColor: "var(--fire)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "exq-burst",
    style: {
      width: 110,
      height: 110,
      borderColor: "var(--gold)",
      animationDelay: ".1s"
    }
  }), /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 18,
      color: "var(--gold)",
      letterSpacing: 1,
      textShadow: "0 0 16px rgba(255,230,0,.8)"
    }
  }, "\u25C8"))));
}
Object.assign(window, {
  Expeditions
});
})();
