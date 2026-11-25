// test/auth-epoch-guard.test.js — garde des authentifications asynchrones.
//
// Une approbation UniSat peut rester ouverte pendant une déconnexion ou un
// changement de compte. Ces assertions pincent la frontière de sécurité : toute
// continuation doit porter l'époque, le compte et le signataire capturés avant
// son premier await, puis les revalider avant d'installer des identifiants.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function bloc(debut, fin) {
  const i = APP.indexOf(debut);
  assert.ok(i >= 0, debut + " absent");
  const j = APP.indexOf(fin, i);
  assert.ok(j > i, fin + " absent après " + debut);
  return APP.slice(i, j);
}

test("déconnexion et remplacements invalident l'époque avant toute installation", () => {
  const disconnect = bloc("disconnect() {", "toggleSelect(");
  assert.ok(disconnect.indexOf("invalidateAuthentication(false)") < disconnect.indexOf("clearToken()"),
    "la déconnexion doit invalider les continuations avant de vider les identifiants");
  for (const action of ["async connectUnisat()", "async createAccount()", "async recoverAccount(code)", "async claimDeviceLink(code)"]) {
    const b = bloc(action, action === "async claimDeviceLink(code)" ? "// Historique des mouvements" :
      action === "async recoverAccount(code)" ? "// Liaison d'appareil — côté ÉMETTEUR" :
      action === "async createAccount()" ? "// Retour sur un compte généré" : "// Crée un compte + wallet");
    assert.match(b, /const replacement = invalidateAuthentication\(\);/,
      action + " doit ouvrir une nouvelle époque de remplacement");
    assert.match(b, /reason: "stale"/,
      action + " doit refuser une réponse appartenant à l'époque remplacée");
  }
});

test("chaque await primaire est suivi d'une revalidation d'identité", () => {
  const b = bloc("async _authenticate(context, signal) {", "async connectUnisat()");
  const awaits = b.match(/\bawait\b/g) || [];
  const guards = b.match(/if \(!authContextCurrent\(context\)\) return null;/g) || [];
  assert.strictEqual(awaits.length, 5, "challenge, JSON, signature, vérification et JSON doivent rester les cinq attentes primaires");
  assert.strictEqual(guards.length, awaits.length + 1,
    "chaque résultat asynchrone et chaque diagnostic doivent être rejetés si leur identité a changé");
  assert.match(b, /signal \? \{ signal \} : \{\}/, "le challenge réseau doit être annulable");
  assert.match(b, /\.\.\.\(signal \? \{ signal \} : \{\}\)/, "la vérification réseau doit être annulable");
});

test("les vols sont isolés par époque, compte et signataire", () => {
  const b = bloc("authenticate(addr, replacementContext) {", "async _authenticate(context, signal)");
  assert.match(b, /!replacementContext && authReplacementEpochRef\.current === authEpochRef\.current/,
    "une ancienne action ne doit pas ouvrir un nouveau vol pendant un remplacement intentionnel");
  assert.match(b, /const key = `\$\{context\.epoch\}:\$\{addr\}:\$\{signataire\}`;/,
    "deux comptes ou signataires ne doivent jamais partager leur promesse");
  assert.match(b, /authFlightsRef\.current\.get\(key\)/,
    "la déduplication doit consulter uniquement la clé complète");
  assert.match(APP, /for \(const flight of authFlightsRef\.current\.values\(\)\)[\s\S]{0,120}flight\.controller\.abort\(\)/,
    "une invalidation doit aussi annuler les fetch encore annulables");
});

test("l'installation réunit identité et jeton derrière la garde", () => {
  const b = bloc("function installAccount(context, account) {", "function installedAccountCurrent");
  const guard = b.indexOf("if (!authContextCurrent(context)");
  const storage = b.indexOf("writeToken(account.token, account.kind)");
  const react = b.indexOf("setG((s) =>");
  assert.ok(guard >= 0 && guard < storage && storage < react,
    "la garde doit précéder l'écriture du stockage et du state React");
  assert.match(b, /wallet: account\.wallet,[\s\S]{0,120}accountKind: account\.kind,[\s\S]{0,120}authToken: account\.token/,
    "wallet, genre et jeton doivent appartenir au même patch atomique");
  assert.match(b, /if \(account\.deviceLinked\) ACC\.markDeviceLinked\(\);/,
    "le statut d'appareil rejoint doit être installé dans le même commit gardé");
});

test("la reconnexion de démarrage s'arrête devant un remplacement plus récent", () => {
  const b = bloc("const didAutoConnectRef = useRef(false);", "// persist");
  assert.match(b, /r\.ok \|\| r\.reason === "stale"/,
    "un résultat périmé de connectUnisat ne doit jamais poursuivre avec l'ancien compte");
  const missing = b.indexOf("if (!token) return;");
  const connect = b.indexOf("await actions.connectWallet(w, token);");
  assert.ok(missing >= 0 && missing < connect,
    "une authentification sans jeton ne doit pas relancer une lecture anonyme de l'ancien compte");
});

