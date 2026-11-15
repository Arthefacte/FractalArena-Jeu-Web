// Câblage Forge d'équipement : actions authentifiées dans app.jsx (fusion de
// reliques + recyclage), écran branché sur les helpers purs de forge-ui.js.
// Vérifications du câblage JSX et exécution de l'action de recyclage isolée,
// sans réseau ni serveur : l'objet est consommé contre des fragments, sans FA.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const SCREENS = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");

function actionSource(name) {
  const start = APP.indexOf(`    async ${name}(`);
  assert.ok(start >= 0, name + " absent");
  const end = APP.indexOf("\n    },", start);
  assert.ok(end > start, name + " : fin de l'action absente");
  return APP.slice(start, end + "\n    }".length);
}

function screenSource(name) {
  const start = SCREENS.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " absent");
  const end = SCREENS.indexOf("\nfunction ", start);
  return SCREENS.slice(start, end < 0 ? undefined : end);
}

test("relicFuse : POST /forge/relic-fuse authentifié, body relic_ids, resync /save", () => {
  const b = actionSource("relicFuse");
  assert.match(b, /forge\/relic-fuse/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /relic_ids/, "relic_ids absent du body");
  assert.match(b, /svOpts\(\)/, "resync /save manquant (solde + inventaire bougent)");
  assert.match(b, /applySave\(save, s\.wallet, s\.authToken\)/, "la réponse /save doit passer par la garde d'identité applySave");
});

test("equipDisenchant : POST /forge/equip-disenchant authentifié, body item_id, resync /save", () => {
  const b = actionSource("equipDisenchant");
  assert.match(b, /forge\/equip-disenchant/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /item_id/, "item_id absent du body");
  assert.match(b, /svOpts\(\)/, "resync /save manquant");
  assert.match(b, /applySave\(save, s\.wallet, s\.authToken\)/, "la réponse /save doit passer par la garde d'identité applySave");
});

test("les deux actions traduisent les codes serveur (jamais de code brut au joueur)", () => {
  for (const name of ["relicFuse", "equipDisenchant"]) {
    const b = actionSource(name);
    assert.match(b, /equipForgeErrText/, name + " : mapping i18n des erreurs manquant");
  }
  assert.match(actionSource("relicFuse"), /insufficient_balance/, "la fusion exige toujours son solde en FA");
  assert.doesNotMatch(actionSource("equipDisenchant"), /DISENCHANT_FEE|BUYBACK|insufficient_balance/,
    "le recyclage ne doit plus exiger de frais ni convertir l'objet en FA");
});

test("écran : section Forge d'équipement branchée sur les helpers purs", () => {
  const b = screenSource("ForgeEquipement");
  assert.match(b, /isRelicItem/, "la section doit filtrer les reliques (jamais les cores)");
  assert.match(b, /equipSelToggle/);
  assert.match(b, /relicFuseState/);
  assert.match(b, /disenchantState/);
  assert.match(b, /actions\.relicFuse\(/);
  assert.match(b, /actions\.equipDisenchant\(/);
  assert.match(b, /FG_EQ_DIS_CONFIRM/, "le désenchantement détruit : confirmation requise");
});

test("écran : la section est rendue dans l'onglet Reliques de la Forge", () => {
  const b = screenSource("ForgeReliques");
  assert.match(b, /<ForgeEquipement/, "ForgeEquipement non rendue dans ForgeReliques");
});

function recycleAction(state, response, save, expeditionState) {
  const requests = [];
  const applied = [];
  const saveOptions = { headers: { Authorization: `Bearer ${state.authToken}` } };
  const context = {
    gRef: { current: state },
    API_URL: "https://api.example.test",
    window: {
      FA_FORGE_UI: { equipForgeErrText: (error) => "Erreur traduite : " + error },
      FA_EXPEDITIONS_UI: { readDustState: () => ({}) },
    },
    setG: (update) => { context.gRef.current = update(context.gRef.current); },
    svOpts: () => saveOptions,
    applySave: (...args) => applied.push(args),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/forge/equip-disenchant")) return { json: async () => response };
      if (url.endsWith("/expeditions/state")) return { ok: true, json: async () => expeditionState };
      assert.strictEqual(url, "https://api.example.test/save/compte-test");
      assert.strictEqual(options, saveOptions, "la sauvegarde est demandée avec les options authentifiées");
      return { ok: true, json: async () => ({ save }) };
    },
  };
  context.actions = vm.runInNewContext(`({${actionSource("equipDisenchant")},${actionSource("expeditionsState")}})`, context);
  return { run: context.actions.equipDisenchant, requests, applied, state: () => context.gRef.current };
}

test("equipDisenchant : à 0 FA, relique et core resynchronisent l'inventaire et le compteur de fragments", async () => {
  for (const [item, rank, fragments, field] of [
    [{ id: "relique", type: "ruby_shard", rarity: "Rare" }, "B", 75, "fragments"],
    [{ id: "core", core_id: "fury_core", rarity: "Legendary" }, "S", 300, "core_fragments"],
  ]) {
    const empty = { C: 0, B: 0, A: 0, S: 0 };
    const state = { wallet: "compte-test", authToken: "jeton-test", liquid: 0, locked: 0, equipment: [item],
      expFragments: { ...empty }, expCoreFragments: { ...empty } };
    // /save fait foi pour l'objet consommé ; /expeditions/state pour les fragments.
    // L'action réelle expeditionsState est exécutée, applySave reçoit la sauvegarde
    // et l'identité capturée sans que ce test reconstruise son hydratation générale.
    const save = { equipment: [], arte_liquid: 0, arte_locked: 0 };
    const expeditionState = { ok: true, fragments: { ...empty }, core_fragments: { ...empty },
      [field]: { ...empty, [rank]: fragments } };
    const h = recycleAction(state, { status: "ok", value: 0, cost: 0, rarity: item.rarity, rank, fragments }, save, expeditionState);
    const result = await h.run(item.id);
    assert.deepStrictEqual({ ...result }, { ok: true, value: 0, fragments, rank });
    assert.strictEqual(h.requests.length, 3, "le solde nul autorise le POST puis les deux resynchronisations");
    assert.strictEqual(h.requests[0].options.method, "POST");
    assert.strictEqual(h.requests[0].options.headers.Authorization, "Bearer jeton-test");
    assert.deepStrictEqual(JSON.parse(h.requests[0].options.body), { wallet: state.wallet, item_id: item.id });
    assert.deepStrictEqual(h.applied, [[save, state.wallet, state.authToken]],
      "la sauvegarde où l'objet a disparu est transmise à applySave avec wallet et jeton");
    assert.strictEqual(h.requests[2].options.headers.Authorization, "Bearer jeton-test");
    assert.deepStrictEqual(h.state().expFragments, expeditionState.fragments, "compteur des reliques actualisé");
    assert.deepStrictEqual(h.state().expCoreFragments, expeditionState.core_fragments, "compteur des cores actualisé");
    assert.strictEqual(h.state().liquid, 0, "aucun crédit local de FA");
    assert.strictEqual(h.state().locked, 0, "aucun débit local de FA");
  }
});

test("equipDisenchant : un refus serveur est traduit sans crédit ni resynchronisation", async () => {
  const h = recycleAction({ wallet: "compte-test", authToken: "jeton-test", liquid: 0, locked: 0 },
    { status: "error", error: "objet_invalide" });
  assert.deepStrictEqual({ ...await h.run("introuvable") }, { ok: false, reason: "Erreur traduite : objet_invalide" });
  assert.strictEqual(h.requests.length, 1);
  assert.strictEqual(h.applied.length, 0);
});

test("equipDisenchant : recycler gratuitement exige toujours un compte authentifié", async () => {
  for (const state of [{ wallet: "", authToken: "jeton-test" }, { wallet: "compte-test", authToken: "" }]) {
    const h = recycleAction(state);
    assert.deepStrictEqual({ ...await h.run("relique") }, { ok: false, reason: "Wallet requis" });
    assert.strictEqual(h.requests.length, 0);
    assert.strictEqual(h.applied.length, 0);
  }
});
