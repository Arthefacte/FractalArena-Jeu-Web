"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const POOL = "bc1qhgnfujw5f6r0hct45vmrrwuyrkh4u8npjn0p4s";
const TXID = "a1".repeat(32);
const ACCOUNT = { wallet: "bc1qaccount", linkedWallet: "bc1qlinked", authToken: "test-token", liquid: 12, locked: 34 };
const SUCCESS = { status: "ok", credited_sats: 50000001, fb_sats: 912345678, sender: ACCOUNT.linkedWallet };
const ERRORS = {
  already_used: "WL_DEP_ALREADY_USED",
  wrong_recipient: "WL_DEP_WRONG_RECIPIENT",
  sender_unverified: "WL_DEP_SENDER_UNVERIFIED",
  sender_mismatch: "FB_DEP_SENDER_MISMATCH",
  tx_pending: "FB_DEP_TX_PENDING",
  tx_unconfirmed: "FB_DEP_TX_UNCONFIRMED",
  below_minimum: "FB_DEP_MIN",
  invalid_amount: "FB_DEP_INVALID_AMOUNT",
  no_account: "FB_DEP_NO_ACCOUNT",
  onchain_unavailable: "FB_DEP_ONCHAIN_UNAVAILABLE",
  deposits_disabled: "FB_DEP_DISABLED",
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function extract(source, name) {
  source = source.replace(/\r\n/g, "\n");
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}\n", start);
  assert.ok(start >= 0 && end > start, `${name} absent`);
  return source.slice(start, end + 2);
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...(tree.children || []).flatMap(nodes)];
}

function visibleText(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(visibleText).join(" ");
  if (typeof tree === "object") return visibleText(tree.children);
  return String(tree);
}

function eventWindow() {
  const target = new EventTarget();
  const events = [];
  return {
    events,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent(event) { events.push(event.type); return target.dispatchEvent(event); },
    FA_ACCOUNT: { withdrawDestination: () => ACCOUNT.linkedWallet, withdrawSigner: () => ({}) },
    FA_ASSET_URL: (url) => url,
  };
}

// Exécute les vrais composants, leurs handlers et leurs effets avec état persistant entre rendus.
// Les réponses réseau sont simulées ; aucune transaction n'est envoyée.
function mount(code, { component = "DepositModal", props = {}, lang = "FR", response = SUCCESS,
  fetcher, browserWindow = eventWindow() } = {}) {
  const states = [], effects = [], cleanups = [], requests = [], toasts = [], deposits = [];
  let cursor = 0, first = true, closed = 0, tree;
  const context = {
    window: browserWindow, Event,
    React: { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props, children }) },
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (value) => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useEffect(effect) { if (first) effects.push(effect); },
    useFA: () => ({ g: ACCOUNT, actions: { deposit: (amount) => deposits.push(amount) },
      toast: (message, kind) => toasts.push({ message, kind }) }),
    usePotEligibility: () => null,
    Modal: "Modal", CopyAddr: "CopyAddr", SectionHead: "SectionHead",
    WithdrawModal: "WithdrawModal", HistoryModal: "HistoryModal", fmt: String,
    API_URL: "https://api.test",
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fetcher) return fetcher(url, options);
      return { ok: response.status === "ok", json: async () => response };
    },
  };
  vm.createContext(context);
  vm.runInContext(read("i18n.js"), context);
  context.I18N = browserWindow.FA_I18N;
  context.I18N.setLang(lang);
  vm.runInContext(code, context);
  const render = () => {
    cursor = 0;
    tree = context[component]({ onClose: () => { closed++; }, ...props });
    if (first) { first = false; effects.forEach((effect) => cleanups.push(effect())); }
    return tree;
  };
  render();
  const button = (key) => {
    const found = nodes(tree).find((node) => node.type === "button" && node.children.includes(context.I18N.t(key)));
    assert.ok(found, `bouton ${key} absent`);
    return found;
  };
  return {
    render, button, context, requests, toasts, deposits, browserWindow,
    get closed() { return closed; },
    get tree() { return tree; },
    choose(asset) { button(asset === "fb" ? "WL_DEP_FB" : "WL_DEP_FA").props.onClick(); render(); },
    enter(value = TXID) {
      nodes(tree).find((node) => node.type === "input").props.onChange({ target: { value } }); render();
    },
    submit() { return button("WL_DEP_SEND").props.onClick(); },
    unmount() { cleanups.forEach((cleanup) => cleanup && cleanup()); },
  };
}

for (const file of ["screens.jsx", "build/screens.js"]) {
  const source = read(file);
  const code = Babel.transform(["DepositModal", "FbCaseModal", "Wallet"].map((name) => extract(source, name)).join("\n"),
    { presets: ["react"], sourceType: "script" }).code;

  test(`${file} : choix explicite, une seule porte avec ses consignes et son adresse`, () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      const h = mount(code, { lang });
      assert.equal(nodes(h.tree).filter((n) => n.type === "input" || n.type === "CopyAddr").length, 0);
      for (const asset of ["fa", "fb", "fa"]) {
        h.choose(asset);
        const selected = nodes(h.tree).filter((n) => n.type === "button" && n.props["aria-pressed"]);
        assert.equal(selected.length, 1);
        assert.equal(visibleText(selected[0]), h.context.I18N.t(asset === "fb" ? "WL_DEP_FB" : "WL_DEP_FA"));
        assert.equal(nodes(h.tree).filter((n) => n.type === "input").length, 1);
        assert.deepEqual(nodes(h.tree).filter((n) => n.type === "CopyAddr").map((n) => n.props.addr), [POOL]);
        const text = visibleText(h.tree);
        const own = asset === "fb" ? "FB_DEP" : "WL_DEP";
        const other = asset === "fb" ? "WL_DEP" : "FB_DEP";
        assert.ok(text.includes(h.context.I18N.t(`${own}_INFO`)));
        assert.ok(text.includes(h.context.I18N.t(`${own}_CONFIRMS`)));
        assert.ok(!text.includes(h.context.I18N.t(`${other}_INFO`)));
        assert.ok(text.includes(POOL));
        if (asset === "fb") {
          assert.match(text, /100[ ,]000 sats/);
          assert.match(text, /0[,.]001 FB/);
          assert.match(text, /3/);
        }
      }
    }
  });

  test(`${file} : FB appelle sa route avec le compte, le jeton et le TXID, sans crédit FA`, async () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      const h = mount(code, { lang });
      h.choose("fb"); h.enter(TXID.toUpperCase()); await h.submit();
      assert.equal(h.requests.length, 1);
      const { url, options } = h.requests[0];
      assert.equal(url, "https://api.test/verify-deposit/fb");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, `Bearer ${ACCOUNT.authToken}`);
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(options.body), { wallet: ACCOUNT.wallet, txid: TXID });
      assert.deepEqual(h.deposits, []);
      assert.deepEqual(h.toasts, [{ message: h.context.I18N.t("FB_DEP_OK", SUCCESS.credited_sats, SUCCESS.fb_sats), kind: "good" }]);
      assert.ok(h.toasts[0].message.includes(String(SUCCESS.credited_sats)));
      assert.ok(h.toasts[0].message.includes(String(SUCCESS.fb_sats)));
      assert.deepEqual(h.browserWindow.events, ["fa:fb-liquidity"]);
      assert.equal(h.closed, 1);
    }
  });

  test(`${file} : FA garde sa route, son crédit et ses messages`, async () => {
    for (const [status, key] of Object.entries({ ok: "WL_DEP_OK", already_used: "WL_DEP_ALREADY_USED",
      wrong_recipient: "WL_DEP_WRONG_RECIPIENT", sender_unverified: "WL_DEP_SENDER_UNVERIFIED", missing: "WL_DEP_NOT_FOUND" })) {
      const h = mount(code, { response: { status, credited: 321 } });
      h.choose("fa"); h.enter(); await h.submit();
      const { url, options } = h.requests[0];
      assert.equal(url, "https://api.test/verify-deposit");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, `Bearer ${ACCOUNT.authToken}`);
      assert.deepEqual(JSON.parse(options.body), { wallet: ACCOUNT.wallet, txid: TXID });
      assert.deepEqual(h.deposits, status === "ok" ? [321] : []);
      assert.equal(h.toasts[0].message, status === "ok" ? h.context.I18N.t(key, 321) : h.context.I18N.t(key));
      assert.equal(h.closed, status === "ok" ? 1 : 0);
      assert.deepEqual(h.browserWindow.events, []);
    }
  });

  test(`${file} : tous les refus FB sont localisés en FR/EN/ZH, minimum du serveur inclus`, async () => {
    for (const lang of ["FR", "EN", "ZH"]) {
      for (const [status, key] of Object.entries(ERRORS)) {
        const h = mount(code, { lang, response: { status, minimum_sats: 234567 } });
        assert.ok(h.context.I18N.T[key]?.[lang]?.trim(), `${key}.${lang}`);
        h.choose("fb"); h.enter(); await h.submit(); h.render();
        assert.deepEqual(h.toasts, [{ kind: "bad", message: status === "below_minimum"
          ? h.context.I18N.t(key, 234567) : h.context.I18N.t(key) }]);
        assert.ok(!h.toasts[0].message.includes(status), `code brut : ${status}`);
        assert.doesNotMatch(h.toasts[0].message, /%[sd]|undefined|NaN|(?:FB|WL)_DEP_/);
        assert.equal(h.closed, 0);
        assert.equal(h.button("WL_DEP_SEND").props.disabled, false);
        assert.deepEqual(h.deposits, []);
        assert.deepEqual(h.browserWindow.events, []);
      }
    }
  });

  test(`${file} : erreurs inconnues, HTTP et réseau sans faux succès ni code brut`, async () => {
    for (const status of ["future_status", "constructor", "ok"]) {
      const h = mount(code, { fetcher: async () => ({ ok: false, json: async () => ({ status }) }) });
      h.choose("fb"); h.enter(); await h.submit();
      assert.equal(h.toasts[0].message, h.context.I18N.t("FB_DEP_ERROR"));
      assert.equal(h.closed, 0);
      assert.deepEqual(h.browserWindow.events, []);
    }
    const h = mount(code, { fetcher: async () => { throw new Error("offline"); } });
    h.choose("fb"); h.enter(); await h.submit(); h.render();
    assert.equal(h.toasts[0].message, h.context.I18N.t("WL_NET_ERROR"));
    assert.equal(h.button("WL_DEP_SEND").props.disabled, false);
    assert.equal(h.closed, 0);
    assert.deepEqual(h.browserWindow.events, []);
  });

  test(`${file} : changement de porte efface le TXID et un TXID invalide ne part jamais`, async () => {
    const h = mount(code);
    h.choose("fa"); h.enter(); h.choose("fb");
    assert.equal(nodes(h.tree).find((n) => n.type === "input").props.value, "");
    await h.submit();
    h.enter("abc"); await h.submit();
    assert.equal(h.requests.length, 0);
    assert.ok(h.toasts.every((toast) => toast.message === h.context.I18N.t("WL_DEP_TXID_INVALID")));
  });

  test(`${file} : pendant une requête, portes et TXID sont verrouillés et aucun second envoi ne part`, async () => {
    let finish;
    const h = mount(code, { fetcher: () => new Promise((resolve) => { finish = resolve; }) });
    h.choose("fb"); h.enter();
    const pending = h.submit(); h.render();
    assert.ok(nodes(h.tree).filter((n) => n.type === "button" || n.type === "input").every((n) => n.props.disabled));
    h.choose("fa");
    assert.equal(h.button("WL_DEP_FB").props["aria-pressed"], true);
    await h.button("WL_DEP_DETECT").props.onClick();
    assert.equal(h.requests.length, 1);
    finish({ ok: true, json: async () => SUCCESS }); await pending;
    assert.equal(h.closed, 1);
  });

  test(`${file} : le bouton FB du Wallet ouvre DepositModal avec FB sélectionné`, async () => {
    const h = mount(code, { component: "Wallet", response: { status: "ok", fb_sats: 100000 } });
    await flush(); h.render();
    h.button("FB_CASE_OPEN").props.onClick(); h.render();
    const entry = nodes(h.tree).find((n) => n.type === h.context.FbCaseModal);
    assert.ok(entry);
    const modal = entry.type(entry.props);
    assert.equal(modal.type, h.context.DepositModal);
    assert.equal(modal.props.initialAsset, "fb");
    const deposit = mount(code, { props: modal.props });
    assert.equal(deposit.button("WL_DEP_FB").props["aria-pressed"], true);
    assert.equal(nodes(deposit.tree).filter((n) => n.type === "input").length, 1);
    h.unmount();
  });

  test(`${file} : le succès FB déclenche le listener existant et relit GET /fb authentifié`, async () => {
    const browserWindow = eventWindow();
    let balance = 100000000;
    const wallet = mount(code, { component: "Wallet", browserWindow,
      fetcher: async () => ({ ok: true, json: async () => ({ fb_sats: balance }) }) });
    await flush(); wallet.render();
    assert.ok(visibleText(wallet.tree).includes("1.0000 FB"));
    const deposit = mount(code, { browserWindow });
    deposit.choose("fb"); deposit.enter();
    // Valeur GET distincte du POST : le test exige bien une relecture, pas une addition locale.
    balance = 2345678900;
    await deposit.submit(); await flush(); wallet.render();
    assert.equal(wallet.requests.length, 2);
    for (const { url, options } of wallet.requests) {
      assert.equal(url, `https://api.test/fb?wallet=${ACCOUNT.wallet}`);
      assert.equal(options.headers.Authorization, `Bearer ${ACCOUNT.authToken}`);
    }
    assert.ok(visibleText(wallet.tree).includes("23.4568 FB"));
    wallet.unmount();
    browserWindow.dispatchEvent(new Event("fa:fb-liquidity")); await flush();
    assert.equal(wallet.requests.length, 2, "listener retiré au démontage");
  });
}

test("tous les nouveaux libellés de dépôt existent dans les trois langues", () => {
  const context = { window: {} };
  vm.runInNewContext(read("i18n.js"), context);
  const keys = ["WL_DEPOSIT", "WL_DEP_CHOOSE", "WL_DEP_FA", "WL_DEP_FB", "FB_DEP_INFO",
    "FB_DEP_CONFIRMS", "FB_DEP_OK", "FB_DEP_ERROR", ...Object.values(ERRORS)];
  for (const key of keys) for (const lang of ["FR", "EN", "ZH"]) {
    assert.ok(context.window.FA_I18N.T[key]?.[lang]?.trim(), `${key}.${lang}`);
  }
});
