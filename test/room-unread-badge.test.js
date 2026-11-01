// La pastille de non-lus du salon : ce qui la rallume, et ce qui l'éteint à tort.
// Régression constatée le 30/10/2026 : plus aucune pastille. Deux causes dans roomchat.jsx.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "roomchat.jsx"), "utf8");

function bloc(start, end) {
  const i = SRC.indexOf(start);
  assert.ok(i >= 0, `introuvable : ${start}`);
  const j = SRC.indexOf(end, i);
  assert.ok(j > i, `fin introuvable : ${end}`);
  return SRC.slice(i, j);
}

test("le curseur « vu » ne s'aligne plus d'office sur le compte (uiState)", () => {
  // L'effet qui écoutait g.uiState recopiait room_seen_id dans seenIdRef : un `seq`
  // sauté (message supprimé, reconnexion) laissait le curseur au-dessus de messages
  // jamais affichés → pastille éteinte pour eux, définitivement.
  const effet = bloc("const local = loadSeenId(g.wallet);", "}, [g.wallet]);");
  assert.match(effet, /loadSeenId\(g\.wallet\)/,
    "le curseur se relit depuis le cache local");
  assert.doesNotMatch(effet, /seenIdDepuis\(g\)/,
    "le curseur ne se réaligne plus sur la valeur du compte");
  assert.doesNotMatch(effet, /uiState/,
    "l'effet ne dépend plus de uiState");
});

test("un message muté ne fait pas avancer le curseur de lecture", () => {
  // maxSeq bornait sur TOUS les messages, y compris les tus : les messages suivants,
  // jamais affichés, passaient pour lus dès l'ouverture du panneau.
  const calc = bloc("const maxSeq = messages.reduce(", "if (open) {");
  assert.match(calc, /estMute\(m, muted\) \? mx/,
    "les messages tus sont exclus de la borne");
});

test("les messages d'agents comptent dans la pastille", () => {
  // Un agent (Omni) n'est « moi » que si le serveur le dit (`mine`), donc sa
  // conversation rallume la pastille — le filtre ne doit pas l'exclure en bloc.
  const filtre = bloc("const nonVus = messages.filter(", "setUnread(nonVus.length)");
  assert.match(filtre, /!estMoi\(m, g\.publicId, g\.wallet\)/);
  assert.match(filtre, /!estMute\(m, muted\)/);
  assert.doesNotMatch(filtre, /kind === "agent"/,
    "aucune exclusion spécifique aux agents dans le compteur");
});

test("un curseur venu de l'ancienne numérotation (id de table) n'éteint plus la pastille", () => {
  // `room_seen_id` a reçu des `id` de table (728, 770…) avant la pièce commune :
  // ces nombres n'ont aucun rapport avec les `seq` (610, 655…) et la fusion
  // serveur en est un MAX, donc ils ne redescendaient jamais. Un compte resté
  // au-dessus de la pièce voyait TOUT comme lu à chaque ouverture.
  // Le curseur vit désormais dans une clé neuve, en `seq` uniquement.
  assert.doesNotMatch(SRC, /ui\.room_seen_id/,
    "l'ancien curseur (id de table) n'est plus lu");
  assert.doesNotMatch(SRC, /pushUiState\(\{ room_seen_id/,
    "on n'écrit plus dans l'ancienne clé");
  assert.match(SRC, /room_seq_seen:/, "cache local sur une clé neuve");
  assert.match(SRC, /ui\.room_seen_seq/, "et sur le compte, en `seq`");
  assert.match(SRC, /pushUiState\(\{ room_seen_seq: maxSeq \}\)/);
});

test("le premier chargement sur le curseur `seq` ne rallume pas tout le salon", () => {
  // Curseur neuf = 0 pour tout le monde au déploiement : sans recalage, les 50
  // derniers messages compteraient comme non lus (« 9+ » gratuit).
  const seed = bloc("if (maxSeq > 0 && seenIdRef.current === 0) {", "if (open) {");
  assert.match(seed, /seenIdRef\.current = maxSeq/);
  assert.match(seed, /saveSeenId\(g\.wallet, maxSeq\)/);
  assert.match(seed, /room_seen_seq: maxSeq/, "le compte est recalé aussi");
});

test("le compteur publie le NOMBRE de non-lus, pas seulement une position", () => {
  assert.match(SRC, /setUnread\(nonVus\.length\)/);
  assert.match(SRC, /fa:room-unread/);
});


test("la pastille lit la LISTE COMPLÈTE, pas seulement les nouveautés", () => {
  // Le compteur vit dans ce navigateur : il lui faut les 50 derniers messages à chaque
  // tour. En `?after=`, un simple rechargement de page repartait d'une pièce quasi vide
  // et la pastille ne comptait que ce qui arrivait ensuite — donc rien, quand on venait
  // de recharger. Constat fondateur 31/10/2026 : « on dirait qu'il n'y a jamais de rouge ».
  const poll = bloc("const poll = useCallback(async () => {", "}, [actions, ingest]);");
  assert.match(poll, /fetchRoomMessages\(\)/, "le poll relit la liste complète");
  assert.doesNotMatch(poll, /fetchRoomMessages\(lastSeqRef/, "plus de `?after=` pour le compteur");
  // Un seul appel par tour : le second (rattrapage de traduction) n'a plus lieu d'être.
  assert.strictEqual((poll.match(/fetchRoomMessages\(/g) || []).length, 1,
    "un seul appel par tour");
});
