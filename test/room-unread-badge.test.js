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

test("un curseur plus haut que la pièce est ramené à ce qui existe", () => {
  // `room_seen_id` a gardé un `id` de table (728) d'avant la pièce commune, où la salle
  // s'arrête à `seq` 610 : aucun message ne peut être « plus récent » que 728, donc la
  // pastille restait éteinte pour toujours. Le curseur doit se recaler sur la salle.
  const garde = bloc("if (maxSeq > 0 && seenIdRef.current > maxSeq) {", "if (open) {");
  assert.match(garde, /seenIdRef\.current = maxSeq/);
  assert.match(garde, /saveSeenId\(g\.wallet, maxSeq\)/, "le cache local est recalé aussi");
  assert.match(garde, /room_seen_id: maxSeq/, "et le compte, sinon le prochain chargement le remet");
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
