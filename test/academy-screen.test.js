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

function harness({ root = "Academie", wallet = "wallet &/一", lang = "FR", fetcher, props } = {}) {
  let g = { wallet, lang }, tree, current, hookIndex;
  const instances = new Map(), listeners = new Map(), timers = new Set();
  const calls = [], toasts = [], views = [];
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
    setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); },
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
  const actions = { answerQuiz: async () => ({ ok: true, data: { correct: true, reward: 0 } }), setView: (v) => views.push(v) };
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
    tree = expand(React.createElement(win[root], props), "root");
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
    win, actions, calls, toasts, views, I, render, settle,
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
  // Un examen s'ouvre DANS l'écran : le bouton ne diffuse plus rien à la bulle,
  // il remplace les fiches par les questions.
  let diffuse = false;
  h.win.addEventListener("fa:open-quiz", () => { diffuse = true; });
  await h.click(exam);
  assert.equal(diffuse, false, "l'examen ne passe plus par la bulle");
  assert.equal(h.nodes().filter((n) => "aria-expanded" in n.props).length, 0,
    "l'écran d'examen remplace les fiches");
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

test("Académie : la fiche demandée depuis le résultat du quiz s'ouvre directement", async () => {
  const h = harness();
  // Le joueur répond dans la modale (autre écran), puis clique « Lire la fiche » :
  // la demande arrive AVANT que l'écran Académie ne soit monté côté navigateur —
  // ici il l'est déjà, et le module demandé doit être chargé sans passer par la liste.
  h.win.dispatchEvent({ type: "fa:academy-module", detail: { module: "minage" } });
  await h.settle();
  const asked = h.calls.map((u) => new URL(u).pathname).filter((p) => p.startsWith("/academy/module/"));
  assert.ok(asked.includes("/academy/module/minage"), `le module demandé doit être chargé : ${asked.join(", ")}`);
  // Et la demande ne survit pas à la lecture : elle ne doit pas rouvrir le module
  // à chaque montage suivant (retour à la liste, changement de langue).
  h.win.dispatchEvent({ type: "fa:academy-module", detail: {} });
  await h.settle();
  assert.equal(h.calls.filter((u) => new URL(u).pathname === "/academy/module/undefined").length, 0);
});


test("mauvaise réponse : « Lire la fiche » affiche la fiche DANS la bulle", async () => {
  const h = harness({ root: "QuizToast" });
  h.actions.answerQuiz = async () => ({
    ok: true,
    data: { correct: false, reward: 0, explanation: "Explication serveur", module_id: "minage" },
  });
  await h.tick(); h.dispatch(); await h.settle();
  await h.click(h.button("A"));

  const lien = h.nodes().find((n) => n.props.className === "quiz-to-lesson");
  assert.ok(lien, "sur une mauvaise réponse, le lien vers la fiche apparaît");
  await h.click(lien);

  // Le clic a un effet visible, local : la fiche se lit sous l'explication.
  assert.ok(h.calls.map((u) => new URL(u).pathname).includes("/academy/module/minage"),
    "la fiche du module de la question est demandée");
  assert.match(textOf(h.tree), /Titre serveur/, "le module s'affiche");
  assert.match(textOf(h.tree), /Paragraphe fourni par le mock serveur/, "le corps de la fiche s'affiche");
  assert.match(textOf(h.tree), /example\.org/, "les sources restent citées");
  assert.ok(h.nodes().some((n) => n.props.className === "quiz-q"),
    "la question reste au-dessus : on lit sans changer d'écran");
  assert.equal(h.nodes().some((n) => n.props.className === "quiz-to-lesson"), false,
    "le lien laisse la place à la fiche");
});

test("fiche indisponible : le clic affiche l'erreur, il ne fait jamais rien", async () => {
  const h = harness({ root: "QuizToast", fetcher: (url) => {
    if (url.pathname.startsWith("/academy/")) return response({}, 500);
    return response({ question: { id: "q1", q: "Question", c: ["A", "B"] } });
  } });
  h.actions.answerQuiz = async () => ({
    ok: true,
    data: { correct: false, reward: 0, explanation: "Explication serveur", module_id: "minage" },
  });
  await h.tick(); h.dispatch(); await h.settle();
  await h.click(h.button("A"));
  await h.click(h.nodes().find((n) => n.props.className === "quiz-to-lesson"));
  assert.match(textOf(h.tree), /Académie indisponible/, "l'échec réseau est dit en clair");
});

test("la fiche ne s'ouvre qu'après l'arbitrage, et le décompte l'épargne", () => {
  const quiz = read("quiz.jsx");
  assert.match(quiz, /verdict\.module_id/, "le champ serveur module_id est lu");
  assert.match(quiz, /!choixEnAttente && verdict\.module_id && !fiche/,
    "le lien n'apparaît qu'une fois garder/offrir tranché");
  // Sans cette garde, les 30 s emportent la fiche que le joueur est en train de lire.
  assert.match(quiz, /if \(ficheRef\.current\) return;/, "le décompte n'emporte pas une fiche ouverte");
  assert.match(quiz, /actions\.fetchAcademyModule\(verdict\.module_id\)/,
    "la fiche vient du serveur, pas d'un texte local");
});

// L'examen d'un module : un écran qui enchaîne les questions. La bulle reste
// pour la question surprise ; un examen, lui, se joue jusqu'à la note.
const examModule = (total = 2) => ({
  id: "mine", order: 1, title: "Titre serveur mine", tagline: "Accroche serveur",
  lessons: [{ id: "fiche-a", title: "Fiche A", minutes: 3, body: ["Texte serveur"], sources: [] }],
  exam: { question_count: total, question_ids: [] },
  question_count: total, progress: null,
});

test("examen d'un module : enchaînement, bonne réponse, note finale", async () => {
  let posees = 0;
  const h = harness({
    root: "AcademyExam",
    props: { module: examModule(2), onClose: () => {} },
    fetcher: (u) => {
      if (u.pathname.startsWith("/quiz/next/")) {
        posees += 1;
        return response({ question: { id: "q" + posees, q: "Question " + posees, c: ["Choix A", "Choix B"] } });
      }
      assert.fail("appel inattendu : " + u.pathname);
    },
  });

  await h.settle();
  assert.match(textOf(h.tree), /Question 1 \/ 2/, "la progression s'affiche");

  const reponses = [
    { correct: true, reward: 10, answer: 0, explanation: "Parce que le protocole.", source: "https://example.org/preuve-1" },
    { correct: false, reward: 0, answer: 1, explanation: "Parce que le bloc.", source: "https://example.org/preuve-2" },
  ];
  h.actions.answerQuiz = async () => ({ ok: true, data: reponses.shift() });

  await h.click(h.button("Choix A"));
  assert.match(textOf(h.tree), /Bonne réponse/);
  assert.doesNotMatch(textOf(h.tree), /La bonne réponse/, "quand c'est juste, on ne récite pas la réponse");

  await h.click(h.button("Question suivante"));
  assert.match(textOf(h.tree), /Question 2 \/ 2/, "on enchaîne sur la suivante sans quitter l'écran");

  await h.click(h.button("Choix A"));
  assert.match(textOf(h.tree), /Mauvaise réponse/);
  assert.match(textOf(h.tree), /La bonne réponse : Choix B/);
  assert.match(textOf(h.tree), /preuve-2/, "la source de la bonne réponse est citée");

  await h.click(h.button("Voir ma note"));
  assert.match(textOf(h.tree), /1 \/ 2/, "la note tombe à la fin");
  assert.match(textOf(h.tree), /50 % de réussite/);
  assert.match(textOf(h.tree), /Question 2/, "le bilan rappelle la question ratée");
  assert.match(textOf(h.tree), /preuve-2/, "et garde sa source sous les yeux");
});

test("l'examen d'un module vit dans l'écran, la bulle reste au quiz surprise", () => {
  const src = read("academie.jsx");
  assert.match(src, /function AcademyExam/);
  assert.match(src, /setExamen\(true\)/, "le bouton ouvre l'écran d'examen");
  assert.doesNotMatch(src, /fa:open-quiz/, "l'examen ne passe plus par la bulle");
  assert.match(src, /verdict\.source/, "la preuve vient du serveur, pas d'un texte local");
  assert.match(src, /ACADEMY_EXAM_ANSWER_WAS/);
});

// Une session absente ou expirée ne doit pas emporter l'examen : la question
// reste à l'écran, et le joueur lit ce qui bloque. (Constaté en vrai : la
// validation sans jeton remplaçait tout l'écran par « Académie indisponible ».)
test("examen : session expirée, la question reste et le message explique", async () => {
  const h = harness({
    root: "AcademyExam",
    props: { module: examModule(2), onClose: () => {} },
    fetcher: (u) => {
      if (u.pathname.startsWith("/quiz/next/")) {
        return response({ question: { id: "q1", q: "Question serveur", c: ["Choix A", "Choix B"] } });
      }
      assert.fail("appel inattendu : " + u.pathname);
    },
  });
  await h.settle();
  h.actions.answerQuiz = async () => ({ ok: false, reason: "auth" });
  await h.click(h.button("Choix A"));

  assert.match(textOf(h.tree), /Question serveur/, "la question reste affichée");
  assert.match(textOf(h.tree), /Connecte-toi pour passer l.examen/);
  assert.doesNotMatch(textOf(h.tree), /Académie indisponible/, "ce n'est pas une panne d'Académie");
  assert.ok(h.button(h.I.t("ACADEMY_RETRY")), "et le joueur peut réessayer sans perdre sa place");
});

test("examen : un jeton rafraîchi est rejoué une fois, sans perdre la question", async () => {
  const h = harness({
    root: "AcademyExam",
    props: { module: examModule(2), onClose: () => {} },
    fetcher: (u) => {
      if (u.pathname.startsWith("/quiz/next/")) {
        return response({ question: { id: "q1", q: "Question serveur", c: ["Choix A", "Choix B"] } });
      }
      assert.fail("appel inattendu : " + u.pathname);
    },
  });
  await h.settle();
  let appels = 0;
  h.actions.answerQuiz = async () => {
    appels += 1;
    if (appels === 1) return { ok: false, reason: "retry" };
    return { ok: true, data: { correct: true, reward: 10, answer: 0, explanation: "Parce que.", source: "https://example.org/preuve" } };
  };
  await h.click(h.button("Choix A"));
  assert.equal(appels, 2, "la réponse est rejouée une seule fois");
  assert.match(textOf(h.tree), /Bonne réponse/);
});

// Le quiz limite à une réponse toutes les 20 s (anti-farm). En examen, le 429
// cassait l'écran ; maintenant l'écran annonce le délai et rejoue tout seul.
test("examen : le limiteur anti-farm fait patienter puis rejoue la réponse", async () => {
  const h = harness({
    root: "AcademyExam",
    props: { module: examModule(2), onClose: () => {} },
    fetcher: (u) => {
      if (u.pathname.startsWith("/quiz/next/")) {
        return response({ question: { id: "q1", q: "Question serveur", c: ["Choix A", "Choix B"] } });
      }
      assert.fail("appel inattendu : " + u.pathname);
    },
  });
  await h.settle();
  let appels = 0;
  h.actions.answerQuiz = async () => {
    appels += 1;
    if (appels === 1) return { ok: false, reason: "rate", retry_after: 2 };
    return { ok: true, data: { correct: true, reward: 10, answer: 0, explanation: "Parce que.", source: "https://example.org/preuve" } };
  };
  await h.click(h.button("Choix A"));
  assert.equal(appels, 1);
  assert.match(textOf(h.tree), /Encore 2 s/, "le délai est annoncé, ce n'est pas une erreur");
  assert.doesNotMatch(textOf(h.tree), /Académie indisponible/);
  await h.tick();
  await h.tick();
  assert.equal(appels, 2, "la réponse est rejouée sans que le joueur reclique");
  assert.match(textOf(h.tree), /Bonne réponse/);
});
