// test/dex-buys.test.js — bandeau des achats DEX (« X a acheté N FA sur InSwap »).
// Le bandeau est une preuve sociale : s'il affiche un faux acheteur ou un montant
// nul, il détruit plus de confiance qu'il n'en crée. D'où des tests sur la
// composition pure, ET sur le câblage (rendu, fetch, clé i18n, classe de style) :
// un composant monté nulle part ne se voit jamais à l'écran.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

globalThis.window = {};
require("../tape-ui.js");
const T = globalThis.window.FA_TAPE;

// ——— itemsAchats (pur) ———

test("itemsAchats : vide sur entrées dégénérées", () => {
  assert.deepStrictEqual(T.itemsAchats(null), []);
  assert.deepStrictEqual(T.itemsAchats({}), []);
  assert.deepStrictEqual(T.itemsAchats({ achats: "x" }), []);
});

test("itemsAchats : garde nom + montant, jette le reste", () => {
  const items = T.itemsAchats({ achats: [
    { nom: "kaito.fb", fa: 14000 },
    { nom: "   ", fa: 500 },          // nom vide : jeté
    { nom: "Joueur 04210", fa: 0 },   // montant nul : jeté
    { nom: "Joueur 04210", fa: "abc" }, // non numérique : jeté
    null,
  ] });
  assert.deepStrictEqual(items, [{ nom: "kaito.fb", fa: 14000 }]);
});

test("itemsAchats : le nom est nettoyé et le montant arrondi", () => {
  const items = T.itemsAchats({ achats: [{ nom: " kaito.fb ", fa: 3500.7 }] });
  assert.deepStrictEqual(items, [{ nom: "kaito.fb", fa: 3501 }]);
});

test("itemsAchats : `max` borne le nombre de lignes (8 par défaut)", () => {
  const achats = [];
  for (let i = 0; i < 12; i++) achats.push({ nom: "joueur" + i, fa: 100 });
  assert.strictEqual(T.itemsAchats({ achats }).length, 8);
  assert.strictEqual(T.itemsAchats({ achats }, 3).length, 3);
});

// ——— câblage : le bandeau doit vraiment être monté et alimenté ———

test("DexBuysTicker interroge /dex/buys et ne peint rien sans achat", () => {
  const src = lire("buyback.jsx");
  assert.match(src, /function DexBuysTicker\(\)/);
  assert.match(src, /API_URL \+ "\/dex\/buys"/, "la route publique du serveur est la seule source");
  assert.match(src, /if \(!items\.length\) return null/, "aucun achat récent → aucun bandeau");
  assert.match(src, /DexBuysTicker,/, "exporté sur window (chargé avant app.jsx)");
});

test("app.jsx monte le bandeau dans le pli des pools, sous les dons", () => {
  const src = lire("app.jsx");
  const iQuiz = src.indexOf("<window.QuizTicker />");
  const iDex = src.indexOf("<window.DexBuysTicker />");
  assert.ok(iQuiz > 0 && iDex > iQuiz, "le bandeau des achats se lit juste sous celui des dons");
  assert.ok(src.indexOf("<PoolsFold>") < iDex && iDex < src.indexOf("</PoolsFold>"), "il vit dans le pli des pools");
});

test("clé i18n DEX_BUYS_ONE : FR, EN et ZH (le montant arrive déjà formaté)", () => {
  const i18n = lire("i18n.js");
  const ligne = i18n.split("\n").find((l) => l.includes("DEX_BUYS_ONE:"));
  assert.ok(ligne, "clé définie");
  for (const langue of ["FR:", "EN:", "ZH:"]) assert.ok(ligne.includes(langue), langue);
  assert.strictEqual((ligne.match(/%s/g) || []).length, 6, "deux %s par langue (nom + montant formaté), trois langues");
});

test("le bandeau est orange, lisible et visible sur mobile", () => {
  const css = lire("styles.css");
  const bloc = css.slice(css.indexOf(".dex-buys {"));
  assert.ok(bloc.length > 0, "classe .dex-buys présente");
  assert.match(bloc.slice(0, 400), /#f7931a/, "orange Bitcoin");
  assert.match(bloc, /\.dex-buys \.fa-tape\.toujours \{ display: block; \}/, "reste visible sur mobile");
});
