/* Écran réel et handlers quiz, exécutés sans DOM et sans réseau. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("app.jsx");
const academy = read("academie.jsx");
const compiled = [academy, read("quiz.jsx")].map((code) =>
  Babel.transform(code, { presets: ["react"], sourceType: "script" }).code);
const API_URL = "https://academy.test.invalid";
const moduleData = (id = "module &/一", progress = null) => ({
  id, order: 1, title: "Titre serveur " + id, tagline: "Accroche serveur",
  lessons: [
    { id: "fiche-a", title: "Fiche A", minutes: 3,
      body: ["<img src=x onerror=alert(1)>", "Paragraphe fourni par le mock serveur."],
      sources: ["https://example.org/source", "javascript:alert(1)"] },
    { id: "fiche-b", title: "Fiche B", minutes: 2, body: ["Suite serveur"], sources: [] },
  ],
  exam: { question_count: 7, question_ids: ["q1"] }, progress,
});
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.children)] : [];
}
function textOf(tree) {
  if (Array.isArray(tree)) return tree.map(textOf).join("");
  if (tree && typeof tree === "object") return textOf(tree.children);
  return tree == null || typeof tree === "boolean" ? "" : String(tree);
}

function harness({ root = "Academie", wallet = "wallet &/一", lang = "FR", fetcher } = {}) {
  let g = { wallet, lang }, tree, current, hookIndex;
  const instances = new Map(), listeners = new Map(), timers = new Set();
  const calls = [], toasts = [];
  const win = {
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); },
  };
  const context = {
    window: win, API_URL, encodeURIComponent,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setInterval(fn) { timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); },
    fetch: async (url) => {
      calls.push(url);
      if (fetcher) return fetcher(new URL(url));
      const u = new URL(url), module = moduleData();
      if (u.pathname === "/academy/modules") return response({ modules: [{ ...module, question_count: 7 }] });
      if (u.pathname.startsWith("/academy/module/")) return response({ module });
      if (u.pathname.startsWith("/quiz/next/")) return response({ question: { id: "q1", q: "Question serveur", c: ["A", "B"] } });
      assert.fail("appel inattendu : " + url);
    },
    gRef: { get current() { return g; } },
  };
  vm.createContext(context);
  vm.runInContext(read("i18n.js"), context);
  vm.runInContext(read("quiz-ui.js"), context);
  const I = win.FA_I18N;
  I.setLang(lang);
  context.I18N = I;
  const actions = { answerQuiz: async () => ({ ok: true, data: { correct: true, reward: 0 } }) };
  for (const name of ["fetchAcademyModules", "fetchAcademyModule", "fetchQuizQuestion"]) {
    const start = app.indexOf(`    async ${name}(`);
    const end = app.indexOf("\n    },", start) + "\n    }".length;
    assert.ok(start >= 0 && end > start);
    actions[name] = vm.runInContext(`({${app.slice(start, end)}}).${name}`, context);
  }
  const React = {
    Fragment: "fragment",
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const instance = current, i = hookIndex++;
      if (!(i in instance.hooks)) instance.hooks[i] = typeof initial === "function" ? initial() : initial;
      return [instance.hooks[i], (next) => {
        instance.hooks[i] = typeof next === "function" ? next(instance.hooks[i]) : next;
      }];
    },
    useRef(initial) {
      const i = hookIndex++;
      if (!(i in current.hooks)) current.hooks[i] = { current: initial };
      return current.hooks[i];
    },
    useEffect(fn, deps) {
      const i = hookIndex++, previous = current.hooks[i];
      if (!previous || !deps || deps.some((d, j) => !Object.is(d, previous.deps[j]))) {
        const effect = { deps, fn, cleanup: previous?.cleanup };
        current.hooks[i] = effect;
        current.pending.push(effect);
      }
    },
  };
  Object.assign(win, {
    useFA: () => ({ g, actions, toast: (...args) => toasts.push(args) }),
    cx: (...args) => args.filter(Boolean).join(" "),
    SectionHead: ({ title }) => React.createElement("h1", null, title),
    FaText: "FaText", TokenIcon: "TokenIcon",
  });
  context.React = React;
  compiled.forEach((code) => vm.runInContext(`(function(){${code}\n})();`, context));
  function render() {
    const used = new Set();
    function expand(node, position) {
      if (Array.isArray(node)) return node.map((n, i) => expand(n, position + "/" + i));
      if (!node || typeof node !== "object") return node;
      if (typeof node.type === "function") {
        const key = position + ":" + node.type.name + ":" + (node.props.key || "");
        used.add(key);
        if (!instances.has(key)) instances.set(key, { hooks: [], pending: [] });
        current = instances.get(key);
        hookIndex = 0;
        return expand(node.type(node.props), key);
      }
      return { ...node, children: expand(node.children, position) };
    }
    tree = expand(React.createElement(win[root]), "root");
    for (const [key, instance] of instances) {
      if (!used.has(key)) {
        instance.hooks.forEach((h) => h?.cleanup?.());
        instances.delete(key);
      }
    }
    for (const instance of instances.values()) {
      for (const effect of instance.pending.splice(0)) {
        effect.cleanup?.();
        effect.cleanup = effect.fn();
      }
    }
    return tree;
  }
  async function settle() {
    for (let i = 0; i < 8; i++) { await new Promise(setImmediate); render(); }
    return tree;
  }
  render();
  return {
    win, actions, calls, toasts, I, render, settle,
    get tree() { return tree; }, nodes: () => nodes(tree),
    button: (text) => nodes(tree).find((n) => n.type === "button" && textOf(n) === text),
    async click(node) {
      assert.ok(node, "contrôle présent"); assert.ok(!node.props.disabled, "contrôle actif");
      node.props.onClick(); render(); await settle();
    },
    dispatch(module) { win.dispatchEvent({ type: "fa:open-quiz", detail: module ? { module } : undefined }); },
    async tick() { for (const fn of [...timers]) fn(); render(); await settle(); },
    async identity(next) { g = { ...g, ...next }; I.setLang(g.lang); render(); await settle(); },
  };
}

test("Académie : composant window, VIEWS, onglet Plus et chargement du build", () => {
  const h = harness();
  assert.equal(typeof h.win.Academie, "function");
  const imports = app.match(/const \{ Team,[^;]+\} = window;/)[0];
  const window = new Proxy(h.win, { get: (obj, key) => obj[key] || function Screen() {} });
  const views = app.match(/const VIEWS = \{[^;]+\};/)[0];
  assert.equal(vm.runInNewContext(`${imports}\n${views}\nVIEWS.academie`, { window }), h.win.Academie);
  const tabs = vm.runInNewContext(app.match(/const tabs = \[[\s\S]+?\n  \];/)[0] + "\ntabs");
  assert.ok(tabs.some(([key, label]) => key === "academie" && label === "NAV_ACADEMIE"));
  assert.ok(!app.match(/const MAIN = (\[[^;]+\]);/)[1].includes("academie"));
  const html = read("index.html");
  assert.ok(html.indexOf("build/academie.js") > html.indexOf("build/components.js"));
  assert.ok(html.indexOf("build/academie.js") < html.indexOf("build/app.js"));
  assert.equal((app.match(/k === "academie" \? "quests" : k/g) || []).length, 0,
    "l'icône d'Académie est un asset dédié : plus aucun écran n'en emprunte une autre");
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets/nav-icons/academie.png")),
    "assets/nav-icons/academie.png doit exister, sinon la tuile rend un carré vide");
});

test("toutes les nouvelles clés existent en FR, EN et ZH", () => {
  const h = harness();
  const keys = ["NAV_ACADEMIE", ...new Set((academy + read("quiz.jsx")).match(/ACADEMY_[A-Z_]+/g))];
  for (const key of keys) for (const lang of ["FR", "EN", "ZH"]) {
    assert.ok(h.I.T[key]?.[lang]?.trim(), `${key}/${lang}`);
  }
});

test("URLs API : base commune, langues, encodage et wallet facultatif", async () => {
  for (const lang of ["FR", "EN", "ZH"]) {
    const h = harness({ lang });
    await h.actions.fetchAcademyModules();
    await h.actions.fetchAcademyModule("id &/一");
    for (const raw of h.calls) {
      const url = new URL(raw);
      assert.equal(url.origin, API_URL); assert.equal(url.searchParams.get("lang"), lang);
    }
    const detail = new URL(h.calls.at(-1));
    assert.equal(detail.pathname, "/academy/module/" + encodeURIComponent("id &/一"));
    assert.equal(detail.searchParams.get("wallet"), "wallet &/一");
  }
  const guest = harness({ wallet: null });
  await guest.actions.fetchAcademyModule("a");
  assert.equal(new URL(guest.calls.at(-1)).searchParams.has("wallet"), false);
});

test("catalogue ordonné, progression serveur et module verrouillé cliquable", async () => {
  const modules = [moduleData("last", { unlocked: false, correct: 0 }),
    moduleData("first", { unlocked: true, exam_passed: true, correct: 7 }),
    moduleData("middle", { unlocked: true, exam_passed: false, correct: 2 })];
  modules.forEach((m, i) => { m.order = [3, 1, 2][i]; m.question_count = 7; });
  const h = harness({ fetcher: (u) => response(u.pathname === "/academy/modules"
    ? { modules } : { module: modules.find((m) => u.pathname.endsWith(m.id)) }) });
  await h.settle();
  const cards = h.nodes().filter((n) => n.type === "button" && n.props.className.includes("q-row"));
  assert.deepEqual(cards.map((n) => textOf(nodes(n).find((child) => child.props.className === "q-name"))),
    ["Titre serveur first", "Titre serveur middle", "Titre serveur last"]);
  assert.match(textOf(cards[0]), /Examen passé/);
  assert.match(textOf(cards[1]), /En cours/);
  assert.match(textOf(cards[2]), /Verrouillé/);
  await h.click(cards[2]);
  assert.ok(h.nodes().some((n) => n.props["aria-expanded"] === true));
  assert.equal(h.button(h.I.t("ACADEMY_EXAM")).props.disabled, true);
  await h.click(h.button(h.I.t("ACADEMY_BACK")));
  assert.match(textOf(h.tree), /Titre serveur first/);
});

test("fiches en texte, accordéon, sources sûres et examen actif sans progression", async () => {
  const h = harness({ wallet: null });
  await h.settle();
  assert.doesNotMatch(textOf(h.tree), /En cours|Verrouillé|0\/7/);
  await h.click(h.nodes().find((n) => n.type === "button" && n.props.className === "q-row"));
  const lessonButtons = () => h.nodes().filter((n) => "aria-expanded" in n.props);
  assert.deepEqual(lessonButtons().map((n) => n.props["aria-expanded"]), [true, false]);
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  assert.ok(h.nodes().some((n) => n.type === "p" && textOf(n) === "<img src=x onerror=alert(1)>"));
  const links = h.nodes().filter((n) => n.type === "a");
  assert.equal(links.length, 1);
  assert.equal(links[0].props.target, "_blank");
  assert.equal(links[0].props.rel, "noopener noreferrer");
  await h.click(lessonButtons()[1]);
  assert.deepEqual(lessonButtons().map((n) => n.props["aria-expanded"]), [false, true]);
  const exam = h.button(h.I.t("ACADEMY_EXAM"));
  assert.equal(exam.props.disabled, false);
  assert.match(exam.props.className, /\bsolid\b/);
  assert.doesNotMatch(textOf(h.tree), /0\/7/);
  let opened;
  h.win.addEventListener("fa:open-quiz", (event) => { opened = event.detail.module; });
  await h.click(exam);
  assert.equal(opened.id, moduleData().id);
});

test("quiz existant sans detail : aucun paramètre module", async () => {
  const h = harness({ root: "QuizToast" });
  await h.tick(); h.dispatch(); await h.settle();
  const quizCalls = h.calls.filter((url) => url.includes("/quiz/next/"));
  assert.equal(quizCalls.length, 1);
  assert.equal(new URL(quizCalls[0]).searchParams.has("module"), false);
  assert.equal(h.calls.some((url) => url.includes("/academy/")), false);
  assert.match(textOf(h.tree), /Question serveur/);
});

test("examen scoppé immédiat, une seule requête, titre et score serveur actualisé", async () => {
  let correct = 2;
  const module = () => moduleData("scope &/一", { correct, unlocked: true });
  const h = harness({ root: "QuizToast", fetcher: (url) => response(url.pathname.startsWith("/academy/")
    ? { module: module() } : { question: { id: "q1", q: "Question", c: ["A", "B"] } }) });
  h.dispatch(module()); h.dispatch(module()); await h.settle();
  const quizCalls = h.calls.filter((url) => url.includes("/quiz/next/"));
  assert.equal(quizCalls.length, 1);
  assert.equal(new URL(quizCalls[0]).searchParams.get("module"), module().id);
  assert.match(textOf(h.tree), /Titre serveur scope/);
  assert.match(textOf(h.tree), /2\/7 bonnes réponses/);
  correct = 3;
  await h.click(h.button("A"));
  assert.match(textOf(h.tree), /3\/7 bonnes réponses/);
  await h.click(h.nodes().find((n) => n.props.className === "quiz-close"));
  h.dispatch("scope &/一"); await h.settle();
  assert.equal(new URL(h.calls.at(-1)).searchParams.get("module"), module().id);
});

test("examen verrouillé vérifié sur le serveur, pas de question tirée", async () => {
  const h = harness({ root: "QuizToast", fetcher: () => response({ module: moduleData("a", { unlocked: false }) }) });
  h.dispatch("a"); await h.settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.toasts[0][0], h.I.t("ACADEMY_LOCKED_HELP"));
});

test("quiz sans progression : aucun score inventé ; sans wallet : invitation à se connecter", async () => {
  const h = harness({ root: "QuizToast" });
  h.dispatch(moduleData()); await h.settle();
  assert.match(textOf(h.tree), /Titre serveur/);
  assert.doesNotMatch(textOf(h.tree), /0\/7/);
  const guest = harness({ root: "QuizToast", wallet: null });
  guest.dispatch("a"); await guest.settle();
  assert.equal(guest.calls.length, 0);
  assert.equal(guest.toasts[0][0], guest.I.t("ACADEMY_CONNECT"));
});

test("catalogue vide, erreur réseau et détail 404 ont des états explicites", async () => {
  const empty = harness({ fetcher: () => response({ modules: [] }) });
  await empty.settle(); assert.match(textOf(empty.tree), /Aucun module/);
  let failed = true;
  const error = harness({ fetcher: () => { if (failed) throw new Error("offline"); return response({ modules: [] }); } });
  await error.settle(); assert.match(textOf(error.tree), /Académie indisponible/);
  failed = false; await error.click(error.button(error.I.t("ACADEMY_RETRY")));
  assert.match(textOf(error.tree), /Aucun module/);
  const missing = harness({ fetcher: (url) => url.pathname === "/academy/modules"
    ? response({ modules: [{ ...moduleData(), question_count: 7 }] }) : response({ error: "Module inconnu" }, 404) });
  await missing.settle();
  await missing.click(missing.nodes().find((n) => n.type === "button" && n.props.className === "q-row"));
  assert.match(textOf(missing.tree), /module est introuvable/);
  assert.ok(missing.button(missing.I.t("ACADEMY_BACK")));
});

test("changer de langue ignore une ancienne réponse de catalogue", async () => {
  let resolveOld;
  const h = harness({ wallet: null, fetcher: (url) => url.searchParams.get("lang") === "FR"
    ? new Promise((resolve) => { resolveOld = resolve; })
    : response({ modules: [{ ...moduleData("EN"), question_count: 7 }] }) });
  await h.identity({ lang: "EN" });
  resolveOld(response({ modules: [{ ...moduleData("FR"), question_count: 7 }] }));
  await h.settle();
  assert.match(textOf(h.tree), /Titre serveur EN/);
  assert.doesNotMatch(textOf(h.tree), /Titre serveur FR/);
});

test("changer de compte ignore une question en vol et permet la suivante", async () => {
  let resolveQuestion;
  const h = harness({ root: "QuizToast", fetcher: (url) => url.pathname.startsWith("/academy/")
    ? response({ module: moduleData("a") })
    : new Promise((resolve) => { resolveQuestion = resolve; }) });
  h.dispatch("a"); await h.settle();
  await h.identity({ wallet: "autre" });
  resolveQuestion(response({ question: { id: "old", q: "Question périmée", c: [] } }));
  await h.settle();
  assert.doesNotMatch(textOf(h.tree), /Question périmée/);
  h.dispatch("a"); await h.settle();
  resolveQuestion(response({ question: { id: "new", q: "Nouvelle question", c: [] } }));
  await h.settle();
  assert.match(textOf(h.tree), /Nouvelle question/);
});

test("garde anti-contenu : pas de longs littéraux ni de paragraphes locaux", () => {
  const ast = Babel.transform(academy, { ast: true, code: false, presets: ["react"] }).ast;
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "StringLiteral") assert.ok(node.value.length <= 80, node.value);
    if (node.type === "TemplateElement") assert.ok(node.value.raw.length <= 80, node.value.raw);
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "comments", "leadingComments", "trailingComments", "innerComments"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === "object") walk(value);
    }
  }
  walk(ast);
  assert.match(academy, /lesson\.body\.map\(\(paragraph, i\) => <p key=\{i\}>\{paragraph\}<\/p>\)/);
  assert.doesNotMatch(academy, /dangerouslySetInnerHTML|\bbody\s*:\s*\[/);
});
