/* ============================================================
   FRACTAL ARENA — Compte sans wallet : ecrans
   SecretsGate (unique affichage des secrets), RecoverScreen, LockedBanner.
   Les secrets ne sont JAMAIS persistes : ils vivent ici, puis disparaissent.
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, Modal, SectionHead } = window;
const I18N = window.FA_I18N;
const ACC = window.FA_ACCOUNT;

function SecretsGate({ secrets, onDone }) {
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

      {/* La phrase de 12 mots n'est PLUS montree (decision du user, 2026-07-27) :
          elle ne donne acces a rien — les FA sont un solde en base, aucun jeton
          n'est envoye a l'adresse du compte, et les retraits partiront vers le
          portefeuille que le joueur liera lui-meme. L'afficher ne ferait que lui
          confier un secret anxiogene et l'entrainer au geste qui le fera phisher,
          en contradiction avec l'avertissement ci-dessous. */}
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
    // Un seul champ pour deux codes : celui de RÉCUPÉRATION (compte généré) et
    // celui de LIAISON D'APPAREIL (affiché sous le QR du PC, ou copié par le
    // pont vers l'app UniSat — lien complet accepté, codeFromInput en tire le
    // code). Le format tranche ; le joueur n'a pas à savoir ce qu'il tient.
    const DL = window.FA_DEVICE_LINK;
    const lien = DL ? DL.codeFromInput(code) : null;
    try {
      r = lien
        ? await actions.claimDeviceLink(lien)
        : await actions.recoverAccount(code);
    } finally { setBusy(false); }
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

/* Pont vers l'app UniSat — mobile sans extension.
   Ce que ce bloc remplace : se déconnecter, rouvrir le jeu dans le navigateur
   de l'app UniSat, retaper un code de récupération. Un code de liaison
   d'appareil (le même que le QR PC→téléphone, écran Options) fait tout ça en
   un collage : la session suit le joueur dans l'app, où le provider est
   injecté (vérifié en réel le 2026-08-18) et où liaison et retraits se
   signent. Et comme la session y persiste (fa_device_linked), les retraits
   suivants n'ont plus besoin du pont : rouvrir le jeu dans l'app suffit.
   `mode` choisit la marche finale : "link" (volet crypto) ou "withdraw". */
function UnisatAppBridge({ mode }) {
  const { actions, toast } = useFA();
  const [link, setLink] = useState(null); // { url, expiresAt }
  const [restant, setRestant] = useState(0);
  const [busy, setBusy] = useState(false);

  // Même règle que DeviceLinkPanel (Options) : un code mort ne doit pas rester
  // affiché comme s'il était encore collable.
  useEffect(() => {
    if (!link) return undefined;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((link.expiresAt - Date.now()) / 1000));
      setRestant(r);
      if (r <= 0) setLink(null);
    }, 500);
    return () => clearInterval(id);
  }, [link]);

  const copier = async (url) => {
    // Presse-papier refusé : l'URL reste affichée en clair, sélectionnable.
    try { await navigator.clipboard.writeText(url); toast(I18N.t("UAPP_COPIED"), "good"); }
    catch (e) {}
  };

  const generer = async () => {
    setBusy(true);
    const r = await actions.createDeviceLink();
    setBusy(false);
    if (!r.ok) { toast(I18N.t("OP_DEVLINK_ERROR"), "bad"); return; }
    const url = window.FA_DEVICE_LINK.linkUrl(window.location.origin, r.code);
    setLink({ url, code: r.code, expiresAt: Date.now() + r.expires_in * 1000 });
    setRestant(r.expires_in);
    await copier(url);
  };

  return (
    <div className="acc-warn" style={{ marginTop: 8, fontSize: 12 }}>
      <div style={{ marginBottom: 8 }}>{I18N.t(mode === "withdraw" ? "UAPP_WD_INTRO" : "UAPP_LINK_INTRO")}</div>
      <div style={{ lineHeight: 1.7 }}>
        <div>{I18N.t("UAPP_STEP1")}</div>
        <div>{I18N.t("UAPP_STEP2")}</div>
        <div>{I18N.t(mode === "withdraw" ? "UAPP_STEP3_WD" : "UAPP_STEP3_LINK")}</div>
      </div>
      {mode === "withdraw" && (
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{I18N.t("UAPP_WD_AGAIN")}</div>
      )}
      {!link ? (
        <button className="btn btn-elec block" style={{ marginTop: 10 }} disabled={busy} onClick={generer}>
          ⧉ {I18N.t("UAPP_BTN")}
        </button>
      ) : (
        <div style={{ marginTop: 10 }}>
          {/* Le code seul, en gros : si le navigateur de l'app n'a pas de barre
              d'adresse, il se colle (ou se recopie) dans « Récupérer mon
              compte » — qui accepte aussi le lien entier (codeFromInput). */}
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, userSelect: "all" }}>{link.code}</div>
          <div className="mono" style={{ fontSize: 11, wordBreak: "break-all", userSelect: "all", opacity: 0.7, marginTop: 4 }}>{link.url}</div>
          <div className="mono muted" style={{ fontSize: 10.5, margin: "6px 0" }}>{I18N.t("OP_DEVLINK_TTL", restant)}</div>
          <button className="btn ghost sm" disabled={busy} onClick={() => copier(link.url)}>⧉ {I18N.t("OP_DEVLINK_COPY")}</button>
        </div>
      )}
    </div>
  );
}

/* Le geste de liaison, en deux temps : on demande son adresse à UniSat, on la
   MONTRE, et rien ne part avant un second clic.

   Pourquoi (incident du 2026-07-30) : le bouton liait directement le compte actif
   de l'extension, sans jamais afficher l'adresse. Le user a lié son compte de
   test à l'adresse de son compte de jeu principal — sans l'avoir voulu, sans
   l'avoir vue. Or lier redirige tous les retraits futurs, déclenche un envoi
   on-chain de 1 000 sats, et le jeu refuse ensuite tout relink (« un compte = un
   portefeuille ») : seul un accès direct à la base a pu le défaire.

   Composant unique, monté partout où l'on peut lier : deux implémentations
   divergeraient, et c'est celle sans confirmation qui ferait le dégât. */
function LinkWalletButton({ onLinked, disabled }) {
  const { actions, toast } = useFA();
  const [pending, setPending] = useState("");   // adresse en attente de confirmation
  const [busy, setBusy] = useState(false);

  const REFUS = {
    "no-unisat": "ACC_LINK_NO_UNISAT",
    "taken": "ACC_LINK_TAKEN",
    "same": "ACC_LINK_SAME",
    "rejected": "ACC_LINK_REJECTED",
    "bad-address": "ACC_LINK_FAIL",
  };

  const demander = async () => {
    setBusy(true);
    let r;
    try { r = await actions.requestWalletAddress(); } finally { setBusy(false); }
    if (r.ok) { setPending(r.wallet); return; }
    toast(I18N.t(REFUS[r.reason] || "ACC_LINK_FAIL"), "bad");
  };

  // C'est `pending` qui part — la valeur affichée, pas une relecture d'UniSat.
  const confirmer = async () => {
    setBusy(true);
    let r;
    try { r = await actions.linkWallet(pending); } finally { setBusy(false); }
    if (r.ok) {
      setPending("");
      toast(I18N.t("ACC_LINK_OK"), "good");
      onLinked && onLinked();
      return;
    }
    setPending("");
    toast(I18N.t(REFUS[r.reason] || "ACC_LINK_FAIL"), "bad");
  };

  if (!pending) {
    // Sans extension injectée, rien n'est signable sur place : le dire ICI, pas
    // après un clic qui échoue. Le chemin de secours dépend de l'appareil
    // (cheminLiaison) : sur mobile, le pont vers l'app UniSat — dont le
    // navigateur intégré injecte le provider ; sur ordinateur, l'extension (le
    // bouton reste actif, elle peut s'injecter tardivement). Sur le chemin
    // mobile, le bouton disparaît : il ne peut pas aboutir, et les étapes du
    // pont désignent leur propre bouton.
    const chemin = ACC.cheminLiaison(ACC.hasProvider(), ACC.estNavigateurMobile());
    return (
      <>
        {chemin !== "unisat-app" && (
          <button className="btn block" disabled={busy || disabled} onClick={demander}>
            {I18N.t("ACC_LINK_BTN")}
          </button>
        )}
        {chemin === "desktop" && (
          <div className="acc-warn" style={{ marginTop: 8, fontSize: 12 }}>{I18N.t("ACC_LINK_DESKTOP_ONLY")}</div>
        )}
        {chemin === "unisat-app" && <UnisatAppBridge mode="link" />}
      </>
    );
  }
  return (
    <div className="acc-warn" style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 8 }}>{I18N.t("ACC_LINK_CONFIRM")}</div>
      <div className="mono" style={{ fontSize: 12, wordBreak: "break-all", marginBottom: 10 }}>{pending}</div>
      <button className="btn btn-gold block" disabled={busy} onClick={confirmer}>
        {I18N.t("ACC_LINK_CONFIRM_BTN")}
      </button>
      <button className="btn block sm" style={{ marginTop: 6 }} disabled={busy}
              onClick={() => setPending("")}>
        {I18N.t("ACC_LINK_CANCEL")}
      </button>
    </div>
  );
}

/* Le volet crypto du parcours, en cinq états tous dictés par le serveur.
   Extrait de LockedBanner (2026-07-29) pour être monté aussi par la fenêtre
   « Bien joué » : deux copies auraient divergé, et le joueur aurait vu un écran
   différent selon la porte empruntée.
   `onLinked` permet à l'appelant de réagir à la liaison (la fenêtre de fin, elle,
   reste ouverte : lier n'est pas la fin, la poussière part ensuite). */
function CryptoVolet({ disc, reload, onLinked }) {
  const { g, actions, toast } = useFA();
  const [txid, setTxid] = useState("");
  const [sending, setSending] = useState(false);
  const lie = !!g.linkedWallet;

  const submitTxid = async () => {
    setSending(true);
    let r;
    try { r = await actions.submitDustTxid(txid); } finally { setSending(false); }
    if (r.ok) {
      toast(I18N.t("DISC_TXID_OK"), "good");
      setTxid("");
      reload && reload(); // relire l'état plutôt que de le patcher : une seule source de vérité
      return;
    }
    const messages = { dust: "DISC_TXID_NONE", bad: "DISC_TXID_BAD" };
    toast(I18N.t(messages[r.reason] || "ACC_VERIFY_ERR"), "bad");
  };

  return (
    <>
      {!disc.game_done && (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.65 }}>
          {I18N.t("DISC_CRYPTO_LOCKED")}
        </div>
      )}

      {disc.game_done && !lie && (
        <LinkWalletButton onLinked={() => { reload && reload(); onLinked && onLinked(); }} />
      )}

      {disc.game_done && lie && !disc.dust_sent && (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{I18N.t("DISC_DUST_WAIT")}</div>
      )}

      {disc.game_done && lie && disc.dust_sent && !disc.txid_verified && (
        <>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{I18N.t("DISC_DUST_ARRIVED")}</div>
          <label className="mono" style={{ fontSize: 12, display: "block", margin: "10px 0 4px" }}>
            {I18N.t("DISC_TXID_LABEL")}
          </label>
          <input className="field" value={txid} onChange={(e) => setTxid(e.target.value)}
                 placeholder={I18N.t("DISC_TXID_PLACEHOLDER")}
                 autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{I18N.t("DISC_TXID_HINT")}</div>
          {/* Le montant vient du serveur : le client ne le recopie jamais. */}
          {disc.txid_reward > 0 && (
            <div className="mono" style={{ fontSize: 12, marginTop: 6, color: "var(--gold)" }}>
              {I18N.t("DISC_TXID_REWARD", disc.txid_reward)}
            </div>
          )}
          <button className="btn block" style={{ marginTop: 10 }}
                  disabled={sending || !txid.trim()} onClick={submitTxid}>
            {I18N.t("DISC_TXID_BTN")}
          </button>
        </>
      )}

      {disc.txid_verified && (
        <div className="mono" style={{ fontSize: 12, lineHeight: 1.6, color: "var(--success)" }}>
          {I18N.t("DISC_TXID_OK")}
        </div>
      )}
    </>
  );
}

/* « Bien joué » — la fenêtre qui conclut le parcours.
   Le volet crypto n'avait qu'une porte : le bandeau des gains verrouillés, que le
   joueur peut fermer et qui se tait alors 24 h. Fermé, aucun écran ne proposait
   plus de lier son portefeuille — il ne restait que la console du navigateur.
   Celle-ci s'ouvre d'elle-même quand la sixième étape vient d'être réclamée, et
   ne se laisse pas condamner : la refermer ne l'empêche pas de revenir. */
function DiscoveryFinish({ disc, reload, onClose }) {
  const { g } = useFA();
  if (!disc) return null;
  // Le sous-titre annonce ce qu'il reste à FAIRE. Il parlait de « relier un
  // portefeuille » même une fois le portefeuille lié (constaté en prod le
  // 2026-07-30, à l'étape txid) : un écran qui décrit une étape déjà franchie
  // fait douter le joueur de ce qu'il vient de faire.
  const etape = ACC.discoveryNextAction(disc, g.linkedWallet);
  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <SectionHead eyebrow="🎉 BIEN JOUÉ" title={I18N.t("DISC_FINISH_TITLE")} />
      {etape === "link" && (
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
          {I18N.t("DISC_FINISH_SUB")}
        </div>
      )}
      <CryptoVolet disc={disc} reload={reload} />
      <div className="acc-warn" style={{ marginTop: 14 }}>{I18N.t("ACC_PHISHING_WARN")}</div>
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
  // Parcours de découverte. Chargé à l'ouverture de la fenêtre seulement : le
  // bandeau est monté en permanence, un appel au montage serait tiré à chaque
  // session pour des joueurs qui n'ouvriront jamais ce panneau.
  const [disc, setDisc] = useState(null);

  const show = ACC.shouldShowLockedBanner({
    kind: g.accountKind, onchainVerified: g.onchainVerified,
    dismissedAt, now: Date.now(),
  });
  if (!show && !howto) return null;

  // Compte cree sans wallet : il lie SON propre portefeuille, qui devient sa
  // destination de retrait. Compte venu d'UniSat mais pas encore verifie : il
  // prouve simplement l'activite de l'adresse avec laquelle il est deja connecte —
  // rien a lier, elle est deja la sienne.
  const genere = g.accountKind === ACC.KIND_GENERATED;

  const loadDisc = () => {
    actions.discoveryState().then((r) => { if (r.ok) setDisc(r.data); }).catch(() => {});
  };
  const openHowto = () => { setHowto(true); loadDisc(); };

  // Le parcours ne concerne que les comptes créés sans wallet ; le serveur en
  // décide (`eligible`). Un joueur venu avec UniSat voit ce même bandeau tant
  // qu'il n'est pas vérifié, mais n'a pas de parcours : il garde l'écran d'origine.
  const parcours = !!(disc && disc.eligible);

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
          <button className="btn sm" onClick={openHowto}>{I18N.t("ACC_LOCKED_HOW")}</button>
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
          <div className="acc-warn" style={{ marginTop: 12 }}>{I18N.t("ACC_PHISHING_WARN")}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>{I18N.t("ACC_HOWTO_CAP")}</div>

          {/* Parcours de découverte : le volet crypto en cinq états, tous dictés
              par le serveur. Un compte non éligible garde l'écran d'origine. */}
          {parcours ? (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div className="mono" style={{ fontSize: 13, marginBottom: 8 }}>{I18N.t("DISC_CRYPTO_TITLE")}</div>
              <CryptoVolet disc={disc} reload={loadDisc} />
            </div>
          ) : genere ? (
            // Compte généré hors parcours : lier conclut, on ferme. Même bouton
            // confirmé que dans le parcours — c'est le même geste irréversible.
            <div style={{ marginTop: 14 }}>
              <LinkWalletButton onLinked={() => setHowto(false)} />
            </div>
          ) : (
            <button className="btn block" style={{ marginTop: 14 }} disabled={checking} onClick={check}>
              {I18N.t("ACC_VERIFY_BTN")}
            </button>
          )}
        </Modal>
      )}
    </>
  );
}

Object.assign(window, { SecretsGate, RecoverScreen, LockedBanner, CryptoVolet, DiscoveryFinish, LinkWalletButton, UnisatAppBridge });
