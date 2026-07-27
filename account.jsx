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

Object.assign(window, { SecretsGate });
