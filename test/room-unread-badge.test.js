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

test("le compteur publie le NOMBRE de non-lus, pas seulement une position", () => {
  assert.match(SRC, /setUnread\(nonVus\.length\)/);
  assert.match(SRC, /fa:room-unread/);
});
