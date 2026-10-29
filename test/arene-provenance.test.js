/* Lot 3a : contrat facultatif et rendu Arène sans navigateur ni réseau. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const helperContext = { window: {} };
vm.runInNewContext(read("data.js"), helperContext);
vm.runInNewContext(read("expeditions-ui.js"), helperContext);
vm.runInNewContext(read("arene-ui.js"), helperContext);
const U = helperContext.window.FA_ARENE_UI;
const compiled = Babel.transform(read("arene.jsx"), { presets: ["react"], sourceType: "script" }).code;

const team = [
  { id: "a", name: "HashByte" },
  { id: "b", name: "Block", custom_name: "Mon rempart" },
  { id: "c", name: "Ledger" },
];
const posted = { team, hp_left: 100, hp_max: 100, power: 100, best_power: 126, posted_at: new Date(2026, 9, 17, 12).toISOString() };

function render(defense, selected = [], extra = {}) {
  let stateIndex = 0;
  const views = [], toasts = [], selections = [];
  const React = {
    useState: (initial) => {
      const index = stateIndex++;
      return [index === 6 ? defense : initial, () => {}];
    },
    useEffect: () => {},
    useRef: (current) => ({ current }),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const win = {
    FA_ARENE_UI: U,
    FA_DATA: helperContext.window.FA_DATA,
    FA_I18N: { getLang: () => "FR", t: (key, ...args) => [key, ...args].join(" "), localizeServerError: (code) => code },
    useFA: () => ({
      g: { selected, roster: [{ id: "x", name: "Autre équipe" }, { id: "y", name: "Autre deux" }, { id: "z", name: "Autre trois" }], pvp: { league: "diamant" }, ...extra },
      actions: { setView: (view) => views.push(view), selectTopThree: () => selections.push("top3") },
      toast: (...args) => toasts.push(args),
    }),
    cx: (...names) => names.filter(Boolean).join(" "),
    rarityLabel: (rarity) => rarity,
    PostureSelect: "PostureSelect", FaText: "FaText",
  };
  vm.runInNewContext(compiled, { window: win, React });
  const tree = win.Arene();
  const nodes = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    node.children.forEach(walk);
  }
  walk(tree);
  const textOf = (node) => Array.isArray(node) ? node.map(textOf).join("")
    : node && typeof node === "object" ? textOf(node.children)
      : node == null || typeof node === "boolean" ? "" : String(node);
  return { nodes, text: textOf(tree), textOf, views, toasts, selections };
}

test("date posée : formats courts FR/EN/ZH dans le fuseau local", () => {
  // Créer la fixture en heure locale vérifie que le helper ne force pas UTC.
  const date = new Date(2026, 9, 17, 0, 1).toISOString();
  assert.equal(U.defensePostedDate(date, "FR"), "17/10/2026");
  assert.equal(U.defensePostedDate(date, "EN"), "10/17/2026");
  assert.equal(U.defensePostedDate(date, "ZH"), "2026/10/17");
});

test("date absente ou invalide : aucune date de remplacement", () => {
  for (const value of [undefined, null, "", " ", "pas une date", 0, {}, []]) {
    assert.equal(U.defensePostedDate(value, "FR"), null);
  }
});

test("défense dépassée : seuil strictement supérieur à 125 %", () => {
  assert.equal(U.defenseOutdated({ power: 100, best_power: 125 }), false);
  assert.equal(U.defenseOutdated({ power: 100, best_power: 124 }), false);
  assert.equal(U.defenseOutdated({ power: 100, best_power: 125.01 }), true);
  assert.equal(U.defenseOutdated({ power: 0, best_power: 1 }), true);
});

test("puissances facultatives ou invalides : aucun faux avertissement", () => {
  for (const defense of [null, undefined, {}, { power: 100 }, { best_power: 1000 }]) {
    assert.equal(U.defenseOutdated(defense), false);
  }
  for (const invalid of [undefined, null, NaN, Infinity, -1, "100", "", true]) {
    assert.equal(U.defenseOutdated({ power: invalid, best_power: 1000 }), false);
    assert.equal(U.defenseOutdated({ power: 100, best_power: invalid }), false);
  }
});

test("défense posée : noms et date du snapshot, sans invitation rouge même sélection vide ou différente", () => {
  for (const selected of [[], ["x"], ["x", "y", "z"]]) {
    const r = render(posted, selected);
    assert.doesNotMatch(r.text, /AR2_DEFENSE_HINT/);
    const provenance = r.nodes.find((n) => n.props["data-fa"] === "arene-defense-provenance");
    assert.match(r.textOf(provenance), /AR2_DEFENSE_POSTED_AT 17\/10\/2026/);
    assert.match(r.textOf(provenance), /HashByte · Mon rempart · Ledger/);
    assert.doesNotMatch(r.textOf(provenance), /Autre équipe/);
  }
});

test("aucune défense posée : invitation rouge même avec trois entités sélectionnées", () => {
  for (const selected of [[], ["x", "y", "z"]]) {
    const r = render(null, selected);
    assert.match(r.text, /AR2_DEFENSE_HINT/);
    assert.ok(!r.nodes.some((n) => n.props["data-fa"] === "arene-defense-provenance"));
    assert.ok(!r.nodes.some((n) => n.props["data-fa"] === "arene-defense-outdated"));
  }
});

test("ancien serveur : noms et PV restent affichés, date et bandeau absents ; stale reste visible", () => {
  const r = render({ team, hp_left: 80, hp_max: 100, stale: true });
  assert.match(r.text, /HashByte · Mon rempart · Ledger/);
  assert.match(r.text, /AR2_DEFENSE_HP 80 100/);
  assert.match(r.text, /AR2_DEFENSE_STALE/);
  assert.doesNotMatch(r.text, /AR2_DEFENSE_POSTED_AT|AR2_DEFENSE_OUTDATED|AR2_DEFENSE_HINT/);
});

test("bandeau au-dessus des adversaires : Équipe navigue et top-3 sélectionne sans poser automatiquement", () => {
  const r = render(posted);
  const banner = r.nodes.find((n) => n.props["data-fa"] === "arene-defense-outdated");
  assert.ok(banner);
  assert.ok(r.text.indexOf("AR2_DEFENSE_OUTDATED") < r.text.indexOf("AR2_OPPONENTS"));
  const bannerButtons = [];
  function collectButtons(node) {
    if (Array.isArray(node)) return node.forEach(collectButtons);
    if (!node || typeof node !== "object") return;
    if (node.type === "button") bannerButtons.push(node);
    node.children.forEach(collectButtons);
  }
  collectButtons(banner);
  for (const key of ["AR2_OPEN_TEAM", "AR2_TAKE_TOP_THREE"]) {
    const button = bannerButtons.find((n) => r.textOf(n) === key);
    assert.ok(button, key);
    button.props.onClick();
  }
  assert.deepEqual(r.views, ["team"]);
  assert.deepEqual(r.selections, ["top3"]);
  assert.deepEqual(r.toasts, []);
  assert.doesNotMatch(render({ ...posted, best_power: 125 }).text, /AR2_DEFENSE_OUTDATED/);
});

test("poser la défense continue d'exiger trois entités sélectionnées", async () => {
  for (const selected of [[], ["x"]]) {
    const r = render(posted, selected);
    const button = r.nodes.find((n) => n.type === "button" && r.textOf(n) === "AR2_SET_DEFENSE");
    assert.equal(button.props.disabled, true);
    await button.props.onClick();
    assert.deepEqual(r.toasts, [["AR2_NO_DEFENSE", "bad"]]);
  }
});

test("classement : le titre nomme la ligue dans sa couleur", () => {
  const r = render(posted);
  const heading = r.nodes.find((n) => n.type === "span" && n.props.className === "h2" && r.textOf(n).startsWith("AR2_LADDER"));
  assert.equal(r.textOf(heading), "AR2_LADDERAR2_LADDER_LEAGUE Diamant");
  const league = heading.children.find((n) => n && n.type === "span");
  assert.equal(league.props.style.color, U.leagueColor("diamant"));
});

test("classement : rang serveur, effectif, identité prioritaire et pastilles de ligue", () => {
  const ladder = Array.from({ length: 14 }, (_, i) => ({ rank: i + 1, player_id: "p" + i, name: "Joueur " + i, rating: 1051 }));
  ladder[0].wallet = "mon-wallet"; // L'adresse ne doit pas primer sur l'identifiant opaque.
  ladder[3].player_id = "moi";
  ladder.reverse(); // Le rang ne doit pas être recalculé depuis l'index client.
  const r = render(posted, [], { publicId: "moi", wallet: "mon-wallet", pvp: { league: "argent", ladder } });
  assert.match(r.text, /AR2_LADDER_POSITION 4 14 Argent/);
  const rows = r.nodes.filter((n) => n.type === "div" && n.props.className === "flex between center wrap" && ladder.some((row) => row.player_id === n.props.key));
  assert.equal(rows.length, 14);
  const highlighted = rows.filter((n) => n.props.style.background !== "transparent");
  assert.equal(highlighted.length, 1);
  assert.match(r.textOf(highlighted[0]), /^4\. ➔ Joueur 3/);
  for (const row of rows) {
    const label = row.children.find((n) => n && n.type === "span");
    const dot = label.children[0];
    assert.equal(dot.props["aria-hidden"], "true");
    assert.equal(dot.props.style.background, U.leagueColor("argent"));
    assert.equal(typeof label.children[1], "number", "la pastille précède le rang");
  }
});

test("classement : repli wallet, aucun rang inventé si joueur absent, liste vide ou ligue inconnue", () => {
  const row = { rank: 7, wallet: "mon-wallet", name: "Moi", rating: 1051 };
  const r = render(posted, [], { wallet: "mon-wallet", pvp: { league: "bronze", ladder: [row] } });
  assert.match(r.text, /AR2_LADDER_POSITION 7 1 Bronze/);
  assert.match(r.text, /7\. ➔ Moi/);
  for (const pvp of [{ league: "bronze", ladder: [row] }, { league: "bronze", ladder: [] }, { ladder: [row] }]) {
    const absent = render(posted, [], { wallet: "autre-wallet", pvp });
    assert.doesNotMatch(absent.text, /AR2_LADDER_POSITION/);
  }
  const unknown = render(posted, [], { wallet: "mon-wallet", pvp: { ladder: [row] } });
  assert.doesNotMatch(unknown.text, /AR2_LADDER_POSITION|AR2_LADDER_LEAGUE/);
});
