// test/wallet-history-ui.test.js — historique des mouvements on-chain :
// câblage de la modale, clés i18n, et surtout le RÉSEAU du lien explorateur.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const I18N = lire("i18n.js");
const SCREENS = lire("screens.jsx");
const APP = lire("app.jsx");

const KEYS = ["WL_HISTORY", "WL_H_EMPTY", "WL_H_ERROR", "WL_H_PENDING", "WL_H_SENT", "WL_H_FAILED", "WL_H_NO_TXID"];

test("toutes les clés de l'historique existent en FR/EN/ZH", () => {
  for (const k of KEYS) {
    const m = I18N.match(new RegExp("\\b" + k + ":\\s*\\{[^}]*\\}"));
    assert.ok(m, k + " absente");
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(m[0], new RegExp(lang + ':\\s*"[^"]+"'), k + " sans " + lang);
    }
  }
});

test("le lien explorateur vise le réseau FRACTAL d'Uniscan", () => {
  // Vérifié en réel le 2026-08-18 : /tx/<txid> cherche sur Bitcoin et rend
  // « aucune donnée » pour une tx Fractal ; seul /fractal/tx/ l'affiche.
  assert.match(SCREENS, /https:\/\/uniscan\.cc\/fractal\/tx\//, "lien uniscan absent ou sur le mauvais réseau");
  assert.ok(!/uniscan\.cc\/tx\//.test(SCREENS), "un lien /tx/ (réseau Bitcoin) enverrait le joueur sur une page vide");
});

test("la modale est montée et l'action appelle la bonne route", () => {
  assert.match(SCREENS, /HistoryModal/, "modale absente");
  assert.match(APP, /fetchWalletHistory/, "action absente");
  assert.match(APP, /\/wallet\/history/, "route jamais appelée");
});

test("le lien s'ouvre hors du jeu (nouvel onglet), statut affiché pour les retraits", () => {
  const bloc = SCREENS.slice(SCREENS.indexOf("const UNISCAN_TX"));
  assert.match(bloc, /target="_blank"/, "sans _blank, l'explorateur remplace le jeu (PWA comprise)");
  assert.match(bloc, /pending_send/, "le statut pending_send doit être traduit, pas montré brut");
});
