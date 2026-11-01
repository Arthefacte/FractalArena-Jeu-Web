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
// Étiquette des messages d'agent dans la pièce commune : la seule information
// qu'un joueur doit voir d'un coup d'œil, c'est QU'IL PARLE À UNE IA.
const AGENT_TAG = {
  fontSize: 9,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  padding: "1px 5px",
  borderRadius: 3,
  marginLeft: 6,
  border: "1px solid currentColor",
  opacity: .7
};
// Le serveur détecte la langue et traduit APRÈS l'insertion (DeepSeek, 1-3 s) :
// une ligne déjà reçue peut donc gagner sa traduction plus tard. Comme chaque tour
// relit la liste complète, la fusion remplace la ligne et la traduction arrive toute
// seule — plus besoin de fenêtre de rattrapage ni de second appel.

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
function seenKey(wallet) {
  return "fa_room_seq_seen:" + (wallet || "anon");
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
// Curseur de lecture, en `seq` UNIQUEMENT (pièce commune du 29/10/2026).
//
// Pourquoi une clé NEUVE (`fa_room_seq_seen` / `ui_state.room_seen_seq`) au lieu
// de réutiliser `room_seen_id` : cette dernière a reçu des `id` de table avant la
// pièce commune (728, 770…) qui sont SANS RAPPORT avec les `seq` (610, 655…).
// Or la fusion serveur de `room_seen_id` est un MAX : une valeur d'id une fois
// écrite ne peut plus jamais redescendre. Un compte resté à 770 sur une pièce à
// 655 voyait donc TOUT comme déjà lu à chaque ouverture — les messages arrivés
// pendant que le jeu était fermé étaient comptés « vus » avant d'être affichés,
// et la pastille ne se rallumait que pour un message reçu page ouverte.
// Un curseur neuf repart de la pièce telle qu'elle est (voir le recalage dans
// RoomFab), donc « tout est lu » à l'instant du déploiement, et le message
// suivant rallume. `room_seen_id` n'est plus lu nulle part.
function seenIdDepuis(g) {
  const ui = g && g.uiState || {};
  const serveur = parseInt(ui.room_seen_seq, 10) || 0;
  return Math.max(loadSeenId(g && g.wallet), serveur);
}
function mutedKey(wallet) {
  return "fa_muted:" + wallet;
}
function loadMutedLocal(wallet) {
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
// Union des deux sources : muter est un geste qu'on ne défait pas dans l'UI, donc
// rien ne doit se perdre entre l'appareil et le compte. Le serveur, lui, REMPLACE
// la liste — on lui envoie toujours la liste complète.
function mutedDepuis(g) {
  const ui = g && g.uiState || {};
  const out = [];
  for (const w of loadMutedLocal(g && g.wallet).concat(Array.isArray(ui.room_muted) ? ui.room_muted : [])) {
    if (typeof w === "string" && !out.includes(w)) out.push(w);
  }
  return out;
}

// E3 (clôture de l'audit complet 2026-09, D10/M4, emplacement 6) : le salon s'identifie désormais par
// l'identifiant OPAQUE (`player_id`, servi depuis C2). La liste des sourdines, elle, vit sur
// l'appareil ET dans l'état du compte, et elle contient encore des adresses écrites avant cette
// phase : on accepte donc les DEUX formes partout, sinon un joueur verrait réapparaître les messages
// qu'il avait tus (et le compteur de non-lus se remettrait à clignoter pour eux).
function idDe(m) {
  if (!m) return "";
  // Salon COMMUN (29/10/2026) : un agent n'a pas de wallet — son identité de
  // sourdine est son uuid public, jamais `undefined` (qui aurait masqué TOUS les
  // messages d'agents d'un seul coup).
  if (m.kind === "agent") return "agent:" + (m.agent_id || m.name || "?");
  return m.player_id || m.wallet || "";
}
function estMute(m, muted) {
  if (!m) return false;
  if (muted.includes(idDe(m))) return true;
  return !!m.wallet && muted.includes(m.wallet);
}
function estMoi(m, myId, myWallet) {
  if (!m) return false;
  // Un message d'agent porte `mine` calculé par le serveur (il n'a ni wallet ni
  // player_id à comparer). Un joueur, lui, se reconnaît à son identifiant opaque.
  if (m.kind === "agent") return m.mine === true;
  if (myId && m.player_id) return m.player_id === myId;
  return !!m.wallet && m.wallet === myWallet;
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

// Choisit la langue d'affichage d'un message : si le message est déjà dans la
// langue du lecteur (ou sans langue source), on garde l'original ; sinon on prend
// la traduction (tr) dans cette langue, avec repli sur l'original.
function pickRoomText(m, lang) {
  if (!m) return "";
  if (!m.src_lang || m.src_lang === lang) return m.content || "";
  return m.tr && m.tr[lang] || m.content || "";
}

/* ---- Salon COMMUN (29/10/2026) : agents + humains dans la même pièce ----
   Trois conséquences côté client :
   1. l'ORDRE ne peut plus venir de `id` — les deux tables ont chacune leur
      BIGSERIAL et se recouvrent. C'est `seq`, une séquence commune côté serveur,
      qui ordonne et sert de curseur (`after`) ;
   2. une ligne dit sa famille (`kind`), et un agent n'a PAS de wallet : muter par
      wallet aurait comparé `undefined` et masqué tous les agents d'un coup ;
   3. `ref` ('agent:12') est la clé sans collision entre les deux tables. */

// Curseur de lecture : `seq` s'il existe (pièce commune), sinon `id` (anciens
// messages mis en cache, ou serveur pas encore déployé).
function msgCursor(m) {
  const s = Number(m && m.seq);
  if (Number.isFinite(s) && s > 0) return s;
  const i = Number(m && m.id);
  return Number.isFinite(i) ? i : 0;
}
function msgKey(m) {
  if (m && m.ref) return m.ref;
  return (m && m.kind ? m.kind : "h") + ":" + msgCursor(m);
}
function RoomPanel({
  messages,
  myWallet,
  myId,
  muted,
  onMute,
  onSend,
  onClose
}) {
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  // Le joueur a-t-il remonté la conversation pour lire ? Tant qu'il est remonté,
  // un message qui arrive ne doit PAS le renvoyer en bas : il perdait sa lecture
  // toutes les 4 secondes (le poll). « En bas » = à moins de 40 px du bas.
  const enBasRef = useRef(true);
  const visible = messages.filter(m => !estMute(m, muted));
  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    enBasRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Ne descendre QUE si le lecteur était déjà en bas (nouveau message naturel),
    // ou pendant la première seconde d'ouverture (on le pose sur le plus récent).
    if (enBasRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, muted]);
  useEffect(() => {
    // À l'ouverture du panneau : on part du bas, puis on laisse le joueur libre.
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      enBasRef.current = true;
    }
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
    ref: listRef,
    onScroll: onScroll
  }, visible.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "room-empty"
  }, I18N.t("ROOM_EMPTY")), visible.map(m => {
    const mine = estMoi(m, myId, myWallet);
    return /*#__PURE__*/React.createElement("div", {
      key: msgKey(m),
      className: cx("room-msg", mine && "mine")
    }, /*#__PURE__*/React.createElement("div", {
      className: "meta"
    }, /*#__PURE__*/React.createElement("span", null, safeName(m)), m.kind === "agent" && /*#__PURE__*/React.createElement("span", {
      style: AGENT_TAG
    }, I18N.t("ROOM_AGENT_TAG")), /*#__PURE__*/React.createElement("span", null, hhmm(m.created_at)), !mine && /*#__PURE__*/React.createElement("button", {
      className: "mute-btn",
      onClick: () => onMute(idDe(m))
    }, I18N.t("ROOM_MUTE"))), /*#__PURE__*/React.createElement("div", {
      className: "text"
    }, pickRoomText(m, I18N.getLang())));
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
  const [muted, setMuted] = useState(() => mutedDepuis(g));
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(0);
  const lastSeqRef = useRef(0);
  const timerRef = useRef(null);
  const seenIdRef = useRef(seenIdDepuis(g));

  // Recharge quand le compte change — et quand sa sauvegarde arrive, puisqu'elle
  // apporte ui_state (dernier id vu, mutés) : c'est elle qui porte l'état lu
  // ailleurs, sans quoi le badge se rallumerait ici.
  useEffect(() => {
    setMuted(mutedDepuis(g));
  }, [g.wallet, g.uiState]);
  // Le curseur « vu » ne DESCEND jamais sous celui du compte (lu sur un autre
  // appareil), mais il ne s'y aligne plus d'office : un `seq` sauté — message
  // supprimé par la modération, ou envoyé pendant une reconnexion — laissait
  // `seen_id` au-dessus de messages jamais affichés, et la pastille restait
  // éteinte pour eux (constat fondateur 30/10 : « la pastille n'apparaît plus »).
  // Le curseur propage donc la valeur LOCALE la plus haute, pas celle du compte.
  useEffect(() => {
    const local = loadSeenId(g.wallet);
    if (local > seenIdRef.current) seenIdRef.current = local;
  }, [g.wallet]);

  // Coquille mobile : la bulle flottante disparaît, un bouton du header ouvre
  // le panneau via cet événement ; le badge de non-lus lui est renvoyé.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("fa:open-room", h);
    return () => window.removeEventListener("fa:open-room", h);
  }, []);
  useEffect(() => {
    unreadRef.current = unread;
    window.dispatchEvent(new CustomEvent("fa:room-unread", {
      detail: unread
    }));
  }, [unread]);
  // Au DÉMARRAGE, le header peut avoir manqué l'émission ci-dessus : il montait
  // avant que le premier poll ne donne une liste. On lui rend donc la valeur à la
  // demande — c'est ce qui manquait pour voir la pastille dès l'ouverture du jeu,
  // sans attendre qu'un nouveau message arrive (constat fondateur 31/10).
  useEffect(() => {
    const h = () => window.dispatchEvent(new CustomEvent("fa:room-unread", {
      detail: unreadRef.current
    }));
    window.addEventListener("fa:room-unread-ask", h);
    return () => window.removeEventListener("fa:room-unread-ask", h);
  }, []);

  // `?after=` ne renvoie JAMAIS un message déjà reçu : une ligne connue ne peut
  // revenir que par la liste complète. On la REMPLACE donc dès que le serveur en
  // sert une version plus riche (traduction arrivée après coup, langue détectée),
  // au lieu de la jeter — sinon le lecteur gardait l'original jusqu'au rechargement
  // de la page, alors que la traduction existait en base.
  const ingest = useCallback(incoming => {
    if (!incoming || incoming.length === 0) return;
    setMessages(prev => {
      // Clé = `ref` ('agent:12' / 'human:12') : les ids des deux tables se
      // recouvrent, une Map sur `id` mélangerait un message d'agent et un message
      // de joueur portant le même numéro.
      const byKey = new Map(prev.map(m => [msgKey(m), m]));
      let changed = false;
      for (const m of incoming) {
        const k = msgKey(m);
        const old = byKey.get(k);
        if (!old) {
          byKey.set(k, m);
          changed = true;
          continue;
        }
        if (m.tr !== old.tr || m.src_lang !== old.src_lang) {
          byKey.set(k, m);
          changed = true;
        }
      }
      if (!changed) return prev;
      const merged = Array.from(byKey.values());
      merged.sort((a, b) => msgCursor(a) - msgCursor(b));
      return merged.slice(-200);
    });
    // Curseur : `seq` de la pièce commune, plus l'id d'une seule table.
    const maxSeq = incoming.reduce((mx, m) => Math.max(mx, msgCursor(m)), lastSeqRef.current);
    lastSeqRef.current = maxSeq;
  }, []);
  const poll = useCallback(async () => {
    try {
      // On relit la LISTE COMPLÈTE, jamais `?after=`. Le compteur vit dans ce
      // navigateur : il lui faut donc les 50 derniers messages à chaque tour, sinon
      // un rechargement de page — ou un premier montage après avoir changé de vue —
      // repart d'une pièce quasi vide et la pastille ne compte que ce qui arrive
      // après. `?after=` reste faux ici pour une autre raison : il renvoie les
      // `ref` d'AGENT sans préfixe, que la fusion prend alors pour des messages
      // de joueur (les mêmes numéros existent dans les deux tables).
      const res = await actions.fetchRoomMessages();
      if (!res.ok) return;
      ingest(res.messages);
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
    // Seuls les messages RÉELLEMENT affichés font avancer le curseur : un message tu
    // ne doit pas servir de borne (sinon les suivants, jamais vus, passent pour lus).
    // Les refs d'AGENT (/chat-room/messages) peuvent arriver sans `seq` : on accepte
    // donc les deux formes, sinon un message d'agent venu après coup ne faisait pas
    // avancer le curseur et la pastille restait allumée sur des messages déjà lus.
    const maxSeq = messages.reduce((mx, m) => estMute(m, muted) ? mx : Math.max(mx, msgCursor(m)), 0);
    // Premier démarrage sur le curseur `seq` (bascule du 01/11/2026) : la pièce
    // telle qu'elle est devient « lue ». Sans ce recalage, le salon entier
    // s'afficherait d'un coup en non-lus au premier chargement après déploiement.
    if (maxSeq > 0 && seenIdRef.current === 0) {
      seenIdRef.current = maxSeq;
      saveSeenId(g.wallet, maxSeq);
      actions.pushUiState({
        room_seen_seq: maxSeq
      });
    }
    if (open) {
      if (maxSeq > seenIdRef.current) {
        seenIdRef.current = maxSeq;
        saveSeenId(g.wallet, maxSeq); // cache de ce navigateur
        actions.pushUiState({
          room_seen_seq: maxSeq
        }); // et le compte, pour les autres
      }
      setUnread(0);
      return;
    }
    // E3 (D10/M4, emplacement 6) : « pas les miens » et « pas les tus » se décident sur l'identifiant
    // opaque, avec repli sur l'adresse (phase 1) — la même règle que dans le panneau, sinon le
    // compteur et la liste ne diraient pas la même chose.
    // Les messages d'AGENTS (Omni) comptent : un agent n'est « moi » que si le serveur le dit
    // (`mine`), donc la conversation avec lui rallume la pastille comme celle d'un joueur.
    const nonVus = messages.filter(m => msgCursor(m) > seenIdRef.current && !estMoi(m, g.publicId, g.wallet) && !estMute(m, muted));
    setUnread(nonVus.length);
  }, [messages, muted, open, g.wallet, g.publicId]);

  // Phase 2 : les sourdines écrites AVANT cette phase sont des adresses. Le serveur va cesser
  // d'envoyer `wallet`, et une sourdine en forme d'adresse cesserait alors de correspondre — les
  // messages tus réapparaîtraient, et le compteur de non-lus se remettrait à clignoter pour eux.
  // Tant que les deux formes circulent, on réécrit les entrées reconnaissables : la liste se
  // soigne toute seule, message après message, sans rien perdre ni rien inventer.
  useEffect(() => {
    if (!muted.length || !messages.length) return;
    const parAdresse = new Map();
    for (const m of messages) if (m && m.wallet && m.player_id) parAdresse.set(m.wallet, m.player_id);
    if (!parAdresse.size) return;
    let change = false;
    const next = muted.map(w => {
      const id = parAdresse.get(w);
      if (id && id !== w) {
        change = true;
        return id;
      }
      return w;
    });
    if (!change) return;
    const uniques = next.filter((w, i) => next.indexOf(w) === i);
    setMuted(uniques);
    saveMuted(g.wallet, uniques); // cache de ce navigateur
    actions.pushUiState({
      room_muted: uniques
    }); // et le compte, pour les autres
  }, [messages, muted, g.wallet]);
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
    if (muted.includes(wallet)) return;
    const next = muted.concat(wallet);
    setMuted(next);
    saveMuted(g.wallet, next); // cache de ce navigateur
    actions.pushUiState({
      room_muted: next
    }); // et le compte, pour les autres
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
    myId: g.publicId,
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
