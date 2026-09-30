// pot-ui.js — la cagnotte vue par le joueur : mise en forme PURE des chiffres reçus de
// /wallet/fb-earned (patron dex-ui.js : IIFE, window.FA_POT, testé par test/pot-ui.test.js).
// La RÈGLE n'est pas ici : elle vit dans buyback.js (potEligibilityFor) et redescend par
// l'API. Ce module ne fait que la rendre lisible et REFUSE de fabriquer un chiffre absent —
// un joueur qui lit « 0/150 » alors qu'il a 40 combats croirait à un bug.
//
// Répartition en vigueur (fondateur 30/09/2026) : le 1 FB du tirage n'est PLUS divisé à parts
// égales, il est réparti AU PRORATA DU NOMBRE DE JOURS où le joueur a rempli sa tâche
// (≥150 combats de Fosse payants sur un jour UTC = 1 jour validé = 1 part), comptés du début
// du remplissage de la cagnotte jusqu'au jour où elle atteint son seuil. D'où les deux chiffres
// servis par le serveur : `days_qualified` (mes parts) et `cycle_days` (la fenêtre).
(function () {
  "use strict";

  function entier(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Progression de la cagnotte elle-même : seuil (200 000 FA), part par tirage (1 FB),
  // compte à rebours quand le seuil est armé, dernier tirage (part unique ou fourchette),
  // et la fenêtre sur laquelle les jours de tâche sont comptés.
  function resumePot(p) {
    if (!p) return null;
    const total = entier(p.total) || 0;
    const seuil = entier(p.threshold) || 0;
    return {
      total: total,
      seuil: seuil,
      progression: seuil > 0 ? Math.min(1, total / seuil) : 0,
      part_sats: entier(p.fb_per_draw_sats) || 0,
      arme: !!p.threshold_reached,
      tirage_prevu: p.countdown_ends_at || null,
      pret: !!p.ready_to_draw,
      tirages: entier(p.pot_payout_count) || 0,
      total_paye_sats: entier(p.pot_total_paid_sats) || 0,
      dernier: p.last_draw || null,
      // Fenêtre de comptage des jours : `fin` reste null tant que le seuil n'est pas atteint,
      // et `debut` null tant que personne n'a versé un FA dans cette cagnotte.
      debut: p.cycle_started_at || null,
      fin: p.cycle_ended_at || null,
      regle: p.split_rule || null,
    };
  }

  // État d'affichage du joueur. null tant que le serveur n'a rien dit : les surfaces
  // masquent la ligne plutôt que d'afficher un compteur inventé.
  function resume(payload) {
    const e = payload && payload.eligibility;
    if (!e) return null;
    const requis = entier(e.fights_required) || 0;
    const faits = entier(e.paid_fights_today) || 0;
    const manquants = e.fights_missing != null ? entier(e.fights_missing) : (requis - faits);
    return {
      faits: faits,
      requis: requis,
      manquants: Math.max(0, manquants || 0),
      progression: requis > 0 ? Math.min(1, faits / requis) : 0,
      verifie: !!e.wallet_verified,
      lie: !!e.wallet_linked,
      eligible: !!e.eligible,
      destination: e.destination || null,
      // Le POIDS de la part : les jours de tâche validés. `jours` null = serveur d'avant la
      // pondération : les surfaces retombent alors sur le compteur du jour, jamais sur un
      // total inventé. La longueur de la fenêtre (`cycle_days`) n'est pas mappée : la ligne
      // ne s'en sert plus (cf. ligne()), la fenêtre se dit par ses dates.
      jours: entier(e.days_qualified),
      tache_du_jour: e.task_done_today != null ? !!e.task_done_today : faits >= requis,
      regle: e.split_rule || null,
      pot: resumePot(payload.pot),
    };
  }

  // Ce qui bloque, dans l'ordre où ça coince vraiment :
  //  1. la vérification on-chain — sans elle, les jours validés ne paient RIEN (le tirage
  //     filtre `ps.onchain_verified = TRUE`, même quand un wallet est déjà lié) ;
  //  2. le premier jour de tâche — tant qu'aucun jour n'est validé, il n'y a aucune part à
  //     recevoir. C'est la SEULE situation où le compteur du jour est un blocage : une fois
  //     un jour validé, ne rien faire aujourd'hui coûte une part, pas la totalité.
  // null = rien ne bloque.
  function blocage(r) {
    if (!r) return null;
    if (!r.verifie) return "wallet";
    if (!r.eligible) return "combats";
    return null;
  }

  // Ce que la ligne doit dire, sous forme de clé i18n + arguments : la formulation reste
  // dans i18n.js (3 langues), la logique reste ici (testable sans DOM).
  // Être éligible ne veut plus dire « j'ai fait mes 150 aujourd'hui » mais « j'ai des jours
  // validés » : la ligne dit donc le POIDS (mes jours validés), et n'affiche le compteur du
  // jour que quand il est le vrai obstacle (aucun jour encore validé).
  // Elle ne dit PAS la longueur de la fenêtre : « 5 jours validés sur 11 » se lisait comme
  // « il faut 11 jours pour que la cagnotte atteigne son seuil », alors que le seuil monte
  // par ce qui est dépensé en jeu, pas par le calendrier. La fenêtre se dit par ses dates
  // (POT_WINDOW / POT_WINDOW_OPEN), la ligne ne dit que des jours validés.
  function ligne(r) {
    const bl = blocage(r);
    if (bl === "wallet") return { cle: "POT_LINE_WALLET", args: [], couleur: "var(--alert)" };
    // Serveur sans pondération (déploiement décalé) : on n'invente pas un nombre de jours,
    // on retombe sur la formulation d'avant.
    if (r.jours == null) {
      return r.tache_du_jour
        ? { cle: "POT_LINE_OK", args: [], couleur: "var(--success)" }
        : { cle: "POT_LINE_COMBATS", args: [r.faits, r.requis], couleur: r.faits > 0 ? "var(--gold)" : "var(--text-dim)" };
    }
    if (bl === "combats") {
      return { cle: "POT_LINE_COMBATS", args: [r.faits, r.requis], couleur: r.faits > 0 ? "var(--gold)" : "var(--text-dim)" };
    }
    if (!r.tache_du_jour) {
      return { cle: "POT_LINE_DAYS_TODAY", args: [r.jours], couleur: "var(--gold)" };
    }
    return { cle: "POT_LINE_OK", args: [r.jours], couleur: "var(--success)" };
  }

  // Satoshis → FB lisible (8 décimales natives). Mêmes règles que le chip du header :
  // 4 décimales dès que c'est lisible, 6 en dessous, jamais « 0.00000000 ».
  function fbTexte(sats) {
    const v = (Number(sats) || 0) / 1e8;
    if (v === 0) return "0";
    return v >= 0.01 ? v.toFixed(4) : v.toFixed(6);
  }

  // Part d'un tirage : une valeur unique quand toutes les parts étaient égales, sinon la
  // fourchette (les jours validés diffèrent d'un compte à l'autre — c'est le cas normal depuis
  // la pondération). null si le serveur n'a rien dit : la surface n'affiche alors aucun montant
  // plutôt qu'un « 0 FB » faux. La date reste à la charge de la surface (dernier argument).
  function partAffichage(d) {
    if (!d) return null;
    if (d.share_sats != null) {
      return { cle: "POT_LAST_DRAW", args: [fbTexte(d.share_sats), entier(d.recipients) || 0] };
    }
    const mini = d.share_min_sats != null ? fbTexte(d.share_min_sats) : null;
    const maxi = d.share_max_sats != null ? fbTexte(d.share_max_sats) : null;
    if (mini === null || maxi === null) return null;
    return { cle: "POT_LAST_DRAW_RANGE", args: [mini, maxi, entier(d.recipients) || 0] };
  }

  // Durée restante avant le tirage, en texte court : « 18 h 04 », « 47 min », « 2 j 03 h ».
  // Zéro ou négatif → null (le tirage est dû, on ne compte plus à l'envers).
  function dureeTexte(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return null;
    const minutes = Math.floor(n / 60000);
    if (minutes < 60) return minutes + " min";
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return heures + " h " + String(minutes % 60).padStart(2, "0");
    return Math.floor(heures / 24) + " j " + String(heures % 24).padStart(2, "0") + " h";
  }

  // Millisecondes restantes avant le tirage armé (null si pas armé, ou déjà dû).
  function restantMs(pot, maintenant) {
    if (!pot || !pot.arme || !pot.tirage_prevu) return null;
    const fin = Date.parse(pot.tirage_prevu);
    if (!Number.isFinite(fin)) return null;
    return fin - (Number(maintenant) || Date.now());
  }

  const api = { resume, resumePot, blocage, ligne, partAffichage, fbTexte, dureeTexte, restantMs };
  if (typeof window !== "undefined") window.FA_POT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
