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

// Payload serveur réaliste (/wallet/fb-earned après la pondération par jours de tâche).
// `jours` = days_qualified (les parts du joueur). `fenetre` = cycle_days : le serveur le
// publie toujours, mais la ligne ne l'affiche plus (un « sur N » se lisait comme un objectif
// de N jours pour remplir la cagnotte — la fenêtre se dit par ses dates).
function payload({ fights = 12, verified = true, linked = false, eligible = false, jours = 0, fenetre = 11, pot = true, taskDone = null } = {}) {
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
      days_qualified: jours,
      cycle_days: fenetre,
      task_done_today: taskDone == null ? fights >= 150 : taskDone,
      split_rule: "days_qualified_until_threshold",
    },
    pot: pot ? {
      total: 137000, threshold: 200000, fb_per_draw_sats: 100000000,
      pot_payout_count: 0, pot_total_paid_sats: 0, threshold_reached: false,
      countdown_ends_at: null, ready_to_draw: false, last_draw: null,
      cycle_started_at: "2026-09-20T17:43:01.185Z", cycle_ended_at: null,
      split_rule: "days_qualified_until_threshold",
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

  const ok = FA_POT.ligne(FA_POT.resume(payload({ fights: 150, eligible: true, jours: 3 })));
  assert.strictEqual(ok.cle, "POT_LINE_OK");
  assert.deepStrictEqual(ok.args, [3], "la ligne dit le POIDS : 3 jours validés, sans « sur N » de fenêtre");
  assert.strictEqual(ok.couleur, "var(--success)");
});

test("ligne : des jours validés sans combat aujourd'hui → encouragement, pas blocage", () => {
  // Le cœur du changement : la tâche du jour n'est plus une condition d'entrée. Un joueur qui
  // a validé 5 jours reste éligible même sans combat aujourd'hui — il perd une part, pas tout.
  const r = FA_POT.resume(payload({ fights: 0, eligible: true, jours: 5, fenetre: 11 }));
  assert.strictEqual(FA_POT.blocage(r), null, "5 jours validés : rien ne bloque");
  const l = FA_POT.ligne(r);
  assert.strictEqual(l.cle, "POT_LINE_DAYS_TODAY");
  assert.deepStrictEqual(l.args, [5]);
  assert.strictEqual(l.couleur, "var(--gold)");

  // Et aujourd'hui fait : même clé que le cas complet, avec le poids mis à jour.
  const fait = FA_POT.resume(payload({ fights: 150, eligible: true, jours: 6, fenetre: 11 }));
  assert.strictEqual(FA_POT.ligne(fait).cle, "POT_LINE_OK");
  assert.deepStrictEqual(FA_POT.ligne(fait).args, [6]);
});

test("ligne : serveur d'avant la pondération (days_qualified absent) → repli, jamais un jour inventé", () => {
  const p = payload({ fights: 150, eligible: true });
  delete p.eligibility.days_qualified;
  delete p.eligibility.task_done_today;
  const r = FA_POT.resume(p);
  assert.strictEqual(r.jours, null, "aucun nombre de jours fabriqué côté client");
  assert.strictEqual(FA_POT.ligne(r).cle, "POT_LINE_OK", "repli : éligible aujourd'hui");
  assert.deepStrictEqual(FA_POT.ligne(r).args, []);

  const p2 = payload({ fights: 12 });
  delete p2.eligibility.days_qualified;
  const r2 = FA_POT.resume(p2);
  assert.strictEqual(FA_POT.ligne(r2).cle, "POT_LINE_COMBATS", "repli : compteur du jour");
});

test("partAffichage : part unique quand les parts sont égales, fourchette sinon", () => {
  // Depuis la pondération, les parts d'un même tirage diffèrent : afficher `share_sats`
  // (la part d'un seul gagnant) ferait croire à un partage égal.
  const unique = FA_POT.partAffichage({ share_sats: 50000000, recipients: 2, at: "2026-09-26T10:00:00.000Z" });
  assert.strictEqual(unique.cle, "POT_LAST_DRAW");
  assert.deepStrictEqual(unique.args, ["0.5000", 2]);

  const fourchette = FA_POT.partAffichage({
    share_sats: null, share_min_sats: 10526315, share_max_sats: 28947368, total_sats: 100000000,
    recipients: 6, at: "2026-09-26T10:00:00.000Z",
  });
  assert.strictEqual(fourchette.cle, "POT_LAST_DRAW_RANGE");
  assert.deepStrictEqual(fourchette.args, ["0.1053", "0.2895", 6],
    "fbTexte : 4 décimales dès 0,01 FB — la fourchette suit la même mise en forme");

  assert.strictEqual(FA_POT.partAffichage(null), null, "aucun tirage : rien à afficher");
  assert.strictEqual(FA_POT.partAffichage({ recipients: 2 }), null, "part inconnue : on n'invente pas 0 FB");
});

test("resumePot : la fenêtre de comptage et la règle remontent au client", () => {
  const r = FA_POT.resumePot(payload().pot);
  assert.strictEqual(r.debut, "2026-09-20T17:43:01.185Z");
  assert.strictEqual(r.fin, null, "cagnotte en cours de remplissage : fenêtre ouverte");
  assert.strictEqual(r.regle, "days_qualified_until_threshold");
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
  // Marge de 30 s VOLONTAIRE : `dureeTexte` TRONQUE à la minute (Math.floor), et le
  // test mesurait `restantMs` après avoir construit `tirage_prevu` à Date.now() + 6 h.
  // Sur la machine de dev (quelques ms d'écart) on tombait sous 6 h → « 5 h 59 » ; sur
  // un runner plus rapide l'écart était de 0 ms → exactement 6 h → « 6 h 00 » et la CI
  // rougissait dès sa première exécution (22/09/2026). Se placer franchement SOUS la
  // frontière (30 s) rend le résultat indépendant du temps de parcours.
  const dans = new Date(Date.now() + 6 * 3600 * 1000 - 30000).toISOString();
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
    "POT_RULE", "POT_LINE_COMBATS", "POT_LINE_WALLET", "POT_LINE_OK", "POT_LINE_DAYS_TODAY",
    "POT_ARMED", "POT_ARMED_NOW", "POT_PROGRESS", "POT_LAST_DRAW", "POT_LAST_DRAW_RANGE",
    "POT_WINDOW", "POT_WINDOW_OPEN", "POT_NONE_YET", "POT_WL_DEST",
  ];
  for (const k of cles) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of LANGS) assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
  }
  // Les états de ligne() sont couverts : aucune clé calculée ne peut manquer.
  for (const etat of [{ fights: 12 }, { fights: 12, verified: false }, { fights: 150, eligible: true, jours: 3 }, { fights: 0, eligible: true, jours: 5 }]) {
    const l = FA_POT.ligne(FA_POT.resume(payload(etat)));
    assert.ok(T[l.cle], "état sans libellé : " + l.cle);
  }
});

test("la ligne des jours validés ne porte plus de dénominateur de fenêtre (« sur N » lu comme un objectif)", () => {
  // « 5 jours validés sur 11 » se lisait comme « il faut 11 jours pour que la cagnotte
  // atteigne son seuil ». Le seuil monte par ce qui est dépensé en jeu, pas par le
  // calendrier : la ligne ne dit que des jours validés, jamais un total de fenêtre.
  for (const lg of LANGS) {
    for (const k of ["POT_LINE_OK", "POT_LINE_DAYS_TODAY"]) {
      const s = T[k][lg];
      assert.strictEqual((s.match(/%d/g) || []).length, 1,
        `${k}.${lg} : un seul %d (les jours validés), pas de « sur N » : ${s}`);
    }
  }
  // Et la règle le dit noir sur blanc, dans les 3 langues.
  assert.match(T.POT_RULE.FR, /dépensé ou perdu en jeu/);
  assert.match(T.POT_RULE.EN, /no deadline/);
  assert.match(T.POT_RULE.ZH, /没有期限/);
});

test("les libellés se substituent (%d/%s) dans les 3 langues", () => {
  assert.strictEqual(t("POT_LINE_COMBATS", 12, 150), "12/150 combats payants aujourd'hui");
  const en = T.POT_LINE_COMBATS.EN.replace("%d", "12").replace("%d", "150");
  assert.ok(en.includes("12/150") && /today/i.test(en));
  const okFr = t("POT_LINE_OK", 5);
  assert.ok(okFr.includes("5"), "les jours validés se substituent");
  assert.ok(!/sur|out of/.test(okFr), "plus de dénominateur de fenêtre dans la ligne : " + okFr);
  assert.ok(t("POT_LINE_DAYS_TODAY", 5).includes("5"), "l'encouragement du jour se substitue");
  const range = T.POT_LAST_DRAW_RANGE.EN.replace("%s", "0.105263").replace("%s", "0.289474").replace("%d", "6");
  assert.ok(range.includes("0.105263") && range.includes("0.289474") && range.includes("6"),
    "les deux bornes de la fourchette se substituent");
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

test("Wallet : tirage et fenêtre passent par les helpers (plus jamais une part unique imposée)", () => {
  const src = lire("screens.jsx");
  assert.match(src, /window\.FA_POT\.partAffichage\(potR\.pot\.dernier\)/,
    "la part du dernier tirage vient du helper : valeur unique, ou fourchette si les parts diffèrent");
  assert.doesNotMatch(src, /I18N\.t\("POT_LAST_DRAW", window\.FA_POT\.fbTexte\(potR\.pot\.dernier\.share_sats\)/,
    "l'ancien affichage d'une part unique ne doit pas revenir (les parts sont pondérées)");
  assert.match(src, /I18N\.t\(potPart\.cle, \.\.\.potPart\.args, new Date\(potR\.pot\.dernier\.at\)\.toLocaleDateString\(\)\)/,
    "la clé et les arguments viennent du helper");
  assert.match(src, /I18N\.t\("POT_WINDOW_OPEN"/, "la fenêtre de comptage est dite au joueur");
  assert.match(src, /Date\.parse\(potR\.pot\.fin\) - 86400000/,
    "la borne haute du serveur est EXCLUSIVE : la surface affiche le dernier jour compté, pas le lendemain");
});

test("la ligne ne promet rien quand rien n'est chargé (rendu null)", () => {
  const src = lire("components.jsx");
  const i = src.indexOf("function PotLigne(");
  const bloc = src.slice(i, src.indexOf("\n}", i) + 2);
  assert.match(bloc, /const r = etat && window\.FA_POT \? window\.FA_POT\.resume\(etat\) : null;/);
  assert.match(bloc, /if \(!r\) return null;/);
});

test("un combat paye relit la ligne tout de suite (le cycle de 60 s n'est plus le seul chemin)", () => {
  // Le compteur du jour se compte en base (fight_history) : apres un combat paye, la
  // ligne doit etre relue sans attendre le prochain cycle. Verifie dans la FONCTION qui
  // traite la reponse de /fight, bornee des deux cotes (declaration suivante), sinon un
  // slice non borne passerait au vert en lisant tout le fichier.
  const src = lire("app.jsx");
  const debut = src.indexOf("async callFight({");
  assert.ok(debut > 0, "app.jsx doit porter l'action callFight");
  const bloc = src.slice(debut, src.indexOf("async buyBoost(", debut));
  assert.match(bloc, /if \(!free\) window\.FA_POT_REFRESH\?\.\(\);/,
    "un combat paye vient de faire bouger le compteur : la ligne se relit ici, pas dans 60 s");

  // Et la relecture existe vraiment, exposee par l'etat partage (components.jsx).
  const comp = lire("components.jsx");
  assert.match(comp, /function rafraichirPot\(\)/);
  assert.match(comp, /_potCharger\(_potWallet, _potToken\)/, "la relecture repasse par le MEME chargeur partage");
  assert.match(comp, /window\.FA_POT_REFRESH = rafraichirPot/);
  assert.match(comp, /if \(_potAbonnes\.size === 0 \|\| !_potWallet \|\| !_potToken\) return;/,
    "sans surface affichee, aucune requete inutile");
});
