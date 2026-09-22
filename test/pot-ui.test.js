// Cagnotte vue par le joueur : mise en forme (pot-ui.js), formulation (i18n.js) et
// surfaces qui l'affichent (Fosse, bandeau, Wallet). La règle d'éligibilité n'est pas
// ici — elle vit côté serveur (buyback.js → potEligibilityFor) et ces tests vérifient
// seulement que le client ne la contredit pas et n'invente aucun chiffre.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const FA_POT = require("../pot-ui.js");

globalThis.window = {};
require("../i18n.js");
const { T, t } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// Payload serveur réaliste (/wallet/fb-earned après l'ajout des blocs eligibility + pot).
function payload({ fights = 12, verified = true, linked = false, eligible = false, pot = true } = {}) {
  return {
    status: "ok",
    fb_earned_sats: "0",
    eligibility: {
      paid_fights_today: fights,
      fights_required: 150,
      fights_missing: Math.max(0, 150 - fights),
      wallet_verified: verified,
      wallet_linked: linked,
      eligible: eligible,
      destination: verified ? "bc1qdestination" : null,
    },
    pot: pot ? {
      total: 137000, threshold: 200000, fb_per_draw_sats: 100000000,
      pot_payout_count: 0, pot_total_paid_sats: 0, threshold_reached: false,
      countdown_ends_at: null, ready_to_draw: false, last_draw: null,
    } : null,
  };
}

// ---- Mise en forme ----

test("resume : rien tant que le serveur n'a rien dit (aucun compteur inventé)", () => {
  assert.strictEqual(FA_POT.resume(null), null);
  assert.strictEqual(FA_POT.resume({}), null);
  assert.strictEqual(FA_POT.resume({ eligibility: null }), null);
  assert.strictEqual(FA_POT.resume({ status: "ok", fb_earned_sats: "0" }), null);
});

test("resume : compteur du jour, progression et état du wallet", () => {
  const r = FA_POT.resume(payload({ fights: 12 }));
  assert.strictEqual(r.faits, 12);
  assert.strictEqual(r.requis, 150);
  assert.strictEqual(r.manquants, 138);
  assert.ok(Math.abs(r.progression - 0.08) < 1e-9);
  assert.strictEqual(r.verifie, true);
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.pot.seuil, 200000);
  assert.strictEqual(r.pot.part_sats, 100000000, "1 FB par tirage");
});

test("resume : fights_missing absent → recalculé, jamais NaN à l'écran", () => {
  const p = payload({ fights: 30 });
  delete p.eligibility.fights_missing;
  const r = FA_POT.resume(p);
  assert.strictEqual(r.manquants, 120);
  const p2 = payload({ fights: 200 });
  delete p2.eligibility.fights_missing;
  assert.strictEqual(FA_POT.resume(p2).manquants, 0, "jamais de manquant négatif");
});

test("resume : payload sans pot → résumé pot null, la ligne du joueur reste", () => {
  const r = FA_POT.resume(payload({ pot: false }));
  assert.strictEqual(r.pot, null);
  assert.strictEqual(r.requis, 150);
});

test("blocage : la vérification on-chain passe AVANT le compteur", () => {
  // 150 combats payants sans wallet vérifié ne paient rien (le tirage filtre
  // onchain_verified = TRUE) : le joueur doit lire ça, pas « 150/150 ✓ ».
  assert.strictEqual(FA_POT.blocage(FA_POT.resume(payload({ fights: 150, verified: false }))), "wallet");
  assert.strictEqual(FA_POT.blocage(FA_POT.resume(payload({ fights: 0, verified: false }))), "wallet");
  assert.strictEqual(FA_POT.blocage(FA_POT.resume(payload({ fights: 12, verified: true }))), "combats");
  assert.strictEqual(FA_POT.blocage(FA_POT.resume(payload({ fights: 150, verified: true, eligible: true }))), null);
  assert.strictEqual(FA_POT.blocage(null), null);
});

test("ligne : une clé i18n et une couleur par état", () => {
  const attention = FA_POT.ligne(FA_POT.resume(payload({ fights: 12, verified: false })));
  assert.strictEqual(attention.cle, "POT_LINE_WALLET");
  assert.strictEqual(attention.couleur, "var(--alert)");

  const enCours = FA_POT.ligne(FA_POT.resume(payload({ fights: 12 })));
  assert.strictEqual(enCours.cle, "POT_LINE_COMBATS");
  assert.deepStrictEqual(enCours.args, [12, 150]);
  assert.strictEqual(enCours.couleur, "var(--gold)");

  const rien = FA_POT.ligne(FA_POT.resume(payload({ fights: 0 })));
  assert.strictEqual(rien.couleur, "var(--text-dim)", "rien commencé : gris, pas d'alarme");

  const ok = FA_POT.ligne(FA_POT.resume(payload({ fights: 150, eligible: true })));
  assert.strictEqual(ok.cle, "POT_LINE_OK");
  assert.strictEqual(ok.couleur, "var(--success)");
});

test("fbTexte : sats → FB, 8 décimales natives, jamais « 0.00000000 »", () => {
  assert.strictEqual(FA_POT.fbTexte(100000000), "1.0000");
  assert.strictEqual(FA_POT.fbTexte(50000000), "0.5000");
  assert.strictEqual(FA_POT.fbTexte(0), "0");
  assert.strictEqual(FA_POT.fbTexte(null), "0");
  assert.strictEqual(FA_POT.fbTexte(12345), "0.000123", "en dessous de 0,01 : 6 décimales");
});

test("dureeTexte : compte à rebours court, ou rien s'il est écoulé", () => {
  const h = 3600 * 1000;
  assert.strictEqual(FA_POT.dureeTexte(18 * h + 4 * 60000), "18 h 04");
  assert.strictEqual(FA_POT.dureeTexte(47 * 60000), "47 min");
  assert.strictEqual(FA_POT.dureeTexte(51 * h + 30 * 60000), "2 j 03 h");
  assert.strictEqual(FA_POT.dureeTexte(0), null, "tirage dû : on ne compte pas à l'envers");
  assert.strictEqual(FA_POT.dureeTexte(-5000), null);
  assert.strictEqual(FA_POT.dureeTexte(NaN), null);
});

test("restantMs : seuil armé → temps restant, sinon rien", () => {
  // Marge d'une minute VOLONTAIRE : sans elle, `dureeTexte` arrondit à la minute et le
  // résultat dépendait du temps écoulé entre l'écriture de `dans` et la mesure — un
  // runner assez rapide (moins de 0,5 ms) affichait « 6 h 00 » au lieu de « 5 h 59 »,
  // ce qui a fait rougir la CI dès sa première exécution (22/09/2026).
  const dans = new Date(Date.now() + 6 * 3600 * 1000 - 60000).toISOString();
  const arme = FA_POT.resume(payload());
  arme.pot.arme = true;
  arme.pot.tirage_prevu = dans;
  assert.ok(FA_POT.restantMs(arme.pot) > 5 * 3600 * 1000);
  assert.strictEqual(FA_POT.dureeTexte(FA_POT.restantMs(arme.pot)), "5 h 59");

  const pasArme = FA_POT.resume(payload());
  assert.strictEqual(FA_POT.restantMs(pasArme.pot), null);

  const du = FA_POT.resume(payload());
  du.pot.arme = true;
  du.pot.tirage_prevu = new Date(Date.now() - 3600 * 1000).toISOString();
  assert.strictEqual(FA_POT.dureeTexte(FA_POT.restantMs(du.pot)), null, "tirage dû → POT_ARMED_NOW");
});

// ---- Formulation : les 3 langues, jamais une clé brute à l'écran ----

test("les clés de la cagnotte existent dans les 3 langues, non vides", () => {
  const cles = [
    "POT_RULE", "POT_LINE_COMBATS", "POT_LINE_WALLET", "POT_LINE_OK",
    "POT_ARMED", "POT_ARMED_NOW", "POT_PROGRESS", "POT_LAST_DRAW", "POT_NONE_YET", "POT_WL_DEST",
  ];
  for (const k of cles) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of LANGS) assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
  }
  // Les états de ligne() sont couverts : aucune clé calculée ne peut manquer.
  for (const etat of [{ fights: 12 }, { fights: 12, verified: false }, { fights: 150, eligible: true }]) {
    const l = FA_POT.ligne(FA_POT.resume(payload(etat)));
    assert.ok(T[l.cle], "état sans libellé : " + l.cle);
  }
});

test("les libellés se substituent (%d/%s) dans les 3 langues", () => {
  assert.strictEqual(t("POT_LINE_COMBATS", 12, 150), "12/150 combats payants aujourd'hui");
  const en = T.POT_LINE_COMBATS.EN.replace("%d", "12").replace("%d", "150");
  assert.ok(en.includes("12/150") && /today/i.test(en));
  assert.strictEqual(t("POT_LINE_OK"), T.POT_LINE_OK.FR);
  assert.ok(t("POT_ARMED", "18 h 04").includes("18 h 04"));
});

// ---- Surfaces : le joueur doit pouvoir la lire là où il joue ----

test("index.html charge pot-ui.js à la même version que les autres modules UI", () => {
  const html = lire("index.html");
  const mien = html.match(/<script src="pot-ui\.js\?v=(\d+)"><\/script>/);
  assert.ok(mien, "pot-ui.js doit être chargé par index.html");
  const autre = html.match(/<script src="dex-ui\.js\?v=(\d+)"><\/script>/);
  assert.strictEqual(mien[1], autre[1], "même cache-bust que les autres modules");
  assert.ok(html.indexOf("pot-ui.js") < html.indexOf("app.js"), "chargé avant l'application");
});

test("components.jsx : une seule requête alimente la Fosse, le bandeau et le Wallet", () => {
  const src = lire("components.jsx");
  assert.match(src, /function usePotEligibility\(wallet, token\)/);
  assert.match(src, /fetch\(window\.FA_API_URL \+ "\/wallet\/fb-earned"/,
    "l'éligibilité vient du serveur, jamais d'un calcul local");
  assert.match(src, /Authorization/, "route authed : le wallet du joueur, pas celui du voisin");
  assert.match(src, /setInterval\(\(\) => _potCharger\(wallet, token\), 60000\)/,
    "le compteur du jour doit se rafraîchir tout seul");
  assert.match(src, /if \(!r\) return null;/, "pas de chiffre affiché sans réponse serveur");
});

test("Fosse, bandeau et Wallet affichent tous la ligne (aucune surface oubliée)", () => {
  for (const f of ["fosse.jsx", "buyback.jsx", "screens.jsx"]) {
    const src = lire(f);
    assert.match(src, /usePotEligibility\(g\.wallet, g\.authToken\)/, f + " : état partagé");
    assert.match(src, /<PotLigne/, f + " : ligne affichée");
  }
});

test("la ligne ne promet rien quand rien n'est chargé (rendu null)", () => {
  const src = lire("components.jsx");
  const i = src.indexOf("function PotLigne(");
  const bloc = src.slice(i, src.indexOf("\n}", i) + 2);
  assert.match(bloc, /const r = etat && window\.FA_POT \? window\.FA_POT\.resume\(etat\) : null;/);
  assert.match(bloc, /if \(!r\) return null;/);
});
