/* ============================================================
   FRACTAL ARENA — Tour infinie (endgame hebdomadaire).
   Serveur-autoritaire intégral : le client envoie 3 IDs (ordre =
   formation) + posture, et rejoue les events renvoyés (AreneBattle).
   PV du run (hp_frac) = état LOCAL du run serveur, jamais g.roster.
   ============================================================ */
const { useState, useEffect } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, rarityLabel, Bar, Modal, SectionHead, PostureSelect, AreneBattle, TokenIcon, FaText } = window;
const TU = window.FA_TOUR_UI, TAU = window.FA_ARENE_UI;

const TOUR_ERRK = {
  run_actif: "TOUR_ERR_ACTIVE", pas_de_run: "TOUR_ERR_NORUN",
  solde_insuffisant: "TOUR_ERR_BALANCE", betes_invalides: "TOUR_ERR_BEASTS",
};
function tourErr(code) { return I18N.t(TOUR_ERRK[code] || "TOUR_ERR_GENERIC"); }

/* Tuile roster : art + nom + barre de PV du RUN + sélection (ordre = formation). */
function TourBeastTile({ beast, hpFrac, dead, selIdx, onToggle }) {
  const rc = D.RARITY_COLORS[beast.rarity];
  const POS = ["AV", "MI", "AR"];
  return (
    <button className="panel oct" disabled={dead} onClick={onToggle}
      style={{
        border: "1px solid " + (selIdx >= 0 ? "var(--elec)" : "var(--line)"),
        padding: 8, textAlign: "center", cursor: dead ? "not-allowed" : "pointer",
        opacity: dead ? 0.45 : 1, position: "relative",
      }}>
      {selIdx >= 0 && (
        <span className="mono" style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--elec)", color: "#03121a", fontWeight: 700 }}>
          {POS[selIdx]}
        </span>
      )}
      <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto", borderRadius: 8, overflow: "hidden", background: "#0b1020", border: "1px solid " + rc }}>
        {D.ART[beast.image_key] && <img src={D.artFor(beast)} alt="" draggable="false" style={{ width: "100%", height: "100%", objectFit: "contain", filter: dead ? "grayscale(1)" : "none" }}
          onError={(e) => { const fb = D.ART[beast.image_key]; if (fb && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }} />}
        {dead && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 22 }}>☠</span>}
      </div>
      <div className="mono" style={{ fontSize: 10, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-dim)" }}>
        {D.displayName(beast)} · LV{beast.level}
      </div>
      <div style={{ marginTop: 3 }}><Bar frac={dead ? 0 : hpFrac} kind="hp" /></div>
      <div className="mono" style={{ fontSize: 9, color: dead ? "var(--alert)" : "var(--text)" }}>
        {dead ? I18N.t("TOUR_DEAD_TAG") : Math.round(hpFrac * 100) + "%"}
      </div>
    </button>
  );
}

/* Bandeau des 10 paliers de la semaine (✓ = payé). */
function TourTierBand({ score }) {
  const tiers = TU.tiersView(score.best_floor, score.claimed_tiers);
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 12 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--gold)", marginBottom: 8 }}>🏆 {I18N.t("TOUR_TIERS_TITLE")}</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {tiers.map((t) => (
          <div key={t.floor} className="oct-sm" style={{
            flex: "none", minWidth: 74, padding: "8px 6px", textAlign: "center",
            border: "1px solid " + (t.claimed ? "rgba(0,240,120,0.5)" : "var(--line-soft)"),
            background: t.claimed ? "rgba(0,240,120,0.07)" : "rgba(255,255,255,0.02)",
            opacity: t.claimed ? 1 : t.reached ? 0.9 : 0.55,
          }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("TOUR_FLOOR", t.floor)}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.claimed ? "var(--success)" : "var(--text)" }}><TokenIcon s={11} /> {fmt(t.fa)}</div>
            <div style={{ fontSize: 10, minHeight: 14 }}>
              {t.silver > 0 && <span style={{ color: "var(--elec)" }}>🎟×{t.silver}</span>}
              {t.gold > 0 && <span style={{ color: "var(--gold)" }}>🎟×{t.gold}</span>}
              {t.claimed && <span style={{ color: "var(--success)", marginLeft: 3 }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Top 50 de la semaine — lignes enrichies serveur {rank, name, wallet_short, value}. */
function TourLeaderboard() {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, top: [], error: false });
  useEffect(() => {
    let alive = true;
    actions.towerLeaderboard().then((r) => {
      if (!alive) return;
      if (r.ok) setSt({ loading: false, top: r.top, error: false });
      else setSt({ loading: false, top: [], error: true });
    });
    return () => { alive = false; };
  }, []);
  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 12 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--elec)", marginBottom: 8 }}>🗼 {I18N.t("TOUR_LB_TITLE")}</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}><FaText text={I18N.t("TOUR_LB_DOTATION")} s={11} /></div>
      {st.loading && <div className="muted mono" style={{ fontSize: 12, padding: 8 }}>{I18N.t("TOUR_LOADING")}</div>}
      {st.error && <div className="muted mono" style={{ fontSize: 12, padding: 8, color: "var(--alert)" }}>{I18N.t("TOUR_ERROR")}</div>}
      {!st.loading && !st.error && (
        <div className="lb-list">
          {st.top.length === 0 && <div className="muted mono" style={{ fontSize: 12, padding: 8 }}>{I18N.t("TOUR_LB_EMPTY")}</div>}
          {st.top.map((row) => (
            <div key={row.rank} className={cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)}>
              <span className="lb-rank">#{row.rank}</span>
              <span className="lb-name">{row.name}</span>
              <span className="lb-val">{I18N.t("TOUR_FLOOR", row.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Modale de départ (gratuit ou 2000 FA). */
function TourStartModal({ score, balance, busy, onConfirm, onClose }) {
  const free = !score.free_run_used;
  const cost = free ? 0 : TU.ENTRY_COST;
  const canPay = balance >= cost;
  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <div className="h1" style={{ fontSize: 22, textAlign: "center", margin: "4px 0 12px" }}>{I18N.t("TOUR_START_TITLE")}</div>
      <div className="mono" style={{ fontSize: 13, textAlign: "center", color: free ? "var(--success)" : "var(--text-dim)", marginBottom: 16 }}>
        {free ? I18N.t("TOUR_START_FREE_LINE") : <FaText text={I18N.t("TOUR_START_COST_LINE", fmt(cost))} />}
      </div>
      {!free && !canPay && <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--alert)", marginBottom: 12 }}>{I18N.t("TOUR_ERR_BALANCE")}</div>}
      <div className="flex gap8">
        <button className="btn ghost block" style={{ flex: 1 }} onClick={onClose} disabled={busy}>{I18N.t("TOUR_CANCEL")}</button>
        <button className="btn btn-elec block" style={{ flex: 1 }} onClick={onConfirm} disabled={busy || (!free && !canPay)}>{I18N.t("TOUR_START_CONFIRM")}</button>
      </div>
    </Modal>
  );
}

/* Modale de résultat post-rejeu : victoire/défaite, paliers payés, run over. */
function TourResultModal({ result, onClose }) {
  const { won, rewards, runOver, floor } = result;
  return (
    <Modal onClose={onClose} accent={won ? "var(--success)" : "var(--alert)"} openSound={null}>
      <div className="h1" style={{ fontSize: 26, textAlign: "center", color: won ? "var(--success)" : "var(--alert)", margin: "4px 0 12px" }}>
        {won ? I18N.t("TOUR_VICTORY") : I18N.t("TOUR_DEFEAT")}
      </div>
      {rewards.tiers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div className="h2" style={{ fontSize: 13, color: "var(--gold)" }}>{I18N.t("TOUR_REWARDS")}</div>
          {rewards.tiers.map((f) => (
            <div key={f} className="flex between center" style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-soft)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("TOUR_TIER_REACHED", f)}</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>
                +<TokenIcon s={11} /> {fmt((TU.TIERS.find((t) => t.floor === f) || { fa: 0 }).fa)}
              </span>
            </div>
          ))}
          {rewards.silver > 0 && <div className="mono" style={{ fontSize: 12, color: "var(--elec)", textAlign: "center" }}>+{rewards.silver} 🎟 Silver</div>}
          {rewards.gold > 0 && <div className="mono" style={{ fontSize: 12, color: "var(--gold)", textAlign: "center" }}>+{rewards.gold} 🎟 Gold</div>}
        </div>
      )}
      {runOver ? (
        <div className="mono" style={{ fontSize: 13, textAlign: "center", color: "var(--alert)", padding: "8px 0" }}>{I18N.t("TOUR_RUN_OVER")}</div>
      ) : won ? (
        <div className="mono" style={{ fontSize: 13, textAlign: "center", color: "var(--text-dim)", padding: "4px 0" }}>{I18N.t("TOUR_FLOOR", floor)} →</div>
      ) : null}
      <button className="btn btn-elec block lg" style={{ marginTop: 14 }} onClick={onClose}>{I18N.t("TOUR_CONTINUE")}</button>
    </Modal>
  );
}

function Tour() {
  const { g, actions, toast } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, weekKey: "", weekEndsAt: 0, run: null, score: null });
  const [busy, setBusy] = useState(false);
  const [posture, setPosture] = useState("equilibre");
  const [showStart, setShowStart] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [battle, setBattle] = useState(null);   // { events, p1Team, p2Team, won, floorFought }
  const [result, setResult] = useState(null);   // TourResultModal (affichée à la fermeture du rejeu)
  const [, setTick] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLog, setAutoLog] = useState([]);      // [{ floor, won, casualties:[nom], tiers:[floor] }]
  const [autoRecap, setAutoRecap] = useState(null); // { startFloor, bestFloor, tiers:[], silver, gold }
  const stopRef = React.useRef(false);
  const runningRef = React.useRef(false);

  async function refresh() {
    const r = await actions.towerState();
    if (r.ok) setSt({ loading: false, error: false, weekKey: r.weekKey, weekEndsAt: r.weekEndsAt, run: r.run, score: r.score });
    else if (r.reason !== "auth") setSt((s) => ({ ...s, loading: false, error: true }));
    else setSt((s) => ({ ...s, loading: false }));
  }
  useEffect(() => { setSt((s) => ({ ...s, loading: true })); refresh(); }, [g.wallet, g.authToken]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  if (!g.wallet || !g.authToken) {
    return (
      <div className="container">
        <SectionHead eyebrow="🗼 ENDGAME" title={I18N.t("TOUR_TITLE")} sub={I18N.t("TOUR_SUB")} />
        <div className="muted mono" style={{ textAlign: "center", padding: 24 }}>{I18N.t("TOUR_LOGIN")}</div>
      </div>
    );
  }
  if (st.loading) return <div className="container"><div className="muted mono" style={{ textAlign: "center", padding: 40 }}>{I18N.t("TOUR_LOADING")}</div></div>;
  if (st.error || !st.score) return <div className="container"><div className="muted mono" style={{ textAlign: "center", padding: 40, color: "var(--alert)" }}>{I18N.t("TOUR_ERROR")}</div></div>;

  const run = st.run;
  const rosterState = run ? run.roster_state : {};
  const view = TU.rosterRunView(g.roster, rosterState);
  const alive = TU.aliveCount(g.roster, rosterState);
  const engage = TU.validateEngage(g.selected, g.roster, rosterState);
  const selectedBeasts = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean);

  async function onStart() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerStart();
    setBusy(false);
    setShowStart(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); refresh(); return; }
    setSt((s) => ({
      ...s, run: r.run,
      score: { ...s.score, free_run_used: true, runs_paid: s.score.runs_paid + (r.cost > 0 ? 1 : 0) },
    }));
  }

  async function onFight() {
    if (busy || !run) return;
    if (!engage.ok) { toast(I18N.t("TOUR_NEED3"), "bad"); return; }
    setBusy(true);
    const r = await actions.towerFight(g.selected.slice(0, 3), posture);
    setBusy(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); refresh(); return; }
    setBattle({ events: r.events, p1Team: selectedBeasts, p2Team: r.enemy, won: r.won, floorFought: run.floor });
    setResult({ won: r.won, rewards: r.rewards, runOver: r.runOver, floor: r.floor });
    setSt((s) => ({
      ...s,
      run: r.runOver ? null : { floor: r.floor, roster_state: r.rosterState },
      score: {
        ...s.score,
        best_floor: Math.max(s.score.best_floor, r.bestFloor),
        claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers])),
      },
    }));
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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
    const sessionTiers = []; let sSilver = 0, sGold = 0, sessionBest = 0;
    let over = false;
    try {
      while (!stopRef.current) {
        const fittest = TU.pickFittest3(g.roster, curState);
        if (!fittest) { over = true; break; } // < 3 vivantes → run terminé
        const r = await actions.towerFight(fittest, posture);
        if (!r.ok) {
          if (r.reason === "trop_rapide") { await sleep(300); continue; } // throttle serveur : ré-attente
          toast(tourErr(r.reason), "bad");
          break;
        }
        const nextState = r.rosterState || {};
        const casualties = newCasualties(curState, nextState);
        setAutoLog((L) => [...L, { floor: curFloor, won: r.won, casualties, tiers: r.rewards.tiers }]);
        r.rewards.tiers.forEach((f) => sessionTiers.push(f));
        sSilver += r.rewards.silver || 0; sGold += r.rewards.gold || 0;
        if (r.won) sessionBest = Math.max(sessionBest, curFloor);
        setSt((s) => ({
          ...s,
          run: r.runOver ? null : { floor: r.floor, roster_state: nextState },
          score: {
            ...s.score,
            best_floor: Math.max(s.score.best_floor, r.bestFloor),
            claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers])),
          },
        }));
        curState = nextState;
        curFloor = r.runOver ? curFloor : r.floor;
        if (r.runOver) { over = true; break; }
        if (stopRef.current) break;
        await sleep(350);
      }
    } finally {
      runningRef.current = false;
      setAutoRunning(false);
      setAutoRecap({ startFloor, bestFloor: sessionBest, tiers: sessionTiers, silver: sSilver, gold: sGold, over });
    }
  }

  async function onAbandon() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerAbandon();
    setBusy(false);
    setShowAbandon(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); }
    refresh();
  }

  return (
    <div className="container wide">
      <SectionHead eyebrow="🗼 ENDGAME" title={I18N.t("TOUR_TITLE")} sub={I18N.t("TOUR_SUB")} />

      <div className="flex between center wrap" style={{ marginBottom: 14, gap: 10 }}>
        <span className="pill" style={{ color: "var(--gold)" }}>{I18N.t("TOUR_BEST", st.score.best_floor)}</span>
        <span className="pill mono" style={{ color: "var(--text-dim)" }}>{st.weekKey} · {I18N.t("TOUR_WEEK_ENDS", TAU.fmtCountdown(st.weekEndsAt - Date.now()))}</span>
        {!st.score.free_run_used && <span className="pill" style={{ color: "var(--success)" }}>{I18N.t("TOUR_FREE_BADGE")}</span>}
      </div>

      <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
        <TourTierBand score={st.score} />
      </div>

      {!run ? (
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 24, textAlign: "center", marginBottom: 14 }}>
          <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14 }}>{I18N.t("TOUR_NO_RUN")}</div>
          <button className="btn btn-fire lg" onClick={() => setShowStart(true)} disabled={busy}>
            {!st.score.free_run_used ? I18N.t("TOUR_START_FREE") : <FaText text={I18N.t("TOUR_START_PAID", fmt(TU.ENTRY_COST))} />}
          </button>
        </div>
      ) : (
        <div className="panel oct" style={{ border: "1px solid var(--elec)", padding: 18, marginBottom: 14 }}>
          <div className="flex between center wrap" style={{ marginBottom: 12, gap: 10 }}>
            <span className="h2" style={{ fontSize: 18, color: "var(--elec)" }}>{I18N.t("TOUR_FLOOR", run.floor)}</span>
            <span className="pill mono" style={{ fontSize: 11 }}>{I18N.t("TOUR_ALIVE", alive)}</span>
            <button className="btn ghost sm" onClick={() => setShowAbandon(true)} disabled={busy || autoRunning}>{I18N.t("TOUR_ABANDON")}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: 14 }}>
            {view.map(({ beast, hpFrac, dead }) => (
              <TourBeastTile key={beast.id} beast={beast} hpFrac={hpFrac} dead={dead}
                selIdx={g.selected.indexOf(beast.id)}
                onToggle={() => actions.toggleSelect(beast.id)} />
            ))}
          </div>

          {autoRunning ? (
            <div>
              <div className="flex between center" style={{ marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--elec)" }}>{I18N.t("TOUR_AUTO_RUNNING")}</span>
                <button className="btn btn-fire sm" onClick={() => { stopRef.current = true; }}>{I18N.t("TOUR_AUTO_STOP")}</button>
              </div>
              <div className="mono" style={{ maxHeight: 180, overflowY: "auto", fontSize: 11, display: "flex", flexDirection: "column-reverse", gap: 2, background: "rgba(0,0,0,0.2)", padding: 8, border: "1px solid var(--line-soft)" }}>
                {autoLog.slice().reverse().map((e, i) => (
                  <div key={autoLog.length - i} style={{ color: e.won ? "var(--success)" : "var(--alert)" }}>
                    {I18N.t(e.won ? "TOUR_AUTO_LOG_WIN" : "TOUR_AUTO_LOG_LOSS", e.floor)}
                    {e.tiers.length > 0 && <span style={{ color: "var(--gold)" }}> 🏆</span>}
                    {e.casualties.length > 0 && <span style={{ color: "var(--text-dim)" }}> · {e.casualties.join(", ")} ☠</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex between center wrap" style={{ gap: 12 }}>
              <PostureSelect value={posture} onChange={setPosture} disabled={busy} />
              <div className="flex gap8">
                {TU.pickFittest3(g.roster, rosterState) && (
                  <button className="btn btn-elec lg" onClick={onAuto} disabled={busy}>{I18N.t("TOUR_AUTO")}</button>
                )}
                {engage.ok
                  ? <button className="btn btn-fire lg" onClick={onFight} disabled={busy}>{I18N.t("TOUR_FIGHT", run.floor)}</button>
                  : <span className="mono" style={{ fontSize: 12, color: "var(--alert)" }}>{I18N.t("TOUR_NEED3")}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <TourLeaderboard />

      {showStart && (
        <TourStartModal score={st.score} balance={g.liquid + g.locked} busy={busy}
          onConfirm={onStart} onClose={() => setShowStart(false)} />
      )}
      {showAbandon && (
        <Modal onClose={() => setShowAbandon(false)} accent="var(--alert)">
          <div className="h1" style={{ fontSize: 20, textAlign: "center", margin: "4px 0 10px" }}>{I18N.t("TOUR_ABANDON_TITLE")}</div>
          <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--text-dim)", marginBottom: 16 }}>{I18N.t("TOUR_ABANDON_DESC")}</div>
          <div className="flex gap8">
            <button className="btn ghost block" style={{ flex: 1 }} onClick={() => setShowAbandon(false)} disabled={busy}>{I18N.t("TOUR_CANCEL")}</button>
            <button className="btn btn-fire block" style={{ flex: 1 }} onClick={onAbandon} disabled={busy}>{I18N.t("TOUR_ABANDON_CONFIRM")}</button>
          </div>
        </Modal>
      )}
      {battle && (
        <AreneBattle events={battle.events} p1Team={battle.p1Team} p2Team={battle.p2Team} won={battle.won}
          opponentName={I18N.t("TOUR_FLOOR", battle.floorFought)} p1Posture={posture} p2Posture="equilibre"
          onClose={() => setBattle(null)} />
      )}
      {!battle && result && <TourResultModal result={result} onClose={() => setResult(null)} />}
      {autoRecap && (
        <Modal onClose={() => { setAutoRecap(null); refresh(); }} accent="var(--elec)">
          <div className="h1" style={{ fontSize: 22, textAlign: "center", margin: "4px 0 12px" }}>{I18N.t(autoRecap.over ? "TOUR_AUTO_RECAP_TITLE" : "TOUR_AUTO_RECAP_STOPPED")}</div>
          <div className="mono" style={{ fontSize: 14, textAlign: "center", color: "var(--elec)", marginBottom: 12 }}>
            {I18N.t("TOUR_AUTO_RECAP_CLIMB", autoRecap.startFloor, Math.max(autoRecap.startFloor, autoRecap.bestFloor))}
          </div>
          {autoRecap.tiers.length > 0 && (
            <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--gold)", marginBottom: 8 }}>
              🏆 {autoRecap.tiers.map((f) => I18N.t("TOUR_FLOOR", f)).join(" · ")}
            </div>
          )}
          {(autoRecap.silver > 0 || autoRecap.gold > 0) && (
            <div className="mono" style={{ fontSize: 12, textAlign: "center", marginBottom: 8 }}>
              {autoRecap.silver > 0 && <span style={{ color: "var(--elec)" }}>+{autoRecap.silver} 🎟 </span>}
              {autoRecap.gold > 0 && <span style={{ color: "var(--gold)" }}>+{autoRecap.gold} 🎟</span>}
            </div>
          )}
          <button className="btn btn-elec block lg" style={{ marginTop: 10 }} onClick={() => { setAutoRecap(null); refresh(); }}>{I18N.t("TOUR_CONTINUE")}</button>
        </Modal>
      )}
    </div>
  );
}

Object.assign(window, { Tour });
