/* Généré par tools/precompile.mjs depuis account.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Compte sans wallet : ecrans
   SecretsGate (unique affichage des secrets), RecoverScreen, LockedBanner.
   Les secrets ne sont JAMAIS persistes : ils vivent ici, puis disparaissent.
   ============================================================ */
const {
  useState
} = React;
const {
  useFA,
  cx,
  Modal,
  SectionHead
} = window;
const I18N = window.FA_I18N;
const ACC = window.FA_ACCOUNT;
function SecretsGate({
  secrets,
  onDone
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!secrets) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secrets.recovery_code);
      setCopied(true);
    } catch (e) {
      setCopied(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83D\uDD11 BACKUP",
    title: I18N.t("ACC_SECRETS_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13,
      marginBottom: 16
    }
  }, I18N.t("ACC_SECRETS_INTRO")), /*#__PURE__*/React.createElement("div", {
    className: "acc-secret"
  }, /*#__PURE__*/React.createElement("div", {
    className: "acc-secret-label"
  }, I18N.t("ACC_CODE_LABEL")), /*#__PURE__*/React.createElement("div", {
    className: "acc-code mono"
  }, secrets.recovery_code), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    onClick: copy
  }, copied ? I18N.t("ACC_COPIED") : I18N.t("ACC_COPY")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11,
      marginTop: 6
    }
  }, I18N.t("ACC_CODE_HINT"))), /*#__PURE__*/React.createElement("div", {
    className: "acc-warn"
  }, I18N.t("ACC_PHISHING_WARN")), /*#__PURE__*/React.createElement("label", {
    className: "acc-confirm"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: confirmed,
    onChange: e => setConfirmed(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, I18N.t("ACC_CONFIRM_SAVED"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold lg",
    style: {
      width: "100%",
      marginTop: 12
    },
    disabled: !confirmed,
    onClick: onDone
  }, I18N.t("ACC_CONTINUE")));
}
function RecoverScreen({
  onClose
}) {
  const {
    actions,
    toast
  } = useFA();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    let r;
    // Un seul champ pour deux codes : celui de RÉCUPÉRATION (compte généré) et
    // celui de LIAISON D'APPAREIL (affiché sous le QR, écran Options du PC).
    // Le format tranche — 16 caractères Crockford = liaison ; le joueur n'a
    // pas à savoir lequel il tient.
    const DL = window.FA_DEVICE_LINK;
    try {
      r = DL && DL.isLinkCode(code) ? await actions.claimDeviceLink(code) : await actions.recoverAccount(code);
    } finally {
      setBusy(false);
    }
    if (r.ok) {
      onClose && onClose();
      return;
    }
    if (r.reason === "seed") {
      toast(I18N.t("ACC_RECOVER_SEED_REFUSED"), "bad");
      setCode("");
      return;
    }
    if (r.reason === "rate") {
      toast(I18N.t("ACC_RECOVER_RATE"), "bad");
      return;
    }
    // Panne réseau ou serveur (5xx / exception fetch) : le code n'a PAS été jugé faux,
    // on n'a simplement pas pu le vérifier. Même soin que pour verifyOnchain (98082b1) —
    // sinon un joueur avec un code correct mais du réseau instable s'entend dire que son
    // compte est perdu (IMPORTANT 7).
    if (r.reason === "network" || r.reason === "server") {
      toast(I18N.t("ACC_RECOVER_ERROR"), "bad");
      return;
    }
    toast(I18N.t("ACC_RECOVER_FAIL"), "bad");
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83D\uDD11 RECOVERY",
    title: I18N.t("ACC_RECOVER_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13,
      marginBottom: 14
    }
  }, I18N.t("ACC_RECOVER_SUB")), /*#__PURE__*/React.createElement("input", {
    className: "field",
    style: {
      marginBottom: 10
    },
    value: code,
    autoComplete: "off",
    spellCheck: false,
    autoCapitalize: "off",
    autoCorrect: "off",
    onChange: e => setCode(e.target.value),
    placeholder: I18N.t("ACC_RECOVER_PLACEHOLDER"),
    onKeyDown: e => e.key === "Enter" && submit()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold block lg",
    disabled: busy || !code.trim(),
    onClick: submit
  }, I18N.t("ACC_RECOVER_BTN")));
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
function LinkWalletButton({
  onLinked,
  disabled
}) {
  const {
    actions,
    toast
  } = useFA();
  const [pending, setPending] = useState(""); // adresse en attente de confirmation
  const [busy, setBusy] = useState(false);
  const REFUS = {
    "no-unisat": "ACC_LINK_NO_UNISAT",
    "taken": "ACC_LINK_TAKEN",
    "same": "ACC_LINK_SAME",
    "rejected": "ACC_LINK_REJECTED",
    "bad-address": "ACC_LINK_FAIL"
  };
  const demander = async () => {
    setBusy(true);
    let r;
    try {
      r = await actions.requestWalletAddress();
    } finally {
      setBusy(false);
    }
    if (r.ok) {
      setPending(r.wallet);
      return;
    }
    toast(I18N.t(REFUS[r.reason] || "ACC_LINK_FAIL"), "bad");
  };

  // C'est `pending` qui part — la valeur affichée, pas une relecture d'UniSat.
  const confirmer = async () => {
    setBusy(true);
    let r;
    try {
      r = await actions.linkWallet(pending);
    } finally {
      setBusy(false);
    }
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
    // Sur mobile, l'extension UniSat n'est jamais injectée et rien n'est signable :
    // le dire ICI, pas après un clic qui échoue. Le bouton reste actif — l'extension
    // peut s'injecter tardivement, et un bouton mort n'explique rien.
    const hint = ACC.linkHintKey(ACC.hasProvider());
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn block",
      disabled: busy || disabled,
      onClick: demander
    }, I18N.t("ACC_LINK_BTN")), hint && /*#__PURE__*/React.createElement("div", {
      className: "acc-warn",
      style: {
        marginTop: 8,
        fontSize: 12
      }
    }, I18N.t(hint)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "acc-warn",
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, I18N.t("ACC_LINK_CONFIRM")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      wordBreak: "break-all",
      marginBottom: 10
    }
  }, pending), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold block",
    disabled: busy,
    onClick: confirmer
  }, I18N.t("ACC_LINK_CONFIRM_BTN")), /*#__PURE__*/React.createElement("button", {
    className: "btn block sm",
    style: {
      marginTop: 6
    },
    disabled: busy,
    onClick: () => setPending("")
  }, I18N.t("ACC_LINK_CANCEL")));
}

/* Le volet crypto du parcours, en cinq états tous dictés par le serveur.
   Extrait de LockedBanner (2026-07-29) pour être monté aussi par la fenêtre
   « Bien joué » : deux copies auraient divergé, et le joueur aurait vu un écran
   différent selon la porte empruntée.
   `onLinked` permet à l'appelant de réagir à la liaison (la fenêtre de fin, elle,
   reste ouverte : lier n'est pas la fin, la poussière part ensuite). */
function CryptoVolet({
  disc,
  reload,
  onLinked
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [txid, setTxid] = useState("");
  const [sending, setSending] = useState(false);
  const lie = !!g.linkedWallet;
  const submitTxid = async () => {
    setSending(true);
    let r;
    try {
      r = await actions.submitDustTxid(txid);
    } finally {
      setSending(false);
    }
    if (r.ok) {
      toast(I18N.t("DISC_TXID_OK"), "good");
      setTxid("");
      reload && reload(); // relire l'état plutôt que de le patcher : une seule source de vérité
      return;
    }
    const messages = {
      dust: "DISC_TXID_NONE",
      bad: "DISC_TXID_BAD"
    };
    toast(I18N.t(messages[r.reason] || "ACC_VERIFY_ERR"), "bad");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, !disc.game_done && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      lineHeight: 1.6,
      opacity: 0.65
    }
  }, I18N.t("DISC_CRYPTO_LOCKED")), disc.game_done && !lie && /*#__PURE__*/React.createElement(LinkWalletButton, {
    onLinked: () => {
      reload && reload();
      onLinked && onLinked();
    }
  }), disc.game_done && lie && !disc.dust_sent && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      lineHeight: 1.6
    }
  }, I18N.t("DISC_DUST_WAIT")), disc.game_done && lie && disc.dust_sent && !disc.txid_verified && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      lineHeight: 1.6
    }
  }, I18N.t("DISC_DUST_ARRIVED")), /*#__PURE__*/React.createElement("label", {
    className: "mono",
    style: {
      fontSize: 12,
      display: "block",
      margin: "10px 0 4px"
    }
  }, I18N.t("DISC_TXID_LABEL")), /*#__PURE__*/React.createElement("input", {
    className: "field",
    value: txid,
    onChange: e => setTxid(e.target.value),
    placeholder: I18N.t("DISC_TXID_PLACEHOLDER"),
    autoComplete: "off",
    autoCapitalize: "off",
    autoCorrect: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11,
      marginTop: 4
    }
  }, I18N.t("DISC_TXID_HINT")), disc.txid_reward > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      marginTop: 6,
      color: "var(--gold)"
    }
  }, I18N.t("DISC_TXID_REWARD", disc.txid_reward)), /*#__PURE__*/React.createElement("button", {
    className: "btn block",
    style: {
      marginTop: 10
    },
    disabled: sending || !txid.trim(),
    onClick: submitTxid
  }, I18N.t("DISC_TXID_BTN"))), disc.txid_verified && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      lineHeight: 1.6,
      color: "var(--success)"
    }
  }, I18N.t("DISC_TXID_OK")));
}

/* « Bien joué » — la fenêtre qui conclut le parcours.
   Le volet crypto n'avait qu'une porte : le bandeau des gains verrouillés, que le
   joueur peut fermer et qui se tait alors 24 h. Fermé, aucun écran ne proposait
   plus de lier son portefeuille — il ne restait que la console du navigateur.
   Celle-ci s'ouvre d'elle-même quand la sixième étape vient d'être réclamée, et
   ne se laisse pas condamner : la refermer ne l'empêche pas de revenir. */
function DiscoveryFinish({
  disc,
  reload,
  onClose
}) {
  const {
    g
  } = useFA();
  if (!disc) return null;
  // Le sous-titre annonce ce qu'il reste à FAIRE. Il parlait de « relier un
  // portefeuille » même une fois le portefeuille lié (constaté en prod le
  // 2026-07-30, à l'étape txid) : un écran qui décrit une étape déjà franchie
  // fait douter le joueur de ce qu'il vient de faire.
  const etape = ACC.discoveryNextAction(disc, g.linkedWallet);
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83C\uDF89 BIEN JOU\xC9",
    title: I18N.t("DISC_FINISH_TITLE")
  }), etape === "link" && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 13,
      lineHeight: 1.7,
      marginBottom: 14
    }
  }, I18N.t("DISC_FINISH_SUB")), /*#__PURE__*/React.createElement(CryptoVolet, {
    disc: disc,
    reload: reload
  }), /*#__PURE__*/React.createElement("div", {
    className: "acc-warn",
    style: {
      marginTop: 14
    }
  }, I18N.t("ACC_PHISHING_WARN")));
}
const DISMISS_KEY = "fa_locked_banner_dismissed";
function readDismissed() {
  try {
    return parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0;
  } catch (e) {
    return 0;
  }
}
function writeDismissed(ts) {
  try {
    localStorage.setItem(DISMISS_KEY, String(ts));
  } catch (e) {}
}
function LockedBanner() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [dismissedAt, setDismissedAt] = useState(readDismissed);
  const [howto, setHowto] = useState(false);
  const [checking, setChecking] = useState(false);
  // Parcours de découverte. Chargé à l'ouverture de la fenêtre seulement : le
  // bandeau est monté en permanence, un appel au montage serait tiré à chaque
  // session pour des joueurs qui n'ouvriront jamais ce panneau.
  const [disc, setDisc] = useState(null);
  const show = ACC.shouldShowLockedBanner({
    kind: g.accountKind,
    onchainVerified: g.onchainVerified,
    dismissedAt,
    now: Date.now()
  });
  if (!show && !howto) return null;

  // Compte cree sans wallet : il lie SON propre portefeuille, qui devient sa
  // destination de retrait. Compte venu d'UniSat mais pas encore verifie : il
  // prouve simplement l'activite de l'adresse avec laquelle il est deja connecte —
  // rien a lier, elle est deja la sienne.
  const genere = g.accountKind === ACC.KIND_GENERATED;
  const loadDisc = () => {
    actions.discoveryState().then(r => {
      if (r.ok) setDisc(r.data);
    }).catch(() => {});
  };
  const openHowto = () => {
    setHowto(true);
    loadDisc();
  };

  // Le parcours ne concerne que les comptes créés sans wallet ; le serveur en
  // décide (`eligible`). Un joueur venu avec UniSat voit ce même bandeau tant
  // qu'il n'est pas vérifié, mais n'a pas de parcours : il garde l'écran d'origine.
  const parcours = !!(disc && disc.eligible);
  const close = () => {
    const t = Date.now();
    writeDismissed(t);
    setDismissedAt(t);
  };
  const check = async () => {
    setChecking(true);
    let r;
    try {
      r = await actions.verifyOnchain();
    } finally {
      setChecking(false);
    }
    if (r.ok && r.verified) {
      toast(I18N.t("ACC_VERIFY_OK"), "good");
      setHowto(false);
      return;
    }
    if (r.ok && !r.verified) {
      toast(I18N.t("ACC_VERIFY_NONE"), "bad");
      return;
    }
    toast(I18N.t("ACC_VERIFY_ERR"), "bad");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, show && /*#__PURE__*/React.createElement("div", {
    className: "acc-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }, "\uD83D\uDD12 ", I18N.t("ACC_LOCKED_BANNER")), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    onClick: openHowto
  }, I18N.t("ACC_LOCKED_HOW")), /*#__PURE__*/React.createElement("button", {
    className: "btn-link",
    style: {
      background: "none",
      border: "none",
      color: "var(--text-dim)",
      fontSize: 11,
      cursor: "pointer",
      textDecoration: "underline"
    },
    onClick: close
  }, I18N.t("ACC_LOCKED_CLOSE"))), howto && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setHowto(false),
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83D\uDD13 UNLOCK",
    title: I18N.t("ACC_HOWTO_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      lineHeight: 2
    }
  }, /*#__PURE__*/React.createElement("div", null, I18N.t("ACC_HOWTO_1")), /*#__PURE__*/React.createElement("div", null, I18N.t("ACC_HOWTO_2")), /*#__PURE__*/React.createElement("div", null, I18N.t("ACC_HOWTO_3"))), /*#__PURE__*/React.createElement("div", {
    className: "acc-warn",
    style: {
      marginTop: 12
    }
  }, I18N.t("ACC_PHISHING_WARN")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      marginTop: 12,
      lineHeight: 1.6
    }
  }, I18N.t("ACC_HOWTO_CAP")), parcours ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      borderTop: "1px solid var(--line)",
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      marginBottom: 8
    }
  }, I18N.t("DISC_CRYPTO_TITLE")), /*#__PURE__*/React.createElement(CryptoVolet, {
    disc: disc,
    reload: loadDisc
  })) : genere ?
  /*#__PURE__*/
  // Compte généré hors parcours : lier conclut, on ferme. Même bouton
  // confirmé que dans le parcours — c'est le même geste irréversible.
  React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(LinkWalletButton, {
    onLinked: () => setHowto(false)
  })) : /*#__PURE__*/React.createElement("button", {
    className: "btn block",
    style: {
      marginTop: 14
    },
    disabled: checking,
    onClick: check
  }, I18N.t("ACC_VERIFY_BTN"))));
}
Object.assign(window, {
  SecretsGate,
  RecoverScreen,
  LockedBanner,
  CryptoVolet,
  DiscoveryFinish,
  LinkWalletButton
});
})();
