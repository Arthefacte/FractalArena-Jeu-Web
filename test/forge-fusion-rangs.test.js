/* Fusion de rareté (75 % unique + tickets Argent) et fusion de RANG 3 → 1 — décisions
   fondateur du 13/10/2026, serveur déjà écrit (forge.js : FUSION_SUCCESS_RATE 0.75,
   FUSION_SILVER_TICKETS, RANK_FUSE_COSTS, POST /forge/rank-fuse).

   Ce que ces tests tiennent, dans l'ordre où ça coûte de l'argent au joueur :
     1. les barèmes miroirs du client sont EXACTEMENT ceux du serveur (un écart ici paie
        un prix que le serveur refuse, ou annonce une réussite fausse) ;
     2. la fusion de rang accepte les raretés mélangées, refuse un autre rang, une 4ᵉ entité et le rang S ;
     3. l'avertissement obligatoire nomme niveau, XP, talents et équipement des TROIS
        entités qui partent — c'est une exigence produit, pas une décoration ;
     4. l'onglet de rang est SÉPARÉ de la fusion de rareté (deux blocs semblables dans le
        même écran font déclencher la mauvaise opération — vécu sur les forges de fragments) ;
     5. les nouveaux codes serveur sont mappés dans SERVER_ERROR_KEYS (sinon le joueur lit
        « Une erreur est survenue ») et chaque phrase existe en FR, EN et ZH.
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

test("rankSelToggle : même rang, raretés mélangées acceptées, 3 maximum, re-clic = retrait", () => {
  const a = ent("a", "B", "Rare"), b = ent("b", "B", "Common"), c = ent("c", "B", "Legendary");
  const s1 = F.rankSelToggle([], a);
  assert.deepStrictEqual(s1.map((x) => x.id), ["a"]);
  const s2 = F.rankSelToggle(s1, b);
  const s3 = F.rankSelToggle(s2, c);
  assert.strictEqual(s3.length, 3);
  assert.strictEqual(F.rankSelToggle(s3, ent("d", "B", "Rare")), null, "une 4ᵉ entité est refusée");
  assert.strictEqual(F.rankSelToggle(s2, ent("e", "A", "Rare")), null, "un autre rang est refusé");
  assert.deepStrictEqual(F.rankSelToggle(s2, ent("f", "B", "Epic")).map((x) => x.id), ["a", "b", "f"], "une autre rareté est acceptée");
  assert.deepStrictEqual(F.rankSelToggle(s3, c).map((x) => x.id), ["a", "b"], "le retrait reste possible à 3");
  assert.deepStrictEqual(F.rankSelToggle(s2, a).map((x) => x.id), ["b"], "re-cliquer retire l'entité");
  assert.deepStrictEqual(s2.map((x) => x.id), ["a", "b"], "immutabilité de la sélection");
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

// ---- 3. L'avertissement nomme ce qui part ----

test("rankFuseTemplates : un type par template DISTINCT des trois entités sacrifiées", () => {
  const sel = [ent("a", "C", "Common", { template_name: "HashByte-1", type: "HASH", name: "Genesis #690" }),
               ent("b", "C", "Common", { template_name: "Block-2", type: "BLOCK", name: "Miner #880" }),
               ent("c", "C", "Common", { template_name: "HashByte-1", type: "HASH", name: "Genesis #298" })];
  const t = F.rankFuseTemplates(sel);
  assert.deepStrictEqual(t.map((x) => x.template_name), ["HashByte-1", "Block-2"], "pas de doublon");
  assert.deepStrictEqual(t.map((x) => x.label), ["HashByte", "Block"], "le libellé est le TYPE (affinités)");
});

test("rankFuseTemplates : chaque type nomme TOUTES ses entités sources (deux jumelles ne disparaissent pas)", () => {
  const sel = [ent("a", "C", "Common", { template_name: "HashByte-1", type: "HASH", name: "Genesis #690" }),
               ent("b", "C", "Common", { template_name: "Block-2", type: "BLOCK", name: "Miner #880" }),
               ent("c", "C", "Common", { template_name: "HashByte-1", type: "HASH", name: "Genesis #298" })];
  const t = F.rankFuseTemplates(sel);
  assert.deepStrictEqual(t[0].sources.map((s) => s.name), ["Genesis #690", "Genesis #298"],
    "deux entités du même template : les DEUX noms, dans l'ordre de sélection");
  assert.deepStrictEqual(t[0].sources.map((s) => s.id), ["a", "c"]);
  assert.deepStrictEqual(t[1].sources.map((s) => s.name), ["Miner #880"], "une seule entité : un seul nom");
  // Le nom personnalisé prime (displayName) : c'est celui que le joueur lit sur sa carte.
  const renomme = F.rankFuseTemplates([ent("a", "C", "Common", { template_name: "HashByte-1", type: "HASH", name: "Genesis #690", custom_name: "Alpha" })]);
  assert.deepStrictEqual(renomme[0].sources.map((s) => s.name), ["Alpha"]);
});

test("rankFuseWarning : niveau, XP, talents et équipement des TROIS entités", () => {
  const sel = [
    ent("a", "C", "Common", { level: 12, xp: 340, relic_id: "rel_1", talents: { tier25: "hash_surchauffe" } }),
    ent("b", "C", "Common", { level: 7, xp: 90, core_id: "core_9" }),
    ent("c", "C", "Common", { level: 1, xp: 0, talents: { tier25: "x", tier50: "y" } }),
  ];
  const w = F.rankFuseWarning(sel);
  assert.ok(w, "une sélection complète doit produire un avertissement");
  assert.strictEqual(w.lines.length, 3);
  assert.strictEqual(w.lines[0].level, 12);
  assert.strictEqual(w.lines[0].xp, 340);
  assert.strictEqual(w.lines[0].talents, 1);
  assert.strictEqual(w.lines[0].equipment, 1, "la relique équipée est nommée");
  assert.strictEqual(w.lines[1].equipment, 1, "le core équipé est nommé");
  assert.strictEqual(w.lines[2].talents, 2);
  assert.strictEqual(w.totalXp, 430);
  assert.strictEqual(w.totalTalents, 3);
  assert.strictEqual(w.totalEquipment, 2);
  assert.strictEqual(w.targetRarity, "Common");
  assert.strictEqual(w.bestRollPct, null, "aucun tirage renseigné : pas de pourcentage inventé");
  assert.strictEqual(F.rankFuseWarning(sel.slice(0, 2)), null, "rien à annoncer avant les 3 entités");
  assert.strictEqual(F.rankFuseWarning([{ id: "z" }]), null, "entité sans stats : jamais de NaN");
});

test("rankFuseWarning : toujours Commune, meilleur tirage des trois quel que soit sa position ou sa rareté", () => {
  const sel = [
    ent("a", "B", "Legendary", { summon_roll_pct: 68 }),
    ent("b", "B", "Common", { summon_roll_pct: 97.5 }),
    ent("c", "B", "Epic", { summon_roll_pct: 83 }),
  ];
  for (let i = 0; i < 3; i++) {
    const w = F.rankFuseWarning([...sel.slice(i), ...sel.slice(0, i)]);
    assert.strictEqual(w.targetRarity, "Common");
    assert.strictEqual(w.bestRollPct, 97.5);
  }
  const allLegendary = sel.map((b) => ({ ...b, rarity: "Legendary" }));
  assert.strictEqual(F.rankFuseWarning(allLegendary).targetRarity, "Common", "trois Légendaires donnent aussi une Commune");
});

test("rankFuseWarning : tirages absents ignorés, zéro conservé", () => {
  const sel = [
    ent("a", "C", "Common"),
    ent("b", "C", "Rare", { summon_roll_pct: null }),
    ent("c", "C", "Epic", { summon_roll_pct: 0 }),
  ];
  assert.strictEqual(F.rankFuseWarning(sel).bestRollPct, 0);
  assert.strictEqual(F.rankFuseWarning(sel.map((b) => ({ ...b, summon_roll_pct: null }))).bestRollPct, null);
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
  // Ce qui part : les trois lignes détaillées + le total perdu.
  assert.match(modal, /FG_RANK_ALERT_LINE/, "chaque entité consommée doit être détaillée");
  assert.match(modal, /FG_RANK_ALERT_TOTALS/);
  // Ce qui arrive, et ce qui survit (reliques + cores rendus à l'inventaire).
  assert.match(modal, /FG_RANK_ALERT_NEW/, "l'entité produite (niveau 1) doit être annoncée");
  assert.match(modal, /FG_RANK_ALERT_EQUIP/, "le sort de l'équipement doit être dit");
  assert.match(modal, /FG_RANK_ALERT_COST/, "le coût doit être rappelé dans l'avertissement");
});

test("l'onglet de rang affiche le TYPE produit et le rang visé", () => {
  const b = fnBloc("ForgeRangs");
  assert.match(b, /F\.rankFuseTemplates/, "les types proposés viennent des trois entités");
  assert.match(b, /t\.sources/, "le libellé du type doit nommer TOUTES les entités sources (deux jumelles)");
  assert.match(b, /FG_RANK_TYPE/, "le choix de type doit être libellé");
  assert.match(b, /FG_RANK_TARGET/, "le rang visé doit être affiché");
  assert.match(b, /FG_RANK_SUCCESS/, "la réussite à 100 % doit être dite");
  assert.match(b, /FG_RANK_MAX/, "le refus du rang S doit être affiché");
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

// Deux rôles, deux mots : dans la fusion de rareté (2 → 1) une carte est CONSERVÉE ; ici les
// TROIS partent. « Sacrifiée » y faisait croire qu'une des trois serait gardée.
test("la grille de rang dit « consommée », jamais « sacrifiée »", () => {
  const b = fnBloc("ForgeRangs");
  assert.match(b, /FG_CONSUMED/, "les trois entités consommées doivent être dites consommées");
  assert.ok(!/FG_SACRIFICED/.test(b),
    "« sacrifiée » appartient à la fusion de rareté 2 → 1 : pas de mot ambigu ici");
});

// La rareté Commune et le meilleur tirage conservé doivent être dits AVANT de valider.
test("la qualité conservée et la règle de type sont annoncées avant la validation", () => {
  const b = fnBloc("ForgeRangs") + fnBloc("RankFuseWarningModal");
  assert.match(b, /FG_RANK_ALERT_QUALITY/, "la modale doit annoncer la rareté Commune et les stats de création conservées");
  const hint = I18N.match(/FG_RANK_HINT: \{ FR: "([^"]+)"/);
  assert.ok(hint, "FG_RANK_HINT introuvable");
  assert.match(hint[1], /meilleur tirage/, "l'onglet doit rappeler la meilleure qualité conservée");
  const typeHint = I18N.match(/FG_RANK_TYPE_HINT: \{ FR: "([^"]+)"/);
  assert.ok(typeHint, "FG_RANK_TYPE_HINT introuvable");
  assert.match(typeHint[1], /Mineurs/, "trois Mineurs → un Mineur doit être dit explicitement");
});

test("la modale annonce Commune, le rang obtenu et le meilleur tirage avant confirmation en FR/EN/ZH", () => {
  const i18n = require("../i18n.js");
  const lang = i18n.getLang();
  const code = require("@babel/standalone").transform(fnBloc("RankFuseWarningModal"), { presets: ["react"] }).code;
  const modal = require("node:vm").runInNewContext(code + "\nRankFuseWarningModal;", {
    React: { createElement: (tag, props, ...children) => ({ tag, props, children }) },
    window: { Modal: "modal" }, I18N: i18n, rarityLabel: (rarity) => i18n.t(rarity), fmt: String,
  });
  const sel = [ent("a", "B", "Legendary", { summon_roll_pct: 70 }),
               ent("b", "B", "Common", { summon_roll_pct: 97.5 }),
               ent("c", "B", "Epic", { summon_roll_pct: 80 })];
  const warn = F.rankFuseWarning(sel);
  const text = (node) => node == null ? "" : Array.isArray(node) ? node.map(text).join("")
    : typeof node === "object" ? text(node.children) : String(node);
  const expected = {
    FR: "La carte produite sera de rareté Commune, rang A, avec les stats de création du meilleur tirage des trois (97.5 %).",
    EN: "The resulting card will have Common rarity, rank A, with the creation stats of the best roll of the three (97.5%).",
    ZH: "产出的卡牌稀有度将为普通，阶位为A，并保留三者中最佳抽取的初始属性（97.5%）。",
  };
  try {
    for (const language of ["FR", "EN", "ZH"]) {
      i18n.setLang(language);
      const render = (warning) => text(modal({ warn: warning, state: F.rankFuseState({ sel, balance: 15000 }) }));
      const rendered = render(warn);
      assert.ok(rendered.includes(expected[language]), language + " : résultat précis annoncé");
      assert.strictEqual(rendered.split(expected[language]).length, 2, "une seule ligne de qualité");
      assert.ok(rendered.indexOf(expected[language]) < rendered.indexOf(i18n.t("FG_RANK_ALERT_CONFIRM")), "résultat annoncé avant le bouton");
      assert.ok(render({ ...warn, bestRollPct: null }).includes(i18n.t("FG_RANK_ALERT_QUALITY", i18n.t("Common"), "A", "—")), "tirage absent : aucun faux zéro");
    }
  } finally {
    i18n.setLang(lang);
  }
});

// ---- 5. Réseau : la route de rang, le champ ticket, le miroir du serveur ----

test("l'action rankFuse appelle POST /forge/rank-fuse avec les 3 ids et le template choisi", () => {
  const i = APP.indexOf("async rankFuse(");
  assert.ok(i > 0, "action rankFuse absente");
  const b = APP.slice(i, APP.indexOf("\n    },", i));
  assert.match(b, /`\$\{API_URL\}\/forge\/rank-fuse`/);
  assert.match(b, /beast_ids: beastIds/);
  assert.match(b, /template_id: templateId/);
  assert.match(b, /status !== "ok"/, "seul status ok est un succès");
});

test("l'action rankFuse transmet les raretés mélangées et refuse toujours un autre rang", async () => {
  const start = APP.indexOf("async rankFuse(");
  const method = APP.slice(start, APP.indexOf("\n    },", start) + 6);
  const roster = [ent("a", "C", "Common"), ent("b", "C", "Epic"), ent("c", "C", "Legendary")];
  const calls = [];
  const rankFuse = require("node:vm").runInNewContext("({" + method + "}).rankFuse", {
    gRef: { current: { roster, wallet: "wallet-test", authToken: "test-token", liquid: 5000, locked: 0 } },
    D, I18N: { t: (key) => key }, API_URL: "https://example.invalid", svOpts: () => ({}),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return options.method === "POST"
        ? { json: async () => ({ status: "ok", beast: { rarity: "Common", rank: "B" }, new_rank: "B" }) }
        : { ok: false };
    },
  });
  const result = await rankFuse(["a", "b", "c"], "HashByte-1");
  assert.strictEqual(result.ok, true, "la confirmation doit accepter les raretés mélangées");
  assert.strictEqual(calls.length, 2, "fusion puis synchronisation existante");
  assert.strictEqual(calls[0].url, "https://example.invalid/forge/rank-fuse");
  assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
    wallet: "wallet-test", beast_ids: ["a", "b", "c"], template_id: "HashByte-1",
  });
  roster[2].rank = "B";
  const refused = await rankFuse(["a", "b", "c"], "HashByte-1");
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(refused.reason, "FG_RANK_MISMATCH");
  assert.strictEqual(calls.length, 2, "aucun appel en cas de rang différent");
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
                     "FG_RANK_SEL_MAX", "FG_RANK_SUCCESS", "FG_RANK_TARGET", "FG_RANK_MAX", "FG_RANK_BTN",
                     "FG_RANK_TYPE", "FG_RANK_TYPE_HINT", "FG_RANK_OK", "FG_RANK_ALERT_TITLE",
                     "FG_RANK_ALERT_BODY", "FG_RANK_ALERT_LINE", "FG_RANK_ALERT_TOTALS", "FG_RANK_ALERT_NEW",
                     "FG_RANK_ALERT_EQUIP", "FG_RANK_ALERT_COST", "FG_RANK_ALERT_CONFIRM", "FG_RANK_ALERT_BACK",
                     "FG_RANK_ALERT_QUALITY", "FG_CONSUMED",
                     "FG_SILVER", "FG_SILVER_PRICE", "FG_FUSE_BTN_SILVER", "FG_SILVER_SHORT", "FG_FUSE_SILVER_OK"]) {
    assert.match(I18N, new RegExp(`\\n    ${cle}: \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\},`),
      `${cle} absente ou incomplète`);
  }
});

test("la fusion de rang joue la cinématique de la Forge (mode rank) — et parle même si elle est sautée", () => {
  const debut = SCREENS.indexOf("async function doRankFuse");
  assert.ok(debut > 0, "doRankFuse introuvable dans screens.jsx");
  const bloc = SCREENS.slice(debut, SCREENS.indexOf("function RerollPreviewModal", debut));
  assert.ok(bloc.length > 0 && bloc.length < 6000, "fenêtre de lecture de doRankFuse incohérente");
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
});

// Demande fondateur du 03/11/2026 : l'équipement des entités consommées doit être retiré
// automatiquement, et le joueur doit le SAVOIR — pas le découvrir en fouillant l'inventaire.
test("l'équipement détaché est annoncé au joueur après la fusion", () => {
  const app = APP;
  assert.match(app, /equipment_detached/, "l'action lit le champ renvoyé par le serveur");
  assert.match(app, /equipmentDetached: Array\.isArray\(data\.equipment_detached\)/,
    "le champ est normalise (jamais undefined) avant d'atteindre l'écran");
  const b = fnBloc("ForgeRangs");
  assert.match(b, /FG_RANK_EQUIP_BACK/, "un second toast nomme le nombre d'items récupérés");
  assert.match(I18N, /FG_RANK_EQUIP_BACK: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+"/, "clé trilingue");
  // La modale doit dire la règle AVANT de valider, pas seulement après.
  const hint = I18N.match(/FG_RANK_ALERT_EQUIP: \{ FR: "([^"]+)"/);
  assert.match(hint[1], /retiré automatiquement/, "l'avertissement annonce le détachement automatique");
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
  assert.match(I18N, /FG_RANK_BAD_RANK: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+"/, "clé trilingue");
});
