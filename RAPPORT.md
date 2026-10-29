# Rapport — bouton ATTAQUER voyant et ticket Argent explicite

Branche : `Arthefacte/arene-ticket-voyant-2` — PR vers `main`, sans fusion.

## Contrat vérifié avant modification

- `app.jsx:242` initialise `ticketsSilver` depuis `save.tickets_silver`; `:327` prévoit zéro; `:1570/:1592` synchronise le stock avec le serveur.
- `app.jsx:3130-3131` décrémente déjà le stock après une réponse réussie avec `j.entry === "ticket"`, puis retourne cette réponse. Le client ne doit pas soustraire une seconde fois.
- Lecture seule de `C:/Users/PC/orca/workspaces/fractal-arena-server/ladder-unifie/pvp.js` : sauvegarde verrouillée à la ligne 531; ticket absent refusé à la ligne 563; débit d'un ticket à la ligne 564; transaction validée puis réponse `entry: dec.entry` aux lignes 678-679.
- Le chemin contre agent confirme le même contrat dans `ladder-cross.js` : verrouillage ligne 305, vérification/débit lignes 327-331, réponse ligne 434.

Aucun fichier serveur modifié. Le prix, le quota gratuit et les appels réseau restent inchangés.

## Avant / après — bouton du classement

Avant (`arene.jsx`, extrait) :

```jsx
<button className="btn btn-elec sm"
  disabled={busy || attackLock.current || defenseLock.current || !canAttack}
  onClick={() => onPickOpponent(row, false)}>
  {I18N.t("AR2_ATTACK")}
</button>
```

Après :

```jsx
<button className="btn arene-ladder-attack"
  disabled={busy || attackLock.current || defenseLock.current || !canAttack}
  onClick={() => onPickOpponent(row, false)}>
  <span aria-hidden="true">⚔</span>{I18N.t("AR2_ATTACK")}
</button>
```

La classe dédiée de `styles.css` pose le fond `var(--elec)`, le texte sombre, la graisse 800, l'espacement de lettres `.5px`, l'arrondi `3px`, le padding `6px 12px` et l'ombre `0 0 12px rgba(0,240,255,.35)`. Le découpage polygonal du bouton générique est retiré pour laisser apparaître l'arrondi et l'ombre. Désactivé, le bouton est gris, à opacité `.5`, avec curseur normal, sans ombre ni mouvement. Les lignes conservent `flex wrap`; le libellé du bouton reste sur une ligne.

## Avant / après — bouton Ticket Argent

Avant (`arene-ui.js` et `arene.jsx`, extraits) :

```js
function entryModes(cadence) {
  return [ /* … */ { key: "ticket", available: true } ];
}
const modes = AU.entryModes(pvp);
```

```jsx
<button className={cx("btn sm", entry === m.key && "on")}
  disabled={!m.available} onClick={() => setEntry(m.key)}>
  {/* branche ticket */}{I18N.t("AR2_TICKET")}
</button>
```

Après (extraits) :

```js
function entryModes(cadence, tickets) {
  // Stock unique : g.ticketsSilver, déjà synchronisé et débité par app.jsx.
  const count = tickets && Number.isFinite(tickets.ticketsSilver)
    ? Math.max(0, Math.floor(tickets.ticketsSilver)) : 0;
  return [ /* … */ { key: "ticket", available: count > 0, count } ];
}
const modes = AU.entryModes(pvp, g);
```

```jsx
<button className={cx("btn sm arene-entry-mode", m.available && entry === m.key && "on")}
  data-fa={`arene-entry-${m.key}`}
  title={m.key === "ticket" ? `${I18N.t("AR2_TICKET")} ×${m.count}` : undefined}
  aria-label={m.key === "ticket" ? `${I18N.t("AR2_TICKET")} ×${m.count}` : undefined}
  disabled={!m.available} onClick={() => setEntry(m.key)}>
  {/* branche ticket */}{`🎟 ×${m.count}`}
</button>
```

Le sélecteur affiche `🎟 ×3`, puis `🎟 ×0` grisé dès que l'état global change, sans rechargement. Le nom traduit « Ticket Argent » reste disponible à l'infobulle et au lecteur d'écran. Le groupe des modes peut revenir à la ligne sur mobile. Une sélection de ticket devenue vide bloque la confirmation; elle ne bascule pas automatiquement vers un paiement FA. La revanche garde son comportement.

## Débit visible au retour du combat

La fermeture du rejeu lit `result.entry`, donc le moyen de paiement confirmé par le serveur. Si c'est un ticket, le bandeau de statut de l'Arène (`data-fa="arene-entry-paid"`, `role="status"`) affiche le compte courant issu du même helper. Aucun second débit, aucune nouvelle requête. La notice disparaît au combat suivant et au changement de compte.

Nouvelle clé `AR2_TICKET_PAID` :

- FR : « Entrée payée avec 1 ticket Argent · reste %d ».
- EN : « Entry paid with 1 Silver ticket · %d left ».
- ZH : « 已用 1 张白银券入场 · 剩 %d 张 ».

## Validation et livraison

- Dépendances installées par `npm ci --no-audit --no-fund`, aucune dépendance ajoutée.
- `npm run build` : 28 écrans et 17 empreintes régénérés par le pipeline. `build/arene.js` et `build/sources.json` changent; `build/app.js` et `asset-hashes.js` sont régénérés à contenu identique. Aucun fichier de `build/` édité à la main.
- Version de livraison/cache 428 → 429 dans `index.html`, `data.js`, `sw-policy.js`, `manifest.webmanifest`, `version.json` et les assertions de version existantes.
- Tests du helper : ticket à zéro indisponible, stock de trois disponible avec compte, stock absent/invalide traité comme zéro; quota gratuit inchangé.
- Nouveau parcours de rendu `test/arene-ticket.test.js` : classe/icône du classement, stock réactif, vrai `pvpAttack` extrait d'`app.jsx`, dernier ticket 1 → 0, confirmation après fermeture, FR/EN/ZH, refus sans débit/notice, réponse serveur prioritaire, revanche et changement de compte.
- L'assertion de source d'`arene-v2.test.js` suit la nouvelle garde du bouton de confirmation; les protections de défense restent vérifiées.
- Revue indépendante du code et du contrat serveur : aucune anomalie relevée.
- `npm test` : **1 362 tests, 1 356 réussis, 6 ignorés, 0 échec**. Aucun faux rouge SRI Windows rencontré.
- `node tools/asset-hashes.mjs --check` réussi; `git diff --check` propre.
- Limite : pas de validation visuelle dans un navigateur. L'accès navigateur CUA était indisponible; le repli Chrome natif a échoué sur expiration de l'autorisation de contrôle. La compacité mobile a été revue dans le CSS, le rendu et les parcours ont été vérifiés avec le harnais React simulé. Aucun combat en production.

Les modifications préexistantes de `BRIEF.md` et le dossier non suivi `mcp/` sont conservés hors commit.
