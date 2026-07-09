/* ============================================================
   FRACTAL ARENA — Écran Quêtes quotidiennes
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, SectionHead } = window;
const I18N = window.FA_I18N;

const Q_LABEL = { wins: "Q_WINS", paid: "Q_PAID", chat: "Q_CHAT" };

const QW_LABEL = { w_pvp: "QW_PVP", w_tower: "QW_TOWER", w_fosse: "QW_FOSSE" };

function fmtCountdown(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h + "h " + String(m).padStart(2, "0") + "m";
}

function fmtCountdownWeek(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d + "j " + String(h).padStart(2, "0") + "h";
}

function Quests() {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, data: null });
  const [claiming, setClaiming] = useState(null);
  const [reset, setReset] = useState(0);
  const [resetW, setResetW] = useState(0);

  const load = () => {
    setSt((s) => ({ ...s, loading: true, error: false }));
    actions.fetchQuests().then((r) => {
      if (r.ok) {
        setSt({ loading: false, error: false, data: r.data });
        setReset(r.data.reset_in_seconds);
        setResetW(r.data.weekly ? r.data.weekly.week_ends_in : 0);
      }
      else setSt({ loading: false, error: true, data: null });
    }).catch(() => {
      setSt({ loading: false, error: true, data: null });
    });
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setReset((s) => (s > 0 ? s - 1 : 0));
      setResetW((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const onClaim = async (id) => {
    setClaiming(id);
    let r;
    try {
      r = await actions.claimQuest(id);
    } finally {
      setClaiming(null);
    }
    if (r.ok) load();
  };

  const d = st.data;
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px" }}>
      <SectionHead eyebrow="🎯 DAILY" title={I18N.t("Q_TITLE")} />
      {st.loading && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("Q_LOADING")}</div>}
      {st.error && <div className="muted" style={{ textAlign: "center", padding: 24, color: "var(--alert)" }}>{I18N.t("Q_ERROR")}</div>}
      {!st.loading && !st.error && d && (
        <>
          <div className="q-head">
            <span className="q-streak">🔥 {I18N.t("Q_STREAK", d.streak)}</span>
            <span className="q-reset">{I18N.t("Q_RESET_IN", fmtCountdown(reset))}</span>
          </div>
          <div className="q-list">
            {d.quests.map((q) => {
              const pct = q.target > 0 ? Math.min(100, Math.round((q.progress / q.target) * 100)) : 0;
              return (
                <div key={q.id} className={cx("q-row", q.claimed && "done")}>
                  <div className="q-info">
                    <span className="q-name">{I18N.t(Q_LABEL[q.id], q.target)}</span>
                    <span className="q-reward">+{q.reward} 🔒</span>
                  </div>
                  <div className="q-bar"><div className="q-fill" style={{ width: pct + "%" }} /></div>
                  <div className="q-foot">
                    <span className="q-prog">{q.progress}/{q.target}</span>
                    {q.claimed
                      ? <span className="q-claimed">{I18N.t("Q_CLAIMED")}</span>
                      : <button className="q-claim" disabled={!q.done || claiming === q.id} onClick={() => onClaim(q.id)}>{I18N.t("Q_CLAIM")}</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {d.weekly && (
            <>
              <div className="q-head" style={{ marginTop: 18 }}>
                <span className="q-streak">📅 {I18N.t("QW_TITLE")}</span>
                <span className="q-reset">{I18N.t("QW_RESET_IN", fmtCountdownWeek(resetW))}</span>
              </div>
              <div className="q-list">
                {d.weekly.quests.map((q) => {
                  const pct = q.target > 0 ? Math.min(100, Math.round((q.progress / q.target) * 100)) : 0;
                  return (
                    <div key={q.id} className={cx("q-row", q.claimed && "done")}>
                      <div className="q-info">
                        <span className="q-name">{I18N.t(QW_LABEL[q.id], q.target)}</span>
                        <span className="q-reward">+{q.reward} 🔒</span>
                      </div>
                      <div className="q-bar"><div className="q-fill" style={{ width: pct + "%" }} /></div>
                      <div className="q-foot">
                        <span className="q-prog">{q.progress}/{q.target}</span>
                        {q.claimed
                          ? <span className="q-claimed">{I18N.t("Q_CLAIMED")}</span>
                          : <button className="q-claim" disabled={!q.done || claiming === q.id} onClick={() => onClaim(q.id)}>{I18N.t("Q_CLAIM")}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(window, { Quests });
