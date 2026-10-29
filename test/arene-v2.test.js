/* Contrat Arène V2 : tests purs et gardes de câblage, sans serveur ni réseau. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
globalThis.window = {};
require("../arene-ui.js");
const U = window.FA_ARENE_UI;
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const UI = read("arene.jsx");
const APP = read("app.jsx");

const now = Date.UTC(2026, 9, 26, 12);

test("défense entamée : la jauge reprend les PV du serveur", () => {
  const d = U.defenseStatus({ hp_left: 35, hp_max: 100, down_until: null }, now);
  assert.equal(d.hpLeft, 35);
  assert.equal(d.hpMax, 100);
  assert.equal(d.hpPct, 35);
  assert.equal(d.hpKnown, true);
  assert.equal(d.down, false);
  assert.equal(d.full, false);
});

test("défense pleine : le soin devient indisponible, y compris si PV > maximum", () => {
  for (const hp of [100, 120]) {
    const d = U.defenseStatus({ hp_left: hp, hp_max: 100 }, now);
    assert.equal(d.full, true);
    assert.equal(d.hpPct, 100);
  }
});

test("zéro PV sans échéance : la défense reste tombée sans timer inventé", () => {
  const d = U.defenseStatus({ hp_left: 0, hp_max: 100, down_until: null }, now);
  assert.equal(d.down, true);
  assert.equal(d.remainingMs, 0);
  assert.equal(d.hpPct, 0);
  assert.equal(d.full, false);
});

test("le compte à rebours varie chaque seconde et ne relève pas une défense à zéro", () => {
  const server = { hp_left: 0, hp_max: 100, down_until: now + 65000 };
  assert.equal(U.defenseStatus(server, now).remainingMs, 65000);
  assert.equal(U.defenseStatus(server, now + 1000).remainingMs, 64000);
  const expired = U.defenseStatus(server, now + 66000);
  assert.equal(expired.remainingMs, 0);
  assert.equal(expired.down, true);
  assert.equal(expired.hpLeft, 0);
});

test("une échéance future interdit le combat même avec des PV positifs", () => {
  const d = U.defenseStatus({ hp_left: 100, hp_max: 100, down_until: now + 1000 }, now);
  assert.equal(d.down, true);
  assert.equal(d.remainingMs, 1000);
});

test("l'échéance accepte les dates serveur ISO et les millisecondes", () => {
  for (const until of [now + 5000, String(now + 5000), new Date(now + 5000).toISOString()]) {
    assert.equal(U.defenseStatus({ hp_left: 0, hp_max: 100, down_until: until }, now).remainingMs, 5000);
  }
});

test("PV absents ou invalides : aucun état plein ni barre NaN inventés", () => {
  for (const server of [null, undefined, {}, { hp_left: null, hp_max: 100 }, { hp_left: 10, hp_max: 0 }, { hp_left: NaN, hp_max: 100 }]) {
    const d = U.defenseStatus(server, now);
    assert.equal(d.hpKnown, false);
    assert.equal(d.full, false);
    assert.equal(d.hpPct, 0);
    assert.equal(Number.isFinite(d.remainingMs), true);
  }
});

test("seul le 404 pas_de_fantome ouvre l'entrée ; panne réseau et chargement restent distincts", () => {
  assert.match(UI, /r\.status === 404 && r\.error === "pas_de_fantome"/);
  assert.match(UI, /setMyDefense\(null\)/);
  assert.match(UI, /myDefense === undefined/);
  assert.match(UI, /myDefense === null/);
  assert.match(UI, /myDefensePosted && !defenseError && \(sc\.prelaunch/);
  assert.match(UI, /AR2_DEFENSE_RETRY/);
});

test("attaque et soin sont verrouillés par l'état serveur de la défense", () => {
  assert.match(UI, /const canAttack = myDefensePosted && defense\.hpKnown && !defense\.down && !defenseError/);
  const heal = UI.slice(UI.indexOf("async function onHeal"), UI.indexOf("async function onPickOpponent"));
  assert.match(heal, /if \([^\n]*!canAttack[^\n]*defense\.full[^\n]*!healCostKnown\) return/);
  assert.match(heal, /actions\.pvpHeal\(\)/);
  assert.match(heal, /hp_left: r\.hp_left, hp_max: r\.hp_max/);
  assert.match(UI, /disabled=\{!ready \|\| busy \|\| !canAttack \|\| \(!pick\.revanche && entry === "ticket" && !ticketMode\.available\)\}/);
  assert.match(UI, /disabled=\{busy \|\| !canAttack \|\| defense\.full \|\| !healCostKnown\}/);
  assert.match(UI, /defense\.full \? I18N\.t\("AR2_DEFENSE_FULL"\)/);
  assert.match(UI, /role="progressbar"/);
});

test("le timer relit la défense à l'échéance et ne recrée pas de PV", () => {
  assert.match(UI, /setInterval\(\(\) => setNowTs\(Date\.now\(\)\), 1000\)/);
  assert.match(UI, /recoveryChecked\.current === deadline/);
  assert.match(UI, /AR2_DEFENSE_RAISE/);
  assert.match(UI, /AR2_DEFENSE_DOWN/);
});

test("prix et plafond viennent du serveur et sont passés au message d'erreur", () => {
  assert.match(APP, /heal_cost: cad\.heal_cost/);
  assert.match(APP, /pair_limit: ladder\.pair_limit \?\? cad\.pair_limit/);
  assert.match(UI, /pair_limit: pvp\.pair_limit/);
  assert.doesNotMatch(UI, /(?:heal_cost|pair_limit)\s*(?:\|\||\?\?)\s*\d/);
});
