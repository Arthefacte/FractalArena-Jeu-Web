/* ============================================================
   FRACTAL ARENA — Mise a jour du client : decisions (pur, testable Node)

   Pourquoi. Un client ne se remplace pas tout seul. Quand le navigateur integre
   d'une app (app UniSat) ou une PWA installee ressert un index.html PERIME, le
   joueur execute un vieux client pendant des jours sans qu'aucun message ne le
   lui dise. Constate le 13/10/2026 : un plafond d'expedition affiche a 10 000
   alors que le serveur servait deja 20 000, la seule sortie etant de se
   deconnecter et de se reconnecter pour forcer un rechargement complet.

   Le service worker ne rattrape PAS ce cas : il purge son propre cache, mais il
   ne compare jamais ce que le joueur execute avec ce qui est servi, et un
   webview qui a garde le document n'appelle meme pas le worker.

   Ici : la lecture de la version servie et la decision d'afficher la bande
   « nouvelle version ». La peinture vit dans maj.jsx.
   ============================================================ */
(function () {
  const FICHIER = "version.json";        // ~15 octets, et hors cache CDN (Cloudflare ne met pas les .json en cache par defaut)
  const INTERVALLE_MS = 10 * 60 * 1000;  // une session ouverte finit par voir la livraison
  const CLE_VUE = "fa_maj_vue";          // sessionStorage : « vu, je rechargerai plus tard »

  /* Ce qu'on sait lire : le JSON servi « {"v":343} », un nombre nu, « v343 », ou la
     ligne « window.FA_ASSET_V = "343" » (acceptee au cas ou l'hebergeur refuserait de
     servir un .json). Une forme INCONNUE rend null (« je ne sais pas »), jamais 0 :
     0 se comparerait comme « plus ancien que tout » et ferait clignoter la bande a
     chaque sondage, y compris quand il n'y a rien a signaler. */
  function parseVersion(brut) {
    if (typeof brut === "number") return Number.isInteger(brut) && brut > 0 ? brut : null;
    if (typeof brut !== "string") return null;
    const t = brut.trim();
    if (!t || t.length > 400) return null;
    if (t.charAt(0) === "{") {
      try {
        const o = JSON.parse(t);
        const v = o ? (o.v !== undefined ? o.v : o.version) : null;
        return Number.isInteger(v) && v > 0 ? v : null;
      } catch (e) { return null; }
    }
    const nu = /^v?(\d{1,7})$/.exec(t);
    if (nu) return Number(nu[1]);
    const ligne = /FA_ASSET_V\s*=\s*"(\d{1,7})"/.exec(t);
    return ligne ? Number(ligne[1]) : null;
  }

  /* La version que CE client execute : celle publiee par data.js. */
  function versionLocale(w) {
    const win = w || (typeof window !== "undefined" ? window : null);
    return win ? parseVersion(win.FA_ASSET_V) : null;
  }

  /* Faut-il proposer de recharger ? Quatre refus, chacun pour une raison precise :
     - la version servie n'est pas STRICTEMENT plus recente — recharger ne changerait
       rien (et un cache plus vieux n'est pas un motif de rechargement) ;
     - l'une des deux versions est illisible — on ne devine pas ;
     - le joueur a deja vu CETTE version dans cette session — il a dit « plus tard » ;
     - une action est en cours (signature UniSat, combat, modale ouverte) : recharger
       la perdrait. */
  function doitProposer(ctx) {
    const c = ctx || {};
    const servie = parseVersion(c.servie);
    const locale = parseVersion(c.locale);
    if (servie === null || locale === null) return false;
    if (servie <= locale) return false;
    if (c.occupe) return false;
    if (String(c.vueLe || "") === String(servie)) return false;
    return true;
  }

  /* Memoire du « plus tard », par VERSION et non par simple drapeau : sinon la bande
     reviendrait a chaque livraison suivante dans la meme session, sans que le joueur
     ait rien demande. */
  function vueLe(stockage) {
    try { return (stockage || window.sessionStorage).getItem(CLE_VUE) || ""; } catch (e) { return ""; }
  }
  function marquerVue(servie, stockage) {
    try { (stockage || window.sessionStorage).setItem(CLE_VUE, String(servie)); } catch (e) {}
  }

  const API = { FICHIER, INTERVALLE_MS, CLE_VUE, parseVersion, versionLocale, doitProposer, vueLe, marquerVue };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.FA_MAJ = API;
})();
