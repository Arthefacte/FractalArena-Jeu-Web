// Rendu réel du JSX et réponses serveur : la poussière ne promet aucun chiffre local.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const source = read("app.jsx");
const compiled = Babel.transform(read("expeditions.jsx"), { presets: ["react"], sourceType: "script" }).code;
const context = { window: {} };
for (const file of ["data.js", "i18n.js", "expeditions-ui.js"]) vm.runInNewContext(read(file), context);
const { FA_EXPEDITIONS_UI: XU, FA_I18N: I, FA_DATA: D } = context.window;
const payload = () => ({ ok: true, dust_sats: 1000000, dust_p: 0.05, dust_min_h: 12,
  dust_min_rarity: "Epic", dust_weekly_cap: 5, dust_week: { used: 2, left: 3 } });
const plain = (value) => JSON.parse(JSON.stringify(value));
const textOf = (node) => Array.isArray(node) ? node.map(textOf).join("")
  : node && typeof node === "object" ? textOf(node.children)
    : node == null || typeof node === "boolean" ? "" : String(node);

function render({ data = payload(), lang = "FR", hours = 12, verified = true,
  rarities = ["Epic", "Legendary", "Epic"], loot = null } = {}) {
  I.setLang(lang);
  let stateIndex = 0;
  const roster = rarities.map((rarity, index) => ({ id: String(index), name: "HashByte", type: "HASH", rarity,
    level: 10, base_hp: 100, base_atk: 10, base_def: 10, base_spd: 10, base_mag: 10 }));
  const initialStates = { 0: loot ? "loot" : "config", 1: "blocs", 2: roster.map((b) => b.id), 3: hours, 11: loot };
  const React = {
    useState(initial) {
      const index = stateIndex++;
      return [index in initialStates ? initialStates[index] : initial, () => {}];
    },
    useEffect() {}, useRef: (current) => ({ current }),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const win = { ...context.window, SectionHead: "SectionHead", Bar: "Bar",
    useFA: () => ({ g: { wallet: "wallet", authToken: "token", roster, selected: [],
      expDust: XU.readDustState(data), onchainVerified: verified }, actions: {}, toast() {} }),
  };
  vm.runInNewContext(compiled, { window: win, React });
  const tree = win.Expeditions(), nodes = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    node.children.forEach(walk);
  }
  walk(tree);
  const box = nodes.find((n) => /\bexq-(epicbox|dustnote|dustbox)\b/.test(n.props.className || ""));
  return { text: textOf(tree), box, dustText: textOf(box), eligible: box?.props.className === "exq-epicbox" };
}

test("aucun bloc poussière avant un état complet : pas de valeur de repli", () => {
  for (const data of [null, {}, { ...payload(), dust_min_h: undefined }, { ...payload(), dust_week: null }]) {
    const r = render({ data });
    assert.equal(r.box, undefined);
    assert.ok(!r.text.includes(I.t("EXP_DUST")));
  }
});

test("règle, conditions, destination et semaine sont rendues en FR/EN/ZH", () => {
  for (const lang of ["FR", "EN", "ZH"]) {
    const r = render({ lang });
    assert.equal(r.eligible, true);
    for (const expected of [I.t("EXP_DUST_RULE", lang === "FR" ? "0,01" : "0.01", "5", 12, 5),
      I.t("EXP_DUST_CONDITIONS", I.t("Epic")), I.t("EXP_DUST_DESTINATION"),
      I.t("EXP_DUST_WEEK", 2, 5), I.t("EXP_DUST_LEFT", 3)]) {
      assert.ok(r.dustText.includes(expected), lang + " : " + expected);
    }
    assert.doesNotMatch(r.dustText, /EXP_DUST_|\{\d+\}|1000000/);
  }
});

test("8 h reste inéligible, 12 h devient éligible ; le seuil ne vient pas du client", () => {
  const short = render({ hours: 8 });
  assert.equal(short.eligible, false);
  assert.ok(short.dustText.includes(I.t("EXP_DUST_NEEDS_H", 12)));
  assert.equal(render({ hours: 12 }).eligible, true);
  const changed = { ...payload(), dust_sats: 2500000, dust_p: 0.125,
    dust_min_h: 10, dust_min_rarity: "Legendary", dust_weekly_cap: 7, dust_week: { used: 1, left: 6 } };
  const r = render({ data: changed, hours: 10, rarities: ["Legendary", "Legendary", "Legendary"] });
  assert.equal(r.eligible, true);
  assert.ok(r.dustText.includes(I.t("EXP_DUST_RULE", "0,025", "12,5", 10, 7)));
  assert.ok(r.dustText.includes(I.t("EXP_DUST_CONDITIONS", I.t("Legendary"))));
  assert.ok(r.dustText.includes(I.t("EXP_DUST_WEEK", 1, 7)));
  assert.ok(r.dustText.includes(I.t("EXP_DUST_LEFT", 6)));
  assert.equal(render({ data: changed, hours: 9 }).eligible, false);
  const low = render({ data: changed, hours: 10 });
  assert.equal(low.eligible, false);
  assert.ok(low.dustText.includes(I.t("EXP_DUST_NEEDS_RARITY", I.t("Legendary"))));
});

test("rang insuffisant ou compte non vérifié : règle visible, aucune mise en avant du gain", () => {
  const low = render({ rarities: ["Epic", "Rare", "Legendary"] });
  assert.equal(low.eligible, false);
  assert.ok(low.dustText.includes(I.t("EXP_DUST_NEEDS_RARITY", I.t("Epic"))));
  for (const verified of [false, null, "true"]) {
    const r = render({ verified });
    assert.equal(r.eligible, false);
    assert.ok(r.dustText.includes(I.t("EXP_DUST_NEEDS_ONCHAIN")));
  }
  const empty = render({ rarities: [] });
  assert.equal(empty.eligible, false);
  assert.ok(empty.dustText.includes(I.t("EXP_DUST_CONDITIONS", I.t("Epic"))));
});

test("plafond atteint : annonce prioritaire, aucune invitation à rallonger ou changer l'équipe", () => {
  for (const week of [{ used: 5, left: 0 }, { used: 5, left: 1 }, { used: 4, left: 0 }]) {
    for (const hours of [8, 12]) {
      const r = render({ data: { ...payload(), dust_week: week }, hours, verified: false,
        rarities: ["Rare", "Rare", "Rare"] });
      assert.equal(r.eligible, false);
      assert.ok(r.dustText.includes(I.t("EXP_DUST_CAPPED")));
      assert.ok(r.dustText.includes(I.t("EXP_DUST_WEEK", week.used, 5)));
      for (const hint of [I.t("EXP_DUST_NEEDS_H", 12), I.t("EXP_DUST_NEEDS_ONCHAIN"),
        I.t("EXP_DUST_NEEDS_RARITY", I.t("Epic"))]) assert.ok(!r.dustText.includes(hint));
    }
  }
});

test("le butin affiche le montant réel du claim en FB et sa destination", () => {
  const r = render({ loot: { success: true, rewards: { dust: true, dust_sats: 2500000 }, worldId: "blocs" } });
  assert.ok(r.dustText.includes(I.t("EXP_DUST_GAIN", "0,025")));
  assert.ok(r.dustText.includes(I.t("EXP_DUST_DESTINATION")));
  assert.doesNotMatch(r.dustText, /2500000|0,01/);
});

function action(name, globals) {
  const start = source.indexOf("    async " + name + "(");
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n    },", start) + "\n    }".length;
  return vm.runInNewContext("({" + source.slice(start, end) + "})." + name,
    { window: context.window, API_URL: "https://example.test", ...globals });
}

test("expeditionsState transporte la règle et retire l'ancienne si un champ manque", async () => {
  let g = { authToken: "token", expDust: null }, data = payload();
  const gRef = { get current() { return g; } };
  const run = action("expeditionsState", { gRef, setG: (update) => { g = update(g); },
    fetch: async () => ({ ok: true, json: async () => data }) });
  assert.equal((await run()).ok, true);
  assert.deepEqual(plain(g.expDust), plain(XU.readDustState(data)));
  data = { ...payload(), dust_p: undefined };
  assert.equal((await run()).ok, true);
  assert.equal(g.expDust, null);
});

test("une réponse poussière de l'ancien compte ne traverse pas la garde du jeton", async () => {
  let g = { authToken: "ancien", expDust: null }, resolve;
  const pending = new Promise((done) => { resolve = done; });
  const run = action("expeditionsState", { gRef: { get current() { return g; } },
    setG: () => assert.fail("la réponse de l'ancien compte ne doit pas modifier le nouveau"),
    fetch: () => pending });
  const result = run();
  g = { authToken: "nouveau", expDust: null };
  resolve({ ok: true, json: async () => payload() });
  assert.equal((await result).ok, false);
});

test("le claim actualise le compteur même si le rafraîchissement réseau échoue", async () => {
  let g = { wallet: "wallet", authToken: "token", expDust: XU.readDustState(payload()), expeditions: [{ id: 1 }] };
  const run = action("expeditionsClaim", { gRef: { get current() { return g; } },
    setG: (update) => { g = update(g); }, svOpts: () => ({}),
    actions: { expeditionsState: async () => ({ ok: false }) },
    fetch: async (_url, options) => {
      if (options?.method !== "POST") throw new Error("hors ligne");
      return { ok: true, json: async () => ({ ok: true, success: true, dust_week: { used: 5, left: 0 } }) };
    } });
  assert.equal((await run(1)).ok, true);
  assert.equal(g.expDust.used, 5);
  assert.equal(g.expDust.left, 0);
  assert.equal(g.expDust.sats, 1000000);
});

test("rechargement et déconnexion effacent la semaine mise en cache", () => {
  const freshStart = source.indexOf("function freshState()");
  const freshEnd = source.indexOf("\n}", freshStart) + 2;
  const loadStart = source.indexOf("function loadState()");
  const loadEnd = source.indexOf("\n}", loadStart) + 2;
  const globals = { I18N: I, D, navigator: { language: "fr" }, SAVE_KEY: "cache", readToken: () => "token",
    ACC: { readKind: () => "generated" }, localStorage: { getItem: () => JSON.stringify({ expDust: XU.readDustState(payload()) }) } };
  const state = vm.runInNewContext(source.slice(freshStart, freshEnd) + "\n" + source.slice(loadStart, loadEnd)
    + "\n({ fresh: freshState(), loaded: loadState() })", globals);
  assert.equal(state.fresh.expDust, null);
  assert.equal(state.loaded.expDust, null);
  const disconnect = source.slice(source.indexOf("disconnect() {"), source.indexOf("disconnect() {") + 300);
  assert.match(disconnect, /\.\.\.freshState\(\)/);
});
