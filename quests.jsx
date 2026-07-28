/* ============================================================
   FRACTAL ARENA — Écran Quêtes quotidiennes
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, SectionHead, TokenIcon } = window;
const I18N = window.FA_I18N;

const Q_LABEL = { wins: "Q_WINS", paid: "Q_PAID", chat: "Q_CHAT" };

const QW_LABEL = { w_pvp: "QW_PVP", w_tower: "QW_TOWER", w_fosse: "QW_FOSSE" };

// Parcours de découverte. Même forme que ci-dessus : les six identifiants
// viennent du serveur (discovery.js), les libellés sont résolus ici.
const D_LABEL = {
  d_win: "DISC_D_WIN", d_paid: "DISC_D_PAID", d_level: "DISC_D_LEVEL",
  d_camp: "DISC_D_CAMP", d_tower: "DISC_D_TOWER", d_pvp: "DISC_D_PVP",
};

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

  // --- Parcours de découverte ---
  // L'état vient entièrement du serveur, y compris l'éligibilité : le parcours
  // n'est proposé qu'aux comptes créés sans wallet, et c'est le serveur qui en
  // décide (discovery.js). On ne le déduit jamais de l'état client.
  const [disc, setDisc] = useState(null);
  const [claimingDisc, setClaimingDisc] = useState(null);

  const loadDisc = () => {
    actions.discoveryState().then((r) => { if (r.ok) setDisc(r.data); }).catch(() => {});
  };
  useEffect(() => { loadDisc(); }, []);

  const onClaimDisc = async (id) => {
    setClaimingDisc(id);
    let r;
    try { r = await actions.claimDiscovery(id); } finally { setClaimingDisc(null); }
    if (!r.ok) return;
    // Recharger depuis le serveur plutôt que de patcher localement : une seule
    // source de vérité, et la progression des autres étapes a pu bouger.
    loadDisc();
  };

  // Visible seulement si le compte est éligible ET qu'il reste une étape à
  // réclamer : un tutoriel terminé ne doit plus occuper l'écran.
  const showDisc = !!(disc && disc.eligible && disc.steps.length > 0
                      && !disc.steps.every((s) => s.claimed));

  const d = st.data;
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px" }}>
      {showDisc && (
        <div style={{ marginBottom: 22 }}>
          <SectionHead eyebrow="🎓 START" title={I18N.t("DISC_TITLE")} />
          <div className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>{I18N.t("DISC_SUB")}</div>
          <div className="q-list">
            {disc.steps.map((s) => {
              const pct = s.target > 0 ? Math.min(100, Math.round((s.progress / s.target) * 100)) : 0;
              return (
                <div key={s.id} className={cx("q-row", s.claimed && "done")}>
                  <div className="q-info">
                    <span className="q-name">{I18N.t(D_LABEL[s.id])}</span>
                    <span className="q-reward">+<TokenIcon s={12} /> {s.reward} 🔒</span>
                  </div>
                  <div className="q-bar"><div className="q-fill" style={{ width: pct + "%" }} /></div>
                  <div className="q-foot">
                    <span className="q-prog">{s.progress}/{s.target}</span>
                    {s.claimed
                      ? <span className="q-claimed">{I18N.t("DISC_CLAIMED")}</span>
                      : <button className="q-claim" disabled={!s.done || claimingDisc === s.id} onClick={() => onClaimDisc(s.id)}>{I18N.t("DISC_CLAIM")}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
                    <span className="q-reward">+<TokenIcon s={12} /> {q.reward} 🔒</span>
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
                        <span className="q-reward">+<TokenIcon s={12} /> {q.reward} 🔒</span>
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
