// « Les gains reclames ne sont pas credites » — signale en cours de parcours le
// 2026-07-28. Ils l'etaient bien en base ; c'est l'ecran qui ne bougeait pas.
// claimDiscovery ne touchait pas au solde affiche, la ou claimQuest applique le
// `new_locked` rendu par le serveur. Le joueur voyait « Reclame ✓ » sans voir son
// gain : dans un tutoriel qui promet « chacune rapporte », la promesse parait fausse.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function blocClaimDiscovery() {
  const i = APP.indexOf("async claimDiscovery");
  assert.ok(i > 0, "action claimDiscovery absente");
  return APP.slice(i, i + 1400);
}

test("la reclamation d'une etape rafraichit le solde affiche", () => {
  const bloc = blocClaimDiscovery();
  assert.match(bloc, /setG/,
    "sans mise a jour de l'etat, l'ecran garde l'ancien solde et le gain parait perdu");
  assert.match(bloc, /new_locked/, "le nouveau solde verrouille doit etre applique");
});

test("le solde liquide est applique aussi", () => {
  // creditEmission met le gain en liquide pour un compte verifie : ne rafraichir
  // que le verrouille laisserait ce joueur-la devant un chiffre fige.
  assert.match(blocClaimDiscovery(), /new_liquid/);
});

test("le client applique le solde du serveur, il ne l'additionne pas", () => {
  // locked + reward divergerait des qu'une autre source credite en parallele.
  const bloc = blocClaimDiscovery();
  assert.ok(!/locked\s*[:+]\s*[^,}]*\+\s*(reward|d\.reward)/.test(bloc),
    "le solde ne doit jamais etre recalcule cote client");
});
