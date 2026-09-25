// Audit complet 2026-09, domaine D10 (client web) — régressions des deux
// corrections livrées avec docs/AUDIT-COMPLET-2026-09-D10.md.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const API = "https://api.test";

// Charge account-ui.js avec un fetch factice dont on pilote la réponse : chaque
// appel renvoie une promesse qu'on résout plus tard, comme une requête en vol.
function load() {
  const src = fs.readFileSync(path.join(ROOT, "account-ui.js"), "utf8");
  function mkStore() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  const enVol = [];
  const events = [];
  const win = {
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    FA_API_URL: API,
    fetch: () => new Promise((resolve) => enVol.push(resolve)),
    dispatchEvent: (e) => events.push(e),
  };
  global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
  new Function("window", "localStorage", "sessionStorage", src)(win, win.localStorage, win.sessionStorage);
  const repondre = (i, neuf) => enVol[i]({ headers: { get: (h) => (h === "x-fa-token-refresh" ? neuf : null) } });
  const attendre = () => new Promise((r) => setImmediate(r));
  return { A: win.FA_ACCOUNT, win, repondre, attendre, events };
}

const avec = (tok) => ({ headers: { "Authorization": "Bearer " + tok } });

test("refresh : le jeton frais remplace le jeton qui a porté la requête", async () => {
  const { A, win, repondre, attendre, events } = load();
  A.writeToken("tok-A", A.KIND_GENERATED);
  win.fetch(API + "/save/x", avec("tok-A"));
  repondre(0, "tok-A2");
  await attendre();
  assert.strictEqual(A.readToken(), "tok-A2");
  assert.strictEqual(events.length, 1);
});

test("refresh : une réponse arrivée APRÈS la déconnexion ne ressuscite pas la session", async () => {
  const { A, win, repondre, attendre, events } = load();
  A.writeToken("tok-A", A.KIND_GENERATED);
  win.fetch(API + "/fight", avec("tok-A"));
  A.clearToken(); // le joueur se déconnecte pendant que la requête est en vol
  repondre(0, "tok-A2");
  await attendre();
  assert.strictEqual(A.readToken(), "", "aucun jeton ne doit réapparaître dans le stockage");
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null);
  assert.strictEqual(events.length, 0, "app.jsx ne doit pas réadopter l'ancienne session");
});

test("refresh : un changement de compte en vol n'est pas écrasé par l'ancien compte", async () => {
  const { A, win, repondre, attendre } = load();
  A.writeToken("tok-A", A.KIND_GENERATED);
  win.fetch(API + "/quests/claim", avec("tok-A"));
  A.writeToken("tok-B", A.KIND_GENERATED); // bascule vers un autre compte
  repondre(0, "tok-A2");
  await attendre();
  assert.strictEqual(A.readToken(), "tok-B");
});

test("refresh : en-têtes sous forme de Headers (get) reconnus", async () => {
  const { A, win, repondre, attendre } = load();
  A.writeToken("tok-A", A.KIND_GENERATED);
  const h = { get: (k) => (k === "authorization" ? "Bearer tok-A" : null) };
  win.fetch(API + "/save/x", { headers: h });
  repondre(0, "tok-A2");
  await attendre();
  assert.strictEqual(A.readToken(), "tok-A2");
});

test("refresh : une requête sans Bearer n'installe jamais de jeton", async () => {
  const { A, win, repondre, attendre } = load();
  win.fetch(API + "/leaderboard");
  repondre(0, "tok-X");
  await attendre();
  assert.strictEqual(A.readToken(), "");
});

test("CSP : unpkg n'est autorisé que pour les deux fichiers React sous SRI", () => {
  const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const csp = (HTML.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, "CSP introuvable");
  const scriptSrc = (/script-src ([^;]+)/.exec(csp) || [])[1].trim().split(/\s+/);
  const unpkg = scriptSrc.filter((s) => s.indexOf("unpkg.com") !== -1);
  assert.ok(!unpkg.includes("https://unpkg.com") && !unpkg.includes("https://unpkg.com/"),
    "le domaine entier laisserait charger n'importe quel paquet npm");
  // Chaque script unpkg de la page doit être couvert exactement, sinon React ne charge plus.
  const balises = [...HTML.matchAll(/<script src="(https:\/\/unpkg\.com\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(balises.length >= 2);
  assert.deepStrictEqual([...unpkg].sort(), [...balises].sort());
});
