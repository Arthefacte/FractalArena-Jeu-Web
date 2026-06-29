/* ============================================================
   FRACTAL ARENA — Rejeu de combat de l'Arène (PvP attaque).
   Propre à l'Arène (la Fosse garde son propre rejeu). Rejoue la
   séquence d'events renvoyée par /pvp/attack : barres de PV + log.
   ============================================================ */
const { useState, useEffect, useRef } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { Bar } = window;

const AB_POS_LABEL = ["AV", "MI", "AR"]; // Avant / Milieu / Arrière (ordre de formation)

function AB_Unit({ beast, live, side, pos }) {
  const maxHp = live ? live.maxHp : (beast ? D.eff(beast, "hp") : 1);
  const hp = live ? Math.max(0, live.hp) : maxHp;
  const frac = maxHp > 0 ? hp / maxHp : 0;
  const dead = live ? live.alive === false : false;
  return (
    <div className={"ab-unit" + (dead ? " ab-dead" : "")} style={{ opacity: dead ? 0.4 : 1, textAlign: "center", flex: 1, minWidth: 0 }}>
      <div style={{ position: "relative", width: 48, height: 48, margin: "0 auto", borderRadius: 8, overflow: "hidden", background: "#0b1020" }}>
        {beast && D.ART[beast.image_key] ? <img src={D.ART[beast.image_key]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable="false" /> : null}
        {AB_POS_LABEL[pos] && <span className="mono" style={{ position: "absolute", top: 1, left: 1, fontSize: 8, lineHeight: "10px", padding: "0 3px", borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "var(--text-dim)" }}>{AB_POS_LABEL[pos]}</span>}
      </div>
      <div style={{ fontSize: 10, marginTop: 2, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {beast ? D.displayName(beast) : "—"} · {I18N.t("LINK_TIER")}{beast ? beast.level : 0}
      </div>
      <div style={{ marginTop: 2 }}><Bar frac={frac} kind="hp" /></div>
      <div style={{ fontSize: 9, color: "var(--text)" }}>{Math.round(hp)}/{Math.round(maxHp)}</div>
    </div>
  );
}

function AreneBattle({ events, p1Team, p2Team, won, delta, onClose }) {
  const evs = Array.isArray(events) ? events : [];
  const [p1Live, setP1Live] = useState(evs[0]?.state?.p1 || null);
  const [p2Live, setP2Live] = useState(evs[0]?.state?.p2 || null);
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(evs.length === 0);
  const iRef = useRef(0), tRef = useRef(null), logRef = useRef(null);

  useEffect(() => {
    function step() {
      if (iRef.current >= evs.length) { setDone(true); return; }
      const ev = evs[iRef.current++];
      let delay = 360;
      if (ev.t === "round") { setLines((L) => [...L, "── " + I18N.t("AR_ROUND", ev.round) + " ──"]); delay = 260; }
      else if (ev.t === "atk" || ev.t === "sp" || ev.t === "crit") {
        if (ev.state) { setP1Live(ev.state.p1); setP2Live(ev.state.p2); }
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        setLines((L) => [...L, I18N.t(key, ev.name, ev.tname, ev.dmg)]);
      } else if (ev.t === "heal") {
        if (ev.state) { setP1Live(ev.state.p1); setP2Live(ev.state.p2); }
        setLines((L) => [...L, I18N.t("L_HEAL", ev.name, ev.heal)]); delay = 220;
      } else if (ev.t === "miss") { setLines((L) => [...L, I18N.t("L_MISS", ev.name)]); delay = 220; }
      else if (ev.t === "win" || ev.t === "lose") { if (ev.state) { setP1Live(ev.state.p1); setP2Live(ev.state.p2); } delay = 120; }
      tRef.current = setTimeout(step, delay);
    }
    tRef.current = setTimeout(step, 300);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [lines]);

  const liveOf = (team, side) => (i) => {
    const arr = side === "p1" ? p1Live : p2Live;
    return arr && arr[i] ? arr[i] : null;
  };

  return (
    <div className="modal-backdrop" onClick={done ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", margin: "4px 0 10px" }}>{I18N.t("AR2_BATTLE")}</h3>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[0, 1, 2].map((i) => <AB_Unit key={"p1" + i} beast={p1Team[i]} live={liveOf(p1Team, "p1")(i)} side="p1" pos={i} />)}
        </div>
        <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 11, margin: "2px 0" }}>{I18N.t("AR_VERSUS")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[0, 1, 2].map((i) => <AB_Unit key={"p2" + i} beast={p2Team[i]} live={liveOf(p2Team, "p2")(i)} side="p2" pos={i} />)}
        </div>
        <div ref={logRef} className="log" style={{ maxHeight: 120, overflowY: "auto", marginBottom: 12 }}>
          {lines.map((l, i) => <div key={i} className="log-line">{l}</div>)}
        </div>
        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: won ? "var(--success)" : "var(--alert)" }}>
              {won ? I18N.t("AR2_WON") : I18N.t("AR2_LOST")}
              {typeof delta === "number" ? <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-dim)" }}>{delta >= 0 ? "+" : ""}{delta} ELO</span> : null}
            </div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onClose}>{I18N.t("AR2_CLOSE")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
Object.assign(window, { AreneBattle, AB_Unit });
