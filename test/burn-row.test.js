// La rangée burn du ticker économie : alimentée par /burn/status, jamais fabriquée.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "buyback.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

test("buyback.jsx fetch /burn/status dans le load() du ticker", () => {
  assert.match(SRC, /fetch\(API_URL \+ "\/burn\/status"\)/,
    "le ticker doit lire /burn/status avec les autres statuts");
});

test("RangeeBurn rend null sans données — pas de repli client sur une donnée serveur", () => {
  const i = SRC.indexOf("function RangeeBurn");
  assert.ok(i > -1, "RangeeBurn attendue dans buyback.jsx");
  const corps = SRC.slice(i, SRC.indexOf("\nfunction", i + 10));
  assert.match(corps, /if \(!burn[\s\S]{0,80}return null/,
    "sans réponse serveur, la rangée est absente (jamais un « 0 brûlé » fabriqué)");
});

test("le lien de preuve pointe l'explorateur sur l'adresse de burn renvoyée par le serveur", () => {
  // UniScan et pas fractal.unisat.io : la page wallet UniSat affiche Actifs vide
  // pour 1111...oLvT2 ; UniScan montre badge Burn Address + solde FractalArena.
  assert.match(SRC, /uniscan\.cc\/fractal\/address\//, "URL explorateur attendue");
  assert.match(SRC, /burn\.burn_address/, "l'adresse vient du serveur, pas d'une constante locale");
});

test("RangeeBurn est une JAUGE avec les animations des pools (bb-bar, bb-gain, bb-rachat)", () => {
  const i = SRC.indexOf("function RangeeBurn");
  const corps = SRC.slice(i, SRC.indexOf("function", i + 10));
  assert.match(corps, /className="bb-bar"/, "la barre de jauge des pools est attendue");
  assert.match(corps, /bb-gain/, "le +delta animé des pools est attendu");
  assert.match(corps, /bb-rachat/, "le pulse de cérémonie est attendu");
  assert.match(corps, /ceremony_threshold/, "la jauge se remplit vers le seuil de cérémonie");
});

test("le cumul brûlé est un bouton qui ouvre le panneau des burns vérifiés", () => {
  const i = SRC.indexOf("function RangeeBurn");
  const corps = SRC.slice(i, SRC.indexOf("\nfunction", i + 10));
  assert.match(corps, /bb-dex-btn/, "même style de bouton que « rachats vérifiés »");
  assert.match(corps, /PanneauBurns/, "le clic ouvre PanneauBurns");
});

test("PanneauBurns : chaque burn de burn.burns avec son txid vers la page de tx UniScan", () => {
  const i = SRC.indexOf("function PanneauBurns");
  assert.ok(i > -1, "PanneauBurns attendu dans buyback.jsx");
  const corps = SRC.slice(i, SRC.indexOf("\nfunction", i + 10));
  assert.match(corps, /burn\.burns/, "la liste vient du serveur (/burn/status), jamais fabriquée");
  assert.match(corps, /uniscan\.cc\/fractal\/tx\//, "le txid pointe la page de transaction UniScan");
  assert.match(corps, /uniscan\.cc\/fractal\/address\//, "le lien vers l'adresse de burn reste offert");
});

test("clés i18n BURN_* présentes en FR/EN/ZH", () => {
  for (const key of ["BURN_POOL_LABEL", "BURN_ROW", "BURN_PROOF", "BURN_SUB",
                     "BURN_MODAL_TITLE", "BURN_MODAL_SUB", "BURN_MODAL_ADDR"]) {
    const i = I18N.indexOf(key + ":");
    assert.ok(i > -1, `clé ${key} attendue dans i18n.js`);
    const bloc = I18N.slice(i, i + 450);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(bloc.includes(lang), `${key} doit avoir sa traduction ${lang.slice(0, 2)}`);
    }
  }
});
