// test/save-identity-guard.test.js — garde d'identite sur TOUS les resyncs /save
// (audit web 2026-09-08, P1#4).
//
// Scenario du bug : au demarrage, `wallet` est restaure du blob et l'UI est
// utilisable pendant que l'auto-connexion lit /save (plusieurs secondes sur
// mobile). Le joueur fait Options -> Deconnexion avant la reponse ->
// serverToState(save, addr, freshState) reecrivait wallet/liquid/roster SANS
// authToken : un « compte fantome ». La garde n'existait que dans le flux
// Expeditions ; elle est generalisee via un helper unique, applySave, qui
// compare le wallet ET le jeton captures A L'ENVOI a ceux de l'etat courant.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function bloc(marker, len) {
  const i = APP.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return APP.slice(i, i + (len || 1600));
}

// Les actions qui relisent /save apres une mutation (ou a la connexion).
const RESYNCS = [
  "async buyBoost(", "async fuse(", "async reroll(", "async rerollConfirm(", "async rerollDiscard(",
  "async summon(", "async relicSummon(", "async coreSummon(", "async relicFuse(", "async equipDisenchant(",
  "async expeditionsClaim(", "async expeditionsCraftRelic(", "async expeditionsCraftCore(",
  "async chooseTalent(", "async refreshLp(", "async rename(", "async setTitle(", "async marketResync(",
];

test("applySave existe et compare wallet + jeton captures a l'envoi, dans l'updater de setG", () => {
  const b = bloc("function applySave(save, addr, tokenAtRequest, patch)", 600);
  assert.match(b, /setG\(\(st\) => \{/, "la garde doit vivre dans l'updater (etat le plus frais, disconnect en file compris)");
  assert.match(b, /if \(st\.wallet !== addr \|\| st\.authToken !== tokenAtRequest\) return st;/,
    "compte OU jeton change depuis l'envoi => l'etat courant est rendu tel quel (aucune reecriture)");
  assert.match(b, /serverToState\(save, addr, st\)/, "le helper applique exactement serverToState(save, addr, st), comme avant");
  assert.match(b, /patch \? patch\(next, st\) : next/, "retouche optionnelle (boosts, selected) sur le nouvel etat");
});

test("chaque resync /save passe par applySave avec le wallet et le jeton lus AVANT l'await", () => {
  for (const name of RESYNCS) {
    const b = bloc(name, 2600);
    assert.match(b, /const s = gRef\.current;/, name + " : l'identite doit etre capturee a l'entree de l'action");
    assert.match(b, /applySave\(save, s\.wallet, s\.authToken[,)]/, name + " : la reponse /save doit passer par applySave(save, s.wallet, s.authToken)");
  }
});

test("aucun resync n'applique plus serverToState sans garde", () => {
  // Seules trois occurrences sont legitimes : la definition, le helper, et
  // connectWallet (garde inline sur le jeton, voir test suivant).
  const occurrences = APP.match(/serverToState\(/g) || [];
  assert.strictEqual(occurrences.length, 3, "serverToState( doit apparaitre 3 fois exactement (definition, applySave, connectWallet) — un resync a ete ajoute sans garde ?");
  assert.ok(!/setG\(\(st\) => serverToState\(/.test(APP), "resync nu setG((st) => serverToState(...)) interdit : passer par applySave");
  // Les fusions LOCALES des Expeditions (start/claim/recall) gardent leur garde
  // inline de jeton : ce ne sont pas des resyncs /save. Seule l'ancienne forme
  // « sv.ok && gRef.current.authToken === s.authToken » doit avoir disparu.
  assert.ok(!/sv\.ok && gRef\.current\.authToken === s\.authToken/.test(APP), "les anciennes gardes inline des resyncs /save des Expeditions doivent etre unifiees dans applySave");
});

test("connectWallet : la reponse /save est gardee sur le jeton capture a l'envoi (le wallet n'est pas encore en state a la premiere connexion)", () => {
  const b = bloc("async connectWallet(addr, token)", 3000);
  const capture = b.indexOf("const tokenAtRequest = token || (gRef.current && gRef.current.authToken) || \"\";");
  const fetchSave = b.indexOf("fetch(`${API_URL}/save/${addr}`, saveOpts)");
  assert.ok(capture > 0, "tokenAtRequest doit etre capture explicitement");
  assert.ok(capture < fetchSave, "le jeton doit etre capture AVANT l'envoi de la requete /save");
  const garde = b.indexOf("if (s.authToken !== tokenAtRequest) return s;");
  const applique = b.indexOf("const next = serverToState(save, addr, s);");
  assert.ok(garde > 0, "garde de jeton absente de connectWallet");
  assert.ok(garde < applique, "la garde doit preceder l'application de la save");
  // Pas de comparaison de wallet ici : connectUnisat / createAccount /
  // recoverAccount / claimDeviceLink appellent connectWallet AVANT que le
  // wallet soit en state — c'est serverToState qui le pose.
  const updater = b.slice(garde, applique);
  assert.ok(!/s\.wallet/.test(updater), "connectWallet ne doit pas comparer le wallet (bloquerait la premiere connexion)");
});

test("disconnect vide wallet et authToken : une reponse /save perimee ne peut plus passer la garde", () => {
  const b = bloc("disconnect() {", 300);
  assert.match(b, /clearToken\(\)/);
  assert.match(b, /setG\(\(s\) => \(\{ \.\.\.freshState\(\), lang: s\.lang, options: s\.options \}\)\)/,
    "freshState() remet wallet et authToken a \"\" : les deux comparaisons d'applySave echouent");
});
