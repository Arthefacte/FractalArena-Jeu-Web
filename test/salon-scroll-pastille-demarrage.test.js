const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const room = fs.readFileSync(path.join(root, "roomchat.jsx"), "utf8");
const app = fs.readFileSync(path.join(root, "app.jsx"), "utf8");

// Deux symptômes signalés le 31/10, une seule cause par symptôme.

test("le dérouleur ne renvoie plus en bas quand le joueur lit plus haut", () => {
  // On mémorise si le lecteur est en bas, et on ne défile que dans ce cas.
  assert.match(room, /enBasRef/, "le panneau doit suivre la position de lecture");
  assert.match(room, /function onScroll\(\)/, "la position se mesure au défilement");
  assert.match(room, /if \(enBasRef\.current\) el\.scrollTop = el\.scrollHeight/,
    "le défilement automatique est conditionné à la position");
  assert.match(room, /onScroll=\{onScroll\}/, "le conteneur écoute le défilement");
});

test("la pastille apparaît DÈS l'ouverture du jeu", () => {
  // Le compteur est calculé après le montage du header : il faut le réclamer.
  assert.match(room, /fa:room-unread-ask/, "RoomFab doit répondre à la demande");
  assert.match(room, /unreadRef/, "la valeur courante doit être disponible hors rendu");
  assert.match(app, /fa:room-unread-ask/, "le header réclame la valeur au démarrage");
});
