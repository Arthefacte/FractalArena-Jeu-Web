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

// ---- Rail de la première session (15/10/2026) ------------------------------
// Le guide disait l'étape sans rien retenir : les 14 onglets restaient ouverts, le
// ✕ masquait le guide pour de bon (drapeau du COMPTE), et la récompense obligeait à
// sortir du rail pour aller la chercher dans Quêtes. Ces tests tiennent les quatre
// décisions prises ensemble — un verrou sans issue serait pire que pas de verrou.

const appSrc = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
const questsSrc = fs.readFileSync(path.join(ROOT, "quests.jsx"), "utf8");

test("hors parcours : aucun verrou (un vétéran ne voit aucune différence)", () => {
  const r = GU.computeGuide({ disc: etatFor([], [], false), g: g0, view: "fosse" });
  assert.equal(GU.allowedViews(r), null, "compte non récompensé : pas de rail");
  const fini = GU.computeGuide({ disc: etatFor(IDS, IDS), g: g0, view: "team" });
  assert.equal(fini.mode, "done");
  assert.equal(GU.allowedViews(fini), null, "parcours terminé : les onglets se rouvrent");
  assert.equal(GU.allowedViews(null), null);
  assert.equal(GU.allowedViews({ mode: "do", rewarded: true, step: null }), null);
});

test("équipe incomplète : seule Équipe reste ouverte", () => {
  const r = GU.computeGuide({ disc: etatFor(), g: { ...g0, selected: [] }, view: "team" });
  assert.equal(r.target, "team-grid");
  assert.deepEqual(GU.allowedViews(r), ["team"], "tant que l'équipe n'est pas posée, la Fosse n'a rien à y faire");
});

test("l'étape ouvre SON onglet plus Équipe, et rien d'autre", () => {
  const g = { ...g0, selected: ["a", "b", "c"] };
  assert.deepEqual(GU.allowedViews(GU.computeGuide({ disc: etatFor(), g, view: "fosse" })), ["fosse", "team"]);
  const trois = ["d_win", "d_paid", "d_level"];
  const camp = GU.computeGuide({ disc: etatFor(trois, trois), g, view: "campaign" });
  assert.equal(camp.step.id, "d_camp");
  assert.deepEqual(GU.allowedViews(camp), ["campaign", "team"]);
  const quatre = trois.concat(["d_camp"]);
  const tour = GU.computeGuide({ disc: etatFor(quatre, quatre), g, view: "tour" });
  assert.equal(tour.step.id, "d_tower");
  assert.deepEqual(GU.allowedViews(tour), ["tour", "team"]);
  const cinq = quatre.concat(["d_tower"]);
  const arene = GU.computeGuide({ disc: etatFor(cinq, cinq), g, view: "arene" });
  assert.equal(arene.step.id, "d_pvp");
  assert.deepEqual(GU.allowedViews(arene), ["arene", "team"]);
});

test("étape accomplie non réclamée : le rail n'ouvre PAS Quêtes (le guide encaisse)", () => {
  const r = GU.computeGuide({ disc: etatFor(["d_win"]), g: { ...g0, selected: ["a", "b", "c"] }, view: "fosse" });
  assert.equal(r.mode, "claim");
  assert.deepEqual(GU.allowedViews(r), ["fosse", "team"]);
});

test("une étape passée d'office ne bloque plus le rail", () => {
  const disc = etatFor([], []);
  disc.steps = disc.steps.map((s) => (s.id === "d_win" ? { ...s, skipped: true } : s));
  const r = GU.computeGuide({ disc, g: { ...g0, selected: ["a", "b", "c"] }, view: "fosse" });
  assert.equal(r.mode, "do");
  assert.equal(r.step.id, "d_paid", "passée n'est pas réclamée : on avance, sans rien encaisser");
});

test("le rail est branché dans le composant : verrou publié, récompense encaissée, ✕ retiré", () => {
  assert.ok(guideSrc.includes("GU.allowedViews(res)"), "le composant lit la décision de guide-ui.js, il ne la refait pas");
  assert.ok(guideSrc.includes("window.FA_GUIDE_LOCK = "), "le verrou est publié pour app.jsx");
  assert.ok(guideSrc.includes("fa-guide-lock"), "et signalé par un événement à la barre de navigation");
  assert.ok(guideSrc.includes("actions.claimDiscovery("), "la récompense est encaissée sur l'écran de l'étape");
  assert.ok(guideSrc.includes("GUIDE_CLAIM_AUTO"), "plus d'ordre d'aller réclamer dans Quêtes");
  assert.ok(guideSrc.includes("actions.skipGuideStep("), "trois échecs → passage d'office, tranché par le serveur");
  assert.ok(guideSrc.includes("GU.FAIL_SKIP"), "le seuil vient de guide-ui.js, jamais recopié");
  assert.ok(guideSrc.includes("e.detail.won === false"), "les défaites viennent de l'instrumentation fetch d'app.jsx");
  assert.ok(guideSrc.includes('(!res.rewarded || res.mode === "done")'), "le ✕ n'existe plus pendant le parcours");
  assert.ok(guideSrc.includes("guide_hidden: false"), "un parcours en cours ne reste pas masqué (✕ d'avant la livraison)");
});

test("app.jsx ferme vraiment la porte : la garde est dans setView, pas seulement dans la nav", () => {
  assert.ok(appSrc.includes("function useGuideLock()"), "la barre de navigation lit le verrou publié");
  const i = appSrc.indexOf("    setView(v) {");
  assert.ok(i > 0, "setView existe toujours");
  const bloc = appSrc.slice(i, i + 500);
  assert.ok(bloc.includes("window.FA_GUIDE_LOCK"), "le verrou est lu au seul endroit qui change d'écran");
  assert.ok(bloc.includes("lock.on && !(lock.views || []).includes(v)"), "un onglet hors rail ne s'ouvre pas");
  assert.ok(bloc.includes("return;"), "le clic est refusé, pas seulement déconseillé");
  assert.ok(bloc.includes("GUIDE_LOCKED_TOAST"), "le refus s'explique au joueur");
  assert.ok(appSrc.includes("async skipGuideStep(stepId)"), "l'action réseau du passage d'office");
  assert.ok(appSrc.includes("/guide/skip"), "elle poste sur la route serveur");
  assert.ok(appSrc.includes("bloque(k)"), "les onglets fermés sont peints comme tels");
  assert.ok(appSrc.includes("locked={more.every(([k]) => bloque(k))}"), "même verdict sur le tiroir « Plus » mobile");
  assert.ok(appSrc.includes("ROUTES_COMBAT"), "les réponses de combat sont lues pour le signal de défaite");
});

test("le parcours ne laisse plus une ligne « à faire » à vie dans Quêtes", () => {
  assert.ok(questsSrc.includes("s.claimed || s.skipped"), "une étape passée ferme sa ligne comme une étape réclamée");
  assert.ok(questsSrc.includes("DISC_SKIPPED"), "et elle se nomme « passée », elle ne ment pas sur son état");
});

test("le guide n'apprend un combat qu'à la FIN du rejeu (pas 2 s après le lancement)", () => {
  // Vécu en Campagne le 15/10/2026 : le serveur tranche dès la requête, donc le
  // guide validait l'étape et créditait la récompense PENDANT l'animation.
  const lire = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(appSrc.includes("window.FA_COMBAT_VU = libereCombat"),
    "les écrans doivent avoir un point où dire « le joueur a vu le combat »");
  assert.ok(appSrc.includes("combatEnAttente = { url, won: true }"),
    "pour les routes de combat, le verdict est mis en attente, pas diffusé à la requête");
  assert.ok(appSrc.includes("setTimeout(libereCombat, 90000)"),
    "filet de sécurité : un écran qui oublierait l'appel ne doit pas figer le parcours");
  for (const [f, pourquoi] of [
    ["arene-battle.jsx", "Arène et Tour (rejeu partagé AreneBattle)"],
    ["campaign.jsx", "Campagne : à l'affichage du résultat, jamais à la requête"],
    ["fosse.jsx", "la Fosse : à la fin de son rejeu"],
  ]) {
    assert.ok(lire(f).includes("FA_COMBAT_VU"), "appel manquant dans " + f + " — " + pourquoi);
  }
});

test("la sortie du parcours : une fenêtre « bien joué », ouverte une fois par compte", () => {
  // Le parcours se terminait en silence : la barre disait « parcours terminé »
  // huit secondes puis s'effaçait, sans jamais dire au joueur qu'il avait fini
  // d'apprendre le jeu ni que la porte s'ouvrait.
  assert.ok(guideSrc.includes("GUIDE_FIN_T"), "la fenêtre de fin existe");
  assert.ok(guideSrc.includes("fermerFin"), "et elle se ferme (bouton + clic hors fenêtre)");
  assert.ok(guideSrc.includes('res.mode !== "done"'), "elle s'ouvre sur le verdict SERVEUR, jamais sur un compteur client");
  assert.ok(guideSrc.includes("annonce.current"), "une seule fois par session (le ? ne la rouvre pas)");
  assert.ok(guideSrc.includes("guide_hidden: true"), "le COMPTE retient qu'elle est passée — elle ne revient ni au rechargement ni sur un autre appareil");
  assert.ok(guideSrc.includes("!hidden && !fin"), "tant qu'elle est ouverte, la barre ne s'efface pas sous elle");
  for (const k of ["GUIDE_FIN_EYEBROW", "GUIDE_FIN_T", "GUIDE_FIN_B", "GUIDE_FIN_ARENE", "GUIDE_FIN_OK"]) {
    assert.ok(T[k], "clé i18n manquante : " + k);
  }
  // Ce qu'il reste du volet crypto (fondateur, 15/10/2026) : dit dans la fenêtre,
  // et choisi par la règle de l'écran Quêtes — jamais re-dérivé ici.
  assert.ok(guideSrc.includes("ACC.discoveryNextAction"), "la règle du volet crypto est appelée, pas réécrite");
  assert.ok(guideSrc.includes("actions.discoveryState()"), "l'état vient du serveur");
  assert.ok(guideSrc.includes("GUIDE_FIN_CRYPTO_"), "les trois cas ont leur texte");
  for (const k of ["GUIDE_FIN_CRYPTO_LINK", "GUIDE_FIN_CRYPTO_DUST", "GUIDE_FIN_CRYPTO_TXID"]) {
    assert.ok(T[k], "clé i18n manquante : " + k);
  }
});
