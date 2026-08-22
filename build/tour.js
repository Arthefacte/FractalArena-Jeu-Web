/* Généré par tools/precompile.mjs depuis tour.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Tour infinie (endgame hebdomadaire).
   Serveur-autoritaire intégral : le client envoie 3 IDs (ordre =
   formation) + posture, et rejoue les events renvoyés (AreneBattle).
   PV du run (hp_frac) = état LOCAL du run serveur, jamais g.roster.
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const D = window.FA_DATA,
  I18N = window.FA_I18N;
const {
  useFA,
  cx,
  fmt,
  rarityLabel,
  Bar,
  Modal,
  SectionHead,
  PostureSelect,
  AreneBattle,
  TokenIcon,
  FaText
} = window;
const TU = window.FA_TOUR_UI,
  TAU = window.FA_ARENE_UI;
const TOUR_ERRK = {
  run_actif: "TOUR_ERR_ACTIVE",
  pas_de_run: "TOUR_ERR_NORUN",
  solde_insuffisant: "TOUR_ERR_BALANCE",
  betes_invalides: "TOUR_ERR_BEASTS"
};
function tourErr(code) {
  return I18N.t(TOUR_ERRK[code] || "TOUR_ERR_GENERIC");
}

/* Tuile roster : art + nom + barre de PV du RUN + sélection (ordre = formation). */
function TourBeastTile({
  beast,
  hpFrac,
  dead,
  selIdx,
  onToggle
}) {
  const rc = D.RARITY_COLORS[beast.rarity];
  const POS = ["AV", "MI", "AR"];
  return /*#__PURE__*/React.createElement("button", {
    className: "panel oct",
    disabled: dead,
    onClick: onToggle,
    style: {
      border: "1px solid " + (selIdx >= 0 ? "var(--elec)" : "var(--line)"),
      padding: 8,
      textAlign: "center",
      cursor: dead ? "not-allowed" : "pointer",
      opacity: dead ? 0.45 : 1,
      position: "relative"
    }
  }, selIdx >= 0 && /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      position: "absolute",
      top: 4,
      left: 4,
      fontSize: 9,
      padding: "1px 5px",
      borderRadius: 4,
      background: "var(--elec)",
      color: "#03121a",
      fontWeight: 700
    }
  }, POS[selIdx]), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 56,
      height: 56,
      margin: "0 auto",
      borderRadius: 8,
      overflow: "hidden",
      background: "#0b1020",
      border: "1px solid " + rc
    }
  }, D.ART[beast.image_key] && /*#__PURE__*/React.createElement("img", {
    src: D.artFor(beast),
    alt: "",
    draggable: "false",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      filter: dead ? "grayscale(1)" : "none"
    },
    onError: e => {
      const fb = D.ART[beast.image_key];
      if (fb && !e.currentTarget.dataset.fb) {
        e.currentTarget.dataset.fb = "1";
        e.currentTarget.src = fb;
      }
    }
  }), dead && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      fontSize: 22
    }
  }, "\u2620")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      marginTop: 4,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: "var(--text-dim)"
    }
  }, D.displayName(beast), " \xB7 LV", beast.level), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    frac: dead ? 0 : hpFrac,
    kind: "hp"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      color: dead ? "var(--alert)" : "var(--text)"
    }
  }, dead ? I18N.t("TOUR_DEAD_TAG") : Math.round(hpFrac * 100) + "%"));
}

/* Bandeau des mutateurs de la semaine. Les VALEURS viennent du serveur
   (/tower/state) et ne sont jamais redéclarées ici — seuls les noms sont
   localisés. Absent/vide → rien affiché : c'est ce qui permet de déployer
   ce client AVANT le serveur sans rien casser. */
function TourMutatorBand({
  mutators
}) {
  const list = TU.formatMutators(mutators);
  if (!list.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 13,
      color: "var(--elec)",
      marginBottom: 4
    }
  }, "\u26A1 ", I18N.t("MUT_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--text-dim)",
      marginBottom: 8
    }
  }, I18N.t("MUT_HINT")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, list.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      flex: "1 1 160px",
      minWidth: 0,
      padding: 8,
      borderRadius: 6,
      background: "rgba(255,255,255,0.03)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--gold)",
      marginBottom: 4
    }
  }, I18N.t("MUT_NAME_" + String(m.id).toUpperCase())), m.types && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--text-dim)",
      marginBottom: 2
    }
  }, I18N.t("MUT_AFFINITY_LINE", I18N.t("MUT_TYPE_" + m.types.favored), I18N.t("MUT_TYPE_" + m.types.penalized))), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, m.parts.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: p.stat,
    style: {
      color: p.text.startsWith("+") ? "var(--elec)" : "var(--alert)"
    }
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)"
    }
  }, " · "), I18N.t("MUT_STAT_" + p.stat.toUpperCase()), " ", p.text)))))));
}

/* Bandeau des paliers de la semaine (✓ = payé) — 13 depuis les jalons 75/100. */
function TourTierBand({
  score
}) {
  const tiers = TU.tiersView(score.best_floor, score.claimed_tiers);
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 13,
      color: "var(--gold)",
      marginBottom: 8
    }
  }, "\uD83C\uDFC6 ", I18N.t("TOUR_TIERS_TITLE")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      paddingBottom: 4
    }
  }, tiers.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.floor,
    className: "oct-sm",
    style: {
      flex: "none",
      minWidth: 74,
      padding: "8px 6px",
      textAlign: "center",
      border: "1px solid " + (t.claimed ? "rgba(0,240,120,0.5)" : "var(--line-soft)"),
      background: t.claimed ? "rgba(0,240,120,0.07)" : "rgba(255,255,255,0.02)",
      opacity: t.claimed ? 1 : t.reached ? 0.9 : 0.55
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--text-dim)"
    }
  }, I18N.t("TOUR_FLOOR", t.floor)), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: t.claimed ? "var(--success)" : "var(--text)"
    }
  }, /*#__PURE__*/React.createElement(TokenIcon, {
    s: 11
  }), " ", fmt(t.fa)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      minHeight: 14
    }
  }, t.silver > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--elec)"
    }
  }, "\uD83C\uDF9F\xD7", t.silver), t.gold > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--gold)"
    }
  }, "\uD83C\uDF9F\xD7", t.gold), t.claimed && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--success)",
      marginLeft: 3
    }
  }, "\u2713"))))));
}

/* Top 50 de la semaine — lignes enrichies serveur {rank, name, wallet_short, value}. */
function TourLeaderboard() {
  const {
    g,
    actions
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    top: [],
    error: false
  });
  useEffect(() => {
    let alive = true;
    actions.towerLeaderboard().then(r => {
      if (!alive) return;
      if (r.ok) setSt({
        loading: false,
        top: r.top,
        error: false
      });else setSt({
        loading: false,
        top: [],
        error: true
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 13,
      color: "var(--elec)",
      marginBottom: 8
    }
  }, "\uD83D\uDDFC ", I18N.t("TOUR_LB_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("TOUR_LB_DOTATION"),
    s: 11
  })), st.loading && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      padding: 8
    }
  }, I18N.t("TOUR_LOADING")), st.error && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      padding: 8,
      color: "var(--alert)"
    }
  }, I18N.t("TOUR_ERROR")), !st.loading && !st.error && /*#__PURE__*/React.createElement("div", {
    className: "lb-list"
  }, st.top.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      padding: 8
    }
  }, I18N.t("TOUR_LB_EMPTY")), st.top.map(row => /*#__PURE__*/React.createElement("div", {
    key: row.rank,
    className: cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)
  }, /*#__PURE__*/React.createElement("span", {
    className: "lb-rank"
  }, "#", row.rank), /*#__PURE__*/React.createElement("span", {
    className: "lb-name"
  }, row.name), /*#__PURE__*/React.createElement("span", {
    className: "lb-val"
  }, I18N.t("TOUR_FLOOR", row.value))))));
}

/* Modale de départ (gratuit, ou le prix du prochain run annoncé par le serveur). */
function TourStartModal({
  state,
  score,
  balance,
  busy,
  onConfirm,
  onClose
}) {
  const free = !score.free_run_used;
  // Le montant vient du serveur (`next_cost`) : depuis que le prix monte avec les runs
  // déjà payés dans la semaine, une constante figée afficherait 2 000 là où on débite 500.
  const cost = TU.nextCost(state, score);
  const canPay = balance >= cost;
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 22,
      textAlign: "center",
      margin: "4px 0 12px"
    }
  }, I18N.t("TOUR_START_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      textAlign: "center",
      color: free ? "var(--success)" : "var(--text-dim)",
      marginBottom: 16
    }
  }, free ? I18N.t("TOUR_START_FREE_LINE") : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("TOUR_START_COST_LINE", fmt(cost))
  })), !free && !canPay && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      textAlign: "center",
      color: "var(--alert)",
      marginBottom: 12
    }
  }, I18N.t("TOUR_ERR_BALANCE")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost block",
    style: {
      flex: 1
    },
    onClick: onClose,
    disabled: busy
  }, I18N.t("TOUR_CANCEL")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block",
    style: {
      flex: 1
    },
    onClick: onConfirm,
    disabled: busy || !free && !canPay
  }, I18N.t("TOUR_START_CONFIRM"))));
}

/* Modale de résultat post-rejeu : victoire/défaite, paliers payés, run over. */
function TourResultModal({
  result,
  onClose
}) {
  const {
    won,
    rewards,
    runOver,
    floor
  } = result;
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: won ? "var(--success)" : "var(--alert)",
    openSound: null
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 26,
      textAlign: "center",
      color: won ? "var(--success)" : "var(--alert)",
      margin: "4px 0 12px"
    }
  }, won ? I18N.t("TOUR_VICTORY") : I18N.t("TOUR_DEFEAT")), rewards.tiers.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 13,
      color: "var(--gold)"
    }
  }, I18N.t("TOUR_REWARDS")), rewards.tiers.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    className: "flex between center",
    style: {
      padding: "8px 12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--line-soft)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("TOUR_TIER_REACHED", f)), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--success)"
    }
  }, "+", /*#__PURE__*/React.createElement(TokenIcon, {
    s: 11
  }), " ", fmt((TU.TIERS.find(t => t.floor === f) || {
    fa: 0
  }).fa)))), rewards.silver > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--elec)",
      textAlign: "center"
    }
  }, "+", rewards.silver, " \uD83C\uDF9F Silver"), rewards.gold > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--gold)",
      textAlign: "center"
    }
  }, "+", rewards.gold, " \uD83C\uDF9F Gold")), runOver ? /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      textAlign: "center",
      color: "var(--alert)",
      padding: "8px 0"
    }
  }, I18N.t("TOUR_RUN_OVER")) : won ? /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      textAlign: "center",
      color: "var(--text-dim)",
      padding: "4px 0"
    }
  }, I18N.t("TOUR_FLOOR", floor), " \u2192") : null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block lg",
    style: {
      marginTop: 14
    },
    onClick: onClose
  }, I18N.t("TOUR_CONTINUE")));
}
function Tour() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    error: false,
    weekKey: "",
    weekEndsAt: 0,
    run: null,
    score: null,
    mutators: []
  });
  const [busy, setBusy] = useState(false);
  const [posture, setPosture] = useState("equilibre");
  const [showStart, setShowStart] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [battle, setBattle] = useState(null); // { events, p1Team, p2Team, won, floorFought }
  const [result, setResult] = useState(null); // TourResultModal (affichée à la fermeture du rejeu)
  const [, setTick] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLog, setAutoLog] = useState([]); // [{ floor, won, casualties:[nom], tiers:[floor] }]
  const [autoRecap, setAutoRecap] = useState(null); // { startFloor, bestFloor, tiers:[], silver, gold }
  const stopRef = React.useRef(false);
  const runningRef = React.useRef(false);
  async function refresh() {
    const r = await actions.towerState();
    if (r.ok) setSt({
      loading: false,
      error: false,
      weekKey: r.weekKey,
      weekEndsAt: r.weekEndsAt,
      run: r.run,
      score: r.score,
      mutators: r.mutators || []
    });else if (r.reason !== "auth") setSt(s => ({
      ...s,
      loading: false,
      error: true
    }));else setSt(s => ({
      ...s,
      loading: false
    }));
  }
  useEffect(() => {
    setSt(s => ({
      ...s,
      loading: true
    }));
    refresh();
  }, [g.wallet, g.authToken]);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!g.wallet || !g.authToken) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement(SectionHead, {
      eyebrow: "\uD83D\uDDFC ENDGAME",
      title: I18N.t("TOUR_TITLE"),
      sub: I18N.t("TOUR_SUB")
    }), /*#__PURE__*/React.createElement("div", {
      className: "muted mono",
      style: {
        textAlign: "center",
        padding: 24
      }
    }, I18N.t("TOUR_LOGIN")));
  }
  if (st.loading) return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      textAlign: "center",
      padding: 40
    }
  }, I18N.t("TOUR_LOADING")));
  if (st.error || !st.score) return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      textAlign: "center",
      padding: 40,
      color: "var(--alert)"
    }
  }, I18N.t("TOUR_ERROR")));
  const run = st.run;
  const rosterState = run ? run.roster_state : {};
  const view = TU.rosterRunView(g.roster, rosterState);
  const alive = TU.aliveCount(g.roster, rosterState);
  const engage = TU.validateEngage(g.selected, g.roster, rosterState);
  const selectedBeasts = g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean);
  async function onStart() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerStart();
    setBusy(false);
    setShowStart(false);
    if (!r.ok) {
      toast(tourErr(r.reason), "bad");
      refresh();
      return;
    }
    setSt(s => {
      const runsPaid = s.score.runs_paid + (r.cost > 0 ? 1 : 0);
      return {
        ...s,
        run: r.run,
        score: {
          ...s.score,
          free_run_used: true,
          runs_paid: runsPaid
        },
        // `next_cost` vient d'être invalidé par ce run : le recalculer localement, sinon
        // l'écran continue d'annoncer le prix précédent jusqu'au prochain /tower/state.
        next_cost: TU.entryCost(runsPaid)
      };
    });
  }
  async function onFight() {
    if (busy || !run) return;
    if (!engage.ok) {
      toast(I18N.t("TOUR_NEED3"), "bad");
      return;
    }
    setBusy(true);
    const r = await actions.towerFight(g.selected.slice(0, 3), posture);
    setBusy(false);
    if (!r.ok) {
      toast(tourErr(r.reason), "bad");
      refresh();
      return;
    }
    setBattle({
      events: r.events,
      p1Team: selectedBeasts,
      p2Team: r.enemy,
      won: r.won,
      floorFought: run.floor
    });
    setResult({
      won: r.won,
      rewards: r.rewards,
      runOver: r.runOver,
      floor: r.floor
    });
    setSt(s => ({
      ...s,
      run: r.runOver ? null : {
        floor: r.floor,
        roster_state: r.rosterState
      },
      score: {
        ...s.score,
        best_floor: Math.max(s.score.best_floor, r.bestFloor),
        claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers]))
      }
    }));
  }
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Bêtes passées de vivantes à mortes entre deux états de run (pour le log).
  function newCasualties(prevState, nextState) {
    const names = [];
    for (const b of g.roster) {
      if (!TU.isDeadInRun(prevState, b.id) && TU.isDeadInRun(nextState, b.id)) names.push(D.displayName(b));
    }
    return names;
  }
  async function onAuto() {
    if (runningRef.current || busy || !run) return;
    runningRef.current = true;
    stopRef.current = false;
    setAutoRunning(true);
    setAutoLog([]);
    let curState = run.roster_state || {};
    let curFloor = run.floor;
    const startFloor = run.floor;
    const sessionTiers = [];
    let sSilver = 0,
      sGold = 0,
      sessionBest = 0;
    let over = false;
    try {
      while (!stopRef.current) {
        const fittest = TU.pickFittest3(g.roster, curState);
        if (!fittest) {
          over = true;
          break;
        } // < 3 vivantes → run terminé
        const r = await actions.towerFight(fittest, posture);
        if (!r.ok) {
          if (r.reason === "trop_rapide") {
            await sleep(300);
            continue;
          } // throttle serveur : ré-attente
          toast(tourErr(r.reason), "bad");
          break;
        }
        const nextState = r.rosterState || {};
        const casualties = newCasualties(curState, nextState);
        setAutoLog(L => [...L, {
          floor: curFloor,
          won: r.won,
          casualties,
          tiers: r.rewards.tiers
        }]);
        r.rewards.tiers.forEach(f => sessionTiers.push(f));
        sSilver += r.rewards.silver || 0;
        sGold += r.rewards.gold || 0;
        if (r.won) sessionBest = Math.max(sessionBest, curFloor);
        setSt(s => ({
          ...s,
          run: r.runOver ? null : {
            floor: r.floor,
            roster_state: nextState
          },
          score: {
            ...s.score,
            best_floor: Math.max(s.score.best_floor, r.bestFloor),
            claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers]))
          }
        }));
        curState = nextState;
        curFloor = r.runOver ? curFloor : r.floor;
        if (r.runOver) {
          over = true;
          break;
        }
        if (stopRef.current) break;
        await sleep(350);
      }
    } finally {
      runningRef.current = false;
      setAutoRunning(false);
      setAutoRecap({
        startFloor,
        bestFloor: sessionBest,
        tiers: sessionTiers,
        silver: sSilver,
        gold: sGold,
        over
      });
    }
  }
  async function onAbandon() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerAbandon();
    setBusy(false);
    setShowAbandon(false);
    if (!r.ok) {
      toast(tourErr(r.reason), "bad");
    }
    refresh();
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container wide"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83D\uDDFC ENDGAME",
    title: I18N.t("TOUR_TITLE"),
    sub: I18N.t("TOUR_SUB")
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 14,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("TOUR_BEST", st.score.best_floor)), /*#__PURE__*/React.createElement("span", {
    className: "pill mono",
    style: {
      color: "var(--text-dim)"
    }
  }, st.weekKey, " \xB7 ", I18N.t("TOUR_WEEK_ENDS", TAU.fmtCountdown(st.weekEndsAt - Date.now()))), !st.score.free_run_used && /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--success)"
    }
  }, I18N.t("TOUR_FREE_BADGE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(TourMutatorBand, {
    mutators: st.mutators
  }), /*#__PURE__*/React.createElement(TourTierBand, {
    score: st.score
  })), !run ? /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 24,
      textAlign: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      color: "var(--text-dim)",
      marginBottom: 14
    }
  }, I18N.t("TOUR_NO_RUN")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire lg",
    onClick: () => setShowStart(true),
    disabled: busy
  }, !st.score.free_run_used ? I18N.t("TOUR_START_FREE") : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("TOUR_START_PAID", fmt(TU.nextCost(st, st.score)))
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--elec)",
      padding: 18,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 12,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 18,
      color: "var(--elec)"
    }
  }, I18N.t("TOUR_FLOOR", run.floor)), /*#__PURE__*/React.createElement("span", {
    className: "pill mono",
    style: {
      fontSize: 11
    }
  }, I18N.t("TOUR_ALIVE", alive)), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setShowAbandon(true),
    disabled: busy || autoRunning
  }, I18N.t("TOUR_ABANDON"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
      gap: 8,
      marginBottom: 14
    }
  }, view.map(({
    beast,
    hpFrac,
    dead
  }) => /*#__PURE__*/React.createElement(TourBeastTile, {
    key: beast.id,
    beast: beast,
    hpFrac: hpFrac,
    dead: dead,
    selIdx: g.selected.indexOf(beast.id),
    onToggle: () => actions.toggleSelect(beast.id)
  }))), autoRunning ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--elec)"
    }
  }, I18N.t("TOUR_AUTO_RUNNING")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire sm",
    onClick: () => {
      stopRef.current = true;
    }
  }, I18N.t("TOUR_AUTO_STOP"))), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      maxHeight: 180,
      overflowY: "auto",
      fontSize: 11,
      display: "flex",
      flexDirection: "column-reverse",
      gap: 2,
      background: "rgba(0,0,0,0.2)",
      padding: 8,
      border: "1px solid var(--line-soft)"
    }
  }, autoLog.slice().reverse().map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: autoLog.length - i,
    style: {
      color: e.won ? "var(--success)" : "var(--alert)"
    }
  }, I18N.t(e.won ? "TOUR_AUTO_LOG_WIN" : "TOUR_AUTO_LOG_LOSS", e.floor), e.tiers.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--gold)"
    }
  }, " \uD83C\uDFC6"), e.casualties.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)"
    }
  }, " \xB7 ", e.casualties.join(", "), " \u2620"))))) : /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(PostureSelect, {
    value: posture,
    onChange: setPosture,
    disabled: busy
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8"
  }, TU.pickFittest3(g.roster, rosterState) && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec lg",
    onClick: onAuto,
    disabled: busy
  }, I18N.t("TOUR_AUTO")), engage.ok ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire lg",
    onClick: onFight,
    disabled: busy
  }, I18N.t("TOUR_FIGHT", run.floor)) : /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--alert)"
    }
  }, I18N.t("TOUR_NEED3"))))), /*#__PURE__*/React.createElement(TourLeaderboard, null), showStart && /*#__PURE__*/React.createElement(TourStartModal, {
    state: st,
    score: st.score,
    balance: g.liquid + g.locked,
    busy: busy,
    onConfirm: onStart,
    onClose: () => setShowStart(false)
  }), showAbandon && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowAbandon(false),
    accent: "var(--alert)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 20,
      textAlign: "center",
      margin: "4px 0 10px"
    }
  }, I18N.t("TOUR_ABANDON_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      textAlign: "center",
      color: "var(--text-dim)",
      marginBottom: 16
    }
  }, I18N.t("TOUR_ABANDON_DESC")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost block",
    style: {
      flex: 1
    },
    onClick: () => setShowAbandon(false),
    disabled: busy
  }, I18N.t("TOUR_CANCEL")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire block",
    style: {
      flex: 1
    },
    onClick: onAbandon,
    disabled: busy
  }, I18N.t("TOUR_ABANDON_CONFIRM")))), battle && /*#__PURE__*/React.createElement(AreneBattle, {
    events: battle.events,
    p1Team: battle.p1Team,
    p2Team: battle.p2Team,
    won: battle.won,
    opponentName: I18N.t("TOUR_FLOOR", battle.floorFought),
    p1Posture: posture,
    p2Posture: "equilibre",
    onClose: () => setBattle(null)
  }), !battle && result && /*#__PURE__*/React.createElement(TourResultModal, {
    result: result,
    onClose: () => setResult(null)
  }), autoRecap && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => {
      setAutoRecap(null);
      refresh();
    },
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 22,
      textAlign: "center",
      margin: "4px 0 12px"
    }
  }, I18N.t(autoRecap.over ? "TOUR_AUTO_RECAP_TITLE" : "TOUR_AUTO_RECAP_STOPPED")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 14,
      textAlign: "center",
      color: "var(--elec)",
      marginBottom: 12
    }
  }, I18N.t("TOUR_AUTO_RECAP_CLIMB", autoRecap.startFloor, Math.max(autoRecap.startFloor, autoRecap.bestFloor))), autoRecap.tiers.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      textAlign: "center",
      color: "var(--gold)",
      marginBottom: 8
    }
  }, "\uD83C\uDFC6 ", autoRecap.tiers.map(f => I18N.t("TOUR_FLOOR", f)).join(" · ")), (autoRecap.silver > 0 || autoRecap.gold > 0) && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      textAlign: "center",
      marginBottom: 8
    }
  }, autoRecap.silver > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--elec)"
    }
  }, "+", autoRecap.silver, " \uD83C\uDF9F "), autoRecap.gold > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--gold)"
    }
  }, "+", autoRecap.gold, " \uD83C\uDF9F")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block lg",
    style: {
      marginTop: 10
    },
    onClick: () => {
      setAutoRecap(null);
      refresh();
    }
  }, I18N.t("TOUR_CONTINUE"))));
}
Object.assign(window, {
  Tour
});
})();
