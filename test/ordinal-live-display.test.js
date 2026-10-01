"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const start = source.indexOf("    async saveOrdinalName(name) {");
const end = source.indexOf("\n    withdraw(n)", start);
assert.ok(start > 0 && end > start);
const action = source.slice(start, end);
const reply = (body, ok = true) => ({ ok, json: async () => body });
function harness(fetcher, overrides = {}) {
  let state = { wallet: "wallet-a", authToken: "token-a", ordinalName: "old.fb", playerName: "Le Grand", playerTitle: "Le Grand", liquid: 123, ...overrides };
  const ref = { current: state };
  const calls = [];
  const setState = (next) => { state = next; ref.current = next; };
  const api = vm.runInNewContext(`({${action}})`, {
    gRef: ref, API_URL: "https://api.invalid", svOpts: () => ({ headers: { Authorization: "Bearer token-a" } }),
    setG: (fn) => setState(fn(state)),
    fetch: async (...args) => { calls.push(args); return fetcher(calls.length, setState, () => state); },
  });
  return { api, calls, state: () => state };
}
for (const [label, name, display] of [["selection", "chosen.fb", "chosen.fb"], ["retrait", "", "Joueur #12345"], ["nom refuse on-chain", "chosen.fb", "Joueur #12345"]]) {
  test(`affichage immediat sans reload : ${label}`, async () => {
    const h = harness(async (n) => n === 1
      ? reply({ status: "ok", ordinal_name: name, player_title: "", title_cleared: true })
      : reply({ save: { ordinal_name: name, player_title: "", display_name: display, arte_liquid: 0 } }));
    const result = await h.api.saveOrdinalName(name);
    assert.equal(result.ok, true);
    assert.equal(result.titleCleared, true);
    assert.equal(h.state().playerName, display);
    assert.equal(h.state().ordinalName, name);
    assert.equal(h.state().playerTitle, "");
    assert.equal(h.state().liquid, 123, "une relecture d'identite ne remplace pas les soldes en cours");
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0][0], "https://api.invalid/vanity/ordinal-name");
    assert.equal(h.calls[1][0], "https://api.invalid/save/wallet-a");
  });
}
test("echec POST : aucun nom fictif affiche", async () => {
  const h = harness(async () => reply({}, false));
  assert.equal((await h.api.saveOrdinalName("new.fb")).ok, false);
  assert.equal(h.state().ordinalName, "old.fb");
  assert.equal(h.state().playerName, "Le Grand");
  assert.equal(h.calls.length, 1);
});
test("sans authentification : pas de modification locale", async () => {
  const h = harness(() => { throw Error("unexpected fetch"); }, { authToken: "" });
  assert.equal((await h.api.saveOrdinalName("new.fb")).ok, false);
  assert.equal(h.state().ordinalName, "old.fb");
});
for (const field of ["wallet", "authToken"]) {
  test(`reponse tardive apres changement ${field} : ignoree`, async () => {
    const h = harness(async (n, set, get) => {
      if (n === 1) return reply({ status: "ok", ordinal_name: "new.fb", player_title: "" });
      set({ ...get(), [field]: "other", playerName: "Autre joueur" });
      return reply({ save: { display_name: "new.fb", ordinal_name: "new.fb", player_title: "" } });
    });
    await h.api.saveOrdinalName("new.fb");
    assert.equal(h.state().playerName, "Autre joueur");
  });
}
test("relecture impossible : pas de succes mensonger", async () => {
  const h = harness(async (n) => n === 1 ? reply({ status: "ok", ordinal_name: "new.fb", player_title: "" }) : reply({}, false));
  assert.equal((await h.api.saveOrdinalName("new.fb")).ok, false);
});
test("reponse POST invalide : pas de succes mensonger", async () => {
  const h = harness(async () => reply(null));
  assert.equal((await h.api.saveOrdinalName("new.fb")).ok, false);
});
