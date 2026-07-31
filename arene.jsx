/* ============================================================
   FRACTAL ARENA — Écran Arène (PvP classé, ligues)
   ============================================================ */
const { useState, useEffect, useRef } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, AreneBattle, PostureSelect, FaText } = window;
const AU = window.FA_ARENE_UI;

function TeamPreview({ team }) {
  const list = Array.isArray(team) ? team.slice(0, 3) : [];
  return (
    <div className="flex gap8" style={{ flexWrap: "nowrap" }}>
      {list.map((b, i) => (
        <div key={i} className="oct-sm" style={{ width: 40, height: 40, overflow: "hidden", border: "1px solid var(--line)" }}>
          {D.ART[b.image_key] ? <img src={D.artFor(b)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} draggable="false"
            onError={(e) => { const fb = D.ART[b.image_key]; if (fb && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }} /> : null}
        </div>
      ))}
    </div>
  );
}


function Arene() {
  const { g, actions, toast } = useFA();
  const pvp = g.pvp || {};
  const [entry, setEntry] = useState("free");
  const [busy, setBusy] = useState(false);
  const attackLock = useRef(false); // verrou synchrone anti double-clic (le state `busy` ne se met à jour qu'au re-render)
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(null); // { target, revanche, ids:[id,id,id], oppTeam, posture, oppPosture } ou null
  const [nowTs, setNowTs] = useState(Date.now());
  const [defPosture, setDefPosture] = useState("equilibre");

  useEffect(() => { if (g.wallet) { actions.pvpRefresh().then(() => actions.pvpAttacksSeen()); actions.pvpDefenseOf(g.wallet).then((r) => setDefPosture((r && r.posture) || "equilibre")); } }, [g.wallet]);
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Bascule auto en mode jouable quand l'heure d'ouverture est atteinte.
  useEffect(() => {
    if (pvp.season && pvp.season.live === false && Date.now() >= Number(pvp.season.starts_at)) actions.pvpRefresh();
  }, [nowTs]);

  const defenseReady = g.selected.length === 3;
  const sc = AU.seasonCountdown(pvp.season, nowTs);

  async function onSetDefense() {
    if (!defenseReady) { toast(I18N.t("AR2_NO_DEFENSE"), "bad"); return; }
    setBusy(true);
    const r = await actions.pvpSetDefense(defPosture);
    setBusy(false);
    if (r && r.ok) toast(I18N.t("AR2_SET_DEFENSE"), "good"); else toast((r && r.error) || "error", "bad");
  }

  async function onAttack(target, useRevanche, attackers, myPosture, enemyPosture) {
    if (attackLock.current || busy) return; // le ref bloque les clics de la même rafale avant que `busy` ne re-render
    attackLock.current = true;
    setBusy(true);
    try {
      const prev = (g.pvp && typeof g.pvp.rating === "number") ? g.pvp.rating : null;
      const r = await actions.pvpAttack(target, useRevanche ? "revanche" : entry, attackers, myPosture);
      if (!r || !r.ok) { toast((r && r.error) || "error", "bad"); return; }
      const delta = (prev != null && typeof r.rating === "number") ? r.rating - prev : null;
      const myTeam = (attackers || g.selected).map((id) => g.roster.find((b) => b.id === id)).filter(Boolean);
      setResult({ ...r, delta, p1Team: myTeam, p2Team: r.enemy || [], p1Posture: myPosture || "equilibre", p2Posture: enemyPosture || "equilibre" });
      // Pas de refresh PvP ici (différé au onClose du rejeu) : rafraîchir maintenant
      // mettrait à jour le pill ELO du header et le ladder pendant le combat → résultat spoilé.
    } finally {
      attackLock.current = false;
      setBusy(false);
    }
  }

  const seasonMs = pvp.season ? (Number(pvp.season.ends_at) - Date.now()) : 0;
  const modes = AU.entryModes(pvp);

  return (
    <div className="container wide">
      {/* Header */}
      <div className="flex between center wrap" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <div className="eyebrow">{I18N.t("AR2_TAG")}</div>
          <div className="h1" style={{ marginBottom: 0 }}>{I18N.t("AR2_TITLE")}</div>
        </div>
        <div className="flex gap8 wrap">
          <span className="pill" style={{ color: AU.leagueColor(pvp.league) }}>{AU.leagueLabel(pvp.league)}</span>
          <span className="pill" style={{ color: "var(--elec)" }}>ELO {pvp.rating != null ? pvp.rating : "—"}</span>
          <span className="pill" style={{ color: "var(--success)" }}>⚡ {pvp.free_remaining != null ? pvp.free_remaining : 0}</span>
          {pvp.season && <span className="pill" style={{ color: "var(--gold)" }}>{I18N.t("AR2_SEASON", pvp.season.season)} · {I18N.t("AR2_ENDS_IN", AU.fmtCountdown(seasonMs))}</span>}
          <button className="btn sm" onClick={() => actions.pvpRefresh()}>{I18N.t("AR2_REFRESH")}</button>
        </div>
      </div>

      {/* Ma défense */}
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 14, marginBottom: 14 }}>
        <div className="flex between center wrap" style={{ gap: 10 }}>
          <div className="flex center gap12">
            <span className="h2" style={{ fontSize: 14 }}>{I18N.t("AR2_MY_DEFENSE")}</span>
            <TeamPreview team={g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean)} />
          </div>
          <button className="btn btn-forge" disabled={busy || !defenseReady} onClick={onSetDefense}>{I18N.t("AR2_SET_DEFENSE")}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <PostureSelect value={defPosture} onChange={setDefPosture} disabled={busy} />
        </div>
        {!defenseReady && <div className="mono" style={{ fontSize: 11, color: "var(--alert)", marginTop: 8 }}>{I18N.t("AR2_NO_DEFENSE")}</div>}
        {/* Formation (Avant/Milieu/Arrière) + synergies actives */}
        {defenseReady && (() => {
          const selTeam = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean);
          const syns = AU.computeSynergiesLabels(selTeam);
          return (
            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10 }}>
              {["Avant", "Milieu", "Arrière"].map((pos, i) => {
                const b = g.selected[i] && g.roster.find((x) => x.id === g.selected[i]);
                return (
                  <div key={i} className="flex between center" style={{ gap: 8, padding: "2px 0" }}>
                    <span>{pos} : {b ? (b.custom_name || b.name) : "—"}</span>
                    <span className="flex gap8">
                      <button className="btn xs" disabled={busy || i === 0} onClick={() => actions.pvpReorderDefense(i, i - 1)}>↑</button>
                      <button className="btn xs" disabled={busy || i === 2} onClick={() => actions.pvpReorderDefense(i, i + 1)}>↓</button>
                    </span>
                  </div>
                );
              })}
              {syns.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {syns.map((s) => <span key={s.key} className="pill" style={{ color: "var(--success)", marginRight: 6 }}>{s.label} · {s.effect}</span>)}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {sc.prelaunch ? (
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 24, textAlign: "center" }}>
          <div className="h1" style={{ color: "var(--elec)", marginBottom: 8 }}>{I18N.t("AR2_PRELAUNCH_TITLE")}</div>
          <div className="mono" style={{ fontSize: 28, color: "var(--gold)", margin: "12px 0" }}>{I18N.t("AR2_STARTS_IN", AU.fmtCountdownSec(sc.ms))}</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{I18N.t("AR2_PRELAUNCH_HINT")}</div>
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }} className="arena-lower">
        {/* Adversaires */}
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 16 }}>
          <div className="flex between center" style={{ marginBottom: 10 }}>
            <span className="h2" style={{ fontSize: 14, color: "var(--fire)" }}>{I18N.t("AR2_OPPONENTS")}</span>
            <div className="flex gap8">
              <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", alignSelf: "center" }}>{I18N.t("AR2_ENTRY")} :</span>
              {modes.map((m) => (
                <button key={m.key} className={cx("btn sm", entry === m.key && "on")} disabled={!m.available} onClick={() => setEntry(m.key)}>
                  {m.key === "free" ? I18N.t("AR2_FREE") : m.key === "fa" ? <FaText text={I18N.t("AR2_FA", pvp.fa_cost || 0)} s={12} /> : I18N.t("AR2_TICKET")}
                </button>
              ))}
            </div>
          </div>
          {(!pvp.opponents || pvp.opponents.length === 0) && <div className="mono" style={{ color: "var(--text-dim)", fontSize: 13 }}>{I18N.t("AR2_NO_OPPONENTS")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(pvp.opponents || []).map((o) => {
              const canRevanche = Array.isArray(pvp.revanches) && pvp.revanches.includes(o.wallet);
              // L'appariement se fait sur la puissance : c'est l'écart qui dit si le
              // combat est jouable, pas l'ELO (tout le monde y démarre à 1000).
              const gap = AU.powerGapPct(pvp.power, o.power);
              const tone = AU.powerGapTone(gap);
              const gapColor = tone === "even" ? "var(--success)" : tone === "edge" ? "var(--gold)" : "var(--alert)";
              return (
                <div key={o.wallet} className="oct-sm" style={{ border: "1px solid var(--line-soft)", padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="flex gap8 center">
                      <span className="mono" style={{ fontSize: 12, color: AU.leagueColor(o.league) }}>{AU.leagueLabel(o.league)}</span>
                      {o.implicit
                        ? <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("AR2_UNRANKED")}</span>
                        : <span className="mono" style={{ fontSize: 12, color: "var(--elec)" }}>ELO {o.rating}</span>}
                      <span className="mono" style={{ fontSize: 12, color: gapColor }}>
                        {I18N.t("AR2_POWER", o.power || 0)}{gap !== 0 && ` (${gap > 0 ? "+" : "−"}${Math.abs(gap)} %)`}
                      </span>
                      {canRevanche && <span className="mono" style={{ fontSize: 11, color: "var(--success)" }}>🔥 {I18N.t("AR2_REVANCHE")}</span>}
                    </div>
                    <div style={{ marginTop: 6 }}><TeamPreview team={o.team} /></div>
                  </div>
                  {canRevanche
                    ? <button className="btn btn-success sm" disabled={busy} onClick={async () => { const r = await actions.pvpDefenseOf(o.wallet); setPick({ target: o.wallet, revanche: true, ids: [...g.selected], oppTeam: o.team, posture: "equilibre", oppPosture: (r && r.posture) || "equilibre" }); }}>{I18N.t("AR2_REVANCHE")}</button>
                    : <button className="btn btn-elec sm" disabled={busy} onClick={async () => { const r = await actions.pvpDefenseOf(o.wallet); setPick({ target: o.wallet, revanche: false, ids: [...g.selected], oppTeam: o.team, posture: "equilibre", oppPosture: (r && r.posture) || "equilibre" }); }}>{I18N.t("AR2_ATTACK")}</button>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Classement */}
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 16 }}>
          <span className="h2" style={{ fontSize: 14, color: "var(--gold)" }}>{I18N.t("AR2_LADDER")} — {AU.leagueLabel(pvp.league)}</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {(pvp.ladder || []).map((row) => (
              <div key={row.wallet} className="flex between" style={{ padding: "5px 8px", background: row.wallet === g.wallet ? "rgba(0,240,255,0.08)" : "transparent", fontSize: 12 }}>
                <span className="mono">{row.rank}. {row.wallet === g.wallet ? "➤ " : ""}{(row.name || row.wallet || "").slice(0, 10)}</span>
                <span className="mono" style={{ color: "var(--elec)" }}>{row.rating} · {row.wins || 0}-{row.losses || 0}</span>
              </div>
            ))}
          </div>
          {pvp.season && <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}><FaText text={I18N.t("AR2_PRIZE", pvp.season.dotation || 0)} s={11} /></div>}
          {pvp.season && <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}><FaText text={I18N.t("AR2_PRIZE_FLAT")} s={11} /></div>}
        </div>
      </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
          <h3 style={{ margin: "0 0 8px" }}>{I18N.t("AR2_ATTACKS_TITLE")}</h3>
          {(!pvp.attacks || pvp.attacks.length === 0)
            ? <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{I18N.t("AR2_ATTACKS_NONE")}</div>
            : pvp.attacks.map((a, i) => (
              <div key={i} style={{ borderTop: i ? "1px solid var(--line,#1c2740)" : "none", padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>{a.attacker_name || ((a.attacker || "").slice(0, 6) + "…" + (a.attacker || "").slice(-4))}</span>
                  <span style={{ color: a.attacker_won ? "var(--alert)" : "var(--success)" }}>
                    {a.attacker_won ? I18N.t("AR2_ATTACKS_BEAT") : I18N.t("AR2_ATTACKS_REPELLED")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {(a.team || []).map((b, j) => (
                    <div key={j} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--text-dim)" }}>
                      <div style={{ width: 36, height: 36, margin: "0 auto", borderRadius: 6, overflow: "hidden", background: "#0b1020" }}>
                        {D.ART[b.image_key] ? <img src={D.artFor(b)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          onError={(e) => { const fb = D.ART[b.image_key]; if (fb && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }} /> : null}
                      </div>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{D.displayName(b)}</div>
                      <div>{I18N.t("LINK_TIER")}{b.level} · {D.fmtStat(D.eff(b, "atk"))}/{D.fmtStat(D.eff(b, "def"))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

      {pick && (() => {
        const byId = (id) => g.roster.find((b) => b.id === id);
        const toggle = (id) => setPick((p) => {
          if (!p) return p;
          const has = p.ids.includes(id);
          const ids = has ? p.ids.filter((x) => x !== id) : (p.ids.length < 3 ? [...p.ids, id] : p.ids);
          return { ...p, ids };
        });
        const move = (i, j) => setPick((p) => {
          if (!p || j < 0 || j >= p.ids.length || i < 0 || i >= p.ids.length) return p;
          const ids = [...p.ids]; [ids[i], ids[j]] = [ids[j], ids[i]]; return { ...p, ids };
        });
        const ready = pick.ids.length === 3;
        return (
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={() => setPick(null)}>
            <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", background: "var(--bg)" }} onClick={(e) => e.stopPropagation()}>
              <div className="h2" style={{ fontSize: 14, color: "var(--fire)", marginBottom: 8 }}>{I18N.t("AR2_ATTACK")}</div>
              {/* Compo adverse + types */}
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{I18N.t("AR2_OPPONENTS")} :</div>
              <div className="flex gap8" style={{ marginBottom: 4 }}>
                {(pick.oppTeam || []).slice(0, 3).map((b, i) => (
                  <span key={i} className="pill" style={{ color: "var(--fire)" }}>{D.TYPE_LABEL ? (D.TYPE_LABEL[b.type] || b.type) : b.type}</span>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                {I18N.t("POSTURE_ENEMY")} : {I18N.t("POSTURE_" + (pick.oppPosture || "equilibre").toUpperCase())}
              </div>
              <PostureSelect value={pick.posture || "equilibre"} onChange={(k) => setPick((p) => ({ ...p, posture: k }))} disabled={busy} />
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", margin: "8px 0 2px" }}>⚔️ {I18N.t("AR2_ATTACK")} — Avant / Milieu / Arrière</div>
              {/* Formation choisie (ordre) */}
              {[0, 1, 2].map((i) => {
                const b = byId(pick.ids[i]);
                return (
                  <div key={i} className="flex between center" style={{ gap: 8, padding: "2px 0", fontSize: 12 }}>
                    <span>{["Avant", "Milieu", "Arrière"][i]} : {b ? (b.custom_name || b.name) : "—"} {b ? <span style={{ color: "var(--text-dim)" }}>({D.TYPE_LABEL ? (D.TYPE_LABEL[b.type] || b.type) : b.type})</span> : null}</span>
                    <span className="flex gap8">
                      <button className="btn xs" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                      <button className="btn xs" disabled={i === 2} onClick={() => move(i, i + 1)}>↓</button>
                    </span>
                  </div>
                );
              })}
              {/* Roster : cocher 3 bêtes */}
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", margin: "8px 0 2px" }}>{I18N.t("AR2_DEFENDER_EDGE_HINT")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {(g.roster || []).map((b) => {
                  const on = pick.ids.includes(b.id);
                  return (
                    <button key={b.id} className={cx("btn xs", on && "on")} onClick={() => toggle(b.id)} style={{ opacity: on ? 1 : 0.7 }}>
                      {(b.custom_name || b.name)} · {D.TYPE_LABEL ? (D.TYPE_LABEL[b.type] || b.type) : b.type}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap8" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                <button className="btn sm" onClick={() => setPick(null)}>{I18N.t("CANCEL")}</button>
                <button className="btn btn-elec sm" disabled={!ready || busy} onClick={() => { const ids = [...pick.ids]; const t = pick.target, rv = pick.revanche, myPosture = pick.posture || "equilibre", oppPosture = pick.oppPosture || "equilibre"; setPick(null); onAttack(t, rv, ids, myPosture, oppPosture); }}>{I18N.t("AR2_ATTACK")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {result && <AreneBattle
        events={result.events}
        p1Team={result.p1Team || []}
        p2Team={result.p2Team || []}
        won={result.won}
        delta={result.delta}
        opponentName={result.opponent_name}
        p1Posture={result.p1Posture}
        p2Posture={result.p2Posture}
        onClose={() => { setResult(null); actions.pvpRefresh(); }} />}
    </div>
  );
}

function PrizeModal({ prizes, onClaim }) {
  const { Modal } = window;
  const AU = window.FA_ARENE_UI;
  const total = prizes.reduce((s, p) => s + (p.reward || 0), 0);
  return (
    <Modal onClose={onClaim} accent="var(--gold)">
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="h1" style={{ fontSize: 28, color: "var(--gold)" }}>{I18N.t(prizes.every((p) => p.kind === "tower") ? "PRIZE_TOWER_TITLE" : "PRIZE_TITLE")}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {prizes.map((p, i) => (
          <div key={i} className="panel oct" style={{ border: "1px solid var(--line)", padding: "10px 14px" }}>
            {p.kind === "tower"
              ? <div className="mono" style={{ color: "var(--elec)", marginBottom: 6, fontWeight: "bold" }}>
                  🗼 {I18N.t("PRIZE_TOWER_RANK", p.week_key, p.rank, p.best_floor)}
                </div>
              : <div className="mono" style={{ color: AU.leagueColor(p.league), marginBottom: 6, fontWeight: "bold" }}>
                  {I18N.t("PRIZE_SEASON_RANK", p.season, p.rank, AU.leagueLabel(p.league))}
                </div>}
            <div className="mono" style={{ fontSize: 13 }}><FaText text={I18N.t("PRIZE_BEFORE", p.balance_before)} /></div>
            <div className="mono" style={{ fontSize: 13, color: "var(--success)" }}><FaText text={I18N.t(p.locked ? "PRIZE_REWARD_LOCKED" : "PRIZE_REWARD", p.reward)} /></div>
            <div className="mono" style={{ fontSize: 13 }}><FaText text={I18N.t("PRIZE_AFTER", p.balance_after)} /></div>
          </div>
        ))}
      </div>
      {prizes.length > 1 && (
        <div className="mono" style={{ textAlign: "center", marginTop: 12, color: "var(--success)", fontWeight: "bold" }}>
          <FaText text={I18N.t("PRIZE_TOTAL", total)} />
        </div>
      )}
      <button className="btn block lg btn-elec" style={{ marginTop: 16 }} onClick={onClaim}>
        {I18N.t("PRIZE_CLAIM")}
      </button>
    </Modal>
  );
}

Object.assign(window, { Arene, PrizeModal });
