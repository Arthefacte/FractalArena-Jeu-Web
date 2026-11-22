/* Fusion de rareté (75 % unique + tickets Argent) et fusion de RANG 3 → 1 en place —
   décisions fondateur : 13/10/2026 (axe de rang), 21/11/2026 (« on arrête de supprimer
   l'effort qui a été fait » : la carte GARDÉE monte d'un rang SUR PLACE, les deux autres
   sont détruites). Serveur déjà livré (forge.js : POST /forge/rank-fuse, `kept_id`,
   garde de rareté → `rarity_mismatch`).

   Ce que ces tests tiennent, dans l'ordre où ça coûte de l'argent au joueur :
     1. les barèmes miroirs du client sont EXACTEMENT ceux du serveur (un écart ici paie
        un prix que le serveur refuse, ou annonce une réussite fausse) ;
     2. la fusion de rang exige MÊME rang ET MÊME rareté, refuse une 4ᵉ entité et le rang S ;
     3. l'avertissement obligatoire nomme ce qui SURVIT (nom, rang → rang suivant, niveau,
        XP, rareté, art) et ce qui PART (les deux autres, avec niveau, XP, talents,
        équipement) — c'est une exigence produit, pas une décoration ;
     4. l'onglet de rang est SÉPARÉ de la fusion de rareté (deux blocs semblables dans le
        même écran font déclencher la mauvaise opération — vécu sur les forges de fragments) ;
     5. le contrat réseau envoie `kept_id` (plus de `template_id`), et les nouveaux codes
        serveur sont mappés dans SERVER_ERROR_KEYS (sinon le joueur lit « Une erreur est
        survenue ») avec chaque phrase en FR, EN et ZH ;
     6. aucune phrase ne raconte plus l'ancienne règle : plus d'« entité neuve », de
        « niveau 1 », de « meilleur tirage des trois ».
   Vérification au niveau SOURCE pour le JSX (il n'est pas exécutable en node). */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../data.js");
require("../forge-ui.js");
const D = window.FA_DATA;
const F = window.FA_FORGE_UI;

const RACINE = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const SCREENS = lire("screens.jsx");
const APP = lire("app.jsx");
const I18N = lire("i18n.js");

// ---- 1. Barèmes miroirs ----

test("le taux de fusion est de 75 % aux TROIS paliers (et plus 60/45/30)", () => {
  assert.deepStrictEqual(D.FORGE.FUSION_RATE, { Common: 0.75, Rare: 0.75, Epic: 0.75 });
});

test("prix des tickets Argent et coûts de rang : mêmes chiffres que le serveur", () => {
  assert.deepStrictEqual(D.FORGE.FUSION_SILVER_TICKETS, { Common: 5, Rare: 15, Epic: 50 });
  assert.deepStrictEqual(D.FORGE.RANK_FUSE_COST, { C: 5000, B: 15000, A: 50000 });
  // Les coûts en FA ne bougent pas (décision : seule la vitesse du 100 % est nouvelle).
  assert.deepStrictEqual(D.FORGE.FUSION_COST, { Common: 3000, Rare: 8000, Epic: 25000 });
});

test("fusionButtonState mode Argent : exige le prix du palier, IGNORE le solde FA", () => {
  const ok = F.fusionButtonState({ silver: true, silverCost: 15, cost: 8000, balance: 0, ticketsSilver: 15, busy: false });
  assert.strictEqual(ok.disabled, false, "solde FA nul ne bloque pas une fusion payée en tickets Argent");
  assert.strictEqual(ok.showInsufficient, false, "pas d'avertissement de solde FA hors du mode FA");
  const ko = F.fusionButtonState({ silver: true, silverCost: 15, cost: 8000, balance: 99999, ticketsSilver: 14, busy: false });
  assert.strictEqual(ko.disabled, true, "il manque un ticket Argent");
  assert.strictEqual(ko.showSilverMissing, true, "le manque de tickets doit se dire");
});

test("fusionButtonState : le mode FA garde exactement son ancien comportement", () => {
  assert.strictEqual(F.fusionButtonState({ cost: 3000, balance: 3000, ticketsGold: 0, busy: false }).disabled, false);
  const ko = F.fusionButtonState({ cost: 3000, balance: 2999, busy: false });
  assert.strictEqual(ko.disabled, true);
  assert.strictEqual(ko.showInsufficient, true);
});

// ---- 2. Fusion de rang : paliers et sélection ----

const ent = (id, rank, rarity, over) => Object.assign({
  id, rank, rarity, level: 1, xp: 0, template_name: "HashByte-1", type: "HASH",
}, over || {});

test("rankNext suit RANK_LIST du client ; rankFuseCost refuse le rang S", () => {
  assert.strictEqual(F.rankNext("C"), "B");
  assert.strictEqual(F.rankNext("B"), "A");
  assert.strictEqual(F.rankNext("A"), "S");
  assert.strictEqual(F.rankNext("S"), null, "S est le sommet : rien au-dessus");
  assert.strictEqual(F.rankFuseCost("C"), 5000);
  assert.strictEqual(F.rankFuseCost("A"), 50000);
  assert.strictEqual(F.rankFuseCost("S"), null, "un rang S n'est pas fusionnable, pas gratuit pour autant");
});

test("rankSelToggle : MÊME rang ET MÊME rareté, 3 maximum, re-clic = retrait", () => {
  const a = ent("a", "B", "Rare"), b = ent("b", "B", "Rare"), c = ent("c", "B", "Rare");
  const s1 = F.rankSelToggle([], a);
  assert.deepStrictEqual(s1.map((x) => x.id), ["a"]);
  const s2 = F.rankSelToggle(s1, b);
  const s3 = F.rankSelToggle(s2, c);
  assert.strictEqual(s3.length, 3);
  assert.strictEqual(F.rankSelToggle(s3, ent("d", "B", "Rare")), null, "une 4ᵉ entité est refusée");
  assert.strictEqual(F.rankSelToggle(s2, ent("e", "A", "Rare")), null, "un autre rang est refusé");
  assert.strictEqual(F.rankSelToggle(s2, ent("f", "B", "Epic")), null,
    "une autre RARETÉ est refusée : la gardée conserve la sienne (21/11/2026)");
  assert.strictEqual(F.rankSelToggle(s2, ent("g", "B", "Legendary")), null);
  assert.deepStrictEqual(F.rankSelToggle(s3, c).map((x) => x.id), ["a", "b"], "le retrait reste possible à 3");
  assert.deepStrictEqual(F.rankSelToggle(s2, a).map((x) => x.id), ["b"], "re-cliquer retire l'entité");
  assert.deepStrictEqual(s2.map((x) => x.id), ["a", "b"], "immutabilité de la sélection");
});

// Même défaut que le serveur : une entité antérieure au champ `rank` est une C, une entité
// sans `rarity` est une Commune. Sans ça, deux cartes que l'écran montre identiques sont
// refusées par la garde de sélection.
test("rankSelToggle : rang et rareté absents sont lus C / Commune, comme à l'écran", () => {
  const sansRang = { id: "a", rarity: "Common" }, sansRang2 = { id: "b", rarity: "Common" };
  assert.deepStrictEqual(F.rankSelToggle([sansRang], sansRang2).map((x) => x.id), ["a", "b"]);
  assert.deepStrictEqual(F.rankSelToggle([ent("x", "C", "Common")], { id: "y", rank: "C" }).map((x) => x.id), ["x", "y"],
    "deux Communes dont une sans champ rarity");
  assert.strictEqual(F.rankSelToggle([ent("x", "C", "Common")], { id: "z", rarity: "Rare" }), null);
});

test("rankFuseState : prêt à 3, bloqué par le solde, rang S signalé", () => {
  const sel = [ent("a", "B", "Rare"), ent("b", "B", "Rare"), ent("c", "B", "Rare")];
  const ok = F.rankFuseState({ sel, balance: 15000, busy: false });
  assert.strictEqual(ok.disabled, false);
  assert.strictEqual(ok.cost, 15000);
  assert.strictEqual(ok.nextRank, "A");
  assert.strictEqual(ok.maxRank, false);
  const pauvre = F.rankFuseState({ sel, balance: 14999, busy: false });
  assert.strictEqual(pauvre.disabled, true);
  assert.strictEqual(pauvre.showInsufficient, true);
  const incomplet = F.rankFuseState({ sel: sel.slice(0, 2), balance: 999999, busy: false });
  assert.strictEqual(incomplet.disabled, true);
  assert.strictEqual(incomplet.missing, 1);
  const sommet = F.rankFuseState({ sel: sel.map((x) => ent(x.id, "S", "Rare")), balance: 999999, busy: false });
  assert.strictEqual(sommet.disabled, true);
  assert.strictEqual(sommet.maxRank, true, "le rang S doit être annoncé comme le sommet");
});

// ---- 3. Choix de la carte gardée, et l'avertissement nomme ce qui part ----

test("rankFuseKeptChoices : une entrée par carte, avec de quoi l'identifier", () => {
  const sel = [ent("a", "C", "Rare", { template_name: "HashByte-1", type: "HASH", level: 12, name: "Genesis #690", summon_roll_pct: 71.5 }),
               ent("b", "C", "Rare", { template_name: "Block-2", type: "BLOCK", level: 4, name: "Miner #880" }),
               ent("c", "C", "Rare", { template_name: "HashByte-1", type: "HASH", level: 1, name: "Genesis #298" })];
  const choices = F.rankFuseKeptChoices(sel);
  assert.strictEqual(choices.length, 3, "les TROIS cartes sont des candidates, jumelles comprises");
  assert.deepStrictEqual(choices.map((c) => c.id), ["a", "b", "c"], "dans l'ordre de sélection");
  const a = choices[0];
  assert.strictEqual(a.name, "Genesis #690");
  assert.strictEqual(a.template_name, "HashByte-1");
  assert.strictEqual(a.type, "HASH");
  assert.strictEqual(a.level, 12);
  assert.strictEqual(a.rarity, "Rare");
  assert.strictEqual(a.rollPct, 71.5);
  assert.strictEqual(choices[1].rollPct, null, "tirage absent : null, jamais un zéro inventé");
  // Le nom personnalisé prime (displayName) : c'est celui que le joueur lit sur sa carte.
  assert.strictEqual(F.rankFuseKeptChoices([ent("a", "C", "Rare", { custom_name: "Alpha" })])[0].name, "Alpha");
  assert.deepStrictEqual(F.rankFuseKeptChoices(null), [], "entrée vide : liste vide, pas de plantage");
});

test("rankFuseWarning : ce qui survit + les DEUX qui partent, avec niveau, XP, talents, équipement", () => {
  const sel = [
    ent("a", "C", "Common", { level: 12, xp: 340, relic_id: "rel_1", talents: { tier25: "hash_surchauffe" } }),
    ent("b", "C", "Common", { level: 7, xp: 90, core_id: "core_9" }),
    ent("c", "C", "Common", { level: 1, xp: 0, talents: { tier25: "x", tier50: "y" } }),
  ];
  const w = F.rankFuseWarning(sel, "a");
  assert.ok(w, "une sélection complète doit produire un avertissement");
  assert.strictEqual(w.kept.id, "a");
  assert.strictEqual(w.kept.level, 12, "la gardée garde son niveau");
  assert.strictEqual(w.kept.xp, 340, "la gardée garde son XP");
  assert.deepStrictEqual(w.sacrificed.map((l) => l.id), ["b", "c"], "les deux autres partent");
  assert.strictEqual(w.sacrificed[0].level, 7);
  assert.strictEqual(w.sacrificed[0].equipment, 1, "le core de la sacrifiée est nommé");
  assert.strictEqual(w.sacrificed[1].talents, 2);
  assert.strictEqual(w.lostXp, 90, "seul l'XP des deux sacrifiées est perdu");
  assert.strictEqual(w.lostTalents, 2);
  assert.strictEqual(w.lostEquipment, 1);
  // L'ancienne règle ne doit plus être décrite nulle part dans l'avertissement.
  assert.ok(!("targetRarity" in w), "plus de rareté cible : la gardée conserve la sienne");
  assert.ok(!("bestRollPct" in w), "plus de « meilleur tirage des trois »");
  assert.strictEqual(F.rankFuseWarning(sel.slice(0, 2), "a"), null, "rien à annoncer avant les 3 entités");
  assert.strictEqual(F.rankFuseWarning([{ id: "z" }], "z"), null, "entité sans stats : jamais de NaN");
});

test("rankFuseWarning : gardée par défaut = la première, et un id inconnu ne casse rien", () => {
  const sel = [ent("a", "B", "Rare"), ent("b", "B", "Rare"), ent("c", "B", "Rare")];
  assert.strictEqual(F.rankFuseWarning(sel).kept.id, "a", "défaut = première sélectionnée");
  assert.strictEqual(F.rankFuseWarning(sel, null).kept.id, "a");
  const inconnu = F.rankFuseWarning(sel, "zzz");
  assert.strictEqual(inconnu.kept.id, "a", "un id hors sélection retombe sur la première");
  assert.strictEqual(inconnu.sacrificed.length, 2);
  // Chaque carte peut être la gardée : le total perdu suit.
  const ids = ["a", "b", "c"];
  for (const id of ids) {
    const w = F.rankFuseWarning(sel.map((x, i) => ent(x.id, "B", "Rare", { xp: (i + 1) * 10 })), id);
    assert.strictEqual(w.kept.id, id);
    assert.strictEqual(w.lostXp, 60 - (ids.indexOf(id) + 1) * 10);
  }
});

// ---- 4. Écran : onglet séparé, mode Argent, modale de confirmation ----

const fnBloc = (m) => {
  const i = SCREENS.indexOf("function " + m);
  assert.ok(i >= 0, m + " absent de screens.jsx");
  const fin = SCREENS.indexOf("\nfunction ", i + 1);
  return SCREENS.slice(i, fin > i ? fin : i + 2000);
};

test("la fusion de rang a son PROPRE onglet, jamais empilée sous la fusion de rareté", () => {
  assert.match(fnBloc("Forge"), /\{ k: "rangs"/, "onglet rangs absent de la barre de la Forge");
  assert.match(SCREENS, /\{tab === "rangs" && <ForgeRangs \/>\}/, "l'onglet rangs ne rend pas ForgeRangs");
  assert.ok(!/<ForgeRangs/.test(fnBloc("ForgeFusion")), "la fusion de rang ne doit pas vivre dans ForgeFusion");
  assert.match(I18N, /FG_RANGS: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/, "FG_RANGS incomplète");
});

test("aucun chiffre de barème recopié dans les composants de la Forge", () => {
  const b = fnBloc("ForgeFusion") + fnBloc("ForgeRangs");
  assert.ok(!/0\.75|5000|15000|50000/.test(b), "les coûts et le taux doivent venir de D.FORGE");
  assert.match(fnBloc("ForgeFusion"), /D\.FORGE\.FUSION_SILVER_TICKETS/, "prix Argent lu du miroir");
  assert.match(fnBloc("ForgeRangs"), /F\.rankFuseState/, "état du bouton calculé par le helper testé");
});

test("la fusion de rareté expose la vitesse Argent ET garde la vitesse Or", () => {
  const b = fnBloc("ForgeFusion");
  assert.match(b, /FG_SILVER_PRICE/, "le prix Argent doit être affiché");
  assert.match(b, /FG_FUSE_BTN_SILVER/, "le bouton doit nommer le prix Argent");
  assert.match(b, /FG_GOLD/, "la pastille Or reste");
  assert.match(b, /showSilverMissing/, "le manque de tickets Argent doit se dire");
});

test("l'avertissement de la fusion de rang est OBLIGATOIRE avant la validation", () => {
  const rangs = fnBloc("ForgeRangs");
  const modal = fnBloc("RankFuseWarningModal");
  // Le bouton d'action n'appelle JAMAIS la route : il ouvre la modale…
  assert.match(rangs, /onClick=\{\(\) => setConfirm\(true\)\}/, "le bouton d'action doit ouvrir l'avertissement");
  assert.ok(!/onClick=\{doRankFuse\}/.test(rangs), "le bouton d'action ne doit pas fusionner directement");
  // …et seul le bouton de CONFIRMATION de la modale déclenche l'opération.
  assert.match(rangs, /onConfirm=\{doRankFuse\}/, "la confirmation explicite doit porter l'appel");
  assert.match(modal, /onClick=\{onConfirm\}/);
  assert.match(modal, /FG_RANK_ALERT_CONFIRM/, "la confirmation doit être une phrase explicite, pas un simple « OK »");
  // Ce qui SURVIT : la carte gardée, nommée avec son rang actuel → le rang suivant.
  assert.match(modal, /FG_RANK_ALERT_NEW/, "la section « ce qui survit » doit exister");
  assert.match(modal, /FG_RANK_KEPT_LINE/, "la carte gardée doit être détaillée (nom, rang, niveau, XP, rareté)");
  assert.match(modal, /warn\.kept\.name/, "la gardée est nommée");
  assert.match(modal, /rarityLabel\(warn\.kept\.rarity\)/, "sa rareté est nommée (elle est conservée)");
  // Ce qui part : les DEUX lignes détaillées + le total perdu.
  assert.match(modal, /FG_RANK_ALERT_LINE/);
  assert.match(modal, /FG_RANK_LOST_LINE/, "chaque carte détruite doit être détaillée");
  assert.match(modal, /warn\.sacrificed/, "les deux sacrifiées viennent du helper, jamais recalculées ici");
  assert.match(modal, /FG_RANK_ALERT_TOTALS/);
  // Ce qui survit encore : reliques + cores rendus à l'inventaire.
  assert.match(modal, /FG_RANK_ALERT_EQUIP/, "le sort de l'équipement doit être dit");
  assert.match(modal, /FG_RANK_ALERT_COST/, "le coût doit être rappelé dans l'avertissement");
  // Plus rien de l'ancienne règle.
  assert.ok(!/FG_RANK_ALERT_QUALITY/.test(modal), "plus de rareté Commune imposée ni de « meilleur tirage »");
  assert.ok(!/warn\.bestRollPct/.test(modal));
  assert.ok(!/warn\.targetRarity/.test(modal));
});

test("l'onglet de rang laisse choisir la carte GARDÉE et affiche le rang visé", () => {
  const b = fnBloc("ForgeRangs");
  assert.match(b, /F\.rankFuseKeptChoices/, "les candidates viennent des trois entités sélectionnées");
  assert.match(b, /FG_RANK_KEEP/, "le choix de la gardée doit être libellé");
  assert.match(b, /setKeptSel\(b\.id\)/, "un clic sur « garder » désigne la gardée");
  assert.match(b, /e\.stopPropagation\(\)/, "ce clic ne doit pas décocher la carte (il remonterait au onClick de la carte)");
  assert.match(b, /FG_KEPT/, "la gardée est marquée « Conservée »");
  assert.match(b, /FG_SACRIFICED/, "les deux autres sont marquées « Sacrifiée »");
  assert.match(b, /F\.rankFuseWarning\(sel, keptId\)/, "l'avertissement reçoit la carte gardée");
  assert.match(b, /FG_RANK_TARGET/, "le rang visé doit être affiché");
  assert.match(b, /FG_RANK_SUCCESS/, "la réussite à 100 % doit être dite");
  assert.match(b, /FG_RANK_MAX/, "le refus du rang S doit être affiché");
  // Plus de sélecteur de TYPE : le type de la sortie est celui de la carte gardée.
  assert.ok(!/FG_RANK_TYPE/.test(b), "plus de « type de l'entité produite » : rien n'est produit");
  assert.ok(!/FG_CONSUMED/.test(b), "« consommée » décrivait les trois ; il y a maintenant une gardée");
});

// Décision fondateur du 03/11/2026, verbatim : « c'était pas la peine de préciser sur la carte
// en haut à gauche de mettre C, B ou A suivant le rang de la carte, parce qu'il y a déjà écrit
// le rang de la carte sur la carte ». L'art porte le rang (artFor → <type>_<rang>.webp) : pas
// de seconde étiquette posée dessus.
test("la grille de rang ne repose pas le rang sur l'art (il y est déjà)", () => {
  const b = fnBloc("ForgeRangs");
  assert.ok(!/D\.RANK_COLORS\[b\.rank\]/.test(b), "plus de pastille de rang colorée sur la carte");
  assert.ok(!/FG_RANK_MARK_TIP/.test(b), "plus d'infobulle de rang sur la carte");
  assert.ok(!/top: 8, left: 8/.test(b), "plus de pastille en haut-gauche");
  assert.match(b, /badge = role \?/, "la seule pastille restante est conditionnée au rôle");
});

// La rareté fait partie des critères de sélection : une carte grisée qui ne réagit pas se lit
// comme un bug, donc la grille et le refus doivent dire la MÊME chose.
test("la grille grise sur le rang ET la rareté, et le refus dit lequel des deux", () => {
  const b = fnBloc("ForgeRangs");
  assert.match(b, /F\.rankKey\(b\) === F\.rankKey\(sel\[0\]\)/, "le clic possible suit le rang");
  assert.match(b, /F\.rarityKey\(b\) === F\.rarityKey\(sel\[0\]\)/, "…et la rareté");
  assert.match(b, /FG_RANK_RARITY_MISMATCH/, "le refus de rareté mixte a son propre message");
  assert.match(b, /FG_RANK_MISMATCH/, "le refus de rang garde le sien");
  assert.match(b, /FG_RANK_SEL_MAX/, "le plafond de 3 garde le sien");
});

test("la modale nomme la carte qui survit et les deux qui partent, en FR/EN/ZH", () => {
  const i18n = require("../i18n.js");
  const lang = i18n.getLang();
  const code = require("@babel/standalone").transform(fnBloc("RankFuseWarningModal"), { presets: ["react"] }).code;
  const modal = require("node:vm").runInNewContext(code + "\nRankFuseWarningModal;", {
    React: { createElement: (tag, props, ...children) => ({ tag, props, children }) },
    window: { Modal: "modal" }, I18N: i18n, rarityLabel: (rarity) => i18n.t(rarity), fmt: String,
  });
  const sel = [ent("a", "B", "Legendary", { name: "Gardée #1", level: 14, xp: 720 }),
               ent("b", "B", "Legendary", { name: "Partie #2", level: 9, xp: 150, relic_id: "rel_1" }),
               ent("c", "B", "Legendary", { name: "Partie #3", level: 2, xp: 40, core_id: "core_2" })];
  const warn = F.rankFuseWarning(sel, "a");
  const state = F.rankFuseState({ sel, balance: 15000 });
  const text = (node) => node == null ? "" : Array.isArray(node) ? node.map(text).join("")
    : typeof node === "object" ? text(node.children) : String(node);
  const expectedKept = {
    FR: "Gardée #1 — rang B → A · niveau 14 · 720 XP · rareté Légendaire conservée · art conservé",
    EN: "Gardée #1 — rank B → A · level 14 · 720 XP · Legendary rarity kept · art kept",
    ZH: "Gardée #1 — B 阶 → A 阶 · 等级 14 · 720 XP · 稀有度 传说 保留 · 美术保留",
  };
  const expectedLost = {
    FR: "Partie #2 — rang B · niveau 9 · 150 XP · talents : 0 · équipements : 1",
    EN: "Partie #2 — rank B · level 9 · 150 XP · talents: 0 · equipment: 1",
    ZH: "Partie #2 — 阶位 B · 等级 9 · 150 XP · 天赋: 0 · 装备: 1",
  };
  try {
    for (const language of ["FR", "EN", "ZH"]) {
      i18n.setLang(language);
      const rendered = text(modal({ warn, state }));
      assert.ok(rendered.includes(expectedKept[language]), language + " : la carte gardée est détaillée");
      assert.strictEqual(rendered.split(expectedKept[language]).length, 2, "une seule ligne « survit »");
      assert.ok(rendered.includes(expectedLost[language]), language + " : la première sacrifiée est détaillée");
      assert.ok(rendered.includes("Partie #3"), language + " : la seconde sacrifiée est nommée aussi");
      assert.ok(rendered.indexOf(expectedKept[language]) < rendered.indexOf(i18n.t("FG_RANK_ALERT_CONFIRM")),
        "ce qui survit est annoncé avant le bouton");
      // Aucune trace de l'ancienne règle dans le rendu, dans AUCUNE langue. Les âges sont
      // bornés (`niveau 14` ne doit pas être pris pour `niveau 1`).
      for (const interdit of [/niveau 1(?!\d)/, /level 1(?!\d)/, /等级 1(?!\d)/, /NEUVE/, /NEW entity/,
                              /全新的/, /meilleur tirage/, /best roll/, /最佳抽取/, /Commune/, /Common/]) {
        assert.ok(!interdit.test(rendered), language + " : " + interdit + " ne doit plus apparaître");
      }
    }
  } finally {
    i18n.setLang(lang);
  }
});

// ---- 5. Réseau : la route de rang, le champ `kept_id`, le miroir du serveur ----

test("l'action rankFuse appelle POST /forge/rank-fuse avec les 3 ids et kept_id", () => {
  const i = APP.indexOf("async rankFuse(");
  assert.ok(i > 0, "action rankFuse absente");
  const b = APP.slice(i, APP.indexOf("\n    },", i));
  assert.match(b, /`\$\{API_URL\}\/forge\/rank-fuse`/);
  assert.match(b, /beast_ids: beastIds/);
  assert.match(b, /kept_id: kept/);
  assert.ok(!/template_id/.test(b), "le nouveau client n'envoie plus `template_id` (contrat 21/11/2026)");
  assert.match(b, /status !== "ok"/, "seul status ok est un succès");
});

test("l'action rankFuse envoie kept_id, refuse une rareté mixte et transmet le refus serveur", async () => {
  const start = APP.indexOf("async rankFuse(");
  const method = APP.slice(start, APP.indexOf("\n    },", start) + 6);
  const roster = [ent("a", "C", "Epic"), ent("b", "C", "Epic"), ent("c", "C", "Epic")];
  const calls = [];
  const rankFuse = require("node:vm").runInNewContext("({" + method + "}).rankFuse", {
    gRef: { current: { roster, wallet: "wallet-test", authToken: "test-token", liquid: 5000, locked: 0 } },
    D, I18N: { t: (key) => key }, API_URL: "https://example.invalid", svOpts: () => ({}),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return options.method === "POST"
        ? { json: async () => ({ status: "ok", beast: { id: "b", rank: "B", level: 9 }, kept_id: "b", new_rank: "B", cost: 5000, burn: 0, equipment_detached: [] }) }
        : { ok: false };
    },
  });
  const result = await rankFuse(["a", "b", "c"], "b");
  assert.strictEqual(result.ok, true, "la gardée désignée doit être acceptée");
  assert.strictEqual(result.keptId, "b", "l'action rend la carte gardée renvoyée par le serveur");
  assert.strictEqual(calls.length, 2, "fusion puis synchronisation existante");
  assert.strictEqual(calls[0].url, "https://example.invalid/forge/rank-fuse");
  assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
    wallet: "wallet-test", beast_ids: ["a", "b", "c"], kept_id: "b",
  });
  // Un id hors des trois retombe sur la première : le serveur refuserait `kept_id_invalide`,
  // donc le client ne doit jamais l'envoyer par accident.
  calls.length = 0;
  await rankFuse(["a", "b", "c"], "zzz");
  assert.deepStrictEqual(JSON.parse(calls[0].options.body).kept_id, "a", "kept_id hors sélection → première");
  // Rang différent : refus client, aucun appel réseau.
  calls.length = 0;
  roster[2].rank = "B";
  const refusedRank = await rankFuse(["a", "b", "c"], "b");
  assert.strictEqual(refusedRank.ok, false);
  assert.strictEqual(refusedRank.reason, "FG_RANK_MISMATCH");
  assert.strictEqual(calls.length, 0, "aucun appel en cas de rang différent");
  // Rareté différente : refus client avec SA clé, aucun appel réseau.
  roster[2].rank = "C";
  roster[2].rarity = "Rare";
  const refusedRarity = await rankFuse(["a", "b", "c"], "b");
  assert.strictEqual(refusedRarity.ok, false);
  assert.strictEqual(refusedRarity.reason, "FG_RANK_RARITY_MISMATCH");
  assert.strictEqual(calls.length, 0, "aucun appel en cas de rareté différente");
});

test("le refus serveur rarity_mismatch est traduit avec la phrase des TROIS entités", async () => {
  const start = APP.indexOf("async rankFuse(");
  const method = APP.slice(start, APP.indexOf("\n    },", start) + 6);
  const roster = [ent("a", "C", "Epic"), ent("b", "C", "Epic"), ent("c", "C", "Epic")];
  const rankFuse = require("node:vm").runInNewContext("({" + method + "}).rankFuse", {
    gRef: { current: { roster, wallet: "w", authToken: "t", liquid: 5000, locked: 0 } },
    D, I18N: { t: (key) => key }, API_URL: "https://example.invalid", svOpts: () => ({}),
    fetch: async () => ({ json: async () => ({ status: "error", reason: "rarity_mismatch" }) }),
  });
  const r = await rankFuse(["a", "b", "c"], "a");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "FG_RANK_RARITY_MISMATCH",
    "la phrase de la fusion 2 → 1 (« les deux entités ») serait fausse ici");
});

test("l'action fuse envoie le champ ticket (fa : aucun champ, comme le défaut serveur)", () => {
  const i = APP.indexOf("async fuse(");
  const b = APP.slice(i, APP.indexOf("\n    },", i));
  assert.match(b, /body\.ticket = mode/, "la vitesse choisie doit partir dans `ticket`");
  assert.match(b, /mode !== "fa"/, "en FA, aucun champ ticket : le serveur garde son défaut");
});

test("le compteur de tickets Argent consommé vient du SERVEUR (silver_spent)", () => {
  const i = APP.indexOf("async fuse(");
  const b = APP.slice(i, APP.indexOf("\n    },", i));
  assert.match(b, /data\.silver_spent/);
  assert.match(b, /ticketsSilver: Math\.max\(0, \(st\.ticketsSilver \|\| 0\) - data\.silver_spent\)/);
});

test("les codes serveur de la refonte sont mappés, et leurs phrases sont trilingues", () => {
  const codes = {
    max_rarity: "FG_ERR_max_rarity",
    rarity_mismatch: "FG_ERR_rarity_mismatch",
    no_gold_ticket: "FG_ERR_no_gold_ticket",
    no_silver_ticket: "FG_ERR_no_silver_ticket",
    ticket_invalide: "FG_ERR_ticket_invalide",
    rank_mismatch: "FG_ERR_rank_mismatch",
    rank_max: "FG_RANK_MAX",
    beast_ids_invalide: "FG_ERR_beast_ids_invalide",
    kept_id_invalide: "FG_ERR_kept_id_invalide",
    entite_introuvable: "FG_ERR_entite_introuvable",
  };
  for (const [code, cle] of Object.entries(codes)) {
    assert.match(I18N, new RegExp(`\\n    ${code}: "${cle}",`), `${code} doit pointer sur ${cle}`);
    assert.match(I18N, new RegExp(`\\n    ${cle}: \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\},`),
      `${cle} : FR/EN/ZH incomplets`);
  }
});

test("les phrases de l'onglet de rang et de la vitesse Argent existent en trois langues", () => {
  for (const cle of ["FG_RANGS", "FG_RANK_HINT", "FG_RANK_NONE", "FG_RANK_MISSING", "FG_RANK_MISMATCH",
                     "FG_RANK_RARITY_MISMATCH", "FG_RANK_KEEP", "FG_RANK_SEL_MAX", "FG_RANK_SUCCESS",
                     "FG_RANK_TARGET", "FG_RANK_MAX", "FG_RANK_BTN", "FG_RANK_OK",
                     "FG_RANK_ALERT_TITLE", "FG_RANK_ALERT_BODY", "FG_RANK_ALERT_NEW",
                     "FG_RANK_KEPT_LINE", "FG_RANK_ALERT_LINE", "FG_RANK_LOST_LINE",
                     "FG_RANK_ALERT_TOTALS", "FG_RANK_ALERT_EQUIP", "FG_RANK_ALERT_COST",
                     "FG_RANK_ALERT_CONFIRM", "FG_RANK_ALERT_BACK",
                     "FG_SILVER", "FG_SILVER_PRICE", "FG_FUSE_BTN_SILVER", "FG_SILVER_SHORT", "FG_FUSE_SILVER_OK"]) {
    assert.match(I18N, new RegExp(`\\n    ${cle}: \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\},`),
      `${cle} absente ou incomplète`);
  }
});

// La règle du 21/11/2026 rend fausses les phrases de l'ancienne : aucune ne doit survivre,
// dans aucune des trois langues (le joueur qui fusionne lit le mensonge en ZH comme en FR).
test("plus aucune phrase ne raconte l'ancienne règle (entité neuve, niveau 1, meilleur tirage)", () => {
  // Un âge borné : « niveau 100 » de l'invocation ne doit pas être pris pour « niveau 1 ».
  // « 全新的 » n'est pas dans cette liste : il dit aussi « un portefeuille tout neuf » ailleurs
  // dans i18n.js (ACC_HOWTO_2). La modale de rang est contrôlée langue par langue plus haut.
  const interdits = [/niveau 1(?!\d)/, /level 1(?!\d)/, /等级 1(?!\d)/, /entité NEUVE/, /NEW entity/,
                     /meilleur tirage/, /best roll/, /最佳抽取/, /rareté indifférente/,
                     /regardless of rarity/, /稀有度不限/];
  // On lit les PHRASES servies, pas les commentaires : la trace de la décision (« plus de
  // niveau 1 ») a le droit d'exister dans le code, jamais dans un libellé joueur.
  const libelles = I18N.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  for (const phrase of interdits) {
    assert.ok(!phrase.test(libelles), phrase + " traîne encore dans i18n.js");
  }
  // Les clés qui décrivaient l'ancien modèle ont disparu.
  for (const cle of ["FG_RANK_ALERT_QUALITY", "FG_RANK_TYPE", "FG_RANK_TYPE_HINT", "FG_CONSUMED"]) {
    assert.ok(!new RegExp(`\\n    ${cle}:`).test(I18N), `${cle} décrit une règle qui n'existe plus`);
  }
  assert.ok(!/FG_RANK_ALERT_QUALITY/.test(SCREENS), "l'écran ne doit plus mentionner la qualité produite");
});

test("la fusion de rang joue la cinématique de la Forge (mode rank) — et parle même si elle est sautée", () => {
  const debut = SCREENS.indexOf("async function doRankFuse");
  assert.ok(debut > 0, "doRankFuse introuvable dans screens.jsx");
  const bloc = SCREENS.slice(debut, SCREENS.indexOf("function RerollPreviewModal", debut));
  // Plafond de fenêtre : il sert à détecter que la tranche a débordé sur d'autres écrans,
  // pas à figer la taille du bloc. Relevé le 21/11 après le passage à `keptId` (~6 900 car.).
  assert.ok(bloc.length > 0 && bloc.length < 9000, "fenêtre de lecture de doRankFuse incohérente");
  // Le mode « rank » est ce qui distingue la fusion de rang : trois cœurs qui convergent
  // (forge-cine.js) au lieu du cœur unique de la fusion de rareté.
  assert.match(bloc, /FA_FORGE_CINE\.play\(/, "la cinématique doit être jouée après une fusion réussie");
  assert.match(bloc, /mode: "rank"/, "mode « rank » exigé");
  assert.match(bloc, /tier: r\.newRank/, "le palier joué est le rang ATTEINT");
  assert.match(bloc, /color: D\.RANK_COLORS\[r\.newRank\]/, "couleur du rang atteint, jamais d'une rareté");
  // Le résultat passe par onDone : un saut d'un clic, `prefers-reduced-motion` ou un module
  // absent rend le toast quand même — un silence après 50 000 FA serait le pire des cas.
  assert.match(bloc, /onDone: showResult/, "le résultat doit être rendu par onDone");
  assert.match(bloc, /else showResult\(\);/, "sans cinématique, le toast tombe quand même");
  assert.match(bloc, /FG_RANK_OK/, "la phrase de résultat reste utilisée");
  assert.match(bloc, /actions\.rankFuse\(sel\.map\(\(b\) => b\.id\), keptId\)/, "l'appel porte la carte gardée");
});

// Demande fondateur du 03/11/2026 : l'équipement des entités détruites doit être retiré
// automatiquement, et le joueur doit le SAVOIR — pas le découvrir en fouillant l'inventaire.
test("l'équipement détaché est annoncé au joueur après la fusion", () => {
  const app = APP;
  assert.match(app, /equipment_detached/, "l'action lit le champ renvoyé par le serveur");
  assert.match(app, /equipmentDetached: Array\.isArray\(data\.equipment_detached\)/,
    "le champ est normalise (jamais undefined) avant d'atteindre l'écran");
  const b = fnBloc("ForgeRangs");
  assert.match(b, /FG_RANK_EQUIP_BACK/, "un second toast nomme le nombre d'items récupérés");
  assert.match(I18N, /FG_RANK_EQUIP_BACK: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/, "clé trilingue");
  // La modale doit dire la règle AVANT de valider, pas seulement après.
  const hint = I18N.match(/FG_RANK_ALERT_EQUIP: \{ FR: "([^"]+)"/);
  assert.match(hint[1], /retiré automatiquement/, "l'avertissement annonce le détachement automatique");
  assert.match(hint[1], /La carte gardée garde le sien/, "…et que la gardée conserve son propre équipement");
});

// Vécu du 05/11/2026 : trois rang C à l'écran, et « Rang S : sommet atteint » au moment de
// valider. Cause : le champ `rank` manquait (entités antérieures au système de rang), lu en
// brut côté action alors que l'affichage le défautait en « C ». Le rang se lit maintenant
// avec le MÊME défaut partout.
test("le rang absent est lu en C côté action, jamais pris pour un rang S", () => {
  assert.match(APP, /const rankOf = \(b\) => \(b && D\.RANK_LIST\.includes\(b\.rank\) \? b\.rank : "C"\)/,
    "défaut C identique à l'affichage");
  assert.match(APP, /const rank = rankOf\(picked\[0\]\)/, "le coût se calcule sur le rang normalisé");
  assert.match(APP, /FG_RANK_BAD_RANK/, "un rang illisible a son propre refus, pas « rang S »");
  assert.match(I18N, /FG_RANK_BAD_RANK: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/, "clé trilingue");
});
