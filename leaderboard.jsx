/* ============================================================
   FRACTAL ARENA — Leaderboard (écran classement)
   ============================================================ */
const { useState, useEffect, useRef } = React;
const { useFA, cx, fmt, SectionHead, LpBadge } = window;
const I18N = window.FA_I18N;
const LU = window.FA_LB_LIVE_UI;

// Cadence du classement vivant : re-fetch toutes les 20 s tant que l'ecran est
// ouvert (cache serveur 15 s — on voit les chiffres bouger sans marteler l'API).
const LIVE_POLL_MS = 20_000;
const FLASH_MS = 1600;

const SECTIONS = {
  compet: [["wins", "LB_TAB_WINS"], ["collection", "LB_TAB_POWER"]],
  eco: [["earned", "LB_TAB_EARNED"], ["buyback", "LB_TAB_BUYBACK"]],
  lp: [["lp", "LB_TAB_LP"]],
};

// Classement des fournisseurs de liquidité (GET /lp/leaderboard, public).
// Pas de polling : une position LP bouge à l'échelle de la journée, un fetch à
// l'ouverture suffit. 503 = InSwap injoignable → message dédié plutôt qu'un
// classement faussement vide.
function LpBoard({ myWallet }) {
  const { actions } = useFA();
  const [st, setSt] = useState({ loading: true, holders: [], error: false, unavailable: false });
  useEffect(() => {
    let alive = true;
    actions.fetchLpLeaderboard().then((r) => {
      if (!alive) return;
      if (!r.ok) { setSt({ loading: false, holders: [], error: !r.unavailable, unavailable: !!r.unavailable }); return; }
      setSt({ loading: false, holders: r.holders, error: false, unavailable: false });
    });
    return () => { alive = false; };
  }, []);
  const short = (a) => (a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a || "");
  return (
    <div>
      {st.loading && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_LOADING")}</div>}
      {st.unavailable && <div className="muted" style={{ textAlign: "center", padding: 24, color: "var(--alert)" }}>{I18N.t("LP_LB_UNAVAILABLE")}</div>}
      {st.error && <div className="muted" style={{ textAlign: "center", padding: 24, color: "var(--alert)" }}>{I18N.t("LB_ERROR")}</div>}
      {!st.loading && !st.error && !st.unavailable && (
        <div className="lb-list">
          {st.holders.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_EMPTY")}</div>}
          {st.holders.map((h, i) => (
            <div key={h.address} className={cx("lb-row", h.address === myWallet && "mine", i < 3 && "top" + (i + 1))}>
              <span className="lb-rank">#{i + 1}</span>
              <span className="lb-name">
                {/* Logo 3D pour G2 (plancher 28px de LpBadge) : au plus une
                    poignée de G2 dans la liste, le canvas WebGL reste tenable. */}
                {h.tier && <LpBadge tier={h.tier} fa={h.fa} size={16} />}{h.tier ? " " : ""}
                {/* Nom ordinal (.fb) joint par le serveur depuis player_saves ;
                    l'adresse raccourcie n'est que le repli des wallets sans compte. */}
                {h.name ? h.name : <span className="mono">{short(h.address)}</span>}
              </span>
              <span className="lb-val">{fmt(h.fa)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Leaderboard() {
  const { g, actions } = useFA();
  const [section, setSection] = useState("compet");
  const [board, setBoard] = useState("wins");
  const [st, setSt] = useState({ loading: true, top: [], you: null, error: false });

  const [flash, setFlash] = useState(new Set());
  const prevTopRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    // L'onglet LP a son propre fetch (LpBoard) : pas de /leaderboard?board=lp,
    // et surtout pas le polling 20 s — la donnée vient d'InSwap, pas du jeu.
    if (board === "lp") return undefined;
    let alive = true;
    prevTopRef.current = null;
    setFlash(new Set());
    setSt((s) => ({ ...s, loading: true, error: false }));

    // silencieux = refresh du polling : pas de spinner, mais un flash sur les
    // lignes dont la valeur ou le rang a bouge — c'est ce qui rend le live visible.
    const load = (silencieux) => actions.fetchLeaderboard(board).then((r) => {
      if (!alive) return;
      if (!r.ok) { if (!silencieux) setSt({ loading: false, top: [], you: null, error: true }); return; }
      if (silencieux) {
        const changed = LU.diffChanges(prevTopRef.current, r.top);
        if (changed.size > 0) {
          setFlash(changed);
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => { if (alive) setFlash(new Set()); }, FLASH_MS);
        }
      }
      prevTopRef.current = r.top;
      setSt({ loading: false, top: r.top, you: r.you, error: false });
    }).catch(() => {
      if (!alive) return;
      if (!silencieux) setSt({ loading: false, top: [], you: null, error: true });
    });

    load(false);
    const id = setInterval(() => load(true), LIVE_POLL_MS);
    return () => { alive = false; clearInterval(id); if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, [board]);

  const pickSection = (sec) => {
    setSection(sec);
    setBoard(SECTIONS[sec][0][0]);
  };

  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <SectionHead eyebrow="🏆 LEADERBOARD" title={I18N.t("LB_TITLE")} />
      <div className="lb-tabs">
        <button className={cx("lb-tab", section === "compet" && "on")} onClick={() => pickSection("compet")}>{I18N.t("LB_SEC_COMPET")}</button>
        <button className={cx("lb-tab", section === "eco" && "on")} onClick={() => pickSection("eco")}>{I18N.t("LB_SEC_ECO")}</button>
        <button className={cx("lb-tab", section === "lp" && "on")} onClick={() => pickSection("lp")}>{I18N.t("LB_SEC_LP")}</button>
      </div>
      {section !== "lp" && (
        <div className="lb-tabs">
          {SECTIONS[section].map(([key, lbl]) => (
            <button key={key} className={cx("lb-tab", board === key && "on")} onClick={() => setBoard(key)}>{I18N.t(lbl)}</button>
          ))}
        </div>
      )}
      {section === "lp" && <LpBoard myWallet={g.wallet} />}
      {section !== "lp" && (
        <div className="muted mono" style={{ fontSize: 10, textAlign: "right", marginBottom: 6 }}>
          <span style={{ color: "var(--success)" }}>●</span> {I18N.t("LB_LIVE_HINT")}
        </div>
      )}
      {section !== "lp" && st.loading && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_LOADING")}</div>}
      {section !== "lp" && st.error && <div className="muted" style={{ textAlign: "center", padding: 24, color: "var(--alert)" }}>{I18N.t("LB_ERROR")}</div>}
      {section !== "lp" && !st.loading && !st.error && (
        <div className="lb-list">
          {st.top.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("LB_EMPTY")}</div>}
          {st.top.map((row) => (
            <div key={LU.rowKey(row)}
              className={cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)}
              style={{ transition: "background 0.8s ease",
                background: flash.has(LU.rowKey(row)) ? "rgba(0,240,255,0.14)" : undefined }}>
              <span className="lb-rank">#{row.rank}</span>
              <span className="lb-name">
                {/* Recence AVANT le nom : .lb-name coupe a l'ellipse, un nom long
                    perso avalait le point vert / le « il y a X » sur mobile. */}
                {row.live && <span title={I18N.t("LB_LIVE_HINT")}
                  style={{ color: "var(--success)", marginRight: 6, fontSize: 10, textShadow: "0 0 6px rgba(0,255,140,0.9)" }}>●</span>}
                {!row.live && (() => {
                  const ago = LU.formatAgo(row.ago_s);
                  return ago && <span className="mono" style={{ marginRight: 6, fontSize: 9, color: "var(--text-faint)" }}>
                    {ago.n === null ? I18N.t(ago.key) : I18N.t(ago.key, ago.n)}
                  </span>;
                })()}
                {row.name}
              </span>
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
