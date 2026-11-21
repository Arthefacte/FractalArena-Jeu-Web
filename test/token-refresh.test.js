// Renouvellement glissant de session (serveur PR #127) : l'intercepteur fetch
// d'account-ui.js range le jeton frais et prévient app.jsx. Sans ce câblage,
// un joueur actif est déconnecté tous les 30 jours et repasse par le parcours
// de signature UniSat (vécu par le user le 2026-08-27).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ACC = read("account-ui.js");
const APP = read("app.jsx");
const API = "https://api.example.test";

function chargeIntercepteur() {
  function stockage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  const appels = [];
  const evenements = [];
  const win = {
    FA_API_URL: API,
    localStorage: stockage(),
    sessionStorage: stockage(),
    navigator: {},
    fetch(input, init) {
      const appel = { input, init };
      appel.promise = new Promise((resolve, reject) => Object.assign(appel, { resolve, reject }));
      appels.push(appel);
      return appel.promise;
    },
    dispatchEvent: (e) => evenements.push(e),
  };
  function CustomEvent(type, options) {
    this.type = type;
    this.detail = options && options.detail;
  }
  new Function("window", "localStorage", "sessionStorage", "CustomEvent", ACC)(
    win, win.localStorage, win.sessionStorage, CustomEvent);
  return { A: win.FA_ACCOUNT, win, appels, evenements };
}

function reponseRefresh(token) {
  return { headers: { get: (nom) => nom.toLowerCase() === "x-fa-token-refresh" ? token : null } };
}

test("account-ui.js : l'intercepteur lit x-fa-token-refresh et range via writeToken", () => {
  assert.match(ACC, /x-fa-token-refresh/, "l'en-tête du serveur doit être lu");
  assert.match(ACC, /installTokenRefresh/, "l'enveloppe fetch doit exister");
  // Le jeton passe par writeToken (même stockage que la connexion), jamais un setItem direct.
  const bloc = ACC.slice(ACC.indexOf("installTokenRefresh"));
  assert.match(bloc.slice(0, 2400), /writeToken\(neuf,\s*kindRequete\)/);
  assert.match(ACC, /fa:token-refresh/, "app.jsx doit pouvoir être prévenu");
});

test("account-ui.js : seuls les appels vers FA_API_URL sont inspectés", () => {
  const bloc = ACC.slice(ACC.indexOf("installTokenRefresh"));
  assert.match(bloc.slice(0, 1200), /FA_API_URL/,
    "sans ce filtre, chaque fetch tiers (UniSat, InSwap) serait inspecté pour rien");
});

test("app.jsx : écoute fa:token-refresh et aligne g.authToken", () => {
  assert.match(APP, /addEventListener\("fa:token-refresh"/);
  const idx = APP.indexOf('fa:token-refresh');
  const bloc = APP.slice(Math.max(0, idx - 600), idx + 600);
  assert.match(bloc, /authToken: t/,
    "l'état React doit adopter le jeton frais, sinon les Bearer suivants partent périmés");
});

test("une réponse de refresh arrivée après logout ne recrée aucun jeton", async () => {
  const { A, win, appels, evenements } = chargeIntercepteur();
  A.writeToken("ancien", A.KIND_GENERATED);
  const requete = win.fetch(`${API}/save/joueur`, {
    headers: { Authorization: "Bearer ancien" },
  });

  A.clearToken();
  appels[0].resolve(reponseRefresh("ressuscite"));
  await requete;
  await Promise.resolve();

  assert.strictEqual(A.readToken(), "", "la réponse pré-logout ne doit restaurer aucun Bearer");
  assert.strictEqual(A.readKind(), "", "le type de compte supprimé au logout doit rester absent");
  assert.deepStrictEqual(evenements, [], "React ne doit recevoir aucun refresh de l'ancienne session");
});

test("la génération bloque aussi une ancienne réponse après reconnexion avec le même jeton", async () => {
  const { A, win, appels, evenements } = chargeIntercepteur();
  A.writeToken("partage", A.KIND_UNISAT);
  const requete = win.fetch(`${API}/save/joueur`, {
    headers: { Authorization: "Bearer partage" },
  });

  A.clearToken();
  A.writeToken("partage", A.KIND_UNISAT);
  appels[0].resolve(reponseRefresh("ancien-refresh"));
  await requete;
  await Promise.resolve();

  assert.strictEqual(A.readToken(), "partage", "l'ancienne génération ne doit pas modifier la nouvelle session");
  assert.deepStrictEqual(evenements, [], "l'ancienne génération ne doit pas notifier React");
});

test("un refresh du Bearer courant conserve la rotation normale", async () => {
  const { A, win, appels, evenements } = chargeIntercepteur();
  A.writeToken("courant", A.KIND_GENERATED);
  const requete = win.fetch(`${API}/save/joueur`, {
    headers: { authorization: "Bearer courant" },
  });

  appels[0].resolve(reponseRefresh("frais"));
  await requete;
  await Promise.resolve();

  assert.strictEqual(A.readToken(), "frais", "le Bearer courant doit toujours pouvoir être renouvelé");
  assert.strictEqual(A.readKind(), A.KIND_GENERATED, "la rotation doit conserver le stockage du compte");
  assert.deepStrictEqual(evenements.map((e) => [e.type, e.detail.token]),
    [["fa:token-refresh", "frais"]], "React doit recevoir le jeton accepté");
});

test("un refresh sans Bearer authentifié est ignoré", async () => {
  const { A, win, appels, evenements } = chargeIntercepteur();
  A.writeToken("courant", A.KIND_GENERATED);
  const requete = win.fetch(`${API}/public`);

  appels[0].resolve(reponseRefresh("injecte"));
  await requete;
  await Promise.resolve();

  assert.strictEqual(A.readToken(), "courant", "une réponse publique ne doit pas remplacer la session");
  assert.deepStrictEqual(evenements, [], "une réponse publique ne doit pas notifier React");
});
