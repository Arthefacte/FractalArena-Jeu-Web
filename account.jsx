/* ============================================================
   FRACTAL ARENA — Compte sans wallet : ecrans
   SecretsGate (unique affichage des secrets), RecoverScreen, LockedBanner.
   Les secrets ne sont JAMAIS persistes : ils vivent ici, puis disparaissent.
   ============================================================ */
const { useState } = React;
const { useFA, cx, Modal, SectionHead } = window;
const I18N = window.FA_I18N;
const ACC = window.FA_ACCOUNT;

function SecretsGate({ secrets, onDone }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!secrets) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(secrets.recovery_code); setCopied(true); }
    catch (e) { setCopied(false); }
  };

  return (
    <Modal accent="var(--gold)">
      <SectionHead eyebrow="🔑 BACKUP" title={I18N.t("ACC_SECRETS_TITLE")} />
      <div className="muted mono" style={{ fontSize: 13, marginBottom: 16 }}>{I18N.t("ACC_SECRETS_INTRO")}</div>

      <div className="acc-secret">
        <div className="acc-secret-label">{I18N.t("ACC_CODE_LABEL")}</div>
        <div className="acc-code mono">{secrets.recovery_code}</div>
        <button className="btn sm" onClick={copy}>{copied ? I18N.t("ACC_COPIED") : I18N.t("ACC_COPY")}</button>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("ACC_CODE_HINT")}</div>
      </div>

      <div className="acc-secret">
        <div className="acc-secret-label">{I18N.t("ACC_SEED_LABEL")}</div>
        <div className={cx("acc-seed mono", !revealed && "masked")}>
          {revealed ? secrets.seed : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}
        </div>
        <button className="btn sm" onClick={() => setRevealed(!revealed)}>
          {revealed ? I18N.t("ACC_SEED_HIDE") : I18N.t("ACC_SEED_REVEAL")}
        </button>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("ACC_SEED_HINT")}</div>
      </div>

      <div className="acc-warn">{I18N.t("ACC_PHISHING_WARN")}</div>

      <label className="acc-confirm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{I18N.t("ACC_CONFIRM_SAVED")}</span>
      </label>

      <button className="btn btn-gold lg" style={{ width: "100%", marginTop: 12 }}
              disabled={!confirmed} onClick={onDone}>
        {I18N.t("ACC_CONTINUE")}
      </button>
    </Modal>
  );
}

function RecoverScreen({ onClose }) {
  const { actions, toast } = useFA();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    let r;
    try { r = await actions.recoverAccount(code); } finally { setBusy(false); }
    if (r.ok) { onClose && onClose(); return; }
    if (r.reason === "seed") { toast(I18N.t("ACC_RECOVER_SEED_REFUSED"), "bad"); setCode(""); return; }
    if (r.reason === "rate") { toast(I18N.t("ACC_RECOVER_RATE"), "bad"); return; }
    // Panne réseau ou serveur (5xx / exception fetch) : le code n'a PAS été jugé faux,
    // on n'a simplement pas pu le vérifier. Même soin que pour verifyOnchain (98082b1) —
    // sinon un joueur avec un code correct mais du réseau instable s'entend dire que son
    // compte est perdu (IMPORTANT 7).
    if (r.reason === "network" || r.reason === "server") { toast(I18N.t("ACC_RECOVER_ERROR"), "bad"); return; }
    toast(I18N.t("ACC_RECOVER_FAIL"), "bad");
  };

  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <SectionHead eyebrow="🔑 RECOVERY" title={I18N.t("ACC_RECOVER_TITLE")} />
      <div className="muted mono" style={{ fontSize: 13, marginBottom: 14 }}>{I18N.t("ACC_RECOVER_SUB")}</div>
      <input className="field" style={{ marginBottom: 10 }} value={code} autoComplete="off" spellCheck={false}
             autoCapitalize="off" autoCorrect="off"
             onChange={(e) => setCode(e.target.value)}
             placeholder={I18N.t("ACC_RECOVER_PLACEHOLDER")}
             onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button className="btn btn-gold block lg" disabled={busy || !code.trim()} onClick={submit}>
        {I18N.t("ACC_RECOVER_BTN")}
      </button>
    </Modal>
  );
}

const DISMISS_KEY = "fa_locked_banner_dismissed";
function readDismissed() { try { return parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
function writeDismissed(ts) { try { localStorage.setItem(DISMISS_KEY, String(ts)); } catch (e) {} }

function LockedBanner() {
  const { g, actions, toast } = useFA();
  const [dismissedAt, setDismissedAt] = useState(readDismissed);
  const [howto, setHowto] = useState(false);
  const [checking, setChecking] = useState(false);

  const show = ACC.shouldShowLockedBanner({
    kind: g.accountKind, onchainVerified: g.onchainVerified,
    dismissedAt, now: Date.now(),
  });
  if (!show && !howto) return null;

  const close = () => { const t = Date.now(); writeDismissed(t); setDismissedAt(t); };
  const check = async () => {
    setChecking(true);
    let r;
    try { r = await actions.verifyOnchain(); } finally { setChecking(false); }
    if (r.ok && r.verified) { toast(I18N.t("ACC_VERIFY_OK"), "good"); setHowto(false); return; }
    if (r.ok && !r.verified) { toast(I18N.t("ACC_VERIFY_NONE"), "bad"); return; }
    toast(I18N.t("ACC_VERIFY_ERR"), "bad");
  };

  return (
    <>
      {show && (
        <div className="acc-banner">
          <span className="grow">🔒 {I18N.t("ACC_LOCKED_BANNER")}</span>
          <button className="btn sm" onClick={() => setHowto(true)}>{I18N.t("ACC_LOCKED_HOW")}</button>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                  onClick={close}>{I18N.t("ACC_LOCKED_CLOSE")}</button>
        </div>
      )}
      {howto && (
        <Modal onClose={() => setHowto(false)} accent="var(--gold)">
          <SectionHead eyebrow="🔓 UNLOCK" title={I18N.t("ACC_HOWTO_TITLE")} />
          <div className="mono" style={{ fontSize: 13, lineHeight: 2 }}>
            <div>{I18N.t("ACC_HOWTO_1")}</div>
            <div>{I18N.t("ACC_HOWTO_2")}</div>
            <div>{I18N.t("ACC_HOWTO_3")}</div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>{I18N.t("ACC_HOWTO_CAP")}</div>
          <button className="btn block" style={{ marginTop: 14 }} disabled={checking} onClick={check}>
            {I18N.t("ACC_VERIFY_BTN")}
          </button>
        </Modal>
      )}
    </>
  );
}

Object.assign(window, { SecretsGate, RecoverScreen, LockedBanner });
