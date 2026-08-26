# Burn — rangée du ticker économie (plan web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Afficher le cumul brûlé à jamais + le taux du miroir et son halving dans le ticker économie, alimenté par `GET /burn/status` (déployé, PR serveur #122/#123).

**Architecture:** `RangeeBurn` dans `buyback.jsx`, même patron que `RangeeDex` : fetch dans le `load()` existant, rien d'affiché tant que le serveur n'a pas répondu (jamais de valeur fabriquée). i18n FR/EN/ZH. Bump v211 → v212 (rituel 5 endroits).

**Spec:** `../fractal-arena-server/docs/superpowers/specs/2026-08-26-burn-miroir-halving-design.md` (§ Web)

## Global Constraints

- Texte joueur : « entité », jamais « bête » ; pas de repli client sur une donnée serveur.
- Rituel de bump complet : index.html (`?v=212`), data.js (`FA_ASSET_V = "212"`), sw-policy.js (`fa-v212`), test/account-wiring.test.js (2 assertions épinglées), manifest.webmanifest (5 icônes `?v=212`). Puis `npm run build` + `node --test --test-force-exit test/*.test.js`.

### Task 1 : i18n + RangeeBurn + styles + test source

**Files:** Modify `i18n.js` (~l.428, après les clés DEX), `buyback.jsx` (RangeeBurn + fetch), `styles.css` (~l.1028, après .bb-dex-item) ; Create `test/burn-row.test.js`.

- [ ] Test source (échoue d'abord) : `/burn/status` fetché dans buyback.jsx ; `RangeeBurn` rend null sans données ; clés BURN_* présentes en FR/EN/ZH.
- [ ] Clés i18n : `BURN_ROW` %s FA brûlés à jamais · `BURN_PROOF` preuve · `BURN_SUB` 1 dépensé = %s brûlé · halving à %s brûlés.
- [ ] `RangeeBurn({ burn })` : 🔥 + cumul + lien `https://fractal.unisat.io/address/<burn_address>` (preuve ↗) + sous-ligne taux/halving. Rendue après `<RangeeDex>`. Fetch `/burn/status` ajouté au `Promise.all` du `load()`.
- [ ] `.bb-burn` dans styles.css, calqué sur `.bb-dex` (flex, mono, 10.5px) avec le cumul en `var(--alert)` adouci ou `--gold`.
- [ ] Suite verte, commit.

### Task 2 : bump v212 + build + PR + déploiement

- [ ] Bump aux 5 endroits, `npm run build`, suite complète verte, commit (build/ inclus).
- [ ] PR → merge → attendre la fin du run GitHub Pages (ne PAS curl `?v=212` avant — leçon Cloudflare), vérifier l'origine via `&x=1`, puis validation par le user sur téléphone.
