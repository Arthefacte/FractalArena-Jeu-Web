// ============================================================
// FRACTAL ARENA — Écran Expéditions (idle 1 h / 2 h / 8 h)
// Port du proto Claude Design « Expeditions.dc.html » (4 vues +
// animation de lancement). Le serveur fait foi : l'état vient de
// GET /expeditions/state (g.expeditions), le taux affiché en
// config est un aperçu (FA_EXPEDITIONS_UI), le taux FIGÉ est
// celui renvoyé par /start. Résolution du butin AU CLAIM.
// ============================================================
const { useState, useEffect, useRef } = React;
const I18N = window.FA_I18N;
const D = window.FA_DATA;
const XU = window.FA_EXPEDITIONS_UI;
const { useFA, SectionHead, Bar } = window;

const EXP_GLYPH = { HASH: "#", MINING: "⛏", LEDGER: "▤", NETWORK: "❖", GENESIS: "✦", BLOCK: "▣" };
const EXP_ERRK = {
  bete_en_expedition: "EXP_ERR_bete_en_expedition",
  destination_occupee: "EXP_ERR_destination_occupee",
  expedition_en_cours: "EXP_ERR_expedition_en_cours",
  deja_reclame: "EXP_ERR_deja_reclame",
  expedition_rappelee: "EXP_ERR_expedition_rappelee",
  expedition_non_rappelable: "EXP_ERR_expedition_non_rappelable",
  fragments_insuffisants: "EXP_ERR_fragments_insuffisants",
  betes_invalides: "EXP_ERR_betes_invalides",
};
function expErr(code) { return I18N.t(EXP_ERRK[code] || "EXP_ERR_generic"); }
function typeMeta(type) {
  const w = XU.WORLDS.find((x) => x.type === type);
  return w || { color: "var(--elec)", rgb: "0,240,255" };
}
function fmtClock(d) {
  try { return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }
}
function reducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

function Expeditions() {
  const { g, actions, toast } = useFA();
  const [view, setView] = useState("dest");        // dest | config | track | loot
  const [selWorld, setSelWorld] = useState(null);
  const [sel, setSel] = useState([]);
  const [dur, setDur] = useState(7200);
  const [mode, setMode] = useState("prudente");
  const [busyCall, setBusyCall] = useState(false);
  const [fx, setFx] = useState(null);              // { worldId, rate, endsAt, ids } pendant l'animation
  const [justLaunched, setJustLaunched] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [loot, setLoot] = useState(null);          // { success, rewards, fa_week, worldId, beastIds }
  const [confirmRecall, setConfirmRecall] = useState(false);
  const [, setTick] = useState(0);
  const fxTimer = useRef(null);

  // Tick 1 s seulement là où un compte à rebours est visible (dest, track).
  const ticking = view === "dest" || view === "track";
  useEffect(() => {
    if (!ticking) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [ticking]);
  // Rafraîchit à l'OUVERTURE de l'écran ; le changement de jeton est déjà
  // couvert par l'effet global d'app.jsx (sinon double requête au boot).
  useEffect(() => { if (g.authToken) actions.expeditionsState(); }, []);
  useEffect(() => () => { if (fxTimer.current) clearTimeout(fxTimer.current); }, []);

  const now = Date.now() + (g.expNowOffset || 0);
  const exps = Array.isArray(g.expeditions) ? g.expeditions : [];
  const byDest = {};
  exps.forEach((e) => { byDest[e.destination] = e; });
  const busyIds = new Set(exps.flatMap((e) => (Array.isArray(e.beast_ids) ? e.beast_ids : [])));
  const roster = Array.isArray(g.roster) ? g.roster : [];
  const beastById = (id) => roster.find((b) => b && b.id === id);

  // Une vue orpheline (expédition rappelée/réclamée ailleurs, butin absent)
  // retombe sur les destinations — via un effet, jamais en plein rendu.
  const trackOrphan = view === "track" && !byDest[selWorld];
  const lootOrphan = view === "loot" && !loot;
  useEffect(() => { if (trackOrphan || lootOrphan) setView("dest"); }, [trackOrphan, lootOrphan]);

  if (!g.wallet || !g.authToken) {
    return (
      <div className="container">
        <SectionHead eyebrow="◇ IDLE" title={I18N.t("EXP_TITLE")} sub={I18N.t("EXP_SUB")} />
        <div className="muted mono" style={{ textAlign: "center", padding: 24 }}>{I18N.t("EXP_LOGIN")}</div>
      </div>
    );
  }

  // ---- Lancement : serveur d'abord (taux figé), animation ensuite ----
  function endFx() {
    if (fxTimer.current) { clearTimeout(fxTimer.current); fxTimer.current = null; }
    setFx((f) => {
      if (f) { setJustLaunched(f.worldId); setTimeout(() => setJustLaunched(null), 800); }
      return null;
    });
    setView("dest"); setSel([]);
  }
  async function launch() {
    if (busyCall || sel.length !== 3) return;
    setBusyCall(true);
    const r = await actions.expeditionsStart({ destination: selWorld, beast_ids: sel, mode, duration_s: dur });
    setBusyCall(false);
    if (!r.ok) { toast(expErr(r.reason), "bad"); return; }
    if (reducedMotion()) {
      toast(I18N.t("EXP_STATUS_RUNNING") + " · " + r.expedition.success_rate + " %", "good");
      setView("dest"); setSel([]);
      return;
    }
    setFx({ worldId: selWorld, ids: sel.slice(), endsAt: new Date(r.expedition.ends_at) });
    fxTimer.current = setTimeout(endFx, 2300);
  }

  // ---- Claim : résolution serveur puis vue butin ----
  async function claim(e) {
    if (busyCall) return;
    setBusyCall(true); setClaiming(true);
    let r = await actions.expeditionsClaim(e.id);
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsClaim(e.id);
    setBusyCall(false);
    if (!r.ok) { setClaiming(false); toast(expErr(r.reason), "bad"); return; }
    setTimeout(() => setClaiming(false), 750);   // laisse le burst se jouer
    setLoot({ success: r.success, rewards: r.rewards, fa_week: r.fa_week, worldId: e.destination, beastIds: e.beast_ids || [] });
    setSelWorld(e.destination);
    setView("loot");
  }

  async function doRecall(e) {
    const r = await actions.expeditionsRecall(e.id);
    setConfirmRecall(false);
    if (!r.ok) { toast(expErr(r.reason), "bad"); return; }
    setView("dest");
  }

  const world = XU.worldOf(selWorld) || XU.WORLDS[0];
  const wName = (w) => I18N.t(w.i18nKey);

  function WorldHead() {
    return (
      <div className="exq-headworld">
        <span style={{ width: 6, height: 22, background: world.color, flex: "none" }} />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 10, color: world.color }}>{I18N.t("EXP_AFFINITY")} {world.type}</div>
          <b style={{ fontSize: 19 }}>{wName(world)}</b>
        </div>
      </div>
    );
  }

  // ============ VUE DESTINATIONS ============
  function renderDest() {
    let running = 0, ready = 0;
    XU.WORLDS.forEach((w) => {
      const s = XU.statusOf(byDest[w.id], now);
      if (s === "running") running++; else if (s === "ready") ready++;
    });
    const fa = g.expFaWeek;
    return (
      <div className="exq-col">
        <SectionHead eyebrow="◇ IDLE" title={I18N.t("EXP_TITLE")} sub={I18N.t("EXP_SUB")} />
        <div className="exq-summary">
          <span className="exq-mono"><b style={{ color: "var(--elec)" }}>{running}</b> {I18N.t("EXP_STATUS_RUNNING")}</span>
          <span className="exq-vline" />
          <span className="exq-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {ready > 0 && <span className="exq-dot" />}
            <b style={{ color: "var(--fire)" }}>{ready}</b> {I18N.t("EXP_STATUS_READY")}
          </span>
        </div>
        {fa && (
          <div className="panel" style={{ padding: "10px 13px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div className="exq-mono" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 5 }}>{I18N.t("EXP_FA_WEEK")}</div>
              <Bar frac={Math.min(1, (fa.granted || 0) / (fa.cap || 500))} kind="xp" />
            </div>
            <b className="exq-mono" style={{ color: "var(--fire)" }}>{fa.granted || 0}/{fa.cap || 500}</b>
          </div>
        )}
        <div className="exq-worlds">
          {XU.WORLDS.map((w) => {
            const e = byDest[w.id];
            const s = XU.statusOf(e, now);
            const border = s === "ready" ? "rgba(247,147,26,.55)" : s === "running" ? `rgba(${w.rgb},.35)` : "var(--line)";
            const onClick = s === "free"
              ? () => { setSelWorld(w.id); setSel([]); setDur(7200); setMode("prudente"); setView("config"); }
              : s === "ready" ? () => claim(e)
              : () => { setSelWorld(w.id); setConfirmRecall(false); setView("track"); };
            return (
              <button key={w.id} className="exq-world" onClick={onClick}
                style={{ border: "1px solid " + border, boxShadow: s === "ready" ? "0 0 16px rgba(247,147,26,.22)" : "none" }}>
                <span className="exq-worldbar" style={{ background: w.color }} />
                {justLaunched === w.id && <span className="exq-fresh" style={{ borderColor: w.color }} />}
                <span className="exq-worldhead">
                  <b>{wName(w)}</b>
                  <span className="exq-aff exq-mono" style={{ color: w.color, borderColor: `rgba(${w.rgb},.4)`, background: `rgba(${w.rgb},.08)` }}>{w.type}</span>
                </span>
                {s === "free" && <span className="exq-mono exq-dim">{I18N.t("EXP_STATUS_FREE")} · ›</span>}
                {s === "running" && (
                  <span className="exq-worldrow">
                    <span className="exq-mono exq-dim">{e.mode === "risquee" ? I18N.t("EXP_MODE_RISKY") : I18N.t("EXP_MODE_PRUDENT")}</span>
                    <b className="exq-mono" style={{ color: "var(--elec)", fontVariantNumeric: "tabular-nums" }}>{XU.fmtCountdown(new Date(e.ends_at).getTime() - now)}</b>
                  </span>
                )}
                {s === "ready" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span className="exq-dot" />
                    <b className="exq-mono" style={{ color: "var(--fire)", fontSize: 12 }}>{I18N.t("EXP_CLAIM")} ›</b>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============ VUE CONFIGURATION ============
  function renderConfig() {
    const team = sel.map(beastById).filter(Boolean);
    const ready3 = sel.length === 3;
    const pow = XU.collectionPower(team);
    const affBonus = XU.affinityBonus(team, selWorld);
    const pct = XU.previewSuccessRate(team, selWorld);
    const successColor = pct >= 75 ? "var(--success)" : pct >= 55 ? "var(--gold)" : "var(--alert)";
    const warnTeam = sel.some((id) => (g.selected || []).includes(id));
    const allEpic = ready3 && team.every((b) => b.rarity === "Epic");
    return (
      <div className="exq-col">
        <BackRow />
        <WorldHead />
        <div className="exq-steprow">
          <span className="eyebrow" style={{ fontSize: 10 }}>1 · {I18N.t("EXP_SELECT_3")}</span>
          <b className="exq-mono" style={{ color: ready3 ? "var(--success)" : "var(--text-dim)" }}>{sel.length} / 3</b>
        </div>
        <div className="exq-roster">
          {roster.map((b) => {
            const isBusy = busyIds.has(b.id);
            const selected = sel.includes(b.id);
            const tm = typeMeta(b.type);
            const toggle = () => {
              if (isBusy) return;
              setSel((s) => s.includes(b.id) ? s.filter((x) => x !== b.id) : (s.length < 3 ? [...s, b.id] : s));
            };
            return (
              <button key={b.id} className="exq-beast" onClick={toggle}
                style={{ border: "1px solid " + (selected ? "var(--fire)" : isBusy ? "var(--line-soft)" : "var(--line)"),
                  boxShadow: selected ? "0 0 12px rgba(247,147,26,.4)" : "none",
                  cursor: isBusy ? "not-allowed" : "pointer" }}>
                <span className="exq-beastart" style={{ background: `linear-gradient(150deg, rgba(${tm.rgb},.14), rgba(6,9,18,.6))`,
                  opacity: isBusy ? 0.4 : 1, filter: isBusy ? "grayscale(.85)" : "none" }}>
                  <img src={D.artFor(b)} alt="" draggable="false" />
                  <span className="exq-lvl exq-mono">N{b.level}</span>
                  {selected && <span className="exq-check">✓</span>}
                </span>
                <span className="exq-beastname" style={{ color: isBusy ? "var(--text-dim)" : "var(--text)" }}>{D.displayName(b)}</span>
                <span className="exq-mono exq-beasttag" style={{ color: isBusy ? "var(--text-dim)" : (g.selected || []).includes(b.id) ? "var(--fire)" : "var(--text-dim)" }}>
                  {isBusy ? I18N.t("EXP_IN_EXPEDITION") : (g.selected || []).includes(b.id) ? I18N.t("EXP_ACTIVE_TEAM") : b.type + " · " + b.rarity}
                </span>
              </button>
            );
          })}
        </div>
        {warnTeam && <div className="exq-warn"><span style={{ color: "var(--fire)" }}>⚠</span><span>{I18N.t("EXP_TEAM_WARN")}</span></div>}
        <span className="eyebrow" style={{ fontSize: 10 }}>2 · {I18N.t("EXP_D_1H")}/{I18N.t("EXP_D_2H")}/{I18N.t("EXP_D_8H")}</span>
        <div className="exq-durs">
          {XU.DURATIONS.map((d) => {
            const on = dur === d.s;
            return (
              <button key={d.s} onClick={() => setDur(d.s)} className="exq-toggle"
                style={{ background: on ? "rgba(247,147,26,.12)" : "var(--bg-panel)", borderColor: on ? "var(--fire)" : "var(--line)", color: on ? "var(--fire)" : "var(--text)" }}>
                <b style={{ fontSize: 16 }}>{I18N.t(d.i18nKey)}</b>
                {d.s === 28800 && <span className="exq-mono" style={{ fontSize: 9, color: on ? "var(--fire)" : "var(--text-dim)" }}>{I18N.t("EXP_D_8H_SUB")}</span>}
              </button>
            );
          })}
        </div>
        <span className="eyebrow" style={{ fontSize: 10 }}>3 · {I18N.t("EXP_MODE_PRUDENT")} / {I18N.t("EXP_MODE_RISKY")}</span>
        <div className="exq-modes">
          {[["prudente", "EXP_MODE_PRUDENT", "EXP_MODE_PRUDENT_SUB", "var(--elec)", "rgba(0,240,255,.08)"],
            ["risquee", "EXP_MODE_RISKY", "EXP_MODE_RISKY_SUB", "var(--alert)", "rgba(255,59,92,.1)"]].map(([k, tk, sk, accent, bgOn]) => {
            const on = mode === k;
            return (
              <button key={k} onClick={() => setMode(k)} className="exq-toggle" style={{ alignItems: "flex-start", background: on ? bgOn : "var(--bg-panel)", borderColor: on ? accent : "var(--line)", color: on ? accent : "var(--text)" }}>
                <b style={{ fontSize: 13, letterSpacing: ".5px" }}>{I18N.t(tk)}</b>
                <span style={{ fontSize: 10, lineHeight: 1.35, color: "var(--text-dim)", textAlign: "left" }}>{I18N.t(sk)}</span>
              </button>
            );
          })}
        </div>
        <div className="panel" style={{ padding: "13px 14px", border: "1px solid " + (ready3 ? successColor : "var(--line)") }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 7 }}>{I18N.t("EXP_RATE")}</div>
          {ready3 ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <b style={{ fontSize: 44, lineHeight: 0.9, color: successColor, textShadow: "0 0 18px rgba(0,0,0,.4)" }}>{pct} %</b>
              <span className="exq-mono" style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)" }}>
                {I18N.t("EXP_POWER")} <b style={{ color: "var(--text)" }}>{pow.toLocaleString()}</b><br />
                {I18N.t("EXP_AFFINITY")} {world.type} <b style={{ color: world.color }}>+{affBonus} %</b>
              </span>
            </div>
          ) : (
            <span style={{ color: "var(--text-dim)" }}>{I18N.t("EXP_SELECT_3")}</span>
          )}
          {ready3 && <div className="exq-mono" style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>{I18N.t("EXP_RATE_NOTE")}</div>}
          {allEpic && (
            <div className="exq-epicbox">
              <span style={{ color: "var(--gold)", fontSize: 15, flex: "none" }}>◈</span>
              <span style={{ fontSize: 11, lineHeight: 1.4 }}>{I18N.t("EXP_DUST")}</span>
            </div>
          )}
        </div>
        <button className="exq-launch" disabled={!ready3 || busyCall} onClick={launch}
          style={ready3 ? { background: "linear-gradient(180deg, #14e0a0, #0fae7d)", border: "1px solid #6dffce", color: "#031a12", boxShadow: "0 0 22px rgba(39,224,138,.4)" } : {}}>
          ⬢ {I18N.t("EXP_LAUNCH")}
        </button>
        <div className="exq-mono" style={{ textAlign: "center", fontSize: 11, color: "var(--text-dim)" }}>{I18N.t("EXP_FREE_ENTRY")}</div>
      </div>
    );
  }

  // ============ VUE SUIVI ============
  function renderTrack() {
    const e = byDest[selWorld];
    if (!e) return null;   // l'effet trackOrphan ramène sur les destinations
    const endsAt = new Date(e.ends_at).getTime();
    const startedAt = new Date(e.started_at).getTime();
    const remain = Math.max(0, endsAt - now);
    const progPct = Math.round(Math.min(100, Math.max(0, (1 - remain / Math.max(1, endsAt - startedAt)) * 100)));
    const rate = e.success_rate;
    const crew = (e.beast_ids || []).map(beastById).filter(Boolean);
    return (
      <div className="exq-col">
        <BackRow />
        <WorldHead />
        <div className="exq-trackbox">
          <div className="eyebrow" style={{ fontSize: 10, color: "var(--elec)" }}>{I18N.t("EXP_STATUS_RUNNING")}</div>
          <b className="exq-mono exq-bigtime">{XU.fmtCountdown(remain)}</b>
          <span className="exq-mono exq-dim">{I18N.t("EXP_BACK_AT", fmtClock(new Date(endsAt)))}</span>
          <div className="exq-prog"><div style={{ width: progPct + "%" }} /></div>
        </div>
        <div className="exq-statrow">
          <div><span className="exq-mono exq-cap">MODE</span><b style={{ color: e.mode === "risquee" ? "var(--alert)" : "var(--elec)" }}>{e.mode === "risquee" ? I18N.t("EXP_MODE_RISKY") : I18N.t("EXP_MODE_PRUDENT")}</b></div>
          <div><span className="exq-mono exq-cap">⏱</span><b>{e.duration_s === 3600 ? I18N.t("EXP_D_1H") : e.duration_s === 28800 ? I18N.t("EXP_D_8H") : I18N.t("EXP_D_2H")}</b></div>
          <div><span className="exq-mono exq-cap">%</span><b style={{ color: rate >= 75 ? "var(--success)" : rate >= 55 ? "var(--gold)" : "var(--alert)" }}>{rate} %</b></div>
        </div>
        <span className="exq-mono" style={{ fontSize: 10, color: "var(--text-faint)", marginTop: -8 }}>{I18N.t("EXP_RATE_LOCKED")}</span>
        <div className="eyebrow" style={{ fontSize: 10 }}>{I18N.t("EXP_CREW")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {crew.map((b) => {
            const tm = typeMeta(b.type);
            return (
              <div key={b.id} className="exq-crewrow">
                <span className="exq-crewart" style={{ background: `linear-gradient(150deg, rgba(${tm.rgb},.16), rgba(6,9,18,.6))` }}>
                  <img src={D.artFor(b)} alt="" draggable="false" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{D.displayName(b)}</b>
                  <span className="exq-mono" style={{ fontSize: 10 }}>
                    <span style={{ color: tm.color }}>{b.type}</span>{" "}
                    <span style={{ color: D.RARITY_COLORS[b.rarity] || "var(--text-dim)" }}>{b.rarity}</span>
                  </span>
                </div>
                <b className="exq-mono" style={{ flex: "none", color: "var(--text-dim)", fontSize: 12 }}>NIV {b.level}</b>
              </div>
            );
          })}
        </div>
        {!confirmRecall ? (
          <button className="exq-recall" onClick={() => setConfirmRecall(true)}>{I18N.t("EXP_RECALL")}</button>
        ) : (
          <div className="exq-recallbox">
            <b style={{ color: "var(--alert)", fontSize: 14 }}>{I18N.t("EXP_RECALL")}</b>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text-dim)" }}>{I18N.t("EXP_RECALL_CONFIRM")}</span>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <button className="btn" onClick={() => setConfirmRecall(false)}>{I18N.t("CANCEL")}</button>
              <button className="btn" style={{ background: "var(--alert)", borderColor: "#ff8ba4", color: "#14030a", fontWeight: 700 }} onClick={() => doRecall(e)}>{I18N.t("EXP_RECALL_YES")}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ VUE BUTIN ============
  function renderLoot() {
    if (!loot) return null;   // l'effet lootOrphan ramène sur les destinations
    const rw = loot.rewards || {};
    const frags = rw.frags || {};
    const fragRanks = ["C", "B", "A"].filter((rk) => (frags[rk] || 0) > 0);
    const failed = loot.success === false;
    const crew = (loot.beastIds || []).map(beastById).filter(Boolean);
    const fa = loot.fa_week || g.expFaWeek || { granted: 0, cap: 500 };
    return (
      <div className="exq-col">
        <div>
          <div className="eyebrow" style={{ fontSize: 10, color: failed ? "var(--alert)" : "var(--fire)" }}>{wName(world)}</div>
          <b style={{ fontSize: 20 }}>{failed ? I18N.t("EXP_HARD_RETURN") : I18N.t("EXP_VICTORY")}</b>
        </div>
        {failed && <div className="exq-warn" style={{ background: "rgba(255,59,92,.08)", borderColor: "rgba(255,59,92,.35)" }}><span style={{ color: "var(--alert)" }}>⚠</span><span>{I18N.t("EXP_EXHAUSTED")}</span></div>}
        {rw.dust && (
          <div className="exq-dustbox">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="exq-mono exq-goldchip">◈ ULTRA-RARE</span>
              <span className="exq-mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--gold)", opacity: 0.85 }}>ON-CHAIN</span>
            </div>
            <b style={{ fontSize: 19, color: "#ffe6a8", textShadow: "0 0 16px rgba(255,230,0,.5)" }}>{I18N.t("EXP_DUST")}</b>
          </div>
        )}
        {rw.ticket && (
          <div className="exq-ticketbox">
            <span className="exq-hex" style={{ color: "var(--gold)", borderColor: "var(--gold)", background: "rgba(255,230,0,.14)" }}>⚒</span>
            <div style={{ minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 15 }}>{I18N.t("EXP_TICKET")}</b>
            </div>
          </div>
        )}
        {fragRanks.length > 0 && (
          <div className="panel" style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
            {fragRanks.map((rk) => {
              const total = (g.expFragments && g.expFragments[rk]) || 0;
              const need = XU.FRAGMENT_COSTS[rk];
              const col = D.RANK_COLORS[rk];
              return (
                <div key={rk} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="exq-hex" style={{ color: col, borderColor: col, background: "rgba(255,255,255,.04)" }}>✦</span>
                    <b style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{I18N.t("EXP_FRAG_LINE", rk, frags[rk])}</b>
                    <b className="exq-mono" style={{ color: col }}>{total} / {need}</b>
                  </div>
                  <Bar frac={Math.min(1, total / need)} kind="xp" />
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {crew.map((b) => (
            <div key={b.id} className="exq-xprow">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, background: "var(--success)", clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)", flex: "none" }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{D.displayName(b)}</span>
              </span>
              <b className="exq-mono" style={{ flex: "none", color: "var(--success)" }}>+{rw.xp || 0} XP</b>
            </div>
          ))}
        </div>
        <div className="exq-farow">
          <div style={{ minWidth: 0 }}>
            <b style={{ color: "var(--fire)", fontSize: 15 }}>🔒 {I18N.t("EXP_FA_LOCKED_GAIN", rw.fa || 0)}</b>
            <div className="exq-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("EXP_FA_CAP", fa.granted || 0, fa.cap || 500)}</div>
          </div>
          <div style={{ flex: "none", width: "38%", maxWidth: 150 }}>
            <Bar frac={Math.min(1, (fa.granted || 0) / (fa.cap || 500))} kind="xp" />
          </div>
        </div>
        <button className="exq-launch" onClick={() => { setLoot(null); setView("dest"); }}
          style={{ background: "linear-gradient(180deg, #ffb64d, #f7931a)", border: "1px solid #ffd08a", color: "#180a02", boxShadow: "0 0 22px rgba(247,147,26,.5)" }}>
          {I18N.t("EXP_BACK")}
        </button>
      </div>
    );
  }

  function BackRow() {
    return (
      <button className="exq-back exq-mono" onClick={() => { setView("dest"); setConfirmRecall(false); }}>
        {I18N.t("EXP_BACK")}
      </button>
    );
  }

  // ============ OVERLAY DE LANCEMENT (portail hexagonal) ============
  function renderFx() {
    if (!fx) return null;
    const w = XU.worldOf(fx.worldId) || XU.WORLDS[0];
    const cards = fx.ids.map(beastById);
    return (
      <div className="exq-fx" onClick={endFx} role="button">
        <div className="exq-fx-shake">
          {[18, 78, 140, 205, 265, 325].map((deg, i) => (
            <span key={deg} className="exq-fil" style={{ transform: `rotate(${deg}deg)` }}>
              <span style={{ background: `linear-gradient(90deg, ${i % 2 ? "#00F0FF" : w.color}, transparent)`, animationDelay: (0.12 + i * 0.05) + "s" }} />
            </span>
          ))}
          <span className="exq-fx-glow" style={{ background: `radial-gradient(circle, rgba(${w.rgb},.55), transparent 68%)` }} />
          {[[232, w.color, "0s"], [172, "#00F0FF", ".08s"], [112, "#F7931A", ".16s"]].map(([size, col, delay]) => (
            <span key={size} className="exq-ring" style={{ width: size, height: size, margin: `-${size / 2}px 0 0 -${size / 2}px`, animationDelay: delay }}>
              <span style={{ position: "absolute", inset: 0, background: col, clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }} />
              <span style={{ position: "absolute", inset: 3, background: "#05070f", clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }} />
            </span>
          ))}
          <div className="exq-fx-cards">
            {cards.map((b, i) => {
              const tm = b ? typeMeta(b.type) : { color: "var(--elec)", rgb: "0,240,255" };
              return (
                <div key={i} className="exq-fx-card" style={{ borderColor: tm.color, boxShadow: `0 0 16px rgba(${tm.rgb},.4)`, "--fx-x": i - 1, animationDelay: (0.35 + i * 0.12) + "s" }}>
                  <span className="exq-streak" style={{ background: `linear-gradient(0deg, ${tm.color}, transparent)`, animationDelay: (0.83 + i * 0.12) + "s" }} />
                  <span className="exq-hex" style={{ color: tm.color, borderColor: tm.color, background: `linear-gradient(150deg, rgba(${tm.rgb},.22), rgba(6,9,18,.7))` }}>{EXP_GLYPH[b && b.type] || "✦"}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>{b ? D.displayName(b) : ""}</span>
                  <span className="exq-mono" style={{ fontSize: 9, color: tm.color }}>NIV {b ? b.level : ""}</span>
                </div>
              );
            })}
          </div>
          <span className="exq-shock">
            <span style={{ position: "absolute", inset: 0, background: w.color, clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }} />
            <span style={{ position: "absolute", inset: 5, background: "#05070f", clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }} />
          </span>
          <span className="exq-flash" />
          <div className="exq-fx-center">
            <span className="exq-stamp" style={{ textShadow: `0 0 26px ${w.color}, 0 0 60px rgba(0,0,0,.9)` }}>{wName(w).toUpperCase()}</span>
            <span className="exq-eta exq-mono">{I18N.t("EXP_BACK_AT", fmtClock(fx.endsAt))}</span>
          </div>
          <span className="exq-skip exq-mono">TAP ›</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {view === "dest" && renderDest()}
      {view === "config" && renderConfig()}
      {view === "track" && renderTrack()}
      {view === "loot" && renderLoot()}
      {renderFx()}
      {claiming && (
        <div className="exq-claimfx">
          <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
            <span className="exq-burst" style={{ borderColor: "var(--fire)" }} />
            <span className="exq-burst" style={{ width: 110, height: 110, borderColor: "var(--gold)", animationDelay: ".1s" }} />
            <b style={{ fontSize: 18, color: "var(--gold)", letterSpacing: 1, textShadow: "0 0 16px rgba(255,230,0,.8)" }}>◈</b>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Expeditions });
