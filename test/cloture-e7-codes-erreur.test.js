/* ============================================================
   FRACTAL ARENA — E7 : les codes d'erreur du serveur et le client

   Audit D10 (client web), findings F1 et F2 — décision E7 :
     « Mapper trade_frozen / listing_indisponible / account_frozen + un test qui
       échoue dès qu'un code serveur n'est pas mappé. »

   Le client ne peut pas lire le dépôt serveur depuis la CI de CE dépôt (deux dépôts,
   le serveur est privé) : la garde s'appuie donc sur un INSTANTANÉ versionné
   (`test/fixtures/server-error-codes.json`), prélevé sur le serveur par
   `tools/snapshot-server-codes.mjs`.

   Ce que ce test tient :
     1. les codes que les décisions E7 et F2 nomment sont MAPPÉS (le joueur lit une
        phrase, pas « Une erreur est survenue ») ;
     2. la dette de codes non mappés ne peut PAS augmenter : `DETTE_MAX` est gelée, et
        la baisser exige de mapper un code (elle ne peut donc que diminuer) ;
     3. l'instantané n'est pas périmé (180 jours) — sinon la garde protégerait l'état
        d'hier : la limite est volontaire, elle force à rejouer le prélèvement.

   Ce qu'il ne tient PAS, dit franchement : un code que le serveur ajoute et qui n'est
   jamais reporté dans l'instantané passe. La fraîcheur dépend du geste de régénération,
   et c'est pour ça que le point 3 existe.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const racine = path.join(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");

// Dette gelée : nombre de codes serveur que le client ne sait pas encore nommer.
// Ne peut que DIMINUER (mapper un code baisse le compte, il faut alors baisser ce nombre).
const DETTE_MAX = 68;
const PEREMPTION_JOURS = 180;

// Les codes que les décisions nomment explicitement, et ce que le joueur doit lire.
const EXIGES = [
  "trade_frozen", "listing_indisponible", "account_frozen", "withdraw_frozen", // E7 / F1 / F7
  "preuve_onchain_requise", "verification_requise", "palier_verrouille",        // F2
  "compte_reserve_au_retrait", "roster_insuffisant", "no_entry",                // F2
  "talent_invalide", "run_actif", "no_charges", "trop_rapide",                  // F2
  "session_revoked",                                                            // C4 : révocation de session
];

// Une entrée de T tient sur une ligne (`MKT_ERR_deja_vendu: { FR: "…", EN: "…", ZH: "…" }`)
// ou sur trois (les blocs EXP_ERR_* alignent FR/EN/ZH). On lit donc le BLOC entier.
function trilingue(src, positionCle) {
  const fin = src.indexOf("\n    },", positionCle);
  const bloc = src.slice(positionCle, fin > 0 ? fin : positionCle + 600);
  return /\bFR:/.test(bloc) && /\bEN:/.test(bloc) && /\bZH:/.test(bloc);
}

function codesMappesParLeClient() {
  const i18n = lire("i18n.js");
  const debut = i18n.indexOf("const SERVER_ERROR_KEYS = {");
  assert.ok(debut > 0, "SERVER_ERROR_KEYS introuvable dans i18n.js");
  const bloc = i18n.slice(debut, i18n.indexOf("};", debut));
  const serveur = new Set([...bloc.matchAll(/^\s{4}([a-z][a-z0-9_]*):\s*"/gm)].map((m) => m[1]));

  const market = lire("market.jsx");
  const md = market.indexOf("const MKT_ERR_KEYS");
  assert.ok(md > 0, "MKT_ERR_KEYS introuvable dans market.jsx");
  const marche = new Set([...market.slice(md, market.indexOf("];", md)).matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]));

  return new Set([...serveur, ...marche]);
}

test("E7 — les codes que les décisions nomment sont mappés côté client", () => {
  const mappes = codesMappesParLeClient();
  const manquants = EXIGES.filter((c) => !mappes.has(c));
  assert.deepStrictEqual(manquants, [], `codes exigés non mappés : ${manquants.join(", ")}`);
});

test("E7 — chaque code mappé a bien une phrase dans les trois langues", () => {
  const i18n = lire("i18n.js");
  // 1) la table du client : code serveur → clé de traduction
  const i2 = i18n.indexOf("const SERVER_ERROR_KEYS = {");
  const bloc = i18n.slice(i2, i18n.indexOf("};", i2));
  const paires = [...bloc.matchAll(/^\s{4}([a-z][a-z0-9_]*):\s*"([A-Za-z0-9_]+)"/gm)].map((m) => [m[1], m[2]]);

  // Market : les clés sont construites (`MKT_ERR_<code>`), on les retire de la liste des
  // codes à vérifier ici — elles passent en fait par les clés MKT_ERR_* ci-dessous.
  const market = lire("market.jsx");
  const md = market.indexOf("const MKT_ERR_KEYS");
  const mkt = [...market.slice(md, market.indexOf("];", md)).matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);

  // Attention : les clés de T sont alignées en colonnes (`AR2_ERR_TARGET:      { FR:`),
  // donc plusieurs espaces avant l'accolade — une comparaison littérale `cle: {` les
  // déclarait absentes à tort (erreur que ce test a faite avant d'être corrigé).
  const dansT = (cle) => i18n.search(new RegExp(`^    ${cle}: *\\{`, "m"));

  const manquants = [];
  for (const [code, cle] of paires) {
    const t = dansT(cle);
    if (t < 0) { manquants.push(`${code} → ${cle} (absente de T)`); continue; }
    if (!trilingue(i18n, t)) manquants.push(`${code} → ${cle} (langue manquante)`);
  }
  for (const code of mkt) {
    const t = dansT(`MKT_ERR_${code}`);
    if (t < 0) { manquants.push(`${code} → MKT_ERR_${code} (absente de T)`); continue; }
    if (!trilingue(i18n, t)) manquants.push(`${code} → MKT_ERR_${code} (langue manquante)`);
  }
  assert.deepStrictEqual(manquants, [], `clés sans phrase trilingue :\n  ${manquants.join("\n  ")}`);
});

test("E7 — la dette de codes non mappés ne peut pas augmenter", () => {
  const snap = JSON.parse(lire("test/fixtures/server-error-codes.json"));
  assert.ok(Array.isArray(snap.codes) && snap.codes.length > 50, "instantané suspect");
  const mappes = codesMappesParLeClient();
  const nonCouverts = snap.codes.map((c) => c.code).filter((c) => !mappes.has(c));
  assert.ok(
    nonCouverts.length <= DETTE_MAX,
    `la dette a AUGMENTÉ : ${nonCouverts.length} codes non mappés (plafond gelé ${DETTE_MAX}).\n` +
      `Mapper les nouveaux codes, ou baisser DETTE_MAX après avoir mappé.\n` +
      `Exemples : ${nonCouverts.slice(0, 12).join(", ")}`
  );
});

test("E7 — l'instantané des codes serveur n'est pas périmé", () => {
  const p = path.join(racine, "test/fixtures/server-error-codes.json");
  const jours = (Date.now() - fs.statSync(p).mtimeMs) / 86400000;
  assert.ok(
    jours <= PEREMPTION_JOURS,
    `instantané vieux de ${Math.round(jours)} jours : rejouer\n` +
      `  node tools/snapshot-server-codes.mjs <chemin du dépôt serveur>\n` +
      `puis vérifier que la dette n'a pas augmenté.`
  );
});

test("E7 — l'instantané date bien d'un commit serveur lisible", () => {
  const snap = JSON.parse(lire("test/fixtures/server-error-codes.json"));
  assert.match(snap.serveur_commit, /^[0-9a-f]{7,40}$/, "l'instantané doit porter le commit serveur prélevé");
  assert.ok(snap.fichiers_lus > 50, "l'instantané doit couvrir le dépôt serveur, pas un fichier");
});
