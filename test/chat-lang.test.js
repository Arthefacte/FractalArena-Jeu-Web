// Le chatbot support repondait en anglais a un joueur FR : le serveur ne
// connaissait pas la langue d'interface. Il lit d'abord player_saves.lang ;
// le client transmet s.lang dans POST /chat comme REPLI (compte tout neuf qui
// n'a pas encore sauvegarde). Aucune langue n'est inventee cote client : si
// s.lang est vide, le champ est omis et le serveur tranche.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function blocCallChat() {
  const i = APP.indexOf("async callChat(");
  assert.ok(i > 0, "callChat introuvable");
  const fin = APP.indexOf("async fetchRoomMessages(", i);
  assert.ok(fin > i, "fin de callChat introuvable");
  return APP.slice(i, fin);
}

function bodyChat() {
  const bloc = blocCallChat();
  assert.match(bloc, /fetch\(`\$\{API_URL\}\/chat`/, "appel POST /chat introuvable");
  const m = bloc.match(/body:\s*JSON\.stringify\(([\s\S]*?)\),\s*\n/);
  assert.ok(m, "body JSON.stringify introuvable dans callChat");
  return m[1];
}

test("callChat envoie la langue d'interface dans le body de POST /chat", () => {
  const body = bodyChat();
  assert.match(body, /messages:\s*last20/, "les messages restent envoyes");
  assert.match(body, /lang/, "le body doit contenir le champ lang");
  assert.match(body, /s\.lang/, "la langue vient de l'etat global (s.lang), pas d'un appel I18N en doublon");
});

test("callChat n'invente aucune langue cote client", () => {
  const body = bodyChat();
  assert.ok(!/lang:\s*(s\.lang\s*\|\|\s*)?["'](FR|EN|ZH)["']/.test(body),
    `aucune langue en dur : ${body.trim()}`);
  assert.ok(!/I18N\.getLang/.test(blocCallChat()), "pas de doublon I18N.getLang");
});
