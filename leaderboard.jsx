/* ============================================================
   FRACTAL ARENA — Leaderboard (écran classement)
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, SectionHead } = window;
const I18N = window.FA_I18N;

function Leaderboard() {
  const { g, actions } = useFA();
  const [board, setBoard] = useState("wins");
  const [st, setSt] = useState({ loading: true, top: [], you: null, error: false });

  useEffect(() => {
    let alive = true;
    setSt((s) => ({ ...s, loading: true, error: false }));
    actions.fetchLeaderboard(board).then((r) => {
      if (!alive) return;
      if (r.ok) setSt({ loading: false, top: r.top, you: r.you, error: false });
      else setSt({ loading: false, top: [], you: null, error: true });
    });
    return () => { alive = false; };
  }, [board]);

  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px" }}>
      <SectionHead eyebrow="🏆 LEADERBOARD" title={I18N.t("LB_TITLE")} />
      <div className="lb-tabs">
        <button className={cx("lb-tab", board === "wins" && "on")} onClick={() => setBoard("wins")}>{I18N.t("LB_TAB_WINS")}</button>
        <button className={cx("lb-tab", board === "collection" && "on")} onClick={() => setBoard("collection")}>{I18N.t("LB_TAB_POWER")}</button>
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
