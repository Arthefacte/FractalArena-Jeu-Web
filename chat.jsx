/* ============================================================
   FRACTAL ARENA — Chatbot support (UI client React)
   ============================================================ */
const { useState, useEffect, useRef } = React;
const { useFA, cx, Modal } = window;
const I18N = window.FA_I18N;

const CHAT_MAX = 40;        // messages gardés en localStorage
const CHAT_MAXLEN = 2000;   // longueur max par message (aligné serveur)

function chatKey(wallet) { return "fa_chat:" + wallet; }
function loadChat(wallet) {
  try { return JSON.parse(localStorage.getItem(chatKey(wallet))) || []; }
  catch (e) { return []; }
}
function saveChat(wallet, msgs) {
  try { localStorage.setItem(chatKey(wallet), JSON.stringify(msgs.slice(-CHAT_MAX))); }
  catch (e) { /* quota / mode privé : on ignore */ }
}

// Overlay présentationnel : reçoit messages/busy, remonte la saisie via onSend
function ChatPanel({ messages, busy, onSend, onClose }) {
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);
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
      <div className="chat-head">
        <div className="h1">{I18N.t("CHAT_TITLE")}</div>
        <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>{I18N.t("CHAT_SUB")}</div>
      </div>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-bubble assistant">{I18N.t("CHAT_WELCOME")}</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("chat-bubble", m.role)}>{m.content}</div>
        ))}
        {busy && (
          <div className="chat-bubble assistant typing"><span /><span /><span /></div>
        )}
      </div>
      <div className="chat-input">
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          maxLength={CHAT_MAXLEN}
          placeholder={I18N.t("CHAT_PLACEHOLDER")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn" disabled={busy || !input.trim()} onClick={submit}>
          {I18N.t("CHAT_SEND")}
        </button>
      </div>
    </Modal>
  );
}

// Bouton flottant : détient l'état de conversation + logique d'envoi
function ChatFab() {
  const { g, actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadChat(g.wallet));
  const [busy, setBusy] = useState(false);

  // Coquille mobile : la bulle flottante disparaît, un bouton du header ouvre
  // le même panneau via cet événement.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("fa:open-chat", h);
    return () => window.removeEventListener("fa:open-chat", h);
  }, []);

  async function send(text) {
    if (busy) return;
    if (text.length > CHAT_MAXLEN) { toast(I18N.t("CHAT_TOOLONG"), "bad"); return; }
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    saveChat(g.wallet, next);
    setBusy(true);
    let res;
    try {
      res = await actions.callChat(next);
    } finally {
      setBusy(false);
    }
    if (res.rateLimited) { toast(I18N.t("CHAT_RATELIMIT"), "bad"); return; }
    const reply = res.ok ? res.reply : I18N.t("CHAT_ERROR");
    const after = [...next, { role: "assistant", content: reply }];
    setMessages(after);
    saveChat(g.wallet, after);
  }

  return (
    <>
      <button className="chat-fab" aria-label={I18N.t("CHAT_FAB_LABEL")} onClick={() => setOpen(true)}>
        <span aria-hidden="true">💬</span>
      </button>
      {open && (
        <ChatPanel messages={messages} busy={busy} onSend={send} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

Object.assign(window, { ChatFab, ChatPanel });
