/* ============================================================
   FRACTAL ARENA — Chat global entre joueurs (UI client)
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;
const { useFA, cx, Modal } = window;
const I18N = window.FA_I18N;

const ROOM_MAXLEN = 280;
const ROOM_POLL_MS = 4000;
const ROOM_BG_POLL_MS = 30000;

/* ---- Ce qui est LU et MUTÉ vit sur le COMPTE, plus dans le navigateur ----
   Le dernier message vu et la liste des wallets mutés partaient dans le
   localStorage : le badge de non-lus ne s'éteignait donc que dans le navigateur
   où le joueur lisait le chat. Résultat constaté (26/09/2026) : dans le
   navigateur intégré de l'app UniSat — celui qu'il ouvre pour retirer ses gains —
   les messages déjà lus sur son ordinateur rallumaient la pastille « nouveaux
   messages », et le jeu paraissait « pas à jour ». Ces deux valeurs vivent
   maintenant sur le compte (ui_state, player-ui.js, fusion côté serveur).
   Le localStorage reste un CACHE : il tient la valeur pendant la seconde qui
   précède l'arrivée de la sauvegarde, et sert de repli hors ligne. */
function seenKey(wallet) { return "fa_room_seen:" + (wallet || "anon"); }
function loadSeenId(wallet) {
  try { return parseInt(localStorage.getItem(seenKey(wallet)), 10) || 0; }
  catch (e) { return 0; }
}
function saveSeenId(wallet, id) {
  try { localStorage.setItem(seenKey(wallet), String(id)); } catch (e) {}
}
// Maximum des deux sources : le compte fait autorité (il a vu ce que les autres
// appareils ont lu), le local couvre la lecture faite ici juste avant.
function seenIdDepuis(g) {
  const ui = (g && g.uiState) || {};
  const serveur = parseInt(ui.room_seen_id, 10) || 0;
  return Math.max(loadSeenId(g && g.wallet), serveur);
}

function mutedKey(wallet) { return "fa_muted:" + wallet; }
function loadMutedLocal(wallet) {
  try { return JSON.parse(localStorage.getItem(mutedKey(wallet))) || []; }
  catch (e) { return []; }
}
function saveMuted(wallet, list) {
  try { localStorage.setItem(mutedKey(wallet), JSON.stringify(list)); } catch (e) {}
}
// Union des deux sources : muter est un geste qu'on ne défait pas dans l'UI, donc
// rien ne doit se perdre entre l'appareil et le compte. Le serveur, lui, REMPLACE
// la liste — on lui envoie toujours la liste complète.
function mutedDepuis(g) {
  const ui = (g && g.uiState) || {};
  const out = [];
  for (const w of loadMutedLocal(g && g.wallet).concat(Array.isArray(ui.room_muted) ? ui.room_muted : [])) {
    if (typeof w === "string" && !out.includes(w)) out.push(w);
  }
  return out;
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
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}

// Choisit la langue d'affichage d'un message : si le message est déjà dans la
// langue du lecteur (ou sans langue source), on garde l'original ; sinon on prend
// la traduction (tr) dans cette langue, avec repli sur l'original.
function pickRoomText(m, lang) {
  if (!m) return "";
  if (!m.src_lang || m.src_lang === lang) return m.content || "";
  return (m.tr && m.tr[lang]) || m.content || "";
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
              <div className="text">{pickRoomText(m, I18N.getLang())}</div>
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
  const [muted, setMuted] = useState(() => mutedDepuis(g));
  const [unread, setUnread] = useState(0);
  const lastIdRef = useRef(0);
  const timerRef = useRef(null);
  const seenIdRef = useRef(seenIdDepuis(g));

  // Recharge quand le compte change — et quand sa sauvegarde arrive, puisqu'elle
  // apporte ui_state (dernier id vu, mutés) : c'est elle qui porte l'état lu
  // ailleurs, sans quoi le badge se rallumerait ici.
  useEffect(() => { setMuted(mutedDepuis(g)); }, [g.wallet, g.uiState]);
  useEffect(() => {
    const serveur = seenIdDepuis(g);
    if (serveur > seenIdRef.current) seenIdRef.current = serveur;
  }, [g.wallet, g.uiState]);

  // Coquille mobile : la bulle flottante disparaît, un bouton du header ouvre
  // le panneau via cet événement ; le badge de non-lus lui est renvoyé.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("fa:open-room", h);
    return () => window.removeEventListener("fa:open-room", h);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fa:room-unread", { detail: unread }));
  }, [unread]);

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

  // Polling : rapide quand le panneau est ouvert, lent en arrière-plan
  // (pastille de non-lus sur le bouton).
  useEffect(() => {
    poll(); // fetch initial (ouverture ou passage en arrière-plan)
    timerRef.current = setInterval(poll, open ? ROOM_POLL_MS : ROOM_BG_POLL_MS);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [open, poll]);

  // Compteur de non-lus : panneau ouvert = tout est vu ; fermé = messages
  // plus récents que le dernier vu, hors les miens et les wallets mutés.
  useEffect(() => {
    const maxId = messages.reduce((mx, m) => Math.max(mx, m.id), 0);
    if (open) {
      if (maxId > seenIdRef.current) {
        seenIdRef.current = maxId;
        saveSeenId(g.wallet, maxId);                    // cache de ce navigateur
        actions.pushUiState({ room_seen_id: maxId });   // et le compte, pour les autres
      }
      setUnread(0);
      return;
    }
    setUnread(messages.filter((m) =>
      m.id > seenIdRef.current && m.wallet !== g.wallet && !muted.includes(m.wallet)
    ).length);
  }, [messages, muted, open, g.wallet]);

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
    if (muted.includes(wallet)) return;
    const next = muted.concat(wallet);
    setMuted(next);
    saveMuted(g.wallet, next);                 // cache de ce navigateur
    actions.pushUiState({ room_muted: next }); // et le compte, pour les autres
    toast(I18N.t("ROOM_MUTED"), "info");
  }

  return (
    <>
      <button className="room-fab" aria-label={I18N.t("ROOM_FAB_LABEL")} onClick={() => setOpen(true)}>
        <span aria-hidden="true">👥</span>
        {unread > 0 && <span className="room-fab-badge">{unread > 9 ? "9+" : unread}</span>}
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
