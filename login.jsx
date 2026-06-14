/* ============================================================
   FRACTAL ARENA — Cadeau de connexion (modale calendrier 7 jours)
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, Modal, SectionHead } = window;
const I18N = window.FA_I18N;

function LoginGate() {
  const { g, actions } = useFA();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!g.wallet) return;
    let alive = true;
    actions.fetchLoginReward().then((r) => {
      if (!alive) return;
      if (r.ok && r.data.claimable_today) { setData(r.data); setOpen(true); }
    });
    return () => { alive = false; };
  }, [g.wallet]);

  if (!open || !data) return null;

  const onClaim = async () => {
    setClaiming(true);
    let r;
    try { r = await actions.claimLoginReward(); } finally { setClaiming(false); }
    if (r.ok) { setOpen(false); return; }
    if (r.reason === "retry") {
      setClaiming(true);
      let rr;
      try { rr = await actions.claimLoginReward(); } finally { setClaiming(false); }
      if (rr.ok) setOpen(false);
    }
  };

  return (
    <Modal onClose={() => setOpen(false)} accent="var(--gold)">
      <SectionHead eyebrow="🎁 DAILY" title={I18N.t("LOGIN_TITLE")} />
      <div className="login-grid">
        {data.rewards.map((amt, i) => {
          const day = i + 1;
          const isToday = day === data.claim_day;
          const isPast = day < data.claim_day;
          return (
            <div key={day} className={cx("login-cell", isToday && "today", isPast && "past", day === 7 && "jackpot")}>
              <span className="login-day">{I18N.t("LOGIN_DAY", day)}</span>
              <span className="login-amt">+{amt} 🔒</span>
              {isPast && <span className="login-check">✓</span>}
            </div>
          );
        })}
      </div>
      <button className="btn btn-gold lg" style={{ width: "100%", marginTop: 12 }} disabled={claiming} onClick={onClaim}>
        {I18N.t("LOGIN_CLAIM")}
      </button>
    </Modal>
  );
}

Object.assign(window, { LoginGate });
