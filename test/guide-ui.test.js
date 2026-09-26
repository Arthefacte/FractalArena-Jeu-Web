// Guide de la première session — logique pure (guide-ui.js).
// Ce que le joueur doit voir à chaque moment de sa première session, sans DOM.
//
// Les six étapes viennent du SERVEUR, pour tous les comptes (GET /guide/state,
// qui les recompte depuis l'historique réel du joueur). Ce fichier vérifie la
// LECTURE de cette réponse ; plus aucune étape ne dépend d'un drapeau de
// navigateur. C'est ce mode local qui faisait dire au guide, dans le navigateur
// intégré de l'app UniSat, que la Tour et l'Arène restaient à faire à un joueur
// qui les avait faites sur son ordinateur.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GU = require("../guide-ui.js");

const ROOT = path.join(__dirname, "..");
const i18nSrc = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const guideSrc = fs.readFileSync(path.join(ROOT, "guide.jsx"), "utf8");
const T = {};
for (const m of i18nSrc.matchAll(/^\s{4}([A-Za-z0-9_]+):\s*\{[^\n]*?FR:\s*"/gm)) T[m[1]] = true;

const g0 = { roster: [{ id: "a", level: 1 }, { id: "b", level: 1 }, { id: "c", level: 1 }], selected: [], session: { wins: 0, losses: 0, net: 0 }, campaignProgress: {} };
// Réponse de GET /guide/state. `rewarded` = le compte est éligible au parcours
// RÉCOMPENSÉ (les claims n'existent que là) ; done/claimed sont les verdicts du
// SERVEUR, jamais ceux du client.
const etatFor = (done = [], claimed = [], rewarded = true) => ({
  rewarded,
  steps: GU.STEPS.map((s) => ({ id: s.id, target: 1, progress: done.includes(s.id) ? 1 : 0, done: done.includes(s.id), claimed: claimed.includes(s.id), reward: s.reward })),
});
const IDS = GU.STEPS.map((s) => s.id);

test("6 étapes, 675 FA : le parcours découverte du serveur, dans le même ordre", () => {
  assert.deepEqual(GU.STEPS.map((s) => s.id), ["d_win", "d_paid", "d_level", "d_camp", "d_tower", "d_pvp"]);
  assert.equal(GU.TOTAL_REWARD, 675);
});

test("chaque étape, chaque onglet et chaque mode ont leur texte dans i18n (FR/EN/ZH vérifiés ailleurs)", () => {
  for (const s of GU.STEPS) assert.ok(T["GUIDE_" + s.id.toUpperCase()], "clé manquante pour " + s.id);
  for (const k of ["GUIDE_PICK_TEAM", "GUIDE_ENTER_FOSSE", "GUIDE_CLAIM", "GUIDE_DONE", "GUIDE_STEP", "GUIDE_GO", "GUIDE_HIDE", "GUIDE_OK", "GUIDE_REWARD", "GUIDE_LABEL", "TUT_SG_T", "TUT_SG_B"]) assert.ok(T[k], "clé manquante " + k);
  for (const v of GU.TAB_HINTS) assert.ok(T[GU.tabHintKey(v)], "astuce manquante pour l'onglet " + v);
  assert.equal(GU.tabHintKey("options"), null, "pas d'astuce sur Options");
});

test("compte neuf, équipe vide : on commence par choisir 3 entités, sur l'onglet Équipe", () => {
  const r = GU.computeGuide({ disc: etatFor(), g: g0, view: "team" });
  assert.equal(r.mode, "do");
  assert.equal(r.step.id, "d_win");
  assert.equal(r.view, "team");
  assert.equal(r.target, "team-grid");
  assert.equal(GU.instructionKey(r), "GUIDE_PICK_TEAM");
  assert.equal(r.index, 0); assert.equal(r.total, 6);
  assert.equal(r.rewarded, true);
});

test("équipe complète, encore sur Équipe : le bouton d'entrée dans la Fosse ; sur la Fosse : le bouton Combat", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  const surEquipe = GU.computeGuide({ disc: etatFor(), g, view: "team" });
  assert.equal(surEquipe.target, "team-enter");
  assert.equal(GU.instructionKey(surEquipe), "GUIDE_ENTER_FOSSE");
  const surFosse = GU.computeGuide({ disc: etatFor(), g, view: "fosse" });
  assert.equal(surFosse.view, "fosse");
  assert.equal(surFosse.target, "fosse-fight");
  assert.equal(GU.instructionKey(surFosse), "GUIDE_D_WIN");
});

test("étape accomplie mais non réclamée : le guide envoie réclamer dans Quêtes, sur le bon bouton", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  const r = GU.computeGuide({ disc: etatFor(["d_win"]), g, view: "fosse" });
  assert.equal(r.mode, "claim");
  assert.equal(r.view, "quests");
  assert.equal(r.target, "quest-claim-d_win");
  assert.equal(r.reward, 50);
  assert.equal(GU.instructionKey(r), "GUIDE_CLAIM");
});

test("réclamée : on passe à la mise Bronze, puis au niveau 5, à la Campagne, la Tour, l'Arène", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  const seq = [];
  const ids = GU.STEPS.map((s) => s.id);
  for (let i = 0; i < ids.length; i++) {
    const r = GU.computeGuide({ disc: etatFor(ids.slice(0, i), ids.slice(0, i)), g, view: "fosse" });
    seq.push(r.step.id + ":" + r.target);
  }
  assert.deepEqual(seq, ["d_win:fosse-fight", "d_paid:fosse-bet-bronze", "d_level:fosse-fight", "d_camp:camp-fight", "d_tower:tour-start", "d_pvp:arene-attack"]);
});

test("tout réclamé : mode done, plus de cible", () => {
  const ids = GU.STEPS.map((s) => s.id);
  const r = GU.computeGuide({ disc: etatFor(ids, ids), g: g0, view: "team" });
  assert.equal(r.mode, "done");
  assert.equal(r.target, null);
  assert.equal(GU.instructionKey(r), "GUIDE_DONE");
});

test("compte UniSat qui a joué la Tour et l'Arène ailleurs : elles ne repassent plus « à faire »", () => {
  // Remplace le test qui figeait l'ANCIEN comportement (mode local piloté par des
  // drapeaux towerPlayed/pvpPlayed du navigateur). Il validait précisément le bug
  // constaté le 26/09/2026 : dans le navigateur intégré de l'app UniSat — celui
  // qu'on ouvre pour retirer ses gains — un joueur qui avait déjà tout fait sur son
  // ordinateur revoyait « Tour » puis « Arène » à faire, sans jamais pouvoir les
  // valider depuis là.
  const g = { ...g0, selected: ["a", "b", "c"], session: { wins: 3, losses: 1, net: 14 }, roster: [{ id: "a", level: 5 }, { id: "b", level: 2 }, { id: "c", level: 1 }], campaignProgress: { 0: { stars: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0] } } };
  // Le serveur recompte la progression RÉELLE et la sert à ce compte, même non
  // éligible au parcours récompensé : Tour et Arène y sont donc déjà faites.
  const r = GU.computeGuide({ disc: etatFor(IDS, [], false), g, view: "fosse" });
  assert.equal(r.mode, "done", "plus rien à faire : le guide se retire, il ne renvoie pas sur la Tour");
  assert.equal(r.rewarded, false);
  // Le même état serveur, plus tôt dans le parcours, guide toujours normalement.
  const enCours = GU.computeGuide({ disc: etatFor(["d_win"], [], false), g, view: "fosse" });
  assert.equal(enCours.step.id, "d_paid");
});

test("aucune étape ne porte plus de prédicat local, et guide.jsx n'écrit plus de drapeau de navigateur", () => {
  for (const s of GU.STEPS) assert.equal(s.local, undefined, s.id + " ne doit plus se décider dans le client");
  assert.doesNotMatch(guideSrc, /towerPlayed|pvpPlayed/, "les drapeaux « Tour jouée » / « Arène jouée » par navigateur ont disparu");
  assert.doesNotMatch(guideSrc, /fractal_arena_guide_flags_/, "plus de clé locale par wallet pour ces drapeaux");
  assert.match(guideSrc, /actions\.guideState\(\)/, "les étapes viennent de GET /guide/state");
  assert.match(guideSrc, /pushUiState\(\{ guide_hidden/, "le masquage du guide suit le COMPTE, pas le navigateur");
  assert.match(guideSrc, /pushUiState\(\{ guide_tabs/, "les onglets déjà vus suivent le COMPTE");
});

test("compte non récompensé : les étapes du SERVEUR servent aussi, Tour et Arène faites ailleurs comprises", () => {
  // Le cas du navigateur intégré d'UniSat : le joueur a déjà joué la Tour sur son
  // ordinateur. Le serveur le sait (tower_scores) ; le client, lui, ne le savait
  // que par un drapeau local — donc il le renvoyait sur une étape déjà faite.
  const g = { ...g0, selected: ["a", "b", "c"] };
  const debut = GU.computeGuide({ disc: etatFor([], [], false), g, view: "fosse" });
  assert.equal(debut.step.id, "d_win");
  assert.equal(debut.rewarded, false, "aucun montant n'est annoncé hors parcours récompensé");
  const apresCinq = GU.computeGuide({ disc: etatFor(IDS.slice(0, 5), [], false), g, view: "fosse" });
  assert.equal(apresCinq.step.id, "d_pvp", "la Tour est faite côté serveur : on passe à l'Arène, on n'y revient pas");
  const fini = GU.computeGuide({ disc: etatFor(IDS, [], false), g, view: "fosse" });
  assert.equal(fini.mode, "done");
  assert.equal(fini.rewarded, false);
});

test("une étape accomplie sans récompense ne propose JAMAIS de réclamer", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  const r = GU.computeGuide({ disc: etatFor(["d_win", "d_paid"], [], false), g, view: "fosse" });
  assert.equal(r.mode, "do");
  assert.equal(r.step.id, "d_level");
  assert.notEqual(r.view, "quests");
});

test("sans réponse du serveur, on ne guide RIEN plutôt que de guider faux", () => {
  for (const disc of [null, undefined, {}, { rewarded: false, steps: [] }]) {
    const r = GU.computeGuide({ disc, g: g0, view: "fosse" });
    assert.equal(r.mode, "done", "état inconnu : le guide se retire");
    assert.equal(r.target, null);
    assert.equal(r.rewarded, false);
  }
});

test("localSummary : niveau max, étages à étoiles, victoires — robuste à un état partiel", () => {
  const s = GU.localSummary({ roster: [{ level: 7 }, {}], campaignProgress: { 1: { stars: [1, 0, 2] }, 2: null }, session: { wins: 2 } });
  assert.equal(s.maxLevel, 7);
  assert.equal(s.campaignFloors, 2);
  assert.equal(s.sessionWins, 2);
  assert.equal(s.sessionNet, 0);
  assert.equal(s.selected, 0);
  const vide = GU.localSummary(undefined);
  assert.equal(vide.maxLevel, 1);
  assert.equal(vide.campaignFloors, 0);
});

test("index.html charge guide-ui.js avant les écrans et build/guide.js avant build/app.js", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const iUi = html.indexOf('src="guide-ui.js?v=');
  const iGuide = html.indexOf('src="build/guide.js?v=');
  const iApp = html.indexOf('src="build/app.js?v=');
  const iComponents = html.indexOf('src="build/components.js?v=');
  assert.ok(iUi > 0 && iUi < iComponents, "guide-ui.js doit précéder les écrans");
  assert.ok(iGuide > 0 && iGuide < iApp, "build/guide.js doit précéder build/app.js");
});

test("les cibles du guide existent dans les écrans (data-guide posés)", () => {
  const lire = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const src = ["screens.jsx", "fosse.jsx", "tour.jsx", "arene.jsx", "campaign.jsx", "quests.jsx"].map(lire).join("\n");
  for (const t of ["team-grid", "team-enter", "fosse-fight", "fosse-bet-bronze", "camp-fight", "tour-start", "arene-attack"]) {
    assert.ok(src.includes('data-guide="' + t + '"') || src.includes('"' + t + '"'), "cible absente des écrans : " + t);
  }
  assert.ok(src.includes('"quest-claim-" + s.id'), "les boutons Réclamer du parcours doivent porter quest-claim-<id>");
});
