/* Minage : calculs déterministes et formatage. Aucune mesure ni activité de minage. */
(function () {
  "use strict";
  const textes = (typeof module !== "undefined" && module.exports ? require("./i18n.js") : window.FA_I18N).T;

  const BLOC_MS = 30000; // Hypothèse : un bloc toutes les 30 s.
  const BLOCS_PAR_JOUR = 2880; // 24 heures avec cette cadence.
  const REWARD_FB = 6.25; // Récompense de bloc post-halving retenue pour la simulation.
  const GH_PAR_COMPTE = 20; // Un mineur de référence correspond environ à une carte moyenne.
  const COMPTES_FALLBACK = 1000; // Toujours fixe : le classement ne fournit aucun total de comptes.

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
  function formaterNombre(n, lang = "FR") {
    return positif(n) ? nombre(n, lang, 0) : null;
  }

  const api = { BLOC_MS, BLOCS_PAR_JOUR, REWARD_FB, GH_PAR_COMPTE, COMPTES_FALLBACK,
    partReseau, fbParJour, probaParBloc, probaJour, tempsMoyenMs,
    formaterProba, formaterDuree, formaterFb, formaterGh, formaterNombre };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FA_MINAGE_UI = api;
})();
