"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");

test("les trois routes du parcours sont appelees", () => {
  assert.match(APP, /\/discovery\/state/);
  assert.match(APP, /\/discovery\/claim/);
  assert.match(APP, /\/discovery\/txid/);
});

test("les trois actions portent le Bearer du joueur", () => {
  for (const nom of ["discoveryState", "claimDiscovery", "submitDustTxid"]) {
    const i = APP.indexOf("async " + nom);
    assert.ok(i > 0, `action ${nom} absente`);
    const bloc = APP.slice(i, i + 1200);
    assert.match(bloc, /Authorization/, `${nom} n'authentifie pas sa requete`);
  }
});

test("le client n'annonce jamais sa propre progression", () => {
  const i = APP.indexOf("async claimDiscovery");
  // Sans cette garde, indexOf rend -1, slice part de la fin du fichier et le test
  // passerait alors meme que l'action n'existe pas.
  assert.ok(i > 0, "action claimDiscovery absente");
  const bloc = APP.slice(i, i + 1200);
  assert.ok(!/progress|done:/.test(bloc),
    "le claim ne doit envoyer que l'identifiant de l'etape : le serveur recompte");
});

test("les cas d'erreur du serveur sont distingues", () => {
  const i = APP.indexOf("async submitDustTxid");
  const bloc = APP.slice(i, i + 1400);
  assert.match(bloc, /poussiere_non_envoyee|dust/, "le cas « pas encore envoyee » a son message");
  assert.match(bloc, /txid_invalide|bad/, "le cas « mauvais txid » a le sien");
});

test("aucune action ne leve : elles rendent toutes {ok:false}", () => {
  for (const nom of ["discoveryState", "claimDiscovery", "submitDustTxid"]) {
    const i = APP.indexOf("async " + nom);
    const bloc = APP.slice(i, i + 1600);
    assert.match(bloc, /catch/, `${nom} doit capturer ses erreurs reseau`);
  }
});

// --- Ecart au plan, corrige ici (voir discovery.js:90-98 cote serveur) ---
// /discovery/txid NE declenche PAS l'envoi de l'airdrop : discovery.js ne peut pas
// requerir server.js (cycle), et le chemin /claim-airdrop existant — reservation
// atomique, creation d'inscription, envoi durable — ne doit pas etre duplique.
// Le serveur rend `airdrop_pending: true` et c'est au CLIENT d'enchainer. Sans cet
// appel, DISC_TXID_OK annonce « ton airdrop est en route » et rien ne part jamais.
test("un txid valide declenche reellement l'airdrop", () => {
  const i = APP.indexOf("async submitDustTxid");
  const bloc = APP.slice(i, i + 1800);
  assert.match(bloc, /claimAirdropIfNew|claim-airdrop/,
    "le serveur ne l'envoie pas lui-meme : sans cet appel, l'airdrop n'arrive jamais");
});

// PIEGE : /discovery/txid rend `wallet: row.linked_wallet` et son commentaire dit
// « le client l'appelle avec ce wallet ». C'est faux. /claim-airdrop exige
// `req.authenticated_wallet === req.body.wallet` (server.js:693) et le jeton du
// joueur est emis pour l'adresse de son COMPTE, pas pour son portefeuille lie :
// poster le portefeuille lie donne un 403 et l'airdrop ne part jamais. C'est le
// serveur qui redirige vers linked_wallet (`airdropTo`, server.js:713).
test("l'airdrop est reclame avec l'adresse du compte, celle du jeton", () => {
  const i = APP.indexOf("async submitDustTxid");
  assert.ok(i > 0, "action submitDustTxid absente");
  const bloc = APP.slice(i, i + 1800);
  assert.ok(!/claimAirdropIfNew\([^)]*d\.wallet/.test(bloc),
    "poster le portefeuille lie = 403 « Token ne correspond pas au wallet »");
  assert.match(bloc, /claimAirdropIfNew\(\s*s\.wallet/,
    "le serveur redirige lui-meme vers linked_wallet");
});
