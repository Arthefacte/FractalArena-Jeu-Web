/* ============================================================
   FRACTAL ARENA — Arène unifiée : le joueur tire aussi des équipes d'AGENT

   Le serveur (`/pvp/opponents`, PR ladder unifié) publie désormais des défenses
   d'agent MÊLÉES aux défenses humaines : `opponent_kind` / `attack_path`, `agent: true`,
   `opponent_id` = uuid de l'agent, `team` déjà résolue. `/pvp/attack` accepte cet uuid et
   délègue lui-même au chemin croisé — le client n'appelle jamais `/pvp/attack-agent`.

   Ce que ces tests tiennent :
     1. la carte d'agent est ÉTIQUETÉE (clé i18n dans les trois langues, jamais un
        libellé en dur dans le composant) ;
     2. aucun bouton revanche sur une carte d'agent, même si une vieille adresse traîne
        dans la liste locale (`pvp.revanches`) ;
     3. le clic sur une carte d'agent n'appelle PAS `/pvp/defense/:ref` — cette route ne
        connaît que les humains (`resoudreRef` rend null sur un uuid → 400). Sans ce
        raccourci, « Adversaire invalide. » et aucun combat possible ;
     4. les refus du chemin croisé sont lisibles (jamais un code brut) ;
     5. un seul chemin d'attaque : pas de `/pvp/attack-agent` côté client.

   Le point 3 s'exécute pour de vrai : `estAgent` + `onPickOpponent` sont découpés du .jsx
   et évalués dans un contexte simulé (même procédé que arene-v2-actions.test.js).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

globalThis.window = {};
require("../i18n.js");
const I = globalThis.window.FA_I18N;
const { T } = I;
const LANGS = ["FR", "EN", "ZH"];

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const UI = read("arene.jsx");
const APP = read("app.jsx");

const start = UI.indexOf("  function estAgent(o) {");
const end = UI.indexOf("\n  async function onAttack(");
assert.ok(start > 0 && end > start, "estAgent / onPickOpponent introuvables dans arene.jsx");
// Le fragment est évalué TEL QUEL (aucune réécriture du source) : ses deux déclarations
// sont exposées par une ligne ajoutée à la fin.
const SNIPPET = UI.slice(start, end) + "\n; __fns = { estAgent: estAgent, onPickOpponent: onPickOpponent };";

function monter() {
  const appels = [];
  const picks = [];
  const toasts = [];
  const context = {
    busy: false,
    attackLock: { current: false },
    defenseLock: { current: false },
    canAttack: true,
    defenseRequest: { current: 0 },
    g: { selected: ["a1", "a2", "a3"] },
    setBusy: () => {},
    setPick: (p) => picks.push(p),
    toast: (msg, kind) => toasts.push({ msg, kind }),
    serverError: (code) => I.localizeServerError(code),
    actions: {
      pvpDefenseOf: async (ref) => {
        appels.push(ref);
        return { ok: true, team: [{ id: "h1" }, { id: "h2" }, { id: "h3" }], posture: "assaut" };
      },
    },
  };
  const fns = vm.runInNewContext(SNIPPET, context).__fns || context.__fns;
  return { fns, appels, picks, toasts, context };
}

const CARTE_AGENT = {
  agent: true, opponent_kind: "agent", attack_path: "agent",
  opponent_id: "3f1c0a52-8a41-4c8f-9d2b-7c1f1a2b3c4d", agent_id: "3f1c0a52-8a41-4c8f-9d2b-7c1f1a2b3c4d",
  name: "Agent Bâtisseur", rating: 1010, league: null, power: 1200, out_of_band: false,
  team: [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
};

test("arène unifiée : une carte d'agent est reconnue par opponent_kind, attack_path ou agent", () => {
  const { fns } = monter();
  assert.equal(fns.estAgent(CARTE_AGENT), true);
  assert.equal(fns.estAgent({ opponent_kind: "agent" }), true);
  assert.equal(fns.estAgent({ attack_path: "agent" }), true);
  assert.equal(fns.estAgent({ agent: true }), true);
  for (const humain of [null, undefined, {}, { opponent_kind: "human", attack_path: "wallet" }, { agent: false }]) {
    assert.equal(fns.estAgent(humain), false, `une carte humaine reste humaine : ${JSON.stringify(humain)}`);
  }
});

test("arène unifiée : le clic sur une carte d'agent n'appelle pas /pvp/defense (route des humains)", async () => {
  const { fns, appels, picks, toasts } = monter();
  await fns.onPickOpponent(CARTE_AGENT, false);
  assert.deepStrictEqual(appels, [], "aucun pvpDefenseOf sur une carte d'agent (l'uuid y répondrait wallet_invalide)");
  assert.equal(picks.length, 1, "la modale de combat doit s'ouvrir");
  const p = picks[0];
  assert.equal(p.target, CARTE_AGENT.opponent_id, "la cible est l'uuid de l'agent, jamais un wallet");
  assert.equal(p.agent, true);
  assert.equal(p.revanche, false, "un agent ne donne pas de revanche");
  assert.equal(JSON.stringify(p.oppTeam), JSON.stringify(CARTE_AGENT.team), "l'équipe affrontée vient de la carte (déjà résolue)");
  assert.equal(p.oppPosture, null, "la posture d'un agent n'est jamais exposée");
  assert.equal(p.ids.join(","), "a1,a2,a3", "la sélection du joueur est reprise telle quelle");
  assert.equal(toasts.length, 0);
});

test("arène unifiée : verrou d'attaque relâché après une carte d'agent", async () => {
  const { fns, context } = monter();
  await fns.onPickOpponent(CARTE_AGENT, false);
  assert.equal(context.attackLock.current, false);
});

test("arène unifiée : un adversaire humain garde sa lecture de défense et sa posture", async () => {
  const { fns, appels, picks } = monter();
  await fns.onPickOpponent({ opponent_id: "j-0123456789", wallet: "bc1qhumain", team: [] }, true);
  assert.deepStrictEqual(appels, ["j-0123456789"]);
  assert.equal(picks[0].target, "j-0123456789");
  assert.equal(picks[0].revanche, true);
  assert.equal(picks[0].oppPosture, "assaut", "la posture cachée reste lue pour un humain");
  assert.equal(picks[0].agent, undefined);
});

test("arène unifiée : la carte affiche l'étiquette d'agent et la clé existe en FR/EN/ZH", () => {
  assert.match(UI, /data-fa="arene-card-agent"[^>]*>\{I18N\.t\("AR2_AGENT_TAG"\)\}/,
    "la carte d'agent doit porter une étiquette tirée de i18n, pas un libellé en dur");
  assert.match(UI, /data-opponent-kind=\{agent \? "agent" : "human"\}/,
    "la carte doit exposer son type d'adversaire pour la QA");
  assert.ok(T.AR2_AGENT_TAG, "clé AR2_AGENT_TAG manquante");
  for (const lang of LANGS) {
    assert.ok(T.AR2_AGENT_TAG[lang] && T.AR2_AGENT_TAG[lang].trim().length > 0, `AR2_AGENT_TAG.${lang} vide`);
  }
});

test("arène unifiée : aucune revanche sur une carte d'agent, même avec une adresse locale", () => {
  const carte = UI.slice(UI.indexOf("const carte = (o) =>"), UI.indexOf("return <div style={{ display: \"flex\", flexDirection: \"column\", gap: 10 }}>"));
  assert.match(carte, /const agent = estAgent\(o\);/);
  assert.match(carte, /const canRevanche = !agent && Array\.isArray\(pvp\.revanches\)/,
    "la revanche doit être conditionnée à l'absence de marqueur agent");
  assert.match(carte, /\{canRevanche\s*\n?\s*\? <button className="btn btn-success sm"/,
    "le bouton revanche reste réservé aux humains");
});

test("arène unifiée : un seul chemin d'attaque, /pvp/attack-agent jamais appelé", () => {
  for (const src of [UI, APP]) {
    // Aucun APPEL à la route dédiée (un commentaire qui la nomme reste permis : c'est
    // précisément la règle qu'il documente).
    assert.doesNotMatch(src, /fetch\([^\n]*\/pvp\/attack-agent/, "le client ne doit pas appeler la route dédiée");
  }
  assert.match(APP, /await fetch\(`\$\{API_URL\}\/pvp\/attack`/,
    "l'attaque passe par /pvp/attack, qui délègue côté serveur");
});

test("arène unifiée : les refus du chemin croisé sont lisibles dans les trois langues", () => {
  const CODES = {
    agent_introuvable: "AR2_ERR_AGENT_GONE",
    cooldown_couple: "AR2_ERR_PAIR_COOLDOWN",
    defense_modifiee: "AR2_ERR_DEFENSE_CHANGED",
    cible_sans_equipe: "AR2_ERR_NO_GHOST",
    auto_attaque_interdite: "AR2_ERR_SELF",
    defense_tombee: "AR2_ERR_DEFENSE_DOWN",
    saison_pas_demarree: "AR2_ERR_NOT_STARTED",
    pas_de_defense: "AR2_ERR_NO_DEFENSE",
  };
  for (const lang of LANGS) {
    I.setLang(lang);
    for (const code of Object.keys(CODES)) {
      const msg = I.localizeServerError(code);
      assert.notStrictEqual(msg, code, `${lang}: ${code} s'affichait brut`);
      assert.notStrictEqual(msg, I.t("ERR_GENERIC"), `${lang}: ${code} tombait sur l'erreur générique`);
      assert.doesNotMatch(msg, /[a-z]+_[a-z_]+/, `${lang}: ${code} laisse un code serveur dans la phrase`);
    }
  }
  I.setLang("FR");
});

test("arène unifiée : le cooldown de couple dit les 48 h, sans chiffre recopié ailleurs", () => {
  for (const lang of LANGS) {
    I.setLang(lang);
    assert.match(I.localizeServerError("cooldown_couple"), /48/, `${lang}: la fenêtre de 48 h doit être dite`);
  }
  I.setLang("FR");
});
