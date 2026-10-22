"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
for (const file of ["screens.jsx", "build/screens.js"]) {
  const source = read(file);
  const start = source.indexOf("function FbShopPanel(");
  const end = source.indexOf("\nfunction ", start + 1);
  assert.ok(start >= 0 && end > start, `${file} : panneau FB introuvable`);
  const panel = source.slice(start, end);

  test(`${file} : aucun formulaire ni traitement de depot FB dans la Boutique`, () => {
    for (const forbidden of [/deposit_address/, /deposit_min_sats/, /\btxid\b/i,
      /\bdetecter\b/, /verify-deposit/, /FB_DEP_/, /WL_DEP_/, /\bsetBusy\b/]) {
      assert.ok(!forbidden.test(panel), `${file} : depot encore present (${forbidden})`);
    }
  });

  test(`${file} : le bouton de depot ouvre le Wallet via la navigation existante`, () => {
    const destinations = [];
    const context = {
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
      useFA: () => ({ g: {}, actions: { setView: (view) => destinations.push(view) } }),
      useState: (initial) => [initial, () => {}],
      useEffect: () => {},
      I18N: { t: (key) => key },
    };
    const code = Babel.transform(panel, { presets: ["react"], sourceType: "script" }).code;
    const tree = vm.runInNewContext(code + "\nFbShopPanel()", context);
    const nodes = [];
    function walk(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      nodes.push(node);
      (node.children || []).forEach(walk);
    }
    walk(tree);
    const button = nodes.find((node) => node.type === "button"
      && node.children.includes("SH_FB_WALLET"));
    assert.ok(button, "bouton SH_FB_WALLET absent");
    button.props.onClick();
    assert.deepEqual(destinations, ["wallet"]);
  });

  test(`${file} : solde serveur, explication et achat permanent conserves`, () => {
    for (const required of [/\/fb\?wallet=/, /g\.authToken/, /info\.fb_sats/,
      /(?:FB_CASE_INFO|SH_FB_INFO)/, /\/fb\/buy/, /function acheter\(/, /setAchat/,
      /it\.owned/, /it\.price_sats/, /fa:fb-liquidity/]) {
      assert.ok(required.test(panel), `${file} : fonctionnalite manquante (${required})`);
    }
  });
}

test("le bouton vers le Wallet est traduit en FR, EN et ZH", () => {
  const context = { window: {} };
  vm.runInNewContext(read("i18n.js"), context);
  const label = context.window.FA_I18N.T.SH_FB_WALLET;
  assert.ok(label, "cle SH_FB_WALLET absente");
  assert.equal(label.FR, "Déposer du FB depuis le Wallet");
  for (const lang of ["FR", "EN", "ZH"]) {
    assert.ok(label[lang]?.trim(), lang);
    assert.ok(context.window.FA_I18N.T.SH_FB_INFO?.[lang]?.trim(), `explication ${lang}`);
  }
});
