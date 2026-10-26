/* Lot 3c : vrais handlers JSX et actions du store, sans navigateur ni serveur. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const compiled = Babel.transform(read("arene.jsx"), { presets: ["react"], sourceType: "script" }).code;
const source = read("app.jsx");

function beast(id, hp, level = 1, rarity = "Common") {
  return { id, name: `Entité ${id}`, level, rarity, type: "HASH", base_hp: hp,
    base_atk: 10, base_def: 10, base_spd: 10, base_mag: 10 };
}
const roster = [beast("a", 10), beast("b", 20), beast("c", 30), beast("d", 40, 4), beast("e", 90, 7, "Rare"), beast("f", 70, 8)];
const posted = { team: [beast("posted-a", 12), beast("posted-b", 16), beast("posted-c", 18)],
  hp_left: 80, hp_max: 100, power: 100, best_power: 150, stale: true,
  posted_at: "2026-10-17T12:00:00.000Z" };

function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object") return textOf(node.children);
  return node == null || typeof node === "boolean" ? "" : String(node);
}
function descendants(tree) {
  const result = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    result.push(node);
    node.children.forEach(walk);
  };
  walk(tree);
  return result;
}

function arena({ selected = ["a", "b", "c"], entities = roster, defense = posted, busy = false, lang = "FR" } = {}) {
  let g = { selected: [...selected], roster: [...entities], pvp: {}, wallet: "mine", publicId: "player-mine" };
  const calls = [], states = [], refs = [];
  let stateIndex = 0, refIndex = 0, tree;
  const context = { window: {}, fetch: () => assert.fail("aucun appel réseau pendant une sélection") };
  for (const file of ["data.js", "i18n.js", "expeditions-ui.js", "arene-ui.js"]) vm.runInNewContext(read(file), context);
  const win = context.window, I = win.FA_I18N;
  I.setLang(lang);
  const React = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = index === 6 ? defense : index === 1 ? busy : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef(current) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current };
      return refs[index];
    },
    useEffect() {}, // Chargements et timer ne font pas partie du geste de sélection.
    useMemo: (fn) => fn(),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const actionContext = { window: win, setG: (update) => { g = update(g); }, fetch: context.fetch };
  const actions = {};
  for (const name of ["toggleSelect", "pvpReorderDefense", "replaceSelected", "selectTopThree"]) {
    const start = source.indexOf(`    ${name}(`);
    assert.ok(start >= 0, `${name} doit exister`);
    const end = source.indexOf("\n    },", start) + "\n    }".length;
    const action = vm.runInNewContext(`({${source.slice(start, end)}}).${name}`, actionContext);
    actions[name] = (...args) => { calls.push([name, ...args]); return action(...args); };
  }
  const guardedActions = new Proxy(actions, {
    get(target, name) {
      if (name in target) return target[name];
      return () => assert.fail(`action inattendue pendant la sélection : ${String(name)}`);
    },
  });
  Object.assign(win, {
    useFA: () => ({ g, actions: guardedActions, toast: () => assert.fail("toast inattendu") }),
    cx: (...names) => names.filter(Boolean).join(" "), fmt: (n) => String(n),
    rarityLabel: (rarity) => I.t(rarity),
    PostureSelect: "PostureSelect", FaText: "FaText",
  });
  vm.runInNewContext(compiled, { ...context, React });
  const render = () => { stateIndex = 0; refIndex = 0; tree = win.Arene(); return tree; };
  const nodes = () => descendants(tree);
  const tagged = (tag) => nodes().filter((n) => n.props["data-fa"] === tag);
  const button = (key) => nodes().find((n) => n.type === "button" && textOf(n) === I.t(key));
  const click = (node) => {
    assert.ok(node, "bouton rendu");
    assert.ok(!node.props.disabled, "bouton utilisable");
    node.props.onClick();
    render();
  };
  render();
  return { I, D: win.FA_DATA, U: win.FA_ARENE_UI, calls, render, tagged, button, click,
    get g() { return g; }, setRoster: (next) => { g = { ...g, roster: next }; render(); },
    slot: (index) => tagged("arene-defense-slot").find((n) => n.props["data-slot"] === index),
    candidates: () => tagged("arene-defense-candidate"),
    panel: () => tagged("arene-defense-replacements")[0],
  };
}

test("chaque emplacement ouvre les remplaçants triés et exclut toute la sélection", () => {
  for (const index of [0, 1, 2]) {
    const r = arena();
    assert.equal(r.tagged("arene-defense-slot").length, 3);
    r.click(r.slot(index));
    assert.ok(r.panel());
    assert.deepEqual(r.candidates().map((n) => n.props["data-id"]), ["e", "f", "d"]);
    assert.deepEqual(r.calls, []);
  }
});

test("les remplaçants affichent niveau, rareté, PV, puissance et le rappel de l'emplacement", () => {
  const r = arena();
  r.click(r.slot(1));
  const candidate = r.candidates().find((n) => n.props["data-id"] === "e");
  assert.match(textOf(candidate), /Entité e/);
  assert.ok(textOf(candidate).includes(r.I.t("AR2_ENTITY_STATS", 7, r.I.t("Rare"), r.D.maxHp(roster[4]))));
  assert.ok(textOf(candidate).includes(r.I.t("AR2_POWER", Math.round(r.U.entityPower(roster[4])))));
  assert.ok(textOf(r.panel()).includes(r.I.t("AR2_SLOT_POWER", Math.round(r.U.entityPower(roster[1])))));
});

test("choisir remplace uniquement l'emplacement demandé, conserve l'ordre et referme", () => {
  for (const index of [0, 1, 2]) {
    const r = arena();
    const initialRoster = r.g.roster;
    r.click(r.slot(index));
    r.click(r.candidates().find((n) => n.props["data-id"] === "d"));
    const expected = ["a", "b", "c"];
    expected[index] = "d";
    assert.deepEqual(Array.from(r.g.selected), expected);
    assert.equal(r.g.roster, initialRoster);
    assert.deepEqual(r.calls, [["replaceSelected", index, "d"]]);
    assert.equal(r.panel(), undefined);
  }
});

test("Annuler referme sans modifier la sélection ni appeler une action", () => {
  const r = arena();
  const initial = r.g;
  r.click(r.slot(2));
  r.click(r.button("AR2_REPLACEMENT_CANCEL"));
  assert.equal(r.g, initial);
  assert.deepEqual(r.calls, []);
  assert.equal(r.panel(), undefined);
});

test("une formation incomplète garde trois emplacements et ajoute avec toggleSelect", () => {
  for (const selected of [[], ["a"], ["a", "b"]]) {
    for (const index of [0, 1, 2]) {
      const r = arena({ selected, defense: null });
      assert.equal(r.tagged("arene-defense-slot").length, 3);
      assert.equal(r.button("AR2_SET_DEFENSE").props.disabled, true);
      r.click(r.slot(index));
      r.click(r.candidates().find((n) => n.props["data-id"] === "e"));
      assert.deepEqual(Array.from(r.g.selected), [...selected, "e"]);
      assert.deepEqual(r.calls, [["toggleSelect", "e"]]);
      assert.equal(r.panel(), undefined);
      assert.equal(r.button("AR2_SET_DEFENSE").props.disabled, selected.length !== 2);
    }
  }
});

test("l'entrée Choisir mes 3 entités ouvre le choix sur place puis permet d'ajouter", () => {
  const r = arena({ selected: [], defense: null });
  r.click(r.button("AR2_CHOOSE_THREE"));
  assert.ok(r.panel());
  assert.equal(r.candidates().length, roster.length);
  r.click(r.candidates().find((n) => n.props["data-id"] === "e"));
  assert.deepEqual(Array.from(r.g.selected), ["e"]);
  assert.deepEqual(r.calls, [["toggleSelect", "e"]]);
  assert.equal(r.panel(), undefined);
});

test("la liste suit le roster courant : une entité fusionnée ou retirée disparaît", () => {
  const r = arena();
  r.click(r.slot(0));
  r.setRoster(r.g.roster.filter((b) => b.id !== "e"));
  assert.deepEqual(r.candidates().map((n) => n.props["data-id"]), ["f", "d"]);
  assert.deepEqual(r.calls, []);
});

test("sans remplaçant, le panneau reste refermable sans changer l'équipe", () => {
  const r = arena({ entities: roster.slice(0, 3) });
  r.click(r.slot(1));
  assert.ok(r.panel());
  assert.equal(r.candidates().length, 0);
  r.click(r.button("AR2_REPLACEMENT_CANCEL"));
  assert.deepEqual(Array.from(r.g.selected), ["a", "b", "c"]);
});

test("top-3 choisit réellement les plus puissants dans l'ordre, y compris avec recoupement", () => {
  for (const selected of [[], ["b"], ["e", "b", "d"], ["a", "b", "c"]]) {
    const r = arena({ selected });
    r.click(r.slot(0));
    r.click(r.button("AR2_TAKE_TOP_THREE"));
    assert.deepEqual(Array.from(r.g.selected), ["e", "f", "d"]);
    assert.deepEqual(r.calls, [["selectTopThree"]]);
    assert.equal(r.panel(), undefined);
    assert.equal(r.button("AR2_SET_DEFENSE").props.disabled, false);
  }
});

test("le top-3 du bandeau de défense dépassée agit aussi dans l'Arène", () => {
  const r = arena();
  const banner = r.tagged("arene-defense-outdated")[0];
  const top = descendants(banner).find((n) => n.type === "button" && textOf(n) === r.I.t("AR2_TAKE_TOP_THREE"));
  r.click(top);
  assert.deepEqual(Array.from(r.g.selected), ["e", "f", "d"]);
  assert.deepEqual(r.calls, [["selectTopThree"]]);
});

test("top-3 est désactivé avec moins de trois entités du roster", () => {
  for (const count of [0, 1, 2]) {
    const r = arena({ entities: roster.slice(0, count), selected: [] });
    assert.equal(r.button("AR2_TAKE_TOP_THREE").props.disabled, true);
  }
});

test("les gestes de sélection gardent provenance, PV et avertissement de la défense postée", () => {
  const r = arena();
  const snapshot = () => ["arene-defense-provenance", "arene-defense-hp", "arene-defense-outdated"]
    .map((tag) => textOf(r.tagged(tag)[0]));
  const before = snapshot();
  r.click(r.slot(1));
  r.click(r.candidates()[0]);
  assert.deepEqual(snapshot(), before);
  r.click(r.button("AR2_TAKE_TOP_THREE"));
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(r.calls.map((c) => c[0]), ["replaceSelected", "selectTopThree"]);
});

test("un enregistrement en cours désactive les emplacements et le top-3", () => {
  const r = arena({ busy: true });
  assert.ok(r.tagged("arene-defense-slot").every((n) => n.props.disabled));
  assert.equal(r.button("AR2_TAKE_TOP_THREE").props.disabled, true);
});

test("le choix d'un remplaçant fonctionne avec les libellés FR, EN et ZH", () => {
  for (const lang of ["FR", "EN", "ZH"]) {
    const r = arena({ lang });
    r.click(r.slot(0));
    assert.doesNotMatch(textOf(r.panel()), /AR2_[A-Z_]+|%[sd]/);
    r.click(r.button("AR2_REPLACEMENT_CANCEL"));
    assert.equal(r.panel(), undefined);
  }
});
