/* Généré par tools/precompile.mjs depuis fosse.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — La Fosse screen (combat solo / paris vs maison)
   ============================================================ */
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;
const D = window.FA_DATA,
  I18N = window.FA_I18N;
const {
  useFA,
  cx,
  fmt,
  presetLabel,
  rarityLabel,
  Bar,
  Modal,
  TokenIcon
} = window;
const {
  cosmeticEnemyScale
} = window.FA_COSMETIC;
const {
  loopDecision
} = window.FA_LOOP;

// Formate une durée en ms vers HH:MM:SS (borné à 0).
// NB : nom unique — le scope global est partagé entre les .jsx et quests.jsx
// définit déjà un fmtCountdown(sec) qui sinon écraserait celui-ci.
function fmtFreeCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// Avantage de type d'une bête face à l'équipe adverse (cf. spec §1.3).
// Renvoie une flèche verte ↑ si la bête bat un type adverse (×1.25), une
// flèche rouge ↓ si un type adverse la bat (×0.80), ou null si neutre.
// L'avantage prime sur le désavantage quand les deux coexistent.
function typeAdvInfo(myType, oppMeta) {
  if (!myType || !oppMeta) return null;
  let strongVs = null,
    weakVs = null;
  for (const m of oppMeta) {
    if (!m || !m.type) continue;
    const mult = D.getTypeMultiplier(myType, m.type);
    if (mult > 1 && !strongVs) strongVs = m.type;else if (mult < 1 && !weakVs) weakVs = m.type;
  }
  const L = D.TYPE_LABEL;
  if (strongVs) return {
    arrow: "▲",
    color: "var(--success)",
    tip: I18N.t("AR_TYPE_ADV", L[myType] || myType, L[strongVs] || strongVs)
  };
  if (weakVs) return {
    arrow: "▼",
    color: "var(--alert)",
    tip: I18N.t("AR_TYPE_DIS", L[myType] || myType, L[weakVs] || weakVs)
  };
  return null;
}
function CombatCard({
  meta,
  live,
  side,
  cref,
  oppMeta,
  scale = 1
}) {
  if (!meta) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      ref: cref,
      style: {
        "--rc": "var(--line)",
        opacity: 0.5
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "art",
      style: {
        display: "grid",
        placeItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        color: "var(--text-faint)",
        fontSize: 30
      }
    }, "?")), /*#__PURE__*/React.createElement("div", {
      className: "body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cname muted"
    }, "\u2014")));
  }
  const rc = D.RARITY_COLORS[meta.rarity];
  const frac = live ? live.maxHp > 0 ? live.hp / live.maxHp : 0 : 1;
  const dead = live && !live.alive;
  return /*#__PURE__*/React.createElement("div", {
    className: cx("card", dead && "dead"),
    ref: cref,
    style: {
      "--rc": rc
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "art"
  }, /*#__PURE__*/React.createElement("img", {
    src: D.artFor(meta),
    alt: meta.name,
    draggable: "false",
    onError: e => {
      const fb = D.ART[meta.image_key];
      if (fb && !e.currentTarget.dataset.fb) {
        e.currentTarget.dataset.fb = "1";
        e.currentTarget.src = fb;
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "rar-tag"
  }, rarityLabel(meta.rarity)), /*#__PURE__*/React.createElement("div", {
    className: "lvl-tag"
  }, "LV ", meta.level)), /*#__PURE__*/React.createElement("div", {
    className: "body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex center",
    style: {
      gap: 4,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cname"
  }, meta.name), (() => {
    const adv = typeAdvInfo(meta.type, oppMeta);
    if (!adv) return null;
    return /*#__PURE__*/React.createElement("span", {
      title: adv.tip,
      style: {
        color: adv.color,
        fontSize: 12,
        lineHeight: 1,
        fontWeight: 700,
        flex: "none"
      }
    }, adv.arrow);
  })()), /*#__PURE__*/React.createElement("div", {
    className: "cpreset",
    style: {
      color: D.PRESET_COLORS[meta.preset]
    }
  }, presetLabel(meta.preset))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-label"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: side === "p1" ? "var(--elec)" : "var(--alert)"
    }
  }, "HP"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)"
    }
  }, D.fmtStat(Math.round((live ? Math.max(0, live.hp) : meta.maxHp) * scale)), "/", D.fmtStat(Math.round((live ? live.maxHp : meta.maxHp) * scale)))), /*#__PURE__*/React.createElement(Bar, {
    frac: frac,
    kind: "hp"
  })), /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, [["ATK", meta.atk], ["DEF", meta.def], ["SPD", meta.spd], ["MAG", meta.mag]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "v",
    title: String(Math.round(v * scale))
  }, D.fmtStat(Math.round(v * scale))))))));
}

// Pastilles d'armement des boosts — directement dans la Fosse : un tap arme ou
// désarme (persisté serveur) ; le compteur affiche les charges restantes. Un boost
// désarmé ne se consomme JAMAIS, même avec des charges en stock.
function BoostPills() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [busy, setBusy] = useState(null);
  const defs = [{
    key: "xp_boost",
    label: I18N.t("BO_XP_NAME"),
    color: "var(--gold)"
  }, {
    key: "lucky_strike",
    label: I18N.t("BO_LUCKY_NAME"),
    color: "var(--fire)"
  }, {
    key: "momentum",
    label: I18N.t("BO_MOM_NAME"),
    color: "#9B5CFF"
  }, {
    key: "catalyst",
    label: I18N.t("BO_CAT_NAME"),
    color: "var(--success)"
  }];
  async function tap(key) {
    if (busy) return;
    // Sans charge, rien à activer — même garde que le serveur (no_charges).
    if (!g.boostsArmed[key] && (g.boosts[key] || 0) <= 0) {
      toast(I18N.t("BO_NO_CHARGES"), "bad");
      return;
    }
    setBusy(key);
    const r = await actions.toggleBoost(key, !g.boostsArmed[key]);
    setBusy(null);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t(r.armed ? "BO_ARMED_ON" : "BO_ARMED_OFF"), r.armed ? "good" : "info");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 wrap",
    style: {
      marginBottom: 14
    }
  }, defs.map(d => {
    const n = g.boosts[d.key] || 0;
    const armed = g.boostsArmed[d.key] === true;
    const lit = armed && n > 0;
    return /*#__PURE__*/React.createElement("button", {
      key: d.key,
      onClick: () => tap(d.key),
      disabled: busy !== null,
      className: "pill",
      title: I18N.t("BO_ARM_HINT"),
      style: {
        cursor: "pointer",
        background: "none",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: lit ? d.color : "var(--text-dim)",
        borderColor: armed ? d.color : "var(--line)",
        opacity: n <= 0 && !armed ? 0.55 : 1,
        boxShadow: lit ? `0 0 12px color-mix(in srgb, ${d.color} 30%, transparent)` : "none"
      }
    }, armed ? "⬢" : "⬡", " ", d.label, " \xB7 ", n);
  }));
}
function Fosse() {
  const {
    g,
    actions,
    toast
  } = useFA();
  // Référence vivante vers l'état : la chaîne de la boucle (settleBattle → playFight)
  // réutilise sa closure de départ ; sans ce ref, le roster (niveau/stats) reste figé
  // au lancement du Loop et l'affichage "recule" après une montée de niveau.
  const gRef = useRef(g);
  gRef.current = g;
  const selectedBeasts = g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean);
  const ready = selectedBeasts.length === 3;
  const [betTier, setBetTier] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [p1Live, setP1Live] = useState(null);
  const [p2Live, setP2Live] = useState(null);
  const [p1Meta, setP1Meta] = useState(selectedBeasts.map(beastMeta));
  const [p2Meta, setP2Meta] = useState([null, null, null]);
  const [p2Scale, setP2Scale] = useState([1, 1, 1]);
  const [logLines, setLogLines] = useState([]);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  const loopRef = useRef(false);
  const runIdRef = useRef(0);
  const stepRef = useRef(null);
  const battleRef = useRef(null);
  const logRef = useRef(null);
  const p1Refs = useRef([]);
  const p2Refs = useRef([]);
  const boardRef = useRef(null);
  function beastMeta(b) {
    return b ? {
      name: D.displayName(b),
      type: b.type,
      rarity: b.rarity,
      image_key: b.image_key,
      rank: b.rank,
      preset: b.preset,
      level: b.level,
      maxHp: D.eff(b, "hp"),
      atk: D.eff(b, "atk"),
      def: D.eff(b, "def"),
      spd: D.eff(b, "spd"),
      mag: D.eff(b, "mag")
    } : null;
  }

  // keep idle preview synced with selection
  useEffect(() => {
    if (!playing) {
      setP1Meta(selectedBeasts.map(beastMeta));
      setP1Live(selectedBeasts.map(b => ({
        hp: D.eff(b, "hp"),
        maxHp: D.eff(b, "hp"),
        alive: true
      })));
    }
  }, [g.selected.join(","), g.roster, playing]);

  // Un combat en cours de résolution ne se fait pas interrompre par une bulle de
  // quiz : on marque l'application occupée le temps du déroulé (quiz.jsx lit le
  // drapeau `fa-busy` sur <body>), et on le retire aussi au démontage.
  useEffect(() => {
    const set = window.FA_SET_BUSY;
    if (set) set("fosse", playing);
    return () => {
      if (set) set("fosse", false);
    };
  }, [playing]);

  // cleanup on unmount
  useEffect(() => () => {
    loopRef.current = false;
    runIdRef.current++;
    if (stepRef.current) clearTimeout(stepRef.current);
  }, []);
  function log(text, cls) {
    setLogLines(L => [...L.slice(-120), {
      text,
      cls
    }]);
  }
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);
  function stopBattle() {
    if (stepRef.current) {
      clearTimeout(stepRef.current);
      stepRef.current = null;
    }
  }

  // Begin one fight. Uses a setTimeout-driven stepper (robust under Babel transform).
  async function playFight(isLoopRun) {
    if (!ready) {
      toast(I18N.t("AR_NEED3"), "bad");
      return;
    }
    if (!g.wallet) {
      toast(I18N.t("OB_WALLET_REQUIRED"), "bad");
      return;
    }
    const free = betTier === "" && g.freeFights > 0;
    if (betTier === "" && g.freeFights <= 0) {
      toast(I18N.t("AR_PICK_BET"), "bad");
      return;
    }
    const bet = await actions.callFight({
      free,
      betTier,
      isLoop: isLoopRun
    });
    if (!bet.ok) {
      // bete_en_expedition : garde serveur des Expéditions — code traduit, pas brut.
      const msg = bet.reason === "bete_en_expedition" ? I18N.t("EXP_ERR_bete_en_expedition") : bet.reason || I18N.t("AR_INSUFF");
      toast(msg, "bad");
      if (isLoopRun) {
        loopRef.current = false;
        setLoop(false);
      }
      return;
    }
    if (bet.note) toast(bet.note, "info");
    const effTier = bet.betTier;
    setPlaying(true);
    setResult(null);
    if (!isLoopRun) setLogLines([]);

    // Le serveur a joué le combat : on rejoue sa séquence d'events et son équipe adverse
    const enemies = bet.enemy || [];
    const events = bet.events || [];
    // Roster VIVANT (via gRef) — sinon la closure du Loop fige niveau/stats au démarrage
    // de la boucle, et l'affichage du joueur "recule" d'un niveau après une montée serveur.
    const liveSelected = gRef.current.selected.map(id => gRef.current.roster.find(b => b.id === id)).filter(Boolean);
    const playerBeasts = liveSelected.length === 3 ? liveSelected : selectedBeasts;
    setP1Meta(playerBeasts.map(beastMeta));
    setP2Meta(enemies.map(beastMeta));
    setP2Scale(cosmeticEnemyScale(enemies, playerBeasts));
    const battle = {
      events,
      winner: bet.won ? "p1" : "p2"
    };
    if (events.length) {
      setP1Live(events[0]?.state?.p1);
      setP2Live(events[0]?.state?.p2);
    }
    if (free) log(I18N.t("L_FREE"), "lc-green");else log(I18N.t("L_BET", I18N.t("AR_" + effTier.toUpperCase()), bet.betAmount), "lc-gold");
    log(I18N.t("L_START"), "lc-elec");
    const spd = g.options.speed || 1;
    const baseDelay = 165; // animations toujours actives : cadence plancher du déroulé de combat
    battleRef.current = {
      battle,
      i: 0,
      isLoopRun,
      free,
      effTier,
      bet,
      spd,
      baseDelay
    };
    stopBattle();
    stepRef.current = setTimeout(stepBattle, 220 / spd);
  }
  function stepBattle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const {
      battle,
      spd,
      baseDelay
    } = ctx;
    if (ctx.i >= battle.events.length) {
      settleBattle();
      return;
    }
    const ev = battle.events[ctx.i++];
    let delay = baseDelay / spd;
    switch (ev.t) {
      case "round":
        setRound(ev.round);
        log("── " + I18N.t("AR_ROUND", ev.round) + " ──", "lc-yellow");
        delay = baseDelay * 0.6 / spd;
        break;
      case "atk":
      case "sp":
      case "crit":
        {
          const J = window.FA_JUICE;
          const aEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
          const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
          const tLive = (ev.tside === "p1" ? ev.state.p1 : ev.state.p2)[ev.tidx];
          if (J) {
            J.lunge(aEl, ev.side);
            J.hit(tEl, {
              dmg: ev.dmg,
              maxHp: tLive ? tLive.maxHp : 0,
              kind: ev.t === "sp" ? "sp" : "atk",
              crit: ev.crit,
              boardEl: boardRef.current
            });
          }
          setP1Live(ev.state.p1);
          setP2Live(ev.state.p2);
          const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
          log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
          if (ev.down) {
            if (J) J.ko(tEl);
            log(I18N.t("L_DOWN", ev.tname), "lc-yellow");
          }
          if (J) delay += J.hitStopMs(ev.crit) / spd;
          break;
        }
      case "miss":
        log(I18N.t("L_MISS", ev.name), "lc-dim");
        delay = baseDelay * 0.6 / spd;
        break;
      case "heal":
        {
          const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
          if (window.FA_JUICE) window.FA_JUICE.heal(hEl, {
            amount: ev.heal
          });
          setP1Live(ev.state.p1);
          setP2Live(ev.state.p2);
          log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
          delay = baseDelay * 0.5 / spd;
          break;
        }
      case "timeout":
        log(I18N.t("L_TIMEOUT"), "lc-dim");
        delay = 80 / spd;
        break;
      case "win":
      case "lose":
        setP1Live(ev.state.p1);
        setP2Live(ev.state.p2);
        delay = 40 / spd;
        break;
    }
    stepRef.current = setTimeout(stepBattle, delay);
  }
  function settleBattle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const {
      battle,
      isLoopRun,
      free,
      effTier,
      bet,
      spd
    } = ctx;
    const win = battle.winner === "p1";
    log(win ? I18N.t("L_WIN") : I18N.t("L_LOSE"), win ? "lc-green" : "lc-red");
    const summary = actions.resolveFight({
      win,
      free,
      betTier: effTier,
      betAmount: bet.betAmount,
      fromLocked: bet.fromLocked,
      isLoop: isLoopRun
    });
    summary.levelUps.forEach(e => log(I18N.t("L_LEVELUP", D.displayName(e.beast), e.beast.level), "lc-elec"));
    summary.rarityUps.forEach(e => log(I18N.t("L_RARITYUP", D.displayName(e.beast), rarityLabel(e.beast.rarity)), "lc-purple"));

    // L'XP gagnée "pope" sur chaque carte de l'équipe — même langage visuel que
    // les dégâts, en boucle comprise (léger décalage carte par carte). Gardé
    // comme FA_FINISHER : juice.js absent ne doit rien casser.
    if (win && summary.xp > 0 && window.FA_JUICE && window.FA_JUICE.xp) {
      log(I18N.t("L_XP_GAIN", summary.xp), "lc-elec");
      p1Refs.current.forEach((el, i) => {
        if (el) setTimeout(() => window.FA_JUICE.xp(el, {
          amount: summary.xp
        }), (160 + i * 150) / spd);
      });
    }
    setPlaying(false);
    battleRef.current = null;
    if (loopRef.current) {
      // Décision pure sur l'état FRAIS (gRef.current) — la closure de la boucle fige
      // `g`, donc lire `g` ici raterait la montée des compteurs de loop et du solde.
      const dec = loopDecision(gRef.current, betTier, D.ECON);
      if (dec.go) {
        stepRef.current = setTimeout(() => {
          if (loopRef.current) playFight(true);
        }, 640 / spd);
        return;
      }
      // Boucle terminée. On prévient quand c'est le plafond quotidien du tier qui
      // l'arrête (plus de repli auto sur Bronze) ; arrêt silencieux sinon (solde / gratuits).
      loopRef.current = false;
      setLoop(false);
      if (dec.reason === "cap") {
        toast(I18N.t(dec.tier === "gold" ? "AR_LOOP_END_GOLD" : "AR_LOOP_END_SILVER"), "info");
      }
      return;
    }
    loopRef.current = false;
    setLoop(false);
    if (!isLoopRun) {
      // Le finisher précède la modale ; le garde !isLoopRun le rend inatteignable
      // depuis la boucle (invariant verrouillé par test/finisher-hooks.test.js).
      const showResult = () => setResult({
        win,
        free,
        ...summary
      });
      if (window.FA_FINISHER) window.FA_FINISHER.play({
        win,
        onDone: showResult
      });else showResult();
    }
  }
  function onFight() {
    if (playing) return;
    setResult(null);
    playFight(false);
  }
  function onLoop() {
    if (loop) {
      loopRef.current = false;
      setLoop(false);
      return;
    }
    if (!ready) {
      toast(I18N.t("AR_NEED3"), "bad");
      return;
    }
    // Même garde-fou qu'entre deux combats (settleBattle) : si le plafond du tier est
    // atteint (ou plus de gratuits / solde insuffisant), la boucle NE DÉMARRE PAS.
    // Sans ça, le 1er combat partait quand même (rabattu sur Bronze, ponctionnant la
    // mise) avant de s'arrêter au tour suivant.
    const dec = loopDecision(gRef.current, betTier, D.ECON);
    if (!dec.go) {
      if (dec.reason === "cap") toast(I18N.t(dec.tier === "gold" ? "AR_LOOP_END_GOLD" : "AR_LOOP_END_SILVER"), "info");else if (dec.reason === "free") toast(I18N.t("AR_FREE_EMPTY"), "bad");else toast(I18N.t("AR_INSUFF"), "bad");
      return;
    }
    loopRef.current = true;
    setLoop(true);
    if (!playing) playFight(true);
  }
  const total = g.session.wins + g.session.losses;
  const wr = total ? Math.round(g.session.wins / total * 100) : 0;
  const nextMs = D.ECON.MILESTONE_EVERY - g.totalFights % D.ECON.MILESTONE_EVERY;
  const betTiers = [{
    k: "bronze",
    c: "#CD7F32"
  }, {
    k: "silver",
    c: "#C0C0C0"
  }, {
    k: "gold",
    c: "var(--gold)"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "container wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 14,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, I18N.t("OB_TAG")), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      marginBottom: 0
    }
  }, I18N.t("NAV_FOSSE"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: wr >= 60 ? "var(--success)" : wr >= 45 ? "var(--gold)" : "var(--alert)"
    }
  }, I18N.t("AR_WINRATE", g.session.wins, g.session.losses, wr)), /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, I18N.t("AR_NEXT_MS", nextMs)), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("AR_LOOPS_LEFT", Math.max(0, D.ECON.LOOP_SILVER_MAX - g.loopSilverToday), D.ECON.LOOP_SILVER_MAX, Math.max(0, D.ECON.LOOP_GOLD_MAX - g.loopGoldToday), D.ECON.LOOP_GOLD_MAX)), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--elec)"
    }
  }, I18N.t("AR_TICKETS", g.ticketsSilver, g.ticketsGold)))), /*#__PURE__*/React.createElement(BoostPills, null), /*#__PURE__*/React.createElement("div", {
    ref: boardRef,
    className: "panel oct",
    style: {
      position: "relative",
      overflow: "hidden",
      border: "1px solid var(--line)",
      padding: "26px 22px 22px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "var(--filigrane)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      opacity: 0.16,
      mixBlendMode: "luminosity"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(6,9,18,0.55), rgba(6,9,18,0.82))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex center arena-board-row",
    style: {
      gap: 18,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      color: "var(--elec)",
      fontSize: 15
    }
  }, g.ordinalName || g.playerTitle || g.playerName || I18N.t("AR_YOU")), round > 0 && /*#__PURE__*/React.createElement("span", {
    className: "pill mono",
    style: {
      fontSize: 10
    }
  }, I18N.t("AR_ROUND", round))), /*#__PURE__*/React.createElement("div", {
    className: "team-row",
    style: {
      gridTemplateColumns: "repeat(3,1fr)"
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement(CombatCard, {
    key: i,
    side: "p1",
    meta: p1Meta[i],
    live: p1Live && p1Live[i],
    oppMeta: p2Meta,
    cref: el => p1Refs.current[i] = el
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex center arena-vs",
    style: {
      flexDirection: "column",
      justifyContent: "center",
      flex: "none",
      width: 70
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hex",
    style: {
      width: 64,
      height: 70,
      background: "linear-gradient(160deg, var(--fire), #7a1f0a)",
      display: "grid",
      placeItems: "center",
      boxShadow: "0 0 30px rgba(247,147,26,0.4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hex",
    style: {
      width: 56,
      height: 62,
      background: "var(--bg-0)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      letterSpacing: 1,
      color: "var(--fire)"
    }
  }, "VS")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      color: "var(--alert)",
      fontSize: 15
    }
  }, I18N.t("AR_VERSUS"))), /*#__PURE__*/React.createElement("div", {
    className: "team-row",
    style: {
      gridTemplateColumns: "repeat(3,1fr)"
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement(CombatCard, {
    key: i,
    side: "p2",
    meta: p2Meta[i],
    live: p2Live && p2Live[i],
    oppMeta: p1Meta,
    scale: p2Scale[i] || 1,
    cref: el => p2Refs.current[i] = el
  }))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.1fr 0.9fr",
      gap: 16,
      marginTop: 16
    },
    className: "arena-lower"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      minHeight: 260
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center arena-log-head",
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 14,
      color: "var(--fire)"
    }
  }, I18N.t("AR_LOG")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)"
    }
  }, "terminal://fractal.arena")), /*#__PURE__*/React.createElement("div", {
    className: "log",
    ref: logRef,
    style: {
      flex: 1,
      maxHeight: 320
    }
  }, logLines.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "lc-dim"
  }, "> ", I18N.t("TEAM_HINT"), "\u2026"), logLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: cx("log-line", l.cls)
  }, l.text)))), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("AR_BET")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: g.freeFights > 0 ? "var(--success)" : "var(--text-dim)"
    }
  }, g.freeFights > 0 ? I18N.t("AR_FREE_LEFT", g.freeFights) : I18N.t("AR_FREE_NEXT", fmtFreeCountdown(86400000 - Date.now() % 86400000)))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 arena-bet-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: cx("btn sm", betTier === "" && "on"),
    style: {
      flex: 1,
      "--c": "var(--success)"
    },
    disabled: playing,
    onClick: () => setBetTier("")
  }, I18N.t("AR_FREE")), betTiers.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: cx("btn sm", betTier === t.k && "on"),
    style: {
      flex: 1.3,
      "--c": t.c
    },
    disabled: playing,
    onClick: () => setBetTier(t.k)
  }, I18N.t("AR_" + t.k.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      opacity: 0.8,
      marginLeft: 4,
      display: "inline-flex",
      alignItems: "center",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(TokenIcon, {
    s: 11
  }), " ", D.ECON.BET[t.k])))), betTier && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 6
    }
  }, "+", /*#__PURE__*/React.createElement(TokenIcon, {
    s: 11
  }), " ", D.ECON.BET_GAIN[betTier], " ", I18N.t("RES_NET"), " \xB7 \xD7", D.ECON.PAYOUT_MULT)), /*#__PURE__*/React.createElement("label", {
    className: "flex between center",
    style: {
      cursor: "pointer",
      padding: "8px 0",
      borderTop: "1px solid var(--line-soft)",
      borderBottom: "1px solid var(--line-soft)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("AR_USE_LOCKED")), /*#__PURE__*/React.createElement("span", {
    onClick: () => actions.setUseLocked(!g.useLocked),
    className: "oct-sm",
    style: {
      width: 42,
      height: 22,
      background: g.useLocked ? "var(--fire)" : "#1a2238",
      position: "relative",
      transition: "background .2s",
      borderRadius: 11
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: g.useLocked ? 22 : 3,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: "#fff",
      transition: "left .2s"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8",
    style: {
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-success block lg",
    style: {
      flex: 1.4
    },
    disabled: playing || !ready,
    onClick: onFight
  }, I18N.t("AR_FIGHT")), /*#__PURE__*/React.createElement("button", {
    className: cx("btn block lg", loop ? "btn-forge on" : "btn-forge"),
    style: {
      flex: 1
    },
    disabled: !ready,
    onClick: onLoop
  }, loop ? I18N.t("AR_LOOP_ON") : I18N.t("AR_LOOP_OFF"))), !ready && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--alert)",
      textAlign: "center"
    }
  }, I18N.t("AR_NEED3")))), result && /*#__PURE__*/React.createElement(ResultModal, {
    data: result,
    onClose: () => setResult(null)
  }));
}
function ResultModal({
  data,
  onClose
}) {
  const win = data.win;
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: win ? "var(--success)" : "var(--alert)",
    openSound: null
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: win ? "var(--success)" : "var(--alert)"
    }
  }, data.free ? I18N.t("RES_LOCKED_GAIN") : "FRACTALARENA"), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 38,
      color: win ? "var(--success)" : "var(--alert)",
      margin: "4px 0"
    }
  }, win ? I18N.t("RES_WIN") : I18N.t("RES_LOSE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 9
    }
  }, win ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: I18N.t("RES_GAIN"),
    value: "+" + fmt(data.payout),
    color: "var(--gold)"
  }), !data.free && /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: I18N.t("RES_NET"),
    value: (data.net >= 0 ? "+" : "") + fmt(data.net),
    color: data.net >= 0 ? "var(--success)" : "var(--alert)"
  }), /*#__PURE__*/React.createElement(ResRow, {
    label: I18N.t("RES_XP"),
    value: "+" + data.xp,
    color: "var(--elec)"
  }), data.luckyBonus > 0 && /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: "Lucky Strike",
    value: "+" + fmt(data.luckyBonus),
    color: "var(--fire)"
  }), data.momentumBonus > 0 && /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: `${I18N.t("BO_MOM_NAME")} ×${data.winStreak}`,
    value: "+" + fmt(data.momentumBonus),
    color: "#9B5CFF"
  }), data.catalystUnlocked > 0 && /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: I18N.t("RES_CATALYST"),
    value: "+" + fmt(data.catalystUnlocked),
    color: "var(--success)"
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ResRow, {
    fa: true,
    label: I18N.t("RES_BUYBACK"),
    value: fmt(data.betAmount),
    color: "var(--alert)"
  }), /*#__PURE__*/React.createElement(ResRow, {
    label: I18N.t("RES_XP"),
    value: "+0",
    color: "var(--text-dim)"
  })), data.milestone && /*#__PURE__*/React.createElement("div", {
    className: "oct-sm",
    style: {
      marginTop: 6,
      padding: "12px 14px",
      background: "rgba(255,230,0,0.08)",
      border: "1px solid rgba(255,230,0,0.4)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--gold)",
      fontSize: 13
    }
  }, I18N.t("RES_MILESTONE", D.ECON.MILESTONE_REWARD)), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 3
    }
  }, "+", D.ECON.TICKET_SILVER_PER_MS, " \uD83C\uDF9F Silver \xB7 +", D.ECON.TICKET_GOLD_PER_MS, " \uD83C\uDF9F Gold"))), /*#__PURE__*/React.createElement("button", {
    className: cx("btn block lg", win ? "btn-success" : "btn-elec"),
    style: {
      marginTop: 20
    },
    onClick: onClose
  }, I18N.t("RES_CONTINUE")));
}
function ResRow({
  label,
  value,
  color,
  fa
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      padding: "9px 14px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--line-soft)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      color: "var(--text-dim)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 16,
      fontWeight: 700,
      color
    }
  }, fa && /*#__PURE__*/React.createElement(TokenIcon, {
    s: 14
  }), " ", value));
}
Object.assign(window, {
  Fosse
});
})();
