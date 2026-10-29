// Rendu et parcours Arène sans réseau : le vrai pvpAttack actualise le stock du
// harnais, puis les callbacks du sélecteur et du rejeu rendent le paiement visible.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const compiled = Babel.transform(read("arene.jsx"), { presets: ["react"], sourceType: "script" }).code;
const app = read("app.jsx");
const attackStart = app.indexOf("    async pvpAttack(");
const attackEnd = app.indexOf("\n    },", attackStart) + "\n    }".length;
assert.ok(attackStart >= 0 && attackEnd > attackStart);
const attackSource = `({${app.slice(attackStart, attackEnd)}}).pvpAttack`;
const team = ["a", "b", "c"].map((id) => ({ id, name: id, type: "fire", level: 1, rarity: "common", base_hp: 100 }));
const defense = { ok: true, team, hp_left: 100, hp_max: 100, power: 300 };
const textOf = (node) => Array.isArray(node) ? node.map(textOf).join("")
  : node && typeof node === "object" ? textOf(node.children)
    : node == null || typeof node === "boolean" ? "" : String(node);
function nodesOf(node, result = []) {
  if (Array.isArray(node)) node.forEach((child) => nodesOf(child, result));
  else if (node && typeof node === "object") {
    result.push(node);
    nodesOf(node.children, result);
  }
  return result;
}

async function mount({ ticketsSilver = 3, response = { ok: true, entry: "ticket", events: [], rating: 1001 }, status = 200, revanche = false } = {}) {
  const context = { window: {} };
  for (const file of ["data.js", "expeditions-ui.js", "arene-ui.js", "i18n.js"]) vm.runInNewContext(read(file), context);
  const I = context.window.FA_I18N;
  I.setLang("FR");
  const g = {
    wallet: "mine", publicId: "j-mine", authToken: "session", selected: team.map((b) => b.id), roster: team,
    ticketsSilver, liquid: 100, uiState: { arene_help_seen: true },
    pvp: { league: "argent", rating: 1000, free_remaining: 2, fa_cost: 17,
      ladder: [{ player_id: "j-target", name: "Adversaire", can_attack: true, rank: 1, rating: 1000 }],
      opponents: revanche ? [{ opponent_id: "j-target", name: "Adversaire", team, rating: 1000 }] : [],
      revanches: revanche ? ["j-target"] : [],
    },
  };
  const states = [], refs = [], effects = [], toasts = [], requests = [], refreshes = [];
  let stateIndex, refIndex, effectIndex, pendingEffects, dirty = true, tree;
  const nextResponse = { status, body: response };
  const React = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => {
        const next = typeof value === "function" ? value(states[index]) : value;
        if (!Object.is(next, states[index])) { states[index] = next; dirty = true; }
      }];
    },
    useRef(current) { const index = refIndex++; return refs[index] || (refs[index] = { current }); },
    useEffect(callback, deps) {
      const index = effectIndex++, old = effects[index];
      if (!old || !deps || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pendingEffects.push(() => {
          if (old && old.cleanup) old.cleanup();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const pvpAttack = vm.runInNewContext(attackSource, {
    API_URL: "https://offline.invalid", gRef: { current: g },
    setG: (update) => { Object.assign(g, update(g)); dirty = true; },
    fetch: async (url, opts) => {
      requests.push({ url, opts });
      return { ok: nextResponse.status >= 200 && nextResponse.status < 300, status: nextResponse.status, json: async () => nextResponse.body };
    },
  });
  Object.assign(context.window, {
    useFA: () => ({ g, actions: {
      pvpAttack, pvpDefenseOf: async () => defense,
      pvpRefresh: async () => { refreshes.push(true); },
      pvpAttacksSeen: () => {}, pvpPrizesHistory: () => {}, towerPrizesHistory: () => {},
    }, toast: (...args) => toasts.push(args) }),
    cx: (...classes) => classes.filter(Boolean).join(" "),
    AreneBattle: "AreneBattle", FaText: "FaText", PostureSelect: "PostureSelect",
    rarityLabel: (rarity) => rarity,
  });
  vm.runInNewContext(compiled, { ...context, React, setInterval: () => 1, clearInterval: () => {} });
  async function settle() {
    for (let turn = 0; turn < 12; turn++) {
      dirty = false;
      stateIndex = refIndex = effectIndex = 0;
      pendingEffects = [];
      tree = context.window.Arene();
      pendingEffects.forEach((effect) => effect());
      await new Promise(setImmediate);
      if (!dirty) return;
    }
    assert.fail("le rendu Arène ne se stabilise pas");
  }
  const all = () => nodesOf(tree);
  const find = (predicate) => all().find(predicate);
  const ticket = () => find((node) => node.props["data-fa"] === "arene-entry-ticket");
  const notice = () => find((node) => node.props["data-fa"] === "arene-entry-paid");
  const battle = () => find((node) => node.type === "AreneBattle");
  async function choose(key) {
    const button = find((node) => node.type === "button" && node.props.key === key);
    assert.ok(button, `mode ${key}`);
    assert.equal(button.props.disabled, false);
    button.props.onClick();
    await settle();
  }
  async function pick() {
    const button = find((node) => node.type === "button" && (revanche
      ? textOf(node) === I.t("AR2_REVANCHE")
      : node.props.className.includes("arene-ladder-attack")));
    assert.ok(button, "bouton d'attaque de l'adversaire");
    assert.equal(button.props.disabled, false);
    await button.props.onClick();
    await settle();
  }
  const confirm = () => {
    const modal = find((node) => node.props.className === "modal-backdrop");
    return nodesOf(modal).find((node) => node.type === "button" && textOf(node) === I.t("AR2_ATTACK"));
  };
  async function attack() {
    await pick();
    assert.equal(confirm().props.disabled, false);
    confirm().props.onClick();
    await settle();
  }
  async function close() {
    assert.ok(battle(), "le combat a été accepté");
    battle().props.onClose();
    await settle();
  }
  await settle();
  return { g, I, all, find, ticket, notice, battle, choose, pick, confirm, attack, close, settle, requests, refreshes, toasts, nextResponse };
}

test("classement attaquable : bouton voyant, icône et verrou de défense conservé", async () => {
  const h = await mount();
  const button = () => h.find((node) => node.type === "button" && node.props.className.includes("arene-ladder-attack"));
  assert.ok(button());
  assert.equal(button().props.disabled, false);
  assert.match(textOf(button()), /⚔.*Attaquer/);
  const icon = nodesOf(button()).find((node) => textOf(node) === "⚔");
  assert.equal(icon.props["aria-hidden"], "true");
  h.g.pvp.me_defense_down = true;
  await h.settle();
  assert.equal(button().props.disabled, true);
});

test("ticket Argent : le sélecteur suit le stock global sans rechargement", async () => {
  const h = await mount();
  assert.equal(textOf(h.ticket()), "🎟 ×3");
  assert.equal(h.ticket().props.disabled, false);
  assert.match(h.ticket().props["aria-label"], /Ticket Argent.*×3/);
  await h.choose("ticket");
  h.g.ticketsSilver = 0;
  await h.settle();
  assert.equal(textOf(h.ticket()), "🎟 ×0");
  assert.equal(h.ticket().props.disabled, true);
  assert.ok(!h.ticket().props.className.split(" ").includes("on"));
  assert.equal(h.requests.length, 0);
});

test("dernier ticket : débit unique, notice seulement au retour, compteur à zéro", async () => {
  const h = await mount({ ticketsSilver: 1 });
  await h.choose("ticket");
  await h.attack();
  assert.equal(h.g.ticketsSilver, 0, "l'action app.jsx applique le débit confirmé");
  assert.equal(h.ticket().props.disabled, true);
  assert.equal(h.notice(), undefined, "le message attend la fin du rejeu");
  assert.equal(h.refreshes.length, 1, "aucun refresh pendant le combat");
  await h.close();
  assert.equal(h.notice().props.role, "status");
  assert.equal(textOf(h.notice()), "Entrée payée avec 1 ticket Argent · reste 0");
  assert.equal(h.requests.length, 1, "aucune nouvelle requête pour le stock ou la notice");
  assert.equal(h.refreshes.length, 2, "le refresh de fermeture est conservé");
  assert.equal(JSON.parse(h.requests[0].opts.body).entry, "ticket");
});

test("stock épuisé pendant la sélection : confirmation bloquée, aucun paiement FA automatique", async () => {
  const h = await mount({ ticketsSilver: 1 });
  await h.choose("ticket");
  await h.pick();
  h.g.ticketsSilver = 0;
  await h.settle();
  assert.equal(h.confirm().props.disabled, true);
  h.confirm().props.onClick(); // La garde métier tient aussi sans le disabled natif.
  await h.settle();
  assert.equal(h.requests.length, 0);
  assert.equal(h.g.liquid, 100);
});

test("seul le mode payé confirmé par le serveur déclenche la notice ticket", async () => {
  for (const entry of ["free", "fa", "revanche"]) {
    const h = await mount({ response: { ok: true, entry, events: [] } });
    await h.choose("ticket");
    await h.attack();
    await h.close();
    assert.equal(h.notice(), undefined, entry);
    assert.equal(h.g.ticketsSilver, 3, entry);
  }
  const paid = await mount();
  await paid.choose("free");
  await paid.attack();
  await paid.close();
  assert.equal(textOf(paid.notice()), "Entrée payée avec 1 ticket Argent · reste 2", "la réponse serveur prime sur le choix demandé");
});

test("attaque refusée : aucun débit ni fausse notice, ancienne notice effacée", async () => {
  const h = await mount();
  await h.choose("ticket");
  await h.attack();
  await h.close();
  h.nextResponse.status = 400;
  h.nextResponse.body = { ok: false, error: "no_entry" };
  await h.attack();
  assert.equal(h.notice(), undefined);
  assert.equal(h.battle(), undefined);
  assert.equal(h.g.ticketsSilver, 2);
  assert.equal(h.toasts.length, 1);
});

test("revanche : reste disponible même si le mode ticket sélectionné vient de se vider", async () => {
  const h = await mount({ ticketsSilver: 1, revanche: true, response: { ok: true, entry: "revanche", events: [] } });
  await h.choose("ticket");
  h.g.ticketsSilver = 0;
  await h.settle();
  await h.attack();
  await h.close();
  assert.equal(JSON.parse(h.requests[0].opts.body).entry, "revanche");
  assert.equal(h.notice(), undefined);
});

test("paiement ticket : message traduit en FR, EN et ZH avec le stock courant", async () => {
  const h = await mount();
  await h.choose("ticket");
  await h.attack();
  await h.close();
  for (const [lang, message] of Object.entries({
    FR: "Entrée payée avec 1 ticket Argent · reste 2",
    EN: "Entry paid with 1 Silver ticket · 2 left",
    ZH: "已用 1 张白银券入场 · 剩 2 张",
  })) {
    h.I.setLang(lang);
    await h.settle();
    assert.equal(textOf(h.notice()), message);
  }
  h.g.publicId = "j-autre";
  h.g.wallet = "autre";
  await h.settle();
  assert.equal(h.notice(), undefined, "le reçu d'un compte ne suit pas le suivant");
});
