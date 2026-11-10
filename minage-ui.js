/* Minage : calculs déterministes et formatage. Aucune mesure ni activité de minage. */
(function () {
  "use strict";
  const textes = (typeof module !== "undefined" && module.exports ? require("./i18n.js") : window.FA_I18N).T;

  // Valeurs par défaut, remplacées à l'exécution par le réseau Fractal réel.
  // Cible de bloc du réseau : 10 minutes (120 blocs/jour), et non 30 s.
  const BLOC_MS = 600000;
  const BLOCS_PAR_JOUR = 144;
  // Récompense lue sur le bloc de tête (extras.reward, en sats) ; 6,25 FB au halving du 9/09.
  const REWARD_FB = 6.25;

  // Réseau : hashrate dérivé de la difficulté réelle, difficulty * 2^32 / cible.
  // Un mineur à monGh face à ce réseau touche un bloc en réseauH / monGh × cible.
  function hashrateReseau(difficulte, cibleS) {
    if (!positif(difficulte) || difficulte <= 0 || !positif(cibleS) || cibleS <= 0) return null;
    const h = difficulte * Math.pow(2, 32) / cibleS;
    return Number.isFinite(h) ? h : null;
  }
  function tempsMoyenReseau(monGh, reseauH, cibleS) {
    if (!positif(monGh) || monGh <= 0 || !positif(reseauH) || reseauH <= 0 || !positif(cibleS) || cibleS <= 0) return null;
    const ms = (reseauH / (monGh * 1e9)) * cibleS * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  function fbParJourReseau(rewardFb, cibleS) {
    if (!positif(rewardFb) || !positif(cibleS) || cibleS <= 0) return null;
    return rewardFb * 86400 / cibleS;
  }

  const positif = (n) => Number.isFinite(n) && n >= 0;
  const partValide = (p) => positif(p) && p <= 1;

  function partReseau(monGh, totalGh) {
    if (!positif(monGh) || !positif(totalGh) || (monGh === 0 && totalGh === 0)) return null;
    const total = totalGh + monGh;
    // Évite le débordement de deux entrées finies très grandes.
    return Math.max(0, Math.min(1, Number.isFinite(total) ? monGh / total : 1 / (1 + totalGh / monGh)));
  }
  function fbParJour(part) { return partValide(part) ? part * BLOCS_PAR_JOUR * REWARD_FB : null; }
  function probaParBloc(part) { return partValide(part) ? part : null; }
  function probaJour(part) {
    if (!partValide(part)) return null;
    if (part === 0) return 0;
    // Équivalent à 1 - (1 - part)^BLOCS_PAR_JOUR, précis même pour une très petite part.
    return -Math.expm1(BLOCS_PAR_JOUR * Math.log1p(-part));
  }
  function tempsMoyenMs(part) {
    if (!partValide(part) || part === 0) return null;
    const ms = BLOC_MS / part;
    return Number.isFinite(ms) ? ms : null;
  }

  // La langue est un paramètre : pas de lecture de l'état global i18n dans les calculs.
  function texte(key, lang, ...args) {
    let index = 0;
    const entry = textes["minage." + key];
    return (entry[lang] || entry.FR).replace(/%[sd]/g, () => String(args[index++]));
  }
  function nombre(n, lang, maximumFractionDigits) {
    return new Intl.NumberFormat(texte("locale", lang), { maximumFractionDigits }).format(n);
  }
  function formaterProba(p, lang = "FR") {
    if (!partValide(p)) return null;
    if (p === 0) return texte("pourcentage", lang, "0");
    // Deux chiffres significatifs ; sous 0,01 %, aucun zéro final ajouté
    // au-delà du millième : 0,030 %, 0,006 %, mais 0,0061 % si nécessaire.
    const valeur = new Intl.NumberFormat(texte("locale", lang), {
      minimumSignificantDigits: p < 0.0001 ? 1 : 2,
      maximumSignificantDigits: 2,
    }).format(p * 100);
    return texte("pourcentage", lang, valeur);
  }
  function formaterDuree(ms, lang = "FR") {
    if (!positif(ms)) return null;
    const jours = Math.floor(ms / 86400000);
    if (jours >= 365) {
      const ans = Math.floor(jours / 365);
      return texte(ans === 1 ? "an" : "ans", lang, nombre(ans, lang, 0));
    }
    if (jours >= 1) return texte(jours === 1 ? "jour" : "jours", lang, nombre(jours, lang, 0));
    const minutes = Math.floor(ms / 60000);
    if (minutes >= 60) return texte("heuresMinutes", lang, nombre(Math.floor(minutes / 60), lang, 0), String(minutes % 60).padStart(2, "0"));
    if (minutes >= 1) return texte("minutes", lang, nombre(minutes, lang, 0));
    return texte("secondes", lang, nombre(Math.floor(ms / 1000), lang, 0));
  }
  function formaterFb(n, lang = "FR") {
    if (!positif(n)) return null;
    if (n > 0 && n < 0.001) return texte("fbPetit", lang);
    return texte("fb", lang, nombre(n, lang, 3));
  }
  function formaterGh(n, lang = "FR") {
    return positif(n) ? texte("gh", lang, nombre(n, lang, 1)) : null;
  }
  // Hashrate réseau en unités lisibles : PH/s, EH/s.
  function formaterHashrate(h, lang = "FR") {
    if (!positif(h) || h <= 0) return null;
    const unites = [[1e18, "EH/s"], [1e15, "PH/s"], [1e12, "TH/s"], [1e9, "GH/s"]];
    for (const [seuil, nom] of unites) {
      if (h >= seuil) return nombre(h / seuil, lang, h / seuil < 10 ? 2 : 1) + " " + nom;
    }
    return nombre(h, lang, 0) + " H/s";
  }
  // Lecture du réseau Fractal réel : difficulté du dernier bloc, hauteur et récompense.
  // Un seul appel mempool, aucun backend, aucun secret. Toute réponse douteuse est rejetée.
  const RESEAU_URL = "https://mempool.fractalbitcoin.io/api/blocks";
  function lireReseau(fetchFn) {
    if (typeof fetchFn !== "function") return Promise.reject(new Error("fetch absent"));
    return fetchFn(RESEAU_URL, { headers: { Accept: "application/json" } })
      .then((r) => { if (!r || !r.ok) throw new Error("HTTP " + (r && r.status)); return r.json(); })
      .then((liste) => {
        const blocs = (Array.isArray(liste) ? liste : []).filter((b) =>
          b && Number.isFinite(b.height) && Number.isFinite(b.difficulty) && b.difficulty > 1);
        if (!blocs.length) throw new Error("aucun bloc exploitable");
        // Le bloc de tête peut porter une difficulté d'ajustement : on garde le plus haut
        // bloc dont la difficulté est cohérente (le plus élevé des 15 rendus).
        const tete = blocs.reduce((a, b) => (b.height > a.height ? b : a));
        const hauteurs = blocs.slice().sort((a, b) => b.height - a.height).slice(0, 10);
        const difficulte = hauteurs.map((b) => b.difficulty).sort((a, b) => a - b)[Math.floor(hauteurs.length / 2)];
        const reward = (tete.extras && Number.isFinite(tete.extras.reward)) ? tete.extras.reward : null;
        return { etat: "ok", difficulte, reward, hauteur: tete.height };
      });
  }

  function formaterNombre(n, lang = "FR") {
    return positif(n) ? nombre(n, lang, 0) : null;
  }

  const api = { BLOC_MS, BLOCS_PAR_JOUR, REWARD_FB,
    hashrateReseau, tempsMoyenReseau, fbParJourReseau,
    partReseau, fbParJour, probaParBloc, probaJour, tempsMoyenMs,
    formaterProba, formaterDuree, formaterFb, formaterGh, formaterNombre, formaterHashrate,
    lireReseau, RESEAU_URL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FA_MINAGE_UI = api;
})();
