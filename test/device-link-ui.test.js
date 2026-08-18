// test/device-link-ui.test.js — logique pure de la liaison d'appareil + câblage.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

require("../device-link-ui.js");
const DL = global.window.FA_DEVICE_LINK;

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const HTML = lire("index.html");
const APP = lire("app.jsx");
const SCREENS = lire("screens.jsx");
const ACCOUNT = lire("account.jsx");

test("les constantes miroirent le serveur (si l'un bouge, l'autre doit bouger)", () => {
  // Valeurs recopiees de fractal-arena-server/device-link.js — le test fige la
  // symetrie cote client ; le serveur a la meme dans son propre depot.
  assert.strictEqual(DL.ALPHABET, "0123456789ABCDEFGHJKMNPQRSTVWXYZ");
  assert.strictEqual(DL.CODE_LEN, 16);
});

test("normalisation : tirets, espaces et minuscules acceptes, reste rejete", () => {
  assert.strictEqual(DL.normalizeLinkCode("abcd-2345-jkmn-pqrs"), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.normalizeLinkCode(" ABCD2345JKMNPQRS "), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.normalizeLinkCode("ABCD"), null);
  assert.strictEqual(DL.normalizeLinkCode("IIII2345JKMNPQRS"), null); // I hors alphabet
  assert.strictEqual(DL.normalizeLinkCode(null), null);
  assert.strictEqual(DL.normalizeLinkCode("A".repeat(100)), null);
});

test("codeFromInput : un lien complet collé vaut son code (pont mobile 2026-08-18)", () => {
  // Le pont vers l'app UniSat copie l'URL entière ; si le navigateur de l'app
  // n'offre pas de barre d'adresse, le joueur la colle dans « Récupérer mon
  // compte » — le champ doit en tirer le code au lieu de la rejeter.
  assert.strictEqual(DL.codeFromInput("https://fractalarena.com/#link=ABCD-2345-JKMN-PQRS"), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.codeFromInput("abcd-2345-jkmn-pqrs"), "ABCD2345JKMNPQRS", "un code nu passe comme avant");
  assert.strictEqual(DL.codeFromInput("https://fractalarena.com/"), null);
  assert.strictEqual(DL.codeFromInput("#link=ABCD2345JKMNPQRS"), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.codeFromInput(null), null);
});

test("parseLinkHash : accepte le format du QR, rejette tout le reste", () => {
  assert.strictEqual(DL.parseLinkHash("#link=ABCD-2345-JKMN-PQRS"), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.parseLinkHash("#link=abcd2345jkmnpqrs"), "ABCD2345JKMNPQRS");
  assert.strictEqual(DL.parseLinkHash("#link="), null);
  assert.strictEqual(DL.parseLinkHash("#autre"), null);
  assert.strictEqual(DL.parseLinkHash(""), null);
  assert.strictEqual(DL.parseLinkHash("#link=<script>"), null);
});

test("linkUrl et parseLinkHash sont symetriques", () => {
  const url = DL.linkUrl("https://fractalarena.com", "ABCD-2345-JKMN-PQRS");
  const hash = url.slice(url.indexOf("#"));
  assert.strictEqual(DL.parseLinkHash(hash), "ABCD2345JKMNPQRS");
});

test("cablage : scripts charges, gate montee, panneau present, recover branche", () => {
  assert.match(HTML, /vendor\/qrcode-generator\/qrcode\.js\?v=/);
  assert.match(HTML, /device-link-ui\.js\?v=/);
  assert.match(APP, /DeviceLinkClaimGate/);
  assert.match(APP, /claimDeviceLink/);
  assert.match(SCREENS, /DeviceLinkPanel/);
  assert.match(ACCOUNT, /claimDeviceLink/, "le champ de recuperation doit accepter un code de liaison");
});

test("le hash est lu au chargement, efface de la barre, et saute la cinematique", () => {
  const i = APP.indexOf("const BOOT_LINK_CODE");
  assert.ok(i > 0, "BOOT_LINK_CODE introuvable");
  const bloc = APP.slice(i, i + 600);
  assert.match(bloc, /parseLinkHash/, "le hash doit passer par la normalisation, jamais brut");
  assert.match(bloc, /replaceState/, "un lien de liaison ne doit pas survivre dans l'historique");
  assert.match(APP, /useState\(!!BOOT_LINK_CODE\)/,
    "l'arrivee par QR doit sauter la cinematique (le code expire en 2 minutes)");
});

test("la gate est montee AUSSI sans session (telephone vierge)", () => {
  // Les deux branches !g.wallet (cinematique + onboarding) doivent la rendre :
  // c'est precisement le telephone vierge qui scanne.
  const sansWallet = APP.slice(APP.indexOf("if (!g.wallet) {"), APP.indexOf("const VIEWS"));
  const occurrences = (sansWallet.match(/<DeviceLinkClaimGate \/>/g) || []).length;
  assert.strictEqual(occurrences, 2, "gate absente d'une branche sans-wallet");
});

test("le kind du compte vient du serveur, jamais devine", () => {
  const i = APP.indexOf("async claimDeviceLink");
  const bloc = APP.slice(i, i + 1600);
  assert.match(bloc, /d\.kind === "generated"/);
  assert.match(bloc, /KIND_UNISAT/);
});
