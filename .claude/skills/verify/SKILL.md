---
name: verify
description: Vérifier fractal-arena-web dans un navigateur réel (Playwright) — recette de lancement, seed d'état localStorage, pièges connus
---

# Vérifier fractal-arena-web (zero-build, Babel in-browser)

## Lancer

1. Serveur statique : n'importe lequel (node/python) à la racine du dépôt, port libre.
   Les `.jsx` doivent être servis avec un Content-Type JS quelconque (Babel les fetch en XHR).
2. Playwright global : `NODE_PATH="$(npm root -g)" node script.js` (playwright + chromium déjà installés).
3. Attendre `window.FA_TALENTS`/`window.FA_DATA` (modules purs) puis ~8 s (transpile Babel + rendu React).

## Atteindre l'écran Équipe avec un roster de test (sans wallet réel)

- **Sans `wallet` truthy dans l'état, l'app ne rend JAMAIS l'app-shell** : cinématique (`bouton PASSER`) puis Onboarding. Il FAUT seeder un wallet factice.
- Seed via `page.addInitScript` : intercepter `Object.defineProperty(window, "FA_TALENTS_UI", { set })`
  (dernier module pur chargé — `FA_DATA` et `FA_TALENTS` sont alors disponibles), y construire un roster
  avec `window.FA_DATA.starterRoster()` (3 bêtes) puis :
  `localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1q<factice>", options: { sound: false, anim: false, speed: 1 } }))`
  — `loadState()` (app.jsx) merge ce blob dans `freshState()`.
- `localStorage.setItem("fractal_arena_tutorial_v1", "1")` → pas d'overlay tutoriel.
- La modale « Cadeau de connexion » (LoginGate) peut apparaître quand même : fermer avec `Escape`.

## Pièges Playwright sur cette app

- **`options.anim: false` OBLIGATOIRE** : le canvas d'ambiance en rendu logiciel headless sature le main
  thread → tous les `locator.click/evaluate/screenshot` timeoutent de façon erratique.
- Les cartes ont des animations perpétuelles → l'actionnabilité (`stability`, `scrollIntoView`) ne converge
  jamais : cliquer via `locator.evaluate((el) => el.click())`, jamais `.click()` natif.
- `waitUntil: "domcontentloaded"` (jamais `"load"` : des ressources externes pendent).
- La croix ✕ des `Modal` a la classe `btn ghost sm` — pour compter/cliquer les vraies options d'une modale,
  filtrer `:not(.ghost)`.
- `innerText` des descriptions est en MAJUSCULES (text-transform CSS) → comparaisons insensibles à la casse.
- Erreurs console préexistantes normales : CSP `frame-ancestors` via meta, un 401 (fetch authentifié sans token).

## Flux vérifiables sans credentials

- Rendu Équipe, bandes reliques/talents, modales, verrouillage par niveau, i18n (boutons FR/EN/中文 dans le header).
- Actions authentifiées (`chooseTalent`, forge…) : le garde client `Wallet requis` se toast — le flux serveur
  réel exige un vrai wallet + token (non automatisable ici).
