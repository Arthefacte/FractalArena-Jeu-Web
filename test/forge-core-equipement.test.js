"use strict";
// Forge d'équipement des CORES (25/09) — miroir de l'onglet Reliques.
//
// Demande du fondateur : « tu peux faire pour core une forge d'équipement comme
// pour relique et baisser le prix de désenchantement ». Décisions actées :
//   - 3 cores de même rareté → 1 core de la rareté supérieure (100 %), core aléatoire
//   - barèmes IDENTIQUES aux reliques (fusion 2 000/5 000/15 000,
//     désenchantement 1 600/4 000/10 000/25 000)
//   - frais de désenchantement 500 → 600 FA pour les DEUX familles (net Commune 1000)
// Vérification au niveau SOURCE pour le JSX (non exécutable en node) et par
// exécution pour les helpers purs de forge-ui.js.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../data.js");
require("../forge-ui.js");
const D = window.FA_DATA;
const F = window.FA_FORGE_UI;

const SCREENS = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const I18N_SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
// Garde croisée web ↔ serveur : le dépôt serveur est SÉPARÉ (et privé), donc la CI du
// dépôt web ne le clone pas — un readFileSync inconditionnel fait échouer le run avec
// ENOENT. Les vérifications serveur ne tournent que là où le voisin est présent
// (poste du dev) ; les valeurs attendues sont de toute façon figées ci-dessus côté web.
const SRV_PATH = path.join(__dirname, "..", "..", "fractal-arena-server", "forge.js");
const SRV = fs.existsSync(SRV_PATH) ? fs.readFileSync(SRV_PATH, "utf8") : null;
const testServeur = SRV ? test : test.skip;

const blocFn = (m) => {
  const i = SCREENS.indexOf("function " + m);
  assert.ok(i >= 0, m + " absent de screens.jsx");
  return SCREENS.slice(i, SCREENS.indexOf("\nfunction ", i));
};
const EQ = blocFn("ForgeCoreEquipement");
const core = (id, rarity) => ({ id, core_id: "fury_core", rarity: rarity || "Common", acquired_at: "2026-08-28T00:00:00.000Z" });
const relic = (id, rarity) => ({ id, type: "ruby_shard", rarity });

// ---- Barèmes : miroir serveur ----

test("barèmes des cores : identiques aux reliques, Legendary non fusable", () => {
  assert.deepStrictEqual(D.CORE_FUSE_COSTS, { Common: 2000, Rare: 5000, Epic: 15000 });
  assert.deepStrictEqual(D.CORE_BUYBACK, { Common: 1600, Rare: 4000, Epic: 10000, Legendary: 25000 });
  assert.deepStrictEqual(D.CORE_FUSE_COSTS, D.RELIC_FUSE_COSTS);
  assert.deepStrictEqual(D.CORE_BUYBACK, D.RELIC_BUYBACK);
  assert.ok(!Object.hasOwn(D.CORE_FUSE_COSTS, "Legendary"), "un core Legendary ne fusionne pas");
});

test("frais de désenchantement 600 FA (net Commune +1000, miroir web)", () => {
  assert.strictEqual(D.DISENCHANT_FEE, 600);
});

testServeur("frais et barèmes alignés sur le serveur (source de vérité)", () => {
  assert.match(SRV, /const DISENCHANT_COST = 600;/, "le serveur (source de vérité) doit être aligné");
  assert.match(SRV, /const CORE_FUSE_COSTS = \{ Common: 2000, Rare: 5000, Epic: 15000 \};/);
  assert.match(SRV, /const CORE_BUYBACK = \{ Common: 1600, Rare: 4000, Epic: 10000, Legendary: 25000 \};/);
  assert.match(SRV, /même coût d'obtention|Mêmes barèmes que les reliques|mêmes barèmes que les reliques/i,
    "le lien de justification (mêmes coûts d'obtention) doit rester écrit");
});

// ---- Helpers purs, famille "core" ----

test("equipSelToggle(family core) : ne prend QUE des cores, plafond 3, reset sur changement de rareté", () => {
  assert.strictEqual(F.equipSelToggle([], relic("r1", "Common"), "core"), null, "une relique ne se fusionne pas ici");
  const s1 = F.equipSelToggle([], core("c1"), "core");
  assert.deepStrictEqual(s1.map((x) => x.id), ["c1"]);
  assert.deepStrictEqual(F.equipSelToggle(s1, core("c1"), "core"), [], "re-clic = désélection");
  const trois = [core("a"), core("b"), core("c")];
  assert.strictEqual(F.equipSelToggle(trois, core("d"), "core"), null, "plafond 3");
  assert.deepStrictEqual(F.equipSelToggle(trois, core("d", "Rare"), "core").map((x) => x.id), ["d"], "changement de rareté = reset");
});

test("familyMatch/buybackFor/fuseCostFor : la famille choisit la table, jamais la rareté seule", () => {
  assert.strictEqual(F.familyMatch(core("c1"), "core"), true);
  assert.strictEqual(F.familyMatch(core("c1"), "relic"), false);
  assert.strictEqual(F.familyMatch(relic("r1", "Common"), "core"), false);
  assert.strictEqual(F.buybackFor(core("c1", "Legendary")), 25000);
  assert.strictEqual(F.fuseCostFor(core("c1", "Rare")), 5000);
});

test("coreFuseState : prêt à 3 cores, coût par rareté, solde exigé, Legendary bloqué", () => {
  const sel = [core("a", "Epic"), core("b", "Epic"), core("c", "Epic")];
  const s = F.coreFuseState({ sel, balance: 20000, busy: false });
  assert.strictEqual(s.disabled, false);
  assert.strictEqual(s.cost, 15000);
  assert.strictEqual(s.nextRarity, "Legendary");
  assert.strictEqual(F.coreFuseState({ sel, balance: 100, busy: false }).showInsufficient, true);
  const max = F.coreFuseState({ sel: [core("a", "Legendary"), core("b", "Legendary"), core("c", "Legendary")], balance: 99999, busy: false });
  assert.strictEqual(max.maxRarity, true);
  assert.strictEqual(max.cost, null);
});

test("disenchantState : un core se désenchante avec SA table et les frais de 600", () => {
  const s = F.disenchantState({ sel: [core("c1")], balance: 1000, busy: false });
  assert.strictEqual(s.value, 1600);
  assert.strictEqual(s.fee, 600);
  assert.strictEqual(s.net, 1000, "net Common : +1000 (1600 − 600)");
  assert.strictEqual(s.disabled, false);
  const pauvre = F.disenchantState({ sel: [core("c1")], balance: 100, busy: false });
  assert.strictEqual(pauvre.disabled, true, "le serveur débite les frais AVANT de créditer");
});

// ---- Écran ----

test("l'onglet Cores monte la forge d'équipement des cores (l'inventaire mort a disparu)", () => {
  assert.ok(!/function CoreInventory/.test(SCREENS), "l'inventaire séparé est fusionné dans la forge d'équipement");
  assert.match(blocFn("ForgeCores"), /<ForgeCoreEquipement onForged=\{setLast\} \/>/, "bloc non monté (ou résultat non branché)");
});

test("la grille sert d'inventaire : filtre isCoreItem, nom/effet sur core_id, pastille du porteur", () => {
  assert.match(EQ, /filter\(D\.isCoreItem\)/, "filtre isCoreItem manquant (sinon des reliques apparaissent)");
  assert.match(EQ, /CoreIcon/, "icône de core manquante");
  assert.match(EQ, /CORE_" \+ String\(c\.core_id/, "nom construit sur core_id");
  assert.match(EQ, /core_id === inst\.id/, "pastille ⚔ du porteur (slot core_id) manquante");
  assert.match(EQ, /FG_CORE_INVENTORY/, "sous-titre d'inventaire manquant");
  assert.match(EQ, /FG_CORE_NONE/, "état vide manquant");
});

test("aucune modale dans la forge de cores (grille + boutons, comme les reliques)", () => {
  assert.ok(!/<Modal/.test(EQ), "un core se manipule dans la grille, jamais dans une modale plein écran");
});

test("sélection famille core, fusion et désenchantement branchés jusqu'à app.jsx", () => {
  assert.match(EQ, /FUI\.equipSelToggle\(sel, inst, "core"\)/, "la sélection doit être en famille core");
  assert.match(EQ, /FUI\.coreFuseState\(/, "état de fusion des cores manquant");
  assert.match(EQ, /actions\.coreFuse\(sel\.map/, "la fusion doit appeler actions.coreFuse");
  assert.match(EQ, /actions\.equipDisenchant\(sel\[0\]\.id\)/, "le désenchantement doit appeler actions.equipDisenchant");
  assert.match(EQ, /if \(onForged\) onForged\(r\.core\)/, "le core fusionné doit remonter à la case de résultat");
  assert.match(APP, /async coreFuse\(coreIds\)/, "action coreFuse absente d'app.jsx");
  assert.match(APP, /\/forge\/core-fuse/, "route core-fuse jamais appelée");
  assert.match(APP, /D\.CORE_FUSE_COSTS/, "coût de fusion des cores non miroité dans app.jsx");
  assert.match(APP, /D\.isCoreItem\(item\) \? D\.CORE_BUYBACK : D\.RELIC_BUYBACK/, "valeur de désenchantement par famille non miroitée");
});

test("libellés dédiés : aucun texte de relique dans la forge de cores", () => {
  for (const k of ["FG_CORE_EQ_TITLE", "FG_CORE_EQ_SUB", "FG_CORE_EQ_FUSE_BTN", "FG_CORE_EQ_FUSE_HINT", "FG_CORE_EQ_FUSE_OK",
                   "FG_CORE_EQ_MAX_RARITY", "FG_CORE_EQ_SEL_MAX", "FG_CORE_EQ_DIS_BTN", "FG_CORE_EQ_DIS_CONFIRM", "FG_CORE_EQ_DIS_OK"]) {
    assert.match(EQ, new RegExp(k), k + " non utilisé par l'écran");
  }
  assert.ok(!/FG_EQ_FUSE_BTN|FG_EQ_DIS_BTN|FG_EQ_SEL_MAX|FG_EQ_MAX_RARITY/.test(EQ), "libellé de relique dans la forge de cores");
});

test("i18n : clés de la forge de cores et codes serveur, FR/EN/ZH complets", () => {
  for (const k of ["FG_CORE_EQ_TITLE", "FG_CORE_EQ_SUB", "FG_CORE_EQ_FUSE_BTN", "FG_CORE_EQ_FUSE_HINT", "FG_CORE_EQ_FUSE_OK",
                   "FG_CORE_EQ_MAX_RARITY", "FG_CORE_EQ_SEL_MAX", "FG_CORE_EQ_DIS_BTN", "FG_CORE_EQ_DIS_CONFIRM", "FG_CORE_EQ_DIS_OK",
                   "FG_EQ_ERR_core_ids_invalide", "FG_EQ_ERR_core_introuvable", "FG_EQ_ERR_pas_un_core",
                   "FG_EQ_ERR_core_rarity_mismatch", "FG_EQ_ERR_core_max_rarity", "FG_EQ_ERR_objet_invalide"]) {
    assert.match(I18N_SRC, new RegExp(k + ': \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\}'), k + " : FR/EN/ZH incomplets");
  }
});

// ---- Serveur : le chemin d'argent ----

testServeur("serveur : /forge/core-fuse montée, authentifiée, débitée dans la transaction", () => {
  assert.match(SRV, /app\.post\("\/forge\/core-fuse"/, "route non montée");
  const i = SRV.indexOf("async function handleCoreFuse");
  assert.ok(i > 0, "handler absent");
  const bloc = SRV.slice(i, SRV.indexOf("\nasync function ", i));
  assert.match(bloc, /requireWalletAuth/, "authentification manquante");
  assert.match(bloc, /req\.authenticated_wallet !== wallet/, "le token doit correspondre au wallet");
  assert.match(bloc, /FOR UPDATE/, "verrou de ligne manquant (course sur le solde)");
  assert.match(bloc, /deductBalance\(client, wallet, cost\)/, "débit absent");
  assert.match(bloc, /addToBuyback\(client, wallet, cost\)/, "le coût doit partir au buyback");
  assert.match(bloc, /stripCoreRefs\(creatures, core_ids\)/, "un core consommé doit quitter son porteur");
  assert.match(bloc, /"core_fuse"/, "audit forge_history manquant");
  assert.match(bloc, /core_rarity_mismatch/, "garde de rareté manquante");
  assert.match(bloc, /core_max_rarity/, "garde de rareté max manquante");
});

testServeur("serveur : le désenchantement garde ses gardes d'argent (split du remboursement)", () => {
  const i = SRV.indexOf("async function handleEquipDisenchant");
  const bloc = SRV.slice(i, SRV.indexOf("\nasync function ", i));
  assert.match(bloc, /isCoreInstance\(item\)/, "branche core absente");
  assert.match(bloc, /\(isCore \? CORE_BUYBACK : RELIC_BUYBACK\)\[item\.rarity\]/, "table de valeur par famille absente");
  assert.match(bloc, /isCore \? stripCoreRefs\(creatures, \[item_id\]\) : stripRelicRefs\(creatures, \[item_id\]\)/, "libération du bon slot absente");
  assert.match(bloc, /creditRefundSplit/, "le crédit doit suivre les colonnes qui ont payé le coût");
  assert.match(bloc, /objet_invalide/, "garde objet ni relique ni core absente");
  assert.match(bloc, /family: isCore \? "core" : "relic"/, "l'audit doit dire la famille");
});
