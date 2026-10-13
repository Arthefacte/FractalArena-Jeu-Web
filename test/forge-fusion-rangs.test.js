/* Fusion de rareté (75 % unique + tickets Argent) et fusion de RANG 3 → 1 — décisions
   fondateur du 13/10/2026, serveur déjà écrit (forge.js : FUSION_SUCCESS_RATE 0.75,
   FUSION_SILVER_TICKETS, RANK_FUSE_COSTS, POST /forge/rank-fuse).

   Ce que ces tests tiennent, dans l'ordre où ça coûte de l'argent au joueur :
     1. les barèmes miroirs du client sont EXACTEMENT ceux du serveur (un écart ici paie
        un prix que le serveur refuse, ou annonce une réussite fausse) ;
     2. la fusion de rang refuse un mélange de rang/rareté, une 4ᵉ entité et le rang S ;
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

test("rankSelToggle : même rang ET même rareté, 3 maximum, re-clic = retrait", () => {
  const a = ent("a", "B", "Rare"), b = ent("b", "B", "Rare"), c = ent("c", "B", "Rare");
  const s1 = F.rankSelToggle([], a);
  assert.deepStrictEqual(s1.map((x) => x.id), ["a"]);
  const s2 = F.rankSelToggle(s1, b);
  const s3 = F.rankSelToggle(s2, c);
  assert.strictEqual(s3.length, 3);
  assert.strictEqual(F.rankSelToggle(s3, ent("d", "B", "Rare")), null, "une 4ᵉ entité est refusée");
  assert.strictEqual(F.rankSelToggle(s2, ent("e", "A", "Rare")), null, "un autre rang est refusé");
  assert.strictEqual(F.rankSelToggle(s2, ent("f", "B", "Epic")), null, "une autre rareté est refusée");
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
  const sel = [ent("a", "C", "Common", { template_name: "HashByte-1", type: "HASH" }),
               ent("b", "C", "Common", { template_name: "Block-2", type: "BLOCK" }),
               ent("c", "C", "Common", { template_name: "HashByte-1", type: "HASH" })];
  const t = F.rankFuseTemplates(sel);
  assert.deepStrictEqual(t.map((x) => x.template_name), ["HashByte-1", "Block-2"], "pas de doublon");
  assert.deepStrictEqual(t.map((x) => x.label), ["HashByte", "Block"], "le libellé est le TYPE (affinités)");
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
  assert.strictEqual(F.rankFuseWarning(sel.slice(0, 2)), null, "rien à annoncer avant les 3 entités");
  assert.strictEqual(F.rankFuseWarning([{ id: "z" }]), null, "entité sans stats : jamais de NaN");
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
  assert.match(b, /FG_RANK_TYPE/, "le choix de type doit être libellé");
  assert.match(b, /FG_RANK_TARGET/, "le rang visé doit être affiché");
  assert.match(b, /FG_RANK_SUCCESS/, "la réussite à 100 % doit être dite");
  assert.match(b, /FG_RANK_MAX/, "le refus du rang S doit être affiché");
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
                     "FG_SILVER", "FG_SILVER_PRICE", "FG_FUSE_BTN_SILVER", "FG_SILVER_SHORT", "FG_FUSE_SILVER_OK"]) {
    assert.match(I18N, new RegExp(`\\n    ${cle}: \\{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \\},`),
      `${cle} absente ou incomplète`);
  }
});
