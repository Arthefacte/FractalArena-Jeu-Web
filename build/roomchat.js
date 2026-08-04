/* Généré par tools/precompile.mjs depuis roomchat.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Chat global entre joueurs (UI client)
   ============================================================ */
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;
const {
  useFA,
  cx,
  Modal
} = window;
const I18N = window.FA_I18N;
const ROOM_MAXLEN = 280;
const ROOM_POLL_MS = 4000;
const ROOM_BG_POLL_MS = 30000;
function seenKey(wallet) {
  return "fa_room_seen:" + (wallet || "anon");
}
function loadSeenId(wallet) {
  try {
    return parseInt(localStorage.getItem(seenKey(wallet)), 10) || 0;
  } catch (e) {
    return 0;
  }
}
function saveSeenId(wallet, id) {
  try {
    localStorage.setItem(seenKey(wallet), String(id));
  } catch (e) {}
}
function mutedKey(wallet) {
  return "fa_muted:" + wallet;
}
function loadMuted(wallet) {
  try {
    return JSON.parse(localStorage.getItem(mutedKey(wallet))) || [];
  } catch (e) {
    return [];
  }
}
function saveMuted(wallet, list) {
  try {
    localStorage.setItem(mutedKey(wallet), JSON.stringify(list));
  } catch (e) {}
}
// Nom sûr : si le player_name ressemble à une arnaque, on retombe sur le wallet tronqué
const NAME_BAD_RE = /(https?:\/\/|www\.|\b(bc1|[13])[a-z0-9]{20,}\b|t\.me|telegram|whatsapp)/i;
function safeName(m) {
  if (m.name && !NAME_BAD_RE.test(m.name)) return m.name.slice(0, 24);
  // Le nom est composé et stocké par le serveur (names.js) : nom .fb, portefeuille lié
  // ou « Joueur NNNNN ». S'il manque, on n'affiche pas l'adresse du message à la place —
  // pour un compte créé sans portefeuille, c'est une adresse fabriquée par le serveur.
  return "?";
}
function hhmm(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return "";
  }
}
function RoomPanel({
  messages,
  myWallet,
  muted,
  onMute,
  onSend,
  onClose
}) {
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const visible = messages.filter(m => !muted.includes(m.wallet));
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, muted]);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    onSend(text);
    if (inputRef.current) inputRef.current.focus();
  }
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      marginBottom: 10
    }
  }, I18N.t("ROOM_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "room-warning"
  }, I18N.t("ROOM_WARNING")), /*#__PURE__*/React.createElement("div", {
    className: "room-list",
    ref: listRef
  }, visible.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "room-empty"
  }, I18N.t("ROOM_EMPTY")), visible.map(m => {
    const mine = m.wallet === myWallet;
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: cx("room-msg", mine && "mine")
    }, /*#__PURE__*/React.createElement("div", {
      className: "meta"
    }, /*#__PURE__*/React.createElement("span", null, safeName(m)), /*#__PURE__*/React.createElement("span", null, hhmm(m.created_at)), !mine && /*#__PURE__*/React.createElement("button", {
      className: "mute-btn",
      onClick: () => onMute(m.wallet)
    }, I18N.t("ROOM_MUTE"))), /*#__PURE__*/React.createElement("div", {
      className: "text"
    }, m.content));
  })), /*#__PURE__*/React.createElement("div", {
    className: "room-input"
  }, /*#__PURE__*/React.createElement("textarea", {
    ref: inputRef,
    rows: 2,
    value: input,
    maxLength: ROOM_MAXLEN,
    placeholder: I18N.t("ROOM_PLACEHOLDER"),
    onChange: e => setInput(e.target.value),
    onKeyDown: onKeyDown
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    disabled: !input.trim(),
    onClick: submit
  }, I18N.t("ROOM_SEND"))));
}
function RoomFab() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [muted, setMuted] = useState(() => loadMuted(g.wallet));
  const [unread, setUnread] = useState(0);
  const lastIdRef = useRef(0);
  const timerRef = useRef(null);
  const seenIdRef = useRef(loadSeenId(g.wallet));

  // Recharge la liste des mutés quand le wallet change (les mutés sont par-wallet)
  useEffect(() => {
    setMuted(loadMuted(g.wallet));
  }, [g.wallet]);
  useEffect(() => {
    seenIdRef.current = loadSeenId(g.wallet);
  }, [g.wallet]);
  const ingest = useCallback(incoming => {
    if (!incoming || incoming.length === 0) return;
    setMessages(prev => {
      const known = new Set(prev.map(m => m.id));
      const merged = prev.concat(incoming.filter(m => !known.has(m.id)));
      merged.sort((a, b) => a.id - b.id);
      return merged.slice(-200);
    });
    const maxId = incoming.reduce((mx, m) => Math.max(mx, m.id), lastIdRef.current);
    lastIdRef.current = maxId;
  }, []);
  const poll = useCallback(async () => {
    try {
      const res = await actions.fetchRoomMessages(lastIdRef.current || undefined);
      if (res.ok) ingest(res.messages);
    } catch (e) {/* réseau : on réessaiera au prochain poll */}
  }, [actions, ingest]);

  // Polling : rapide quand le panneau est ouvert, lent en arrière-plan
  // (pastille de non-lus sur le bouton).
  useEffect(() => {
    poll(); // fetch initial (ouverture ou passage en arrière-plan)
    timerRef.current = setInterval(poll, open ? ROOM_POLL_MS : ROOM_BG_POLL_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, poll]);

  // Compteur de non-lus : panneau ouvert = tout est vu ; fermé = messages
  // plus récents que le dernier vu, hors les miens et les wallets mutés.
  useEffect(() => {
    const maxId = messages.reduce((mx, m) => Math.max(mx, m.id), 0);
    if (open) {
      if (maxId > seenIdRef.current) {
        seenIdRef.current = maxId;
        saveSeenId(g.wallet, maxId);
      }
      setUnread(0);
      return;
    }
    setUnread(messages.filter(m => m.id > seenIdRef.current && m.wallet !== g.wallet && !muted.includes(m.wallet)).length);
  }, [messages, muted, open, g.wallet]);
  async function send(text) {
    let res;
    try {
      res = await actions.sendRoomMessage(text);
    } catch (e) {
      toast(I18N.t("ROOM_BLOCKED"), "bad");
      return;
    }
    if (res.ok) {
      poll();
      return;
    }
    const key = res.reason === "rate" ? "ROOM_RATELIMIT" : res.reason === "banned" ? "ROOM_BANNED" : res.reason === "toolong" ? "ROOM_TOOLONG" : "ROOM_BLOCKED";
    toast(I18N.t(key), "bad");
  }
  function mute(wallet) {
    setMuted(prev => {
      if (prev.includes(wallet)) return prev;
      const next = prev.concat(wallet);
      saveMuted(g.wallet, next);
      return next;
    });
    toast(I18N.t("ROOM_MUTED"), "info");
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "room-fab",
    "aria-label": I18N.t("ROOM_FAB_LABEL"),
    onClick: () => setOpen(true)
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\uD83D\uDC65"), unread > 0 && /*#__PURE__*/React.createElement("span", {
    className: "room-fab-badge"
  }, unread > 9 ? "9+" : unread)), open && /*#__PURE__*/React.createElement(RoomPanel, {
    messages: messages,
    myWallet: g.wallet,
    muted: muted,
    onMute: mute,
    onSend: send,
    onClose: () => setOpen(false)
  }));
}
Object.assign(window, {
  RoomFab,
  RoomPanel
});
})();
