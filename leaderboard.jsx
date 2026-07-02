/* ============================================================
   FRACTAL ARENA — Leaderboard (écran classement)
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, SectionHead } = window;
const I18N = window.FA_I18N;

const SECTIONS = {
  compet: [["wins", "LB_TAB_WINS"], ["collection", "LB_TAB_POWER"]],
  eco: [["earned", "LB_TAB_EARNED"], ["buyback", "LB_TAB_BUYBACK"]],
};

function Leaderboard() {
  const { g, actions } = useFA();
  const [section, setSection] = useState("compet");
  const [board, setBoard] = useState("wins");
  const [st, setSt] = useState({ loading: true, top: [], you: null, error: false });

  useEffect(() => {
    let alive = true;
    setSt((s) => ({ ...s, loading: true, error: false }));
    actions.fetchLeaderboard(board).then((r) => {
      if (!alive) return;
      if (r.ok) setSt({ loading: false, top: r.top, you: r.you, error: false });
      else setSt({ loading: false, top: [], you: null, error: true });
    }).catch(() => {
      if (!alive) return;
      setSt({ loading: false, top: [], you: null, error: true });
    });
    return () => { alive = false; };
  }, [board]);

  const pickSection = (sec) => {
    setSection(sec);
    setBoard(SECTIONS[sec][0][0]);
  };

  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px" }}>
      <SectionHead eyebrow="🏆 LEADERBOARD" title={I18N.t("LB_TITLE")} />
      <div className="lb-tabs">
        <button className={cx("lb-tab", section === "compet" && "on")} onClick={() => pickSection("compet")}>{I18N.t("LB_SEC_COMPET")}</button>
        <button className={cx("lb-tab", section === "eco" && "on")} onClick={() => pickSection("eco")}>{I18N.t("LB_SEC_ECO")}</button>
      </div>
      <div className="lb-tabs">
        {SECTIONS[section].map(([key, lbl]) => (
          <button key={key} className={cx("lb-tab", board === key && "on")} onClick={() => setBoard(key)}>{I18N.t(lbl)}</button>
        ))}
      </div>
      {st.loading && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_LOADING")}</div>}
      {st.error && <div className="muted" style={{ textAlign: "center", padding: 24, color: "var(--alert)" }}>{I18N.t("LB_ERROR")}</div>}
      {!st.loading && !st.error && (
        <div className="lb-list">
          {st.top.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_EMPTY")}</div>}
          {st.top.map((row) => (
            <div key={row.rank} className={cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)}>
              <span className="lb-rank">#{row.rank}</span>
              <span className="lb-name">{row.name}</span>
              <span className="lb-val">{row.value}</span>
            </div>
          ))}
          {st.you && (
            <div className="lb-row mine">
              <span className="lb-rank">#{st.you.rank}</span>
              <span className="lb-name">{I18N.t("LB_YOU")}</span>
              <span className="lb-val">{st.you.value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Leaderboard });
