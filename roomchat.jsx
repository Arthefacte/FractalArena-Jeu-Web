/* ============================================================
   FRACTAL ARENA — Chat global entre joueurs (UI client)
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;
const { useFA, cx, Modal } = window;
const I18N = window.FA_I18N;

const ROOM_MAXLEN = 280;
const ROOM_POLL_MS = 4000;

function mutedKey(wallet) { return "fa_muted:" + wallet; }
function loadMuted(wallet) {
  try { return JSON.parse(localStorage.getItem(mutedKey(wallet))) || []; }
  catch (e) { return []; }
}
function saveMuted(wallet, list) {
  try { localStorage.setItem(mutedKey(wallet), JSON.stringify(list)); } catch (e) {}
}
function shortWallet(w) { return w ? w.slice(0, 6) + "…" + w.slice(-4) : "?"; }
// Nom sûr : si le player_name ressemble à une arnaque, on retombe sur le wallet tronqué
const NAME_BAD_RE = /(https?:\/\/|www\.|\b(bc1|[13])[a-z0-9]{20,}\b|t\.me|telegram|whatsapp)/i;
function safeName(m) {
  if (m.name && !NAME_BAD_RE.test(m.name)) return m.name.slice(0, 24);
  return shortWallet(m.wallet);
}
function hhmm(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}

function RoomPanel({ messages, myWallet, muted, onMute, onSend, onClose }) {
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const visible = messages.filter((m) => !muted.includes(m.wallet));

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, muted]);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    onSend(text);
    if (inputRef.current) inputRef.current.focus();
  }
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <div className="h1" style={{ marginBottom: 10 }}>{I18N.t("ROOM_TITLE")}</div>
      <div className="room-warning">{I18N.t("ROOM_WARNING")}</div>
      <div className="room-list" ref={listRef}>
        {visible.length === 0 && <div className="room-empty">{I18N.t("ROOM_EMPTY")}</div>}
        {visible.map((m) => {
          const mine = m.wallet === myWallet;
          return (
            <div key={m.id} className={cx("room-msg", mine && "mine")}>
              <div className="meta">
                <span>{safeName(m)}</span>
                <span>{hhmm(m.created_at)}</span>
                {!mine && (
                  <button className="mute-btn" onClick={() => onMute(m.wallet)}>
                    {I18N.t("ROOM_MUTE")}
                  </button>
                )}
              </div>
              <div className="text">{m.content}</div>
            </div>
          );
        })}
      </div>
      <div className="room-input">
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          maxLength={ROOM_MAXLEN}
          placeholder={I18N.t("ROOM_PLACEHOLDER")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn" disabled={!input.trim()} onClick={submit}>
          {I18N.t("ROOM_SEND")}
        </button>
      </div>
    </Modal>
  );
}

function RoomFab() {
  const { g, actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [muted, setMuted] = useState(() => loadMuted(g.wallet));
  const lastIdRef = useRef(0);
  const timerRef = useRef(null);

  // Recharge la liste des mutés quand le wallet change (les mutés sont par-wallet)
  useEffect(() => { setMuted(loadMuted(g.wallet)); }, [g.wallet]);

  const ingest = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const merged = prev.concat(incoming.filter((m) => !known.has(m.id)));
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
    } catch (e) { /* réseau : on réessaiera au prochain poll */ }
  }, [actions, ingest]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    poll(); // fetch initial à l'ouverture
    timerRef.current = setInterval(poll, ROOM_POLL_MS);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [open, poll]);

  async function send(text) {
    let res;
    try {
      res = await actions.sendRoomMessage(text);
    } catch (e) {
      toast(I18N.t("ROOM_BLOCKED"), "bad");
      return;
    }
    if (res.ok) { poll(); return; }
    const key = res.reason === "rate" ? "ROOM_RATELIMIT"
      : res.reason === "banned" ? "ROOM_BANNED"
      : res.reason === "toolong" ? "ROOM_TOOLONG"
      : "ROOM_BLOCKED";
    toast(I18N.t(key), "bad");
  }

  function mute(wallet) {
    setMuted((prev) => {
      if (prev.includes(wallet)) return prev;
      const next = prev.concat(wallet);
      saveMuted(g.wallet, next);
      return next;
    });
    toast(I18N.t("ROOM_MUTED"), "info");
  }

  return (
    <>
      <button className="room-fab" aria-label={I18N.t("ROOM_FAB_LABEL")} onClick={() => setOpen(true)}>
        <span aria-hidden="true">👥</span>
      </button>
      {open && (
        <RoomPanel
          messages={messages}
          myWallet={g.wallet}
          muted={muted}
          onMute={mute}
          onSend={send}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

Object.assign(window, { RoomFab, RoomPanel });
