// Le salon affichait en VO un message dont la traduction EXISTAIT en base : le
// serveur détecte la langue et traduit APRÈS l'insertion (DeepSeek, 1-3 s), le poll
// `?after=<dernier id>` ne renvoie jamais une ligne déjà reçue, et `ingest` jetait
// les ids connus. Le lecteur gardait donc l'original jusqu'au rechargement complet
// de la page (vécu : un message ZH lu en chinois par un joueur FR, `tr.FR` pourtant
// présent côté serveur).
// Contrat tenu ici : une ligne connue est REMPLACÉE quand le serveur en sert une
// version plus riche, et le poll relit la liste complète tant qu'une traduction
// manque — avec une borne, pour ne pas insister sur un message qui n'en aura jamais.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOM = fs.readFileSync(path.join(__dirname, "..", "roomchat.jsx"), "utf8");

function bloc(nom, suivant) {
  const i = ROOM.indexOf(nom);
  assert.ok(i > 0, `${nom} introuvable`);
  const fin = ROOM.indexOf(suivant, i);
  assert.ok(fin > i, `fin de ${nom} introuvable`);
  return ROOM.slice(i, fin);
}

test("ingest remplace une ligne connue devenue plus riche (traduction, langue détectée)", () => {
  const bloc_ = bloc("const ingest = useCallback(", "const poll = useCallback(");
  assert.match(bloc_, /new Map\(prev\.map\(\(m\) => \[m\.id, m\]\)\)/, "l'ancienne version est indexée par id");
  assert.match(bloc_, /if \(m\.tr !== old\.tr \|\| m\.src_lang !== old\.src_lang\)/, "la ligne est remplacée quand tr/src_lang change");
  assert.ok(!/incoming\.filter\(\(m\) => !known\.has\(m\.id\)\)/.test(bloc_),
    "l'ancien filtre qui JETAIT les ids connus ne doit pas revenir");
});

test("le poll relit la liste complète tant qu'une traduction manque, et pas au-delà de la fenêtre", () => {
  const bloc_ = bloc("const poll = useCallback(", "// Polling : rapide quand le panneau est ouvert");
  assert.match(bloc_, /pendingTrRef\.current\.size/, "le rattrapage est gardé par les ids en attente");
  assert.match(bloc_, /await actions\.fetchRoomMessages\(\)/, "la liste complète est relue SANS `after`");
  assert.match(ROOM, /const ROOM_TR_PENDING_MS = \d+;/, "la fenêtre de rattrapage est bornée");
});

test("un message déjà dans la langue du lecteur n'entre pas en attente de traduction", () => {
  const bloc_ = bloc("const ingest = useCallback(", "const poll = useCallback(");
  assert.match(bloc_, /m\.src_lang !== I18N\.getLang\(\)/, "inutile d'attendre une traduction pour sa propre langue");
  assert.match(bloc_, /if \(m\.tr\) pendingTrRef\.current\.delete\(m\.id\)/, "l'arrivée de la traduction solde l'attente");
});
