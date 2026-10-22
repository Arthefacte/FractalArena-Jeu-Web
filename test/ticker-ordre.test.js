// Ordre du bandeau économie : trois jauges (rachat, cagnotte, burn) puis la
// ligne d'info. Intercalée entre deux jauges, la ligne prix / rachats vérifiés
// cassait la pile et ses chiffres tombaient pile au-dessus de ceux du burn.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "buyback.jsx"), "utf8");
const CSS = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("la ligne DEX est rendue APRÈS la jauge burn (pied du bandeau)", () => {
  const burn = SRC.indexOf("<RangeeBurn");
  const dex = SRC.indexOf("<RangeeDex");
  assert.ok(burn > -1, "RangeeBurn attendue dans le rendu du ticker");
  assert.ok(dex > -1, "RangeeDex attendue dans le rendu du ticker");
  assert.ok(burn < dex,
    "RangeeDex doit suivre RangeeBurn : une info ne se glisse pas entre deux jauges");
});

test("le cumul déjà racheté est sur la ligne du rachat, pas sous la cagnotte", () => {
  assert.match(SRC, /sub=\{p\.tier === "buyback"/,
    "le cumul « FA déjà rachetés » appartient à la jauge du rachat");
  assert.ok(!/i === last/.test(SRC),
    "plus de cumul accroché à la dernière rangée : il atterrissait sous la cagnotte");
});

test("le compte de rachats vérifiés suit le cumul, dans le même sous-titre", () => {
  const i = SRC.indexOf("subExtra={p.tier === \"buyback\"");
  assert.ok(i > -1, "subExtra attendu sur la rangée du rachat");
  assert.match(SRC.slice(i, i + 400), /DEX_VERIFIED_BTN/,
    "le compte de rachats vérifiés suit le cumul vérifié on-chain");
  assert.match(SRC, /<FaText text=\{sub\} s=\{10\} \/>[\s\S]{0,200}\{subExtra\}/,
    "subExtra doit être rendu DANS le .bb-sub du cumul, pas sur une ligne à part");
});

test("le pied DEX est séparé des jauges par un filet", () => {
  const i = CSS.indexOf(".bb-dex {");
  assert.ok(i > -1, "règle .bb-dex attendue dans styles.css");
  const bloc = CSS.slice(i, CSS.indexOf("}", i));
  assert.match(bloc, /border-top:/,
    "sans filet, le prix se lit comme une 4e jauge collée au burn");
});

test("le nom de la poche n'est pas écrit deux fois dans le bandeau", () => {
  // La rangée cagnotte porte déjà son libellé : PotLigne ne doit pas le répéter.
  assert.match(SRC, /<PotLigne etat=\{pot\} s=\{10\} sansLibelle \/>/,
    "PotLigne doit recevoir sansLibelle depuis le bandeau");
  const CMP = fs.readFileSync(path.join(__dirname, "..", "components.jsx"), "utf8");
  const i = CMP.indexOf("function PotLigne");
  const corps = CMP.slice(i, CMP.indexOf("\nfunction", i + 10));
  assert.match(corps, /sansLibelle = false/, "drapeau sansLibelle attendu sur PotLigne");
  assert.match(corps, /\{!sansLibelle && \(/, "le libellé doit être conditionnel");
});
