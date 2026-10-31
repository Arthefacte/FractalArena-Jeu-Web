// Le salon affichait en VO un message dont la traduction EXISTAIT en base : le
// serveur détecte la langue et traduit APRÈS l'insertion (DeepSeek, 1-3 s), le poll
// ne renvoyait alors que les nouveautés (`?after=`), et `ingest` jetait les ids
// connus. Le lecteur gardait donc l'original jusqu'au rechargement complet de la page.
//
// Contrat (rasserré le 31/10/2026) : le poll relit la LISTE COMPLÈTE à chaque tour.
// Il n'y a donc plus de fenêtre de rattrapage ni de second appel — la traduction qui
// arrive en base est servie au tour suivant, et la fusion REMPLACE la ligne. Relire la
// liste complète est aussi ce qui rend la pastille de non-lus honnête : le compteur vit
// dans le navigateur, il a besoin des 50 derniers messages, pas seulement des nouveaux.
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
  assert.match(bloc_, /new Map\(prev\.map\(\(m\) => \[msgKey\(m\), m\]\)\)/, "l'ancienne version est indexée par la clé sans collision (`ref`)");
  assert.match(bloc_, /if \(m\.tr !== old\.tr \|\| m\.src_lang !== old\.src_lang\)/, "la ligne est remplacée quand tr/src_lang change");
  assert.ok(!/incoming\.filter\(\(m\) => !known\.has\(m\.id\)\)/.test(bloc_),
    "l'ancien filtre qui JETAIT les ids connus ne doit pas revenir");
});

test("le poll relit la liste complète à chaque tour, sans fenêtre de rattrapage", () => {
  const bloc_ = bloc("const poll = useCallback(", "// Polling : rapide quand le panneau est ouvert");
  assert.match(bloc_, /await actions\.fetchRoomMessages\(\)/, "la liste complète est relue SANS `after`");
  assert.doesNotMatch(bloc_, /pendingTrRef/, "plus de rattrapage à entretenir : chaque tour sert tout");
  assert.ok(!/ROOM_TR_PENDING_MS/.test(ROOM), "la fenêtre de rattrapage a disparu avec le second appel");
});

test("une traduction arrivée après coup est servie au tour suivant", () => {
  // Un seul appel par tour : la ligne revient dans la liste complète, avec `tr` cette fois,
  // et la fusion la remplace — c'est ce qui remplace l'ancien second appel.
  const bloc_ = bloc("const poll = useCallback(", "// Polling : rapide quand le panneau est ouvert");
  assert.strictEqual((bloc_.match(/fetchRoomMessages\(/g) || []).length, 1, "un seul appel par tour");
  assert.match(bloc_, /ingest\(res\.messages\)/);
});
