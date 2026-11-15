"use strict";
// Forge d'équipement des CORES (25/09) — miroir de l'onglet Reliques.
//
// Décisions actées (recyclage en fragments depuis le 15/11/2026) :
//   - 3 cores de même rareté → 1 core de la rareté supérieure (100 %), core aléatoire
//   - barèmes IDENTIQUES aux reliques : fusion 2 000/5 000/15 000 FA ;
//     recyclage 30/75/180/300 fragments du rang, sans gain ni frais en FA.
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
  assert.deepStrictEqual(D.CORE_FUSE_COSTS, D.RELIC_FUSE_COSTS);
  for (const [rarity, fragments] of Object.entries({ Common: 30, Rare: 75, Epic: 180, Legendary: 300 })) {
    const coreState = F.disenchantState({ sel: [core("c1", rarity)], balance: 0, busy: false });
    const relicState = F.disenchantState({ sel: [relic("r1", rarity)], balance: 0, busy: false });
    assert.strictEqual(coreState.fragments, fragments, rarity + " : barème de recyclage incorrect");
    assert.deepStrictEqual(coreState, relicState, rarity + " : les deux familles rendent les mêmes fragments");
  }
  assert.ok(!Object.hasOwn(D.CORE_FUSE_COSTS, "Legendary"), "un core Legendary ne fusionne pas");
});

test("recyclage : aucun frais ni gain en FA pour les deux familles", () => {
  for (const item of [core("c1"), relic("r1", "Common")]) {
    const state = F.disenchantState({ sel: [item], balance: 0, busy: false });
    assert.strictEqual(state.fee, 0, "l'objet est le seul coût du recyclage");
    assert.strictEqual(state.value, 0, "aucun crédit en FA");
    assert.strictEqual(state.net, 0, "aucun gain net en FA");
    assert.strictEqual(state.showInsufficient, false, "le solde FA ne limite pas le recyclage");
  }
});

testServeur("fusion et recyclage alignés sur le serveur (source de vérité)", () => {
  assert.match(SRV, /const CORE_FUSE_COSTS = \{ Common: 2000, Rare: 5000, Epic: 15000 \};/);
  const i = SRV.indexOf("async function handleEquipDisenchant");
  assert.ok(i >= 0, "handler de recyclage absent");
  const bloc = SRV.slice(i, SRV.indexOf("\nasync function ", i));
  assert.match(bloc, /value:\s*0/, "le recyclage serveur ne doit plus créditer de FA");
  assert.match(bloc, /cost:\s*0/, "le recyclage serveur ne doit plus facturer de FA");
  assert.match(bloc, /\bfragments\b/, "le serveur doit renvoyer les fragments crédités");
  assert.match(bloc, /\brank\b/, "le serveur doit préciser le rang des fragments");
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

test("disenchantState : un core Common rend 30 fragments C, même avec zéro FA", () => {
  const s = F.disenchantState({ sel: [core("c1")], balance: 1000, busy: false });
  assert.strictEqual(s.value, 0);
  assert.strictEqual(s.fee, 0);
  assert.strictEqual(s.net, 0);
  assert.strictEqual(s.fragments, 30);
  assert.strictEqual(s.rank, "C");
  assert.strictEqual(s.disabled, false);
  const pauvre = F.disenchantState({ sel: [core("c1")], balance: 0, busy: false });
  assert.deepStrictEqual(pauvre, s, "un compte à zéro FA peut recycler sans avertissement de solde");
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
  const action = APP.match(/async equipDisenchant\(itemId\) \{[\s\S]*?\n    \},/);
  assert.ok(action, "action de recyclage absente d'app.jsx");
  assert.match(action[0], /value:\s*0/, "le recyclage ne doit jamais annoncer un crédit en FA");
  assert.match(action[0], /fragments:\s*data\.fragments/, "les fragments crédités doivent venir du serveur");
  assert.match(action[0], /rank:\s*data\.rank/, "le rang des fragments doit venir du serveur");
  assert.doesNotMatch(action[0], /BUYBACK|DISENCHANT_FEE/, "le recyclage ne dépend plus des anciens barèmes en FA");
});

test("libellés dédiés : aucun texte de relique dans la forge de cores", () => {
  for (const k of ["FG_CORE_EQ_TITLE", "FG_CORE_EQ_SUB", "FG_CORE_EQ_FUSE_BTN", "FG_CORE_EQ_FUSE_HINT", "FG_CORE_EQ_FUSE_OK",
                   "FG_CORE_EQ_MAX_RARITY", "FG_CORE_EQ_SEL_MAX", "FG_CORE_EQ_DIS_BTN", "FG_CORE_EQ_DIS_CONFIRM", "FG_CORE_EQ_DIS_OK"]) {
    assert.match(EQ, new RegExp(k), k + " non utilisé par l'écran");
  }
  assert.ok(!/FG_EQ_FUSE_BTN|FG_EQ_DIS_BTN|FG_EQ_SEL_MAX|FG_EQ_MAX_RARITY/.test(EQ), "libellé de relique dans la forge de cores");
});

test("recyclage : fragments affichés avant confirmation et crédit serveur annoncé au succès", () => {
  for (const [section, prefix] of [[blocFn("ForgeEquipement"), "FG_EQ"], [EQ, "FG_CORE_EQ"]]) {
    assert.match(section, /dis\.fragments != null/, "le détail exige exactement un objet recyclable");
    assert.match(section, /I18N\.t\("FG_EQ_DIS_BREAKDOWN", fmt\(dis\.fragments \|\| 0\)\)/, "les fragments doivent être affichés avant confirmation");
    assert.match(section, new RegExp('I18N\\.t\\("' + prefix + '_DIS_BTN", fmt\\(dis\\.fragments \\|\\| 0\\)\\)'), "le bouton doit annoncer les fragments formatés");
    assert.match(section, new RegExp('I18N\\.t\\("' + prefix + '_DIS_OK", fmt\\(r\\.fragments \\|\\| 0\\)\\)'), "le toast doit annoncer les fragments réellement crédités");
    assert.match(section, new RegExp(prefix + "_DIS_CONFIRM"), "la destruction de l'objet exige confirmation");
    assert.doesNotMatch(section, /dis\.(?:value|fee|net|showInsufficient)\b|buybackFor/, "aucun affichage ni blocage FA au recyclage");
  }
  assert.match(blocFn("ForgeEquipement"), /I18N\.t\("FG_EQ_FUSE_BTN", fmt\(fuse\.cost \|\| 0\)\)/, "cout de fusion non formate");
});

test("i18n : clés de la forge de cores et codes serveur, FR/EN/ZH complets", () => {
  for (const k of ["FG_CORE_EQ_TITLE", "FG_CORE_EQ_SUB", "FG_CORE_EQ_FUSE_BTN", "FG_CORE_EQ_FUSE_HINT", "FG_CORE_EQ_FUSE_OK",
                   "FG_CORE_EQ_MAX_RARITY", "FG_CORE_EQ_SEL_MAX", "FG_CORE_EQ_DIS_BTN", "FG_CORE_EQ_DIS_CONFIRM", "FG_CORE_EQ_DIS_OK",
                   "FG_EQ_ERR_core_ids_invalide", "FG_EQ_ERR_core_introuvable", "FG_EQ_ERR_pas_un_core",
                   "FG_EQ_DIS_BREAKDOWN",
                   "FG_EQ_ERR_core_rarity_mismatch", "FG_EQ_ERR_core_max_rarity", "FG_EQ_ERR_objet_invalide"]) {
    assert.match(I18N_SRC, new RegExp(k + ': \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\}'), k + " : FR/EN/ZH incomplets");
  }
});

test("i18n : le recyclage annonce des fragments, jamais un gain FA, en FR/EN/ZH", () => {
  for (const key of ["FG_EQ_SUB", "FG_EQ_DIS_BTN", "FG_EQ_DIS_CONFIRM", "FG_EQ_DIS_BREAKDOWN", "FG_EQ_DIS_OK",
                     "FG_CORE_EQ_SUB", "FG_CORE_EQ_DIS_BTN", "FG_CORE_EQ_DIS_CONFIRM", "FG_CORE_EQ_DIS_OK"]) {
    const entry = I18N_SRC.match(new RegExp(key + ':\\s*\\{\\s*FR: "([^"]+)",\\s*EN: "([^"]+)",\\s*ZH: "([^"]+)",?\\s*\\}'));
    assert.ok(entry, key + " : traduction manquante");
    for (const [index, language, unit] of [[1, "FR", /fragments/], [2, "EN", /fragments/], [3, "ZH", /碎片/]]) {
      assert.match(entry[index], unit, key + " : fragments absents en " + language);
      assert.doesNotMatch(entry[index], /[+−-]?%[ds]\s*FA|\b(?:net|fee|frais)\b/i, key + " : ancien contrat FA en " + language);
      if (key.endsWith("_SUB")) {
        assert.doesNotMatch(entry[index], /\bFA\b/, key + " : le sous-titre ne doit plus promettre de FA en " + language);
      }
    }
  }
});

// ---- Serveur : fusion en FA et recyclage en fragments ----

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

testServeur("serveur : le recyclage libère l'objet et crédite les fragments de sa famille", () => {
  const i = SRV.indexOf("async function handleEquipDisenchant");
  assert.ok(i >= 0, "handler de recyclage absent");
  const bloc = SRV.slice(i, SRV.indexOf("\nasync function ", i));
  assert.match(bloc, /isCoreInstance\(item\)/, "branche core absente");
  assert.match(bloc, /isCore \? stripCoreRefs\(creatures, \[item_id\]\) : stripRelicRefs\(creatures, \[item_id\]\)/, "libération du bon slot absente");
  assert.match(bloc, /core_fragments/, "les fragments d'un core doivent revenir aux cores");
  assert.match(bloc, /relic_fragments/, "les fragments d'une relique doivent revenir aux reliques");
  assert.doesNotMatch(bloc, /creditRefundSplit|deductBalance|addToBuyback/, "aucun crédit, frais ou buyback en FA au recyclage");
  assert.match(bloc, /objet_invalide/, "garde objet ni relique ni core absente");
  assert.match(bloc, /family: isCore \? "core" : "relic"/, "l'audit doit dire la famille");
});
