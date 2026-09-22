// Guide de la première session — logique pure (guide-ui.js).
// Ce que le joueur doit voir à chaque moment de sa première session, sans DOM.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GU = require("../guide-ui.js");

const ROOT = path.join(__dirname, "..");
const i18nSrc = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const T = {};
for (const m of i18nSrc.matchAll(/^\s{4}([A-Za-z0-9_]+):\s*\{[^\n]*?FR:\s*"/gm)) T[m[1]] = true;

const g0 = { roster: [{ id: "a", level: 1 }, { id: "b", level: 1 }, { id: "c", level: 1 }], selected: [], session: { wins: 0, losses: 0, net: 0 }, campaignProgress: {} };
const discFor = (done = [], claimed = []) => ({
  eligible: true,
  steps: GU.STEPS.map((s) => ({ id: s.id, target: 1, progress: done.includes(s.id) ? 1 : 0, done: done.includes(s.id), claimed: claimed.includes(s.id), reward: s.reward })),
});

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
  const r = GU.computeGuide({ disc: discFor(), g: g0, flags: {}, view: "team" });
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
  const surEquipe = GU.computeGuide({ disc: discFor(), g, flags: {}, view: "team" });
  assert.equal(surEquipe.target, "team-enter");
  assert.equal(GU.instructionKey(surEquipe), "GUIDE_ENTER_FOSSE");
  const surFosse = GU.computeGuide({ disc: discFor(), g, flags: {}, view: "fosse" });
  assert.equal(surFosse.view, "fosse");
  assert.equal(surFosse.target, "fosse-fight");
  assert.equal(GU.instructionKey(surFosse), "GUIDE_D_WIN");
});

test("étape accomplie mais non réclamée : le guide envoie réclamer dans Quêtes, sur le bon bouton", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  const r = GU.computeGuide({ disc: discFor(["d_win"]), g, flags: {}, view: "fosse" });
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
    const r = GU.computeGuide({ disc: discFor(ids.slice(0, i), ids.slice(0, i)), g, flags: {}, view: "fosse" });
    seq.push(r.step.id + ":" + r.target);
  }
  assert.deepEqual(seq, ["d_win:fosse-fight", "d_paid:fosse-bet-bronze", "d_level:fosse-fight", "d_camp:camp-fight", "d_tower:tour-start", "d_pvp:arene-attack"]);
});

test("tout réclamé : mode done, plus de cible", () => {
  const ids = GU.STEPS.map((s) => s.id);
  const r = GU.computeGuide({ disc: discFor(ids, ids), g: g0, flags: {}, view: "team" });
  assert.equal(r.mode, "done");
  assert.equal(r.target, null);
  assert.equal(GU.instructionKey(r), "GUIDE_DONE");
});

test("compte UniSat (parcours serveur non éligible) : la progression se lit dans l'état local, sans récompense annoncée", () => {
  const g = { ...g0, selected: ["a", "b", "c"], session: { wins: 3, losses: 1, net: 14 }, roster: [{ id: "a", level: 5 }, { id: "b", level: 2 }, { id: "c", level: 1 }], campaignProgress: { 0: { stars: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0] } } };
  const sansTour = GU.computeGuide({ disc: { eligible: false, steps: [] }, g, flags: {}, view: "fosse" });
  assert.equal(sansTour.step.id, "d_tower");
  assert.equal(sansTour.rewarded, false);
  const apresTour = GU.computeGuide({ disc: null, g, flags: { towerPlayed: true }, view: "fosse" });
  assert.equal(apresTour.step.id, "d_pvp");
  const fini = GU.computeGuide({ disc: null, g, flags: { towerPlayed: true, pvpPlayed: true }, view: "fosse" });
  assert.equal(fini.mode, "done");
});

test("localSummary : niveau max, étages à étoiles, victoires — robuste à un état partiel", () => {
  const s = GU.localSummary({ roster: [{ level: 7 }, {}], campaignProgress: { 1: { stars: [1, 0, 2] }, 2: null }, session: { wins: 2 } }, null);
  assert.equal(s.maxLevel, 7);
  assert.equal(s.campaignFloors, 2);
  assert.equal(s.sessionWins, 2);
  assert.equal(s.sessionNet, 0);
  assert.equal(s.selected, 0);
  const vide = GU.localSummary(undefined, undefined);
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
