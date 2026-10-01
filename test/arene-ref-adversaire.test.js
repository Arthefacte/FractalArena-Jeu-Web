/* L'Arène envoyait une cible VIDE à chaque attaque — panne du 01/10/2026.
 *
 * Signalement joueur (en chinois) : « 竞技场报错：对手无效 » — « erreur d'Arène :
 * adversaire invalide », c'est-à-dire `cible_invalide` (i18n AR2_ERR_TARGET).
 *
 * La cause n'était pas le matchmaking : les cartes d'adversaires s'affichaient, avec
 * leur nom, leur ELO et leur puissance. C'est la CIBLE du combat qui partait vide.
 * `/pvp/opponents` publie `opponent_id` (identifiant opaque « j-… ») et ne publie plus
 * `wallet` (migration C2/E3, phase 2) ; `player_id`, lui, est le nom du champ du
 * CLASSEMENT (`/pvp/ladder`). Les deux boutons de la carte lisaient
 * `o.player_id || o.wallet` : deux champs absents de ce payload, donc
 * `target: undefined` — et un refus serveur sur TOUTES les attaques, pour tous les
 * joueurs, tant que le client n'était pas corrigé.
 *
 * Ces tests tiennent le contrat des deux côtés : la cible est l'identifiant que la
 * route publie effectivement, et l'adresse n'est plus une dépendance du client.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ARENE = lire("arene.jsx");

// Garde croisée web ↔ serveur : le dépôt serveur est SÉPARÉ (et privé), donc la CI du
// dépôt web ne le clone pas — un readFileSync inconditionnel fait échouer le run avec
// ENOENT. Les deux emplacements connus sont essayés (voisin direct du clone web, ou
// sous « Fractal Arena/ ») ; les vérifications serveur ne tournent que là où l'un des
// deux est présent, c'est-à-dire sur le poste de dev (même convention que
// test/forge-core-equipement.test.js).
// On lit la branche `origin/main` du voisin, PAS son fichier de travail : sur le poste
// de dev, plusieurs clones cohabitent et celui-ci peut être posé sur un chantier en
// cours (branche d'audit, travail non commité). C'est la branche déployée qui fait
// autorité sur le contrat, et la lire par git évite de faire échouer ce test au motif
// qu'un autre clone n'est pas à jour — un faux rouge apprend à ignorer un vrai.
const { execFileSync } = require("node:child_process");
const SRV_DIR = [
  path.join(__dirname, "..", "..", "fractal-arena-server"),
  path.join(__dirname, "..", "..", "Fractal Arena", "fractal-arena-server"),
].find((p) => fs.existsSync(path.join(p, "pvp.js")));
const SRV = (() => {
  if (!SRV_DIR) return null;
  try {
    return execFileSync("git", ["-C", SRV_DIR, "show", "origin/main:pvp.js"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) { return null; }
})();
const testServeur = SRV ? test : test.skip;

// ---- Côté client : ce que la carte adversaire envoie comme cible ----

test("la carte adversaire construit sa cible sur `opponent_id`", () => {
  assert.match(ARENE, /const oId = o\.opponent_id \|\| o\.wallet;/,
    "l'identifiant de l'adversaire doit venir de `opponent_id` (ce que publie /pvp/opponents)");
});

test("les boutons Attaquer ET Revanche désignent leur cible par `oId`", () => {
  // `pvpDefenseOf(ref)` + `target: ref` : les deux boutons de la carte. Le troisième
  // appel de l'écran (la posture de MA défense, en tête de composant) part de
  // `g.publicId || g.wallet` et ne passe pas par `ref` — il ne compte donc pas ici.
  const lignes = ARENE.split("\n").filter((l) => /actions\.pvpDefenseOf\(ref\)/.test(l));
  assert.strictEqual(lignes.length, 2,
    "attendu les deux boutons de la carte (Attaquer et Revanche), trouvé " + lignes.length);
  for (const l of lignes) {
    assert.match(l, /const ref = oId;/,
      "la cible partait d'un champ que /pvp/opponents ne publie pas (`player_id`/`wallet`) : " +
      "le serveur répond `cible_invalide` et le joueur lit « 对手无效 »");
    assert.match(l, /target: ref,/, "le tour d'attaque doit viser la même référence");
  }
});

test("aucun champ que /pvp/opponents ne publie n'est lu comme cible", () => {
  // `player_id` est le champ du CLASSEMENT (/pvp/ladder) et des autres surfaces
  // publiques ; l'écrire sur un adversaire de la liste est exactement l'erreur d'origine.
  assert.ok(!/\bo\.player_id\b/.test(ARENE),
    "`o.player_id` n'existe pas dans /pvp/opponents — la cible serait `undefined`");
  assert.ok(!/const ref = o\.wallet/.test(ARENE),
    "`wallet` est sorti du payload public des adversaires (phase 2) : repli mort");
});

// ---- Côté serveur : le contrat que le client doit suivre ----

testServeur("serveur (source de vérité) : /pvp/opponents publie `opponent_id`", () => {
  assert.match(SRV, /opponent_id: publicId\(o\.wallet\)/,
    "la route doit publier l'identifiant opaque sous `opponent_id`");
});

testServeur("serveur : `wallet` est SORTI du payload public des adversaires", () => {
  assert.match(SRV, /const \{ player_title, ordinal_name, ordinal_verified, linked_wallet, generated, wallet, \.\.\.pub \} = o;/,
    "l'adresse d'un autre joueur ne sort plus de /pvp/opponents — un client ne peut plus s'en servir");
});

testServeur("serveur : /pvp/attack accepte une adresse OU un identifiant (resoudreRef)", () => {
  assert.match(SRV, /const target = await resoudreRef\(pool, refCible\);/,
    "la cible doit passer par resoudreRef, sinon `j-…` est refusé en `cible_invalide`");
});
